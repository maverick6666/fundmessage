import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { usePositions } from '../hooks/usePositions';
import { priceService } from '../services/priceService';
import { positionService } from '../services/positionService';
import { useAuth } from '../hooks/useAuth';
import {
  formatCurrency,
  formatPercent,
  formatQuantity,
  formatHours,
  calcHoldingHours,
  getStatusBadgeClass,
  getStatusLabel,
  getProfitLossClass
} from '../utils/formatters';

export function Positions() {
  const { adminMode } = useAuth();
  const [statusFilter, setStatusFilter] = useState('open');
  const { positions, total, loading, error, updateFilters, setPage, filters } = usePositions({ status: 'open' });
  const [priceData, setPriceData] = useState({});
  const [priceLoading, setPriceLoading] = useState(false);
  const [expandedIds, setExpandedIds] = useState(new Set());

  useEffect(() => {
    if (statusFilter === 'open' && positions.length > 0) {
      fetchPrices();
      const interval = setInterval(fetchPrices, 60000);
      return () => clearInterval(interval);
    }
  }, [positions, statusFilter]);

  const fetchPrices = async () => {
    try {
      setPriceLoading(true);
      const data = await priceService.getPositionsWithPrices();
      const priceMap = {};
      data.positions?.forEach(p => {
        priceMap[p.id] = p;
      });
      setPriceData(priceMap);
    } catch (err) {
      console.error('시세 조회 실패:', err);
    } finally {
      setPriceLoading(false);
    }
  };

  const handleDelete = async (e, position) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`포지션 "${position.ticker_name || position.ticker}"을(를) 정말 삭제하시겠습니까?\n\n연관된 모든 요청, 토론, 의사결정 노트가 함께 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.`)) return;
    try {
      await positionService.deletePosition(position.id);
      updateFilters({ ...filters });
    } catch (error) {
      alert(error.response?.data?.detail || '삭제에 실패했습니다.');
    }
  };

  const handleStatusChange = (status) => {
    setStatusFilter(status);
    setExpandedIds(new Set());
    updateFilters({ status: status === 'all' ? null : status });
  };

  const toggleExpand = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">포지션</h1>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['open', 'closed', 'all'].map(status => (
          <button
            key={status}
            onClick={() => handleStatusChange(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === status
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {status === 'open' ? '진행중' : status === 'closed' ? '종료' : '전체'}
          </button>
        ))}
      </div>

      {/* Positions List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">로딩중...</div>
      ) : error ? (
        <div className="text-center py-12 text-red-500">{error}</div>
      ) : positions.length === 0 ? (
        <div className="text-center py-12 text-gray-500">포지션이 없습니다</div>
      ) : (
        <>
          <div className="space-y-3">
            {positions.map(position => {
              const isOpen = position.status === 'open';
              const price = priceData[position.id];
              const profitRate = isOpen ? price?.profit_rate : position.profit_rate;
              const profitLoss = isOpen ? price?.profit_loss : position.profit_loss;
              const holdingHours = isOpen ? calcHoldingHours(position.opened_at) : position.holding_period_hours;
              const expanded = expandedIds.has(position.id);

              return (
                <div key={position.id} className="bg-white rounded-lg shadow border border-gray-100 overflow-hidden">
                  {/* Card Header - Always Visible */}
                  <div
                    className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => toggleExpand(position.id)}
                  >
                    <div className="flex items-center justify-between">
                      {/* Left: Ticker Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900 truncate">
                              {position.ticker_name || position.ticker}
                            </span>
                            <span className="text-xs text-gray-400">{position.ticker}</span>
                            {isOpen && !position.is_info_confirmed && (
                              <span className="bg-yellow-100 text-yellow-800 text-xs px-1.5 py-0.5 rounded">미수정</span>
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusBadgeClass(position.status)}`}>
                              {getStatusLabel(position.status)}
                            </span>
                          </div>
                          {/* Remaining plans */}
                          {isOpen && (position.remaining_buys > 0 || position.remaining_take_profits > 0 || position.remaining_stop_losses > 0) && (
                            <div className="flex gap-2 mt-0.5 text-xs">
                              {position.remaining_buys > 0 && (
                                <span className="text-blue-600">매수 {position.remaining_buys}</span>
                              )}
                              {position.remaining_take_profits > 0 && (
                                <span className="text-red-600">익절 {position.remaining_take_profits}</span>
                              )}
                              {position.remaining_stop_losses > 0 && (
                                <span className="text-gray-600">손절 {position.remaining_stop_losses}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Key Metrics */}
                      <div className="flex items-center gap-4 text-right flex-shrink-0">
                        {isOpen && price?.current_price && (
                          <div className="hidden sm:block">
                            <p className="text-xs text-gray-400">현재가</p>
                            <p className="font-medium text-sm">{formatCurrency(price.current_price, position.market)}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-gray-400">{isOpen ? '평가손익' : '손익'}</p>
                          <p className={`font-bold text-sm ${getProfitLossClass(profitRate)}`}>
                            {profitRate != null ? formatPercent(profitRate) : '-'}
                          </p>
                        </div>
                        {/* Expand Arrow */}
                        <svg
                          className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expanded && (
                    <div className="border-t border-gray-100 px-4 pb-4">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-3 text-sm">
                        <div>
                          <p className="text-gray-400 text-xs">평균매수가</p>
                          <p className="font-medium">{formatCurrency(position.average_buy_price, position.market)}</p>
                        </div>
                        {isOpen && (
                          <div>
                            <p className="text-gray-400 text-xs">현재가</p>
                            <p className="font-medium">
                              {price?.current_price
                                ? formatCurrency(price.current_price, position.market)
                                : priceLoading ? '...' : '-'}
                            </p>
                          </div>
                        )}
                        <div>
                          <p className="text-gray-400 text-xs">수량</p>
                          <p className="font-medium">{formatQuantity(position.total_quantity)}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs">매수금액</p>
                          <p className="font-medium">{formatCurrency(position.total_buy_amount, position.market)}</p>
                        </div>
                        {isOpen && (
                          <>
                            <div>
                              <p className="text-gray-400 text-xs">평가금액</p>
                              <p className="font-medium">
                                {price?.evaluation_amount
                                  ? formatCurrency(price.evaluation_amount, position.market)
                                  : '-'}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-400 text-xs">평가손익</p>
                              <p className={`font-medium ${getProfitLossClass(profitLoss)}`}>
                                {profitLoss != null
                                  ? formatCurrency(profitLoss, position.market)
                                  : '-'}
                              </p>
                            </div>
                          </>
                        )}
                        {!isOpen && (
                          <div>
                            <p className="text-gray-400 text-xs">실현손익</p>
                            <p className={`font-medium ${getProfitLossClass(profitLoss)}`}>
                              {formatCurrency(profitLoss, position.market)}
                            </p>
                          </div>
                        )}
                        <div>
                          <p className="text-gray-400 text-xs">보유기간</p>
                          <p className="font-medium">{formatHours(holdingHours)}</p>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                        <Link
                          to={`/positions/${position.id}`}
                          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                        >
                          상세보기
                        </Link>
                        {adminMode && (
                          <button
                            onClick={(e) => handleDelete(e, position)}
                            className="text-sm text-red-500 hover:text-red-700 font-medium ml-auto"
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {total > filters.limit && (
            <div className="flex justify-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={filters.page === 1}
                onClick={() => setPage(filters.page - 1)}
              >
                이전
              </Button>
              <span className="px-4 py-2 text-sm text-gray-600">
                {filters.page} / {Math.ceil(total / filters.limit)}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={filters.page >= Math.ceil(total / filters.limit)}
                onClick={() => setPage(filters.page + 1)}
              >
                다음
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
