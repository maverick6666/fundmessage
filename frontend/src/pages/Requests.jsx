import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { Input, Textarea } from '../components/common/Input';
import { requestService } from '../services/requestService';
import {
  formatCurrency,
  formatPercent,
  formatRelativeTime,
  getStatusBadgeClass,
  getStatusLabel,
  getRequestTypeLabel
} from '../utils/formatters';

export function Requests() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDiscussModal, setShowDiscussModal] = useState(false);

  const [approveData, setApproveData] = useState({
    executed_price: '',
    executed_quantity: '',
  });
  const [rejectReason, setRejectReason] = useState('');
  const [discussTitle, setDiscussTitle] = useState('');

  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const data = await requestService.getRequests({
        status: statusFilter === 'all' ? null : statusFilter,
        limit: 50
      });
      setRequests(data.requests);
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    try {
      await requestService.approveRequest(selectedRequest.id, {
        executed_price: parseFloat(approveData.executed_price),
        executed_quantity: parseFloat(approveData.executed_quantity),
      });
      setShowApproveModal(false);
      setApproveData({ executed_price: '', executed_quantity: '' });
      fetchRequests();
    } catch (error) {
      alert(error.response?.data?.detail || '승인에 실패했습니다.');
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

  const openApproveModal = (request) => {
    setSelectedRequest(request);
    setShowApproveModal(true);
  };

  const openRejectModal = (request) => {
    setSelectedRequest(request);
    setShowRejectModal(true);
  };

  const openDiscussModal = (request) => {
    setSelectedRequest(request);
    setDiscussTitle(`${request.target_ticker} ${getRequestTypeLabel(request.request_type)} 논의`);
    setShowDiscussModal(true);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">요청 관리</h1>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['pending', 'discussion', 'approved', 'rejected', 'all'].map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === status
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {status === 'all' ? '전체' : getStatusLabel(status)}
          </button>
        ))}
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">로딩중...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 text-gray-500">요청이 없습니다</div>
      ) : (
        <div className="grid gap-4">
          {requests.map(request => (
            <Card key={request.id}>
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`badge ${request.request_type === 'buy' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                      {getRequestTypeLabel(request.request_type)}
                    </span>
                    <span className="font-bold text-lg">{request.target_ticker}</span>
                    <span className={`badge ${getStatusBadgeClass(request.status)}`}>
                      {getStatusLabel(request.status)}
                    </span>
                  </div>

                  <div className="text-sm text-gray-600 mb-3">
                    요청자: {request.requester.full_name} | {formatRelativeTime(request.created_at)}
                  </div>

                  {request.request_type === 'buy' && (
                    <div className="space-y-2 text-sm">
                      {request.buy_orders?.length > 0 && (
                        <div>
                          <span className="text-gray-500">매수 계획: </span>
                          {request.buy_orders.map((o, i) => (
                            <span key={i} className="mr-2">
                              {formatCurrency(o.price)} ({formatPercent(o.ratio)})
                            </span>
                          ))}
                        </div>
                      )}
                      <div>
                        <span className="text-gray-500">목표 비중: </span>
                        {formatPercent(request.target_ratio)}
                      </div>
                      {request.take_profit_targets?.length > 0 && (
                        <div>
                          <span className="text-gray-500">익절: </span>
                          {request.take_profit_targets.map((t, i) => (
                            <span key={i} className="mr-2 text-red-600">
                              {formatCurrency(t.price)} ({formatPercent(t.ratio)})
                            </span>
                          ))}
                        </div>
                      )}
                      {request.stop_loss_targets?.length > 0 && (
                        <div>
                          <span className="text-gray-500">손절: </span>
                          {request.stop_loss_targets.map((t, i) => (
                            <span key={i} className="mr-2 text-blue-600">
                              {formatCurrency(t.price)} ({formatPercent(t.ratio)})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {request.request_type === 'sell' && (
                    <div className="space-y-1 text-sm">
                      <div>
                        <span className="text-gray-500">매도 수량: </span>
                        {request.sell_quantity}
                      </div>
                      {request.sell_price && (
                        <div>
                          <span className="text-gray-500">매도 가격: </span>
                          {formatCurrency(request.sell_price)}
                        </div>
                      )}
                      {request.sell_reason && (
                        <div>
                          <span className="text-gray-500">사유: </span>
                          {request.sell_reason}
                        </div>
                      )}
                    </div>
                  )}

                  {request.rejection_reason && (
                    <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
                      거부 사유: {request.rejection_reason}
                    </div>
                  )}
                </div>

                {(request.status === 'pending' || request.status === 'discussion') && (
                  <div className="flex gap-2 lg:flex-col">
                    <Button size="sm" onClick={() => openApproveModal(request)}>
                      승인
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => openRejectModal(request)}>
                      거부
                    </Button>
                    {request.status === 'pending' && (
                      <Button size="sm" variant="secondary" onClick={() => openDiscussModal(request)}>
                        토론
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Approve Modal */}
      <Modal
        isOpen={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        title="요청 승인"
      >
        <div className="space-y-4">
          <div className="bg-gray-50 p-3 rounded">
            <p className="font-medium">{selectedRequest?.target_ticker}</p>
            <p className="text-sm text-gray-600">
              {getRequestTypeLabel(selectedRequest?.request_type)} 요청
            </p>
          </div>

          <Input
            label="체결 가격"
            type="number"
            value={approveData.executed_price}
            onChange={(e) => setApproveData({ ...approveData, executed_price: e.target.value })}
            required
          />
          <Input
            label="체결 수량"
            type="number"
            value={approveData.executed_quantity}
            onChange={(e) => setApproveData({ ...approveData, executed_quantity: e.target.value })}
            required
          />

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowApproveModal(false)}>
              취소
            </Button>
            <Button onClick={handleApprove}>
              승인
            </Button>
          </div>
        </div>
      </Modal>

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

          <div className="flex justify-end gap-3 pt-4 border-t">
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

          <div className="flex justify-end gap-3 pt-4 border-t">
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
