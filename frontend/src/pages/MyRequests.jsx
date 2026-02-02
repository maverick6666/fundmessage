import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
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
  const [expandedId, setExpandedId] = useState(null);

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
        <Link to="/stock-search">
          <Button>종목검색에서 요청</Button>
        </Link>
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
                    <span className="font-bold text-lg">{request.ticker_name || request.target_ticker}</span>
                    <span className="text-gray-500 text-sm">({request.target_ticker})</span>
                    <span className={`badge ${getStatusBadgeClass(request.status)}`}>
                      {getStatusLabel(request.status)}
                    </span>
                  </div>

                  <div className="text-sm text-gray-500 mb-2">
                    {formatRelativeTime(request.created_at)}
                  </div>

                  {request.request_type === 'buy' && (
                    <div className="space-y-1 text-sm">
                      {/* 희망 매수가 & 수량 */}
                      <div className="flex flex-wrap gap-4">
                        {request.buy_price && (
                          <span>
                            <span className="text-gray-500">희망 매수가: </span>
                            <span className="font-medium">{formatCurrency(request.buy_price)}</span>
                          </span>
                        )}
                        {request.order_quantity && (
                          <span>
                            <span className="text-gray-500">수량: </span>
                            <span className="font-medium">{request.order_quantity}</span>
                          </span>
                        )}
                      </div>

                      {/* 분할 매수 계획 */}
                      {request.buy_orders?.length > 0 && (
                        <div>
                          <span className="text-gray-500">분할 매수: </span>
                          {request.buy_orders.map((o, i) => (
                            <span key={i} className="mr-2">
                              {formatCurrency(o.price)} ({formatPercent(o.ratio)})
                            </span>
                          ))}
                        </div>
                      )}

                      {/* 익절/손절 (간략히) */}
                      <div className="flex flex-wrap gap-4">
                        {request.take_profit_targets?.length > 0 && (
                          <span>
                            <span className="text-gray-500">익절: </span>
                            {request.take_profit_targets.map((t, i) => (
                              <span key={i} className="text-red-600 mr-1">
                                {formatCurrency(t.price)}({formatPercent(t.ratio)})
                              </span>
                            ))}
                          </span>
                        )}
                        {request.stop_loss_targets?.length > 0 && (
                          <span>
                            <span className="text-gray-500">손절: </span>
                            {request.stop_loss_targets.map((t, i) => (
                              <span key={i} className="text-blue-600 mr-1">
                                {formatCurrency(t.price)}({formatPercent(t.ratio)})
                              </span>
                            ))}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {request.request_type === 'sell' && (
                    <div className="space-y-1 text-sm">
                      <div>
                        <span className="text-gray-500">매도 수량: </span>
                        <span className="font-medium">{request.sell_quantity}</span>
                      </div>
                      {request.sell_price && (
                        <div>
                          <span className="text-gray-500">매도 가격: </span>
                          {formatCurrency(request.sell_price)}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 세부 정보 (확장 가능) */}
                  {request.memo && (
                    <button
                      onClick={() => setExpandedId(expandedId === request.id ? null : request.id)}
                      className="mt-2 text-sm text-primary-600 hover:text-primary-700"
                    >
                      {expandedId === request.id ? '접기' : '메모 보기'}
                    </button>
                  )}

                  {expandedId === request.id && request.memo && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm">
                      <p className="text-gray-700">{request.memo}</p>
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

    </div>
  );
}
