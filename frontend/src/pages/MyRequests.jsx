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
  formatDate,
  getStatusBadgeClass,
  getStatusLabel,
  getRequestTypeLabel
} from '../utils/formatters';

export function MyRequests() {
  const { user, adminMode } = useAuth();
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

  const handleDelete = async (e, request) => {
    e.stopPropagation();
    if (!window.confirm(`요청 "${request.ticker_name || request.target_ticker}"을(를) 정말 삭제하시겠습니까?\n\n연관된 토론도 함께 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.`)) return;
    try {
      await requestService.deleteRequest(request.id);
      fetchRequests();
    } catch (error) {
      alert(error.response?.data?.detail || '삭제에 실패했습니다.');
    }
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold dark:text-gray-100">내 요청</h1>

      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">로딩중...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">요청이 없습니다</div>
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
                  <span className="font-bold text-lg dark:text-gray-100">{request.ticker_name || request.target_ticker}</span>
                  <span className="text-gray-500 dark:text-gray-400 text-sm">({request.target_ticker})</span>
                  <span className={`badge ${getStatusBadgeClass(request.status)}`}>
                    {getStatusLabel(request.status)}
                  </span>
                  {adminMode && (
                    <button
                      onClick={(e) => handleDelete(e, request)}
                      className="ml-auto text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 p-1 rounded"
                      title="삭제"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* 상태 타임라인 */}
                <div className="flex items-center gap-0 my-3 text-xs">
                  {/* Step 1: 제출 */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 ring-2 ring-green-100 dark:ring-green-900" />
                    <div>
                      <span className="text-gray-600 dark:text-gray-400 font-medium">제출</span>
                      <span className="text-gray-400 dark:text-gray-500 ml-1">{formatDate(request.created_at, 'M/d HH:mm')}</span>
                    </div>
                  </div>

                  <div className={`flex-1 h-0.5 mx-2 ${request.status === 'pending' ? 'bg-gradient-to-r from-green-300 to-yellow-300' : 'bg-green-300'}`} />

                  {/* Step 2: 검토 */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {request.status === 'pending' ? (
                      <>
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 ring-2 ring-yellow-100 dark:ring-yellow-900 animate-pulse" />
                        <span className="text-yellow-600 dark:text-yellow-400 font-medium">검토중</span>
                      </>
                    ) : (
                      <>
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500 ring-2 ring-green-100 dark:ring-green-900" />
                        <span className="text-gray-500 dark:text-gray-400">검토</span>
                      </>
                    )}
                  </div>

                  {request.status !== 'pending' && (
                    <>
                      <div className={`flex-1 h-0.5 mx-2 ${
                        request.status === 'approved' ? 'bg-green-300' :
                        request.status === 'rejected' ? 'bg-red-300' : 'bg-blue-300'
                      }`} />

                      {/* Step 3: 결과 */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {request.status === 'approved' && (
                          <>
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500 ring-2 ring-green-100 dark:ring-green-900" />
                            <div>
                              <span className="text-green-600 dark:text-green-400 font-medium">승인</span>
                              {request.approved_at && (
                                <span className="text-gray-400 dark:text-gray-500 ml-1">{formatDate(request.approved_at, 'M/d HH:mm')}</span>
                              )}
                            </div>
                          </>
                        )}
                        {request.status === 'rejected' && (
                          <>
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-red-100 dark:ring-red-900" />
                            <span className="text-red-600 dark:text-red-400 font-medium">거부</span>
                          </>
                        )}
                        {request.status === 'discussion' && (
                          <>
                            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-blue-100 dark:ring-blue-900" />
                            <span className="text-blue-600 dark:text-blue-400 font-medium">토론중</span>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* 매수 요청 기본 표시 */}
                {request.request_type === 'buy' && (
                  <div className="flex flex-wrap gap-4 text-sm mb-2">
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

                {/* 매도 요청 기본 표시 */}
                {request.request_type === 'sell' && (
                  <div className="flex flex-wrap gap-4 text-sm mb-2">
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

                {/* 상태별 표시 */}
                {request.rejection_reason && (
                  <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-700 dark:text-red-400">
                    거부 사유: {request.rejection_reason}
                  </div>
                )}

                {request.status === 'approved' && (
                  <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded text-sm text-green-700 dark:text-green-400">
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

                {/* 대기중일 때 토론 요청 버튼 */}
                {request.status === 'pending' && (
                  <div className="mt-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await requestService.requestDiscussion(request.id);
                          alert('토론 요청이 매니저에게 전송되었습니다.');
                        } catch (error) {
                          alert(error.response?.data?.detail || '토론 요청에 실패했습니다.');
                        }
                      }}
                    >
                      토론 요청
                    </Button>
                  </div>
                )}

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

                        {/* 익절 타겟 */}
                        {request.take_profit_targets?.length > 0 && (
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">익절: </span>
                            {request.take_profit_targets.map((t, i) => (
                              <span key={i} className="text-red-600 dark:text-red-400 mr-2">
                                {formatCurrency(t.price, request.target_market)} x {t.quantity ?? formatPercent(t.ratio)}
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
                                {formatCurrency(t.price, request.target_market)} x {t.quantity ?? formatPercent(t.ratio)}
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
    </div>
  );
}
