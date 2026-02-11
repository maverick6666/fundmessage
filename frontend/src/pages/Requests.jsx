import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { EmptyState } from '../components/common/EmptyState';
import { Input, Textarea } from '../components/common/Input';
import { requestService } from '../services/requestService';
import { discussionService } from '../services/discussionService';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import {
  formatCurrency,
  formatPercent,
  formatPriceQuantity,
  formatQuantity,
  formatRelativeTime,
  getStatusBadgeClass,
  getStatusLabel,
  getRequestTypeLabel
} from '../utils/formatters';

export function Requests() {
  const navigate = useNavigate();
  const { user, adminMode, isManagerOrAdmin } = useAuth();
  const toast = useToast();
  const canManage = isManagerOrAdmin();
  const [requests, setRequests] = useState([]);
  const [allRequests, setAllRequests] = useState([]); // 건수 계산용
  const [loading, setLoading] = useState(true);
  // 역할별 기본 탭/필터: 팀장은 팀요청+대기중, 팀원은 내요청+전체
  const [activeTab, setActiveTab] = useState(() => canManage ? 'team' : 'mine');
  const [statusFilter, setStatusFilter] = useState(() => canManage ? 'pending' : 'all');

  // 상태별 건수 계산 (대기중 = pending + discussion 합산)
  const statusCounts = {
    all: allRequests.length,
    pending: allRequests.filter(r => r.status === 'pending' || r.status === 'discussion').length,
    approved: allRequests.filter(r => r.status === 'approved').length,
    rejected: allRequests.filter(r => r.status === 'rejected').length,
  };
  const [expandedId, setExpandedId] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDiscussModal, setShowDiscussModal] = useState(false);

  const [approveLoading, setApproveLoading] = useState(null); // 승인 중인 요청 ID
  const [rejectReason, setRejectReason] = useState('');
  const [discussTitle, setDiscussTitle] = useState('');
  const [discussAgenda, setDiscussAgenda] = useState('');
  const [deleteRequestData, setDeleteRequestData] = useState(null);

  // 열린 토론 경고 관련 상태
  const [openDiscussionWarning, setOpenDiscussionWarning] = useState(null); // { request, action: 'approve' | 'reject' }
  const [warningActionLoading, setWarningActionLoading] = useState(false);

  const handleDeleteClick = (request) => {
    setDeleteRequestData(request);
  };

  const confirmDelete = async () => {
    if (!deleteRequestData) return;
    try {
      await requestService.deleteRequest(deleteRequestData.id);
      setDeleteRequestData(null);
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || '삭제에 실패했습니다.');
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
      let allParams = { limit: 100 }; // 건수 계산용

      if (activeTab === 'mine') {
        // 내 요청 탭
        params.requester_id = user.id;
        allParams.requester_id = user.id;
        if (statusFilter !== 'all' && statusFilter !== 'pending') {
          params.status = statusFilter;
        }
        // pending 필터는 프론트에서 처리 (pending + discussion)
      } else {
        // 팀 요청 탭 - 상태 필터 적용
        if (statusFilter !== 'all' && statusFilter !== 'pending') {
          params.status = statusFilter;
        }
        // pending 필터는 프론트에서 처리 (pending + discussion)
      }

      // 필터링된 요청과 전체 요청 둘 다 가져오기
      const [filteredData, allData] = await Promise.all([
        requestService.getRequests(params),
        requestService.getRequests(allParams)
      ]);

      // pending 필터일 때 프론트에서 pending + discussion 필터링
      let finalRequests = filteredData.requests || [];
      if (statusFilter === 'pending') {
        finalRequests = finalRequests.filter(r => r.status === 'pending' || r.status === 'discussion');
      }

      setRequests(finalRequests);
      setAllRequests(allData.requests || []);
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    } finally {
      setLoading(false);
    }
  };

  // 열린 토론 확인 후 승인 시도
  const handleApprove = async (request) => {
    if (approveLoading) return;

    // 열린 토론이 있는지 확인 (status가 discussion이면 열린 토론 있음)
    if (request.status === 'discussion' && request.discussion_id) {
      setOpenDiscussionWarning({ request, action: 'approve' });
      return;
    }

    await executeApprove(request);
  };

  // 실제 승인 실행
  const executeApprove = async (request) => {
    setApproveLoading(request.id);
    try {
      await requestService.approveRequest(request.id, {});
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || '승인에 실패했습니다.');
    } finally {
      setApproveLoading(null);
    }
  };

  // 거부 버튼 클릭 시
  const openRejectModalWithCheck = (request) => {
    // 열린 토론이 있는지 확인
    if (request.status === 'discussion' && request.discussion_id) {
      setOpenDiscussionWarning({ request, action: 'reject' });
      return;
    }
    openRejectModal(request);
  };

  // 열린 토론 경고에서 "토론 종료 후 진행" 선택
  const handleCloseDiscussionAndProceed = async () => {
    if (!openDiscussionWarning) return;
    const { request, action } = openDiscussionWarning;

    setWarningActionLoading(true);
    try {
      // 토론 종료
      await discussionService.closeDiscussion(request.discussion_id);

      // 승인 또는 거부 진행
      if (action === 'approve') {
        setOpenDiscussionWarning(null);
        await executeApprove(request);
      } else {
        setOpenDiscussionWarning(null);
        openRejectModal(request);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || '토론 종료에 실패했습니다.');
    } finally {
      setWarningActionLoading(false);
    }
  };

  // 열린 토론 경고에서 "그냥 진행" 선택
  const handleProceedWithoutClosing = async () => {
    if (!openDiscussionWarning) return;
    const { request, action } = openDiscussionWarning;

    setOpenDiscussionWarning(null);

    if (action === 'approve') {
      await executeApprove(request);
    } else {
      openRejectModal(request);
    }
  };

  const handleReject = async () => {
    try {
      await requestService.rejectRequest(selectedRequest.id, rejectReason);
      setShowRejectModal(false);
      setRejectReason('');
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || '거부에 실패했습니다.');
    }
  };

  const handleStartDiscussion = async () => {
    if (!discussAgenda.trim()) {
      toast.error('의제를 입력해주세요.');
      return;
    }
    try {
      const result = await requestService.startDiscussion(selectedRequest.id, discussTitle, discussAgenda);
      setShowDiscussModal(false);
      setDiscussTitle('');
      setDiscussAgenda('');
      navigate(`/discussions/${result.discussion.id}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || '토론 시작에 실패했습니다.');
    }
  };

  const openRejectModal = (request) => {
    setSelectedRequest(request);
    setShowRejectModal(true);
  };

  const openDiscussModal = (request) => {
    setSelectedRequest(request);
    setDiscussTitle(`${request.ticker_name || request.target_ticker} ${getRequestTypeLabel(request.request_type)} 논의`);
    setDiscussAgenda('');
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

      {/* Status Filters with Count Badges */}
      <div className="flex gap-2 flex-wrap">
        {activeTab === 'team' ? (
          // 팀 요청 현황: 전체, 대기중(토론중 포함), 승인됨, 거부됨
          ['all', 'pending', 'approved', 'rejected'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                statusFilter === status
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {status === 'all' ? '전체' : getStatusLabel(status)}
              {/* 대기중은 빨간 배지 (pending + discussion 합산) */}
              {status === 'pending' && statusCounts.pending > 0 && (
                <span className={`px-1.5 py-0.5 text-xs font-bold rounded-full ${
                  statusFilter === status
                    ? 'bg-white/20 text-white'
                    : 'bg-rose-500 text-white'
                }`}>
                  {statusCounts.pending}
                </span>
              )}
            </button>
          ))
        ) : (
          // 내 요청: 전체, 대기중, 승인됨, 거부됨
          ['all', 'pending', 'approved', 'rejected'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                statusFilter === status
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {status === 'all' ? '전체' : getStatusLabel(status)}
              {status === 'pending' && statusCounts.pending > 0 && (
                <span className={`px-1.5 py-0.5 text-xs font-bold rounded-full ${
                  statusFilter === status
                    ? 'bg-white/20 text-white'
                    : 'bg-amber-500 text-white'
                }`}>
                  {statusCounts.pending}
                </span>
              )}
            </button>
          ))
        )}
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">로딩중...</div>
      ) : requests.length === 0 ? (
        <EmptyState
          icon={statusFilter === 'pending' ? 'check' : 'clipboard'}
          title={
            statusFilter === 'pending'
              ? '대기중인 요청이 없습니다'
              : statusFilter === 'all'
                ? '요청이 없습니다'
                : `${getStatusLabel(statusFilter)} 요청이 없습니다`
          }
          description={
            statusFilter === 'pending'
              ? '모든 요청이 처리되었습니다'
              : activeTab === 'mine'
                ? '새로운 매수/매도 요청을 제출해보세요'
                : '팀원들의 요청이 여기에 표시됩니다'
          }
        />
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
                            <span className="font-medium">{formatQuantity(request.order_quantity)}</span>
                          </span>
                        )}
                      </div>
                    )}

                    {/* 매도 요청 기본 정보 */}
                    {request.request_type === 'sell' && (
                      <div className="flex flex-wrap gap-4 text-sm">
                        <span>
                          <span className="text-gray-500 dark:text-gray-400">매도 수량: </span>
                          <span className="font-medium">{formatQuantity(request.sell_quantity)}</span>
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
                        <Button size="sm" variant="danger" onClick={() => openRejectModalWithCheck(request)}>
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
                      <Button size="sm" variant="secondary" className="text-red-600 hover:bg-red-50" onClick={() => handleDeleteClick(request)}>
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
          <Textarea
            label="토론 의제"
            placeholder="이 토론에서 논의할 내용을 입력하세요"
            rows={3}
            value={discussAgenda}
            onChange={(e) => setDiscussAgenda(e.target.value)}
            required
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            의제는 토론방 상단에 표시되어 팀원들이 주제에 집중할 수 있도록 합니다.
          </p>

          <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
            <Button variant="secondary" onClick={() => setShowDiscussModal(false)}>
              취소
            </Button>
            <Button onClick={handleStartDiscussion} disabled={!discussAgenda.trim()}>
              토론 시작
            </Button>
          </div>
        </div>
      </Modal>

      {/* 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={!!deleteRequestData}
        onClose={() => setDeleteRequestData(null)}
        onConfirm={confirmDelete}
        title="요청 삭제"
        message={`요청 "${deleteRequestData?.ticker_name || deleteRequestData?.target_ticker}"을(를) 정말 삭제하시겠습니까?\n\n연관된 토론도 함께 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.`}
        confirmText="삭제"
        confirmVariant="danger"
      />

      {/* 열린 토론 경고 모달 */}
      <Modal
        isOpen={!!openDiscussionWarning}
        onClose={() => setOpenDiscussionWarning(null)}
        title="⚠️ 열린 토론이 있습니다"
      >
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="text-amber-800 dark:text-amber-300">
              이 요청에 대한 의사결정 토론이 아직 진행 중입니다.
            </p>
            <p className="text-amber-700 dark:text-amber-400 text-sm mt-2">
              토론을 종료하지 않고 {openDiscussionWarning?.action === 'approve' ? '승인' : '거부'}하면 토론이 열린 채로 남습니다.
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button
              onClick={handleCloseDiscussionAndProceed}
              loading={warningActionLoading}
            >
              토론 종료 후 {openDiscussionWarning?.action === 'approve' ? '승인' : '거부'}
            </Button>
            <Button
              variant="secondary"
              onClick={handleProceedWithoutClosing}
              disabled={warningActionLoading}
            >
              그냥 {openDiscussionWarning?.action === 'approve' ? '승인' : '거부'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setOpenDiscussionWarning(null)}
              disabled={warningActionLoading}
              className="text-gray-500"
            >
              취소
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
