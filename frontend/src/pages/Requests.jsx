import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { Input, Textarea } from '../components/common/Input';
import { requestService } from '../services/requestService';
import { useAuth } from '../hooks/useAuth';
import {
  formatCurrency,
  formatPercent,
  formatPriceQuantity,
  formatRelativeTime,
  getStatusBadgeClass,
  getStatusLabel,
  getRequestTypeLabel
} from '../utils/formatters';

export function Requests() {
  const navigate = useNavigate();
  const { user, adminMode, isManagerOrAdmin } = useAuth();
  const canManage = isManagerOrAdmin();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('team'); // 'team', 'rejected', 'mine'
  const [statusFilter, setStatusFilter] = useState('pending');
  const [expandedId, setExpandedId] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDiscussModal, setShowDiscussModal] = useState(false);

  const [approveLoading, setApproveLoading] = useState(null); // 승인 중인 요청 ID
  const [rejectReason, setRejectReason] = useState('');
  const [discussTitle, setDiscussTitle] = useState('');

  const handleDelete = async (request) => {
    if (!window.confirm(`요청 "${request.ticker_name || request.target_ticker}"을(를) 정말 삭제하시겠습니까?\n\n연관된 토론도 함께 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.`)) return;
    try {
      await requestService.deleteRequest(request.id);
      fetchRequests();
    } catch (error) {
      alert(error.response?.data?.detail || '삭제에 실패했습니다.');
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [activeTab, statusFilter, user]);

  const fetchRequests = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let params = { limit: 50 };

      if (activeTab === 'mine') {
        // 내 요청 탭
        params.requester_id = user.id;
        if (statusFilter !== 'all') {
          params.status = statusFilter;
        }
      } else {
        // 팀 요청 탭 - 상태 필터 적용
        if (statusFilter !== 'all') {
          params.status = statusFilter;
        }
      }

      const data = await requestService.getRequests(params);
      setRequests(data.requests);
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (request) => {
    if (approveLoading) return;

    setApproveLoading(request.id);
    try {
      // 모달 없이 바로 승인 (요청자의 희망가/수량 사용)
      await requestService.approveRequest(request.id, {});
      fetchRequests();
    } catch (error) {
      alert(error.response?.data?.detail || '승인에 실패했습니다.');
    } finally {
      setApproveLoading(null);
    }
  };

  const handleReject = async () => {
    try {
      await requestService.rejectRequest(selectedRequest.id, rejectReason);
      setShowRejectModal(false);
      setRejectReason('');
      fetchRequests();
    } catch (error) {
      alert(error.response?.data?.detail || '거부에 실패했습니다.');
    }
  };

  const handleStartDiscussion = async () => {
    try {
      const result = await requestService.startDiscussion(selectedRequest.id, discussTitle);
      setShowDiscussModal(false);
      setDiscussTitle('');
      navigate(`/discussions/${result.discussion.id}`);
    } catch (error) {
      alert(error.response?.data?.detail || '토론 시작에 실패했습니다.');
    }
  };

  const openRejectModal = (request) => {
    setSelectedRequest(request);
    setShowRejectModal(true);
  };

  const openDiscussModal = (request) => {
    setSelectedRequest(request);
    setDiscussTitle(`${request.ticker_name || request.target_ticker} ${getRequestTypeLabel(request.request_type)} 논의`);
    setShowDiscussModal(true);
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold dark:text-gray-100">요청</h1>

      {/* Main Tabs */}
      <div className="flex gap-1 border-b dark:border-gray-700">
        <button
          onClick={() => { setActiveTab('team'); setStatusFilter('all'); }}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'team'
              ? 'border-primary-600 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          팀 요청 현황
        </button>
        <button
          onClick={() => { setActiveTab('mine'); setStatusFilter('all'); }}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'mine'
              ? 'border-primary-600 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          내 요청
        </button>
      </div>

      {/* Status Filters */}
      <div className="flex gap-2 flex-wrap">
        {activeTab === 'team' ? (
          // 팀 요청 현황: 전체, 대기중, 토론중, 승인됨, 거부됨
          ['all', 'pending', 'discussion', 'approved', 'rejected'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {status === 'all' ? '전체' : getStatusLabel(status)}
            </button>
          ))
        ) : (
          // 내 요청: 전체, 승인됨, 거부됨
          ['all', 'approved', 'rejected'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {status === 'all' ? '전체' : getStatusLabel(status)}
            </button>
          ))
        )}
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">로딩중...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">요청이 없습니다</div>
      ) : (
        <div className="grid gap-4">
          {requests.map(request => (
            <Card key={request.id}>
              <div className="flex flex-col">
                {/* 헤더 및 액션 버튼 */}
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="flex-1">
                    {/* 종목명, 상태 */}
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`badge ${request.request_type === 'buy' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                        {getRequestTypeLabel(request.request_type)}
                      </span>
                      <span className="font-bold text-lg dark:text-gray-100">{request.ticker_name || request.target_ticker}</span>
                      <span className="text-gray-500 dark:text-gray-400 text-sm">({request.target_ticker})</span>
                      <span className={`badge ${getStatusBadgeClass(request.status)}`}>
                        {getStatusLabel(request.status)}
                      </span>
                    </div>

                    {/* 요청자, 시간 */}
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      요청자: {request.requester.full_name} | {formatRelativeTime(request.created_at)}
                    </div>

                    {/* 매수 요청 기본 정보 */}
                    {request.request_type === 'buy' && (
                      <div className="flex flex-wrap gap-4 text-sm">
                        {request.buy_price && (
                          <span>
                            <span className="text-gray-500 dark:text-gray-400">희망 매수가: </span>
                            <span className="font-medium">{formatCurrency(request.buy_price, request.target_market)}</span>
                          </span>
                        )}
                        {request.order_quantity && (
                          <span>
                            <span className="text-gray-500 dark:text-gray-400">희망 수량: </span>
                            <span className="font-medium">{request.order_quantity}</span>
                          </span>
                        )}
                      </div>
                    )}

                    {/* 매도 요청 기본 정보 */}
                    {request.request_type === 'sell' && (
                      <div className="flex flex-wrap gap-4 text-sm">
                        <span>
                          <span className="text-gray-500 dark:text-gray-400">매도 수량: </span>
                          <span className="font-medium">{request.sell_quantity}</span>
                        </span>
                        {request.sell_price && (
                          <span>
                            <span className="text-gray-500 dark:text-gray-400">매도가: </span>
                            <span className="font-medium">{formatCurrency(request.sell_price, request.target_market)}</span>
                          </span>
                        )}
                      </div>
                    )}

                    {/* 거부 사유 */}
                    {request.rejection_reason && (
                      <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-700 dark:text-red-400">
                        거부 사유: {request.rejection_reason}
                      </div>
                    )}
                  </div>

                  {/* 액션 버튼 */}
                  <div className="flex gap-2 lg:flex-col">
                    {canManage && (request.status === 'pending' || request.status === 'discussion') && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(request)}
                          loading={approveLoading === request.id}
                        >
                          승인
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => openRejectModal(request)}>
                          거부
                        </Button>
                      </>
                    )}
                    {canManage && request.status === 'pending' && (
                      <Button size="sm" variant="secondary" onClick={() => openDiscussModal(request)}>
                        토론
                      </Button>
                    )}
                    {request.status === 'discussion' && request.discussion_id && (
                      <Link to={`/discussions/${request.discussion_id}`}>
                        <Button size="sm" variant="secondary" className="w-full">
                          토론방
                        </Button>
                      </Link>
                    )}
                    {adminMode && (
                      <Button size="sm" variant="secondary" className="text-red-600 hover:bg-red-50" onClick={() => handleDelete(request)}>
                        삭제
                      </Button>
                    )}
                  </div>
                </div>

                {/* 세부사항 토글 버튼 */}
                <button
                  onClick={() => toggleExpand(request.id)}
                  className="mt-3 pt-3 border-t dark:border-gray-700 flex items-center justify-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  {expandedId === request.id ? (
                    <>
                      <span>접기</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                      </svg>
                    </>
                  ) : (
                    <>
                      <span>세부사항</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </>
                  )}
                </button>

                {/* 세부사항 (확장 시) */}
                {expandedId === request.id && (
                  <div className="mt-3 pt-3 border-t dark:border-gray-700 space-y-2 text-sm">
                    {request.request_type === 'buy' && (
                      <>
                        {/* 매수 계획 */}
                        {request.buy_orders?.length > 0 && (
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">매수 계획: </span>
                            {request.buy_orders.map((o, i) => (
                              <span key={i} className="mr-2">
                                {formatCurrency(o.price, request.target_market)} ({formatPercent(o.ratio)})
                              </span>
                            ))}
                          </div>
                        )}

                        {/* 목표 비중 */}
                        {request.target_ratio && (
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">목표 비중: </span>
                            {formatPercent(request.target_ratio)}
                          </div>
                        )}

                        {/* 익절 타겟 */}
                        {request.take_profit_targets?.length > 0 && (
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">익절: </span>
                            {request.take_profit_targets.map((t, i) => (
                              <span key={i} className="text-red-600 dark:text-red-400 mr-2">
                                {formatPriceQuantity(t.price, t.quantity, request.target_market, t.ratio)}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* 손절 타겟 */}
                        {request.stop_loss_targets?.length > 0 && (
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">손절: </span>
                            {request.stop_loss_targets.map((t, i) => (
                              <span key={i} className="text-blue-600 dark:text-blue-400 mr-2">
                                {formatPriceQuantity(t.price, t.quantity, request.target_market, t.ratio)}
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {request.request_type === 'sell' && request.sell_reason && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">매도 사유: </span>
                        <span>{request.sell_reason}</span>
                      </div>
                    )}

                    {/* 메모 */}
                    {request.memo && (
                      <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">메모</p>
                        <p className="text-gray-700 dark:text-gray-300">{request.memo}</p>
                      </div>
                    )}

                    {/* 시장 정보 */}
                    <div className="text-gray-400 dark:text-gray-500 text-xs">
                      시장: {request.target_market}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="요청 거부"
      >
        <div className="space-y-4">
          <Textarea
            label="거부 사유"
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            required
          />

          <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
            <Button variant="secondary" onClick={() => setShowRejectModal(false)}>
              취소
            </Button>
            <Button variant="danger" onClick={handleReject}>
              거부
            </Button>
          </div>
        </div>
      </Modal>

      {/* Discussion Modal */}
      <Modal
        isOpen={showDiscussModal}
        onClose={() => setShowDiscussModal(false)}
        title="토론 시작"
      >
        <div className="space-y-4">
          <Input
            label="토론 제목"
            value={discussTitle}
            onChange={(e) => setDiscussTitle(e.target.value)}
            required
          />

          <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
            <Button variant="secondary" onClick={() => setShowDiscussModal(false)}>
              취소
            </Button>
            <Button onClick={handleStartDiscussion}>
              토론 시작
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
