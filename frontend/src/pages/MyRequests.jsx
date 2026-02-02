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

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">내 요청</h1>

      {loading ? (
        <div className="text-center py-12 text-gray-500">로딩중...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 text-gray-500">요청이 없습니다</div>
      ) : (
        <div className="grid gap-4">
          {requests.map(request => (
            <Card key={request.id}>
              <div className="flex flex-col">
                {/* 헤더: 종목명, 상태 */}
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

                {/* 기본 정보 */}
                <div className="text-sm text-gray-500 mb-2">
                  {formatRelativeTime(request.created_at)}
                </div>

                {/* 매수 요청 기본 표시 */}
                {request.request_type === 'buy' && (
                  <div className="flex flex-wrap gap-4 text-sm mb-2">
                    {request.buy_price && (
                      <span>
                        <span className="text-gray-500">희망 매수가: </span>
                        <span className="font-medium">{formatCurrency(request.buy_price, request.target_market)}</span>
                      </span>
                    )}
                    {request.order_quantity && (
                      <span>
                        <span className="text-gray-500">희망 수량: </span>
                        <span className="font-medium">{request.order_quantity}</span>
                      </span>
                    )}
                  </div>
                )}

                {/* 매도 요청 기본 표시 */}
                {request.request_type === 'sell' && (
                  <div className="flex flex-wrap gap-4 text-sm mb-2">
                    <span>
                      <span className="text-gray-500">매도 수량: </span>
                      <span className="font-medium">{request.sell_quantity}</span>
                    </span>
                    {request.sell_price && (
                      <span>
                        <span className="text-gray-500">매도가: </span>
                        <span className="font-medium">{formatCurrency(request.sell_price, request.target_market)}</span>
                      </span>
                    )}
                  </div>
                )}

                {/* 상태별 표시 */}
                {request.rejection_reason && (
                  <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
                    거부 사유: {request.rejection_reason}
                  </div>
                )}

                {request.status === 'approved' && (
                  <div className="mt-2 p-2 bg-green-50 rounded text-sm text-green-700">
                    체결: {formatCurrency(request.executed_price, request.target_market)} x {request.executed_quantity}
                  </div>
                )}

                {/* 토론중일 때 토론방 버튼 */}
                {request.status === 'discussion' && request.discussion_id && (
                  <div className="mt-2">
                    <Link to={`/discussions/${request.discussion_id}`}>
                      <Button size="sm" variant="secondary">
                        토론방 입장
                      </Button>
                    </Link>
                  </div>
                )}

                {/* 세부사항 토글 버튼 */}
                <button
                  onClick={() => toggleExpand(request.id)}
                  className="mt-3 pt-3 border-t flex items-center justify-center gap-1 text-sm text-gray-500 hover:text-gray-700"
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
                  <div className="mt-3 pt-3 border-t space-y-2 text-sm">
                    {request.request_type === 'buy' && (
                      <>
                        {/* 매수 계획 */}
                        {request.buy_orders?.length > 0 && (
                          <div>
                            <span className="text-gray-500">매수 계획: </span>
                            {request.buy_orders.map((o, i) => (
                              <span key={i} className="mr-2">
                                {formatCurrency(o.price, request.target_market)} ({formatPercent(o.ratio)})
                              </span>
                            ))}
                          </div>
                        )}

                        {/* 익절 타겟 */}
                        {request.take_profit_targets?.length > 0 && (
                          <div>
                            <span className="text-gray-500">익절: </span>
                            {request.take_profit_targets.map((t, i) => (
                              <span key={i} className="text-red-600 mr-2">
                                {formatCurrency(t.price, request.target_market)} x {t.quantity ?? formatPercent(t.ratio)}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* 손절 타겟 */}
                        {request.stop_loss_targets?.length > 0 && (
                          <div>
                            <span className="text-gray-500">손절: </span>
                            {request.stop_loss_targets.map((t, i) => (
                              <span key={i} className="text-blue-600 mr-2">
                                {formatCurrency(t.price, request.target_market)} x {t.quantity ?? formatPercent(t.ratio)}
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {request.request_type === 'sell' && request.sell_reason && (
                      <div>
                        <span className="text-gray-500">매도 사유: </span>
                        <span>{request.sell_reason}</span>
                      </div>
                    )}

                    {/* 메모 */}
                    {request.memo && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-gray-500 text-xs mb-1">메모</p>
                        <p className="text-gray-700">{request.memo}</p>
                      </div>
                    )}

                    {/* 시장 정보 */}
                    <div className="text-gray-400 text-xs">
                      시장: {request.target_market}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
