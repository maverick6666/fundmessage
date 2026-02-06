import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { ProfitProgressBar } from '../components/common/ProfitProgressBar';
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
        <h1 className="text-2xl font-bold dark:text-gray-100">포지션</h1>
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
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            {status === 'open' ? '진행중' : status === 'closed' ? '종료' : '전체'}
          </button>
        ))}
      </div>

      {/* Positions List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">로딩중...</div>
      ) : error ? (
        <div className="text-center py-12 text-red-500 dark:text-red-400">{error}</div>
      ) : positions.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">포지션이 없습니다</div>
      ) : (
        <>
          <div className="space-y-4">
            {positions.map(position => {
              const isOpen = position.status === 'open';
              const price = priceData[position.id];
              const profitRate = isOpen ? price?.profit_rate : position.profit_rate;
              const profitLoss = isOpen ? price?.profit_loss : position.profit_loss;
              const holdingHours = isOpen ? calcHoldingHours(position.opened_at) : position.holding_period_hours;
              const expanded = expandedIds.has(position.id);
              const isProfit = profitRate != null && profitRate > 0;
              const isLoss = profitRate != null && profitRate < 0;

              return (
                <div
                  key={position.id}
                  className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border overflow-hidden transition-all ${
                    expanded ? 'shadow-md border-primary-200 dark:border-primary-700' : 'border-gray-200 dark:border-gray-700 hover:shadow-md'
                  }`}
                >
                  {/* Card Header */}
                  <div
                    className="cursor-pointer transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-700/50"
                    onClick={() => toggleExpand(position.id)}
                  >
                    {/* Top Row: Ticker + Status */}
                    <div className="px-5 pt-4 pb-2 flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                            {position.ticker_name || position.ticker}
                          </h3>
                          <span className="text-sm text-gray-400 dark:text-gray-500 font-mono">{position.ticker}</span>
                          {isOpen && !position.is_info_confirmed && (
                            <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-medium px-2 py-0.5 rounded-full">
                              미수정
                            </span>
                          )}
                        </div>
                        {/* Remaining plans */}
                        {isOpen && (position.remaining_buys > 0 || position.remaining_take_profits > 0 || position.remaining_stop_losses > 0) && (
                          <div className="flex gap-3 mt-1">
                            {position.remaining_buys > 0 && (
                              <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">
                                매수 {position.remaining_buys}건
                              </span>
                            )}
                            {position.remaining_take_profits > 0 && (
                              <span className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
                                익절 {position.remaining_take_profits}건
                              </span>
                            )}
                            {position.remaining_stop_losses > 0 && (
                              <span className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                                손절 {position.remaining_stop_losses}건
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${getStatusBadgeClass(position.status)}`}>
                          {getStatusLabel(position.status)}
                        </span>
                      </div>
                    </div>

                    {/* Key Metrics Row */}
                    <div className="px-5 pb-4">
                      <div className="flex items-end justify-between gap-4">
                        {/* Left metrics */}
                        <div className="flex gap-6 items-end">
                          <div>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">매수금액</p>
                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                              {formatCurrency(position.total_buy_amount, position.market)}
                            </p>
                          </div>
                          {isOpen && price?.current_price && (
                            <div>
                              <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">현재가</p>
                              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                {formatCurrency(price.current_price, position.market)}
                              </p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">보유기간</p>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{formatHours(holdingHours)}</p>
                          </div>
                        </div>

                        {/* Right: P&L highlight */}
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{isOpen ? '수익률' : '실현 수익률'}</p>
                            <ProfitProgressBar value={profitRate} size="lg" />
                          </div>
                          {/* Expand Arrow */}
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                            expanded ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400' : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
                          }`}>
                            <svg
                              className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                              fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expanded && (
                    <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                      <div className="px-5 py-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
                            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">평균매수가</p>
                            <p className="text-sm font-semibold">{formatCurrency(position.average_buy_price, position.market)}</p>
                          </div>
                          {isOpen && (
                            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
                              <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">현재가</p>
                              <p className="text-sm font-semibold">
                                {price?.current_price
                                  ? formatCurrency(price.current_price, position.market)
                                  : priceLoading ? '...' : '-'}
                              </p>
                            </div>
                          )}
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
                            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">수량</p>
                            <p className="text-sm font-semibold">{formatQuantity(position.total_quantity)}</p>
                          </div>
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
                            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">매수금액</p>
                            <p className="text-sm font-semibold">{formatCurrency(position.total_buy_amount, position.market)}</p>
                          </div>
                          {isOpen && (
                            <>
                              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
                                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">평가금액</p>
                                <p className="text-sm font-semibold">
                                  {price?.evaluation_amount
                                    ? formatCurrency(price.evaluation_amount, position.market)
                                    : '-'}
                                </p>
                              </div>
                              <div className={`rounded-lg p-3 border ${
                                isProfit ? 'bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-800' : isLoss ? 'bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-white border-gray-100 dark:bg-gray-800 dark:border-gray-700'
                              }`}>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">평가손익</p>
                                <p className={`text-sm font-bold ${getProfitLossClass(profitLoss)}`}>
                                  {profitLoss != null
                                    ? formatCurrency(profitLoss, position.market)
                                    : '-'}
                                </p>
                              </div>
                            </>
                          )}
                          {!isOpen && (
                            <div className={`rounded-lg p-3 border ${
                              isProfit ? 'bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-800' : isLoss ? 'bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-white border-gray-100 dark:bg-gray-800 dark:border-gray-700'
                            }`}>
                              <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">실현손익</p>
                              <p className={`text-sm font-bold ${getProfitLossClass(profitLoss)}`}>
                                {formatCurrency(profitLoss, position.market)}
                              </p>
                            </div>
                          )}
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
                            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">보유기간</p>
                            <p className="text-sm font-semibold">{formatHours(holdingHours)}</p>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <Link
                            to={`/positions/${position.id}`}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 dark:text-primary-400 dark:bg-primary-900/20 dark:hover:bg-primary-900/40 rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                            상세보기
                          </Link>
                          {adminMode && (
                            <button
                              onClick={(e) => handleDelete(e, position)}
                              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-lg transition-colors ml-auto"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              삭제
                            </button>
                          )}
                        </div>
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
              <span className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
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
