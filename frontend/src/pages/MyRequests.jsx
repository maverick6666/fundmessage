import { useState, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { BuyRequestForm } from '../components/forms/BuyRequestForm';
import { requestService } from '../services/requestService';
import { useAuth } from '../hooks/useAuth';
import {
  formatCurrency,
  formatPercent,
  formatRelativeTime,
  getStatusBadgeClass,
  getStatusLabel,
  getRequestTypeLabel
} from '../utils/formatters';

export function MyRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBuyModal, setShowBuyModal] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, [user]);

  const fetchRequests = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await requestService.getRequests({
        requester_id: user.id,
        limit: 50
      });
      setRequests(data.requests);
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">내 요청</h1>
        <Button onClick={() => setShowBuyModal(true)}>
          + 매수 요청
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">로딩중...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 text-gray-500">요청이 없습니다</div>
      ) : (
        <div className="grid gap-4">
          {requests.map(request => (
            <Card key={request.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`badge ${request.request_type === 'buy' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                      {getRequestTypeLabel(request.request_type)}
                    </span>
                    <span className="font-bold">{request.target_ticker}</span>
                    <span className={`badge ${getStatusBadgeClass(request.status)}`}>
                      {getStatusLabel(request.status)}
                    </span>
                  </div>

                  <div className="text-sm text-gray-500">
                    {formatRelativeTime(request.created_at)}
                  </div>

                  {request.request_type === 'buy' && (
                    <div className="mt-2 text-sm">
                      <span className="text-gray-500">목표 비중: </span>
                      {formatPercent(request.target_ratio)}
                    </div>
                  )}

                  {request.request_type === 'sell' && (
                    <div className="mt-2 text-sm">
                      <span className="text-gray-500">매도 수량: </span>
                      {request.sell_quantity}
                    </div>
                  )}

                  {request.rejection_reason && (
                    <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
                      거부 사유: {request.rejection_reason}
                    </div>
                  )}

                  {request.status === 'approved' && (
                    <div className="mt-2 p-2 bg-green-50 rounded text-sm text-green-700">
                      체결: {formatCurrency(request.executed_price)} x {request.executed_quantity}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={showBuyModal}
        onClose={() => setShowBuyModal(false)}
        title="매수 요청"
        size="lg"
      >
        <BuyRequestForm
          onSuccess={() => {
            setShowBuyModal(false);
            fetchRequests();
          }}
          onCancel={() => setShowBuyModal(false)}
        />
      </Modal>
    </div>
  );
}
