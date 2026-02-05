import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/common/Card';
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

  // 시세 데이터 가져오기
  useEffect(() => {
    if (statusFilter === 'open' && positions.length > 0) {
      fetchPrices();
      // 1분마다 갱신
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
    updateFilters({ status: status === 'all' ? null : status });
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
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">종목</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">평균매수가</th>
                  {statusFilter === 'open' && (
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">현재가</th>
                  )}
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">수량</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">매수금액</th>
                  {statusFilter === 'open' && (
                    <>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">평가금액</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">평가손익</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">수익률</th>
                    </>
                  )}
                  {statusFilter === 'closed' && (
                    <>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">손익</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">수익률</th>
                    </>
                  )}
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">보유기간</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">상태</th>
                  {adminMode && <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">관리</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {positions.map(position => (
                  <tr key={position.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link to={`/positions/${position.id}`} className="hover:text-primary-600">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-medium">{position.ticker_name || position.ticker}</p>
                            <p className="text-sm text-gray-500">{position.ticker}</p>
                          </div>
                          {position.status === 'open' && !position.is_info_confirmed && (
                            <span className="badge bg-yellow-100 text-yellow-800 text-xs">미수정</span>
                          )}
                        </div>
                        {/* 남은 계획 표시 */}
                        {position.status === 'open' && (position.remaining_buys > 0 || position.remaining_take_profits > 0 || position.remaining_stop_losses > 0) && (
                          <div className="flex gap-2 mt-1 text-xs">
                            {position.remaining_buys > 0 && (
                              <span className="text-blue-600">매수 {position.remaining_buys}건</span>
                            )}
                            {position.remaining_take_profits > 0 && (
                              <span className="text-red-600">익절 {position.remaining_take_profits}건</span>
                            )}
                            {position.remaining_stop_losses > 0 && (
                              <span className="text-gray-600">손절 {position.remaining_stop_losses}건</span>
                            )}
                          </div>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(position.average_buy_price, position.market)}
                    </td>
                    {statusFilter === 'open' && (
                      <td className="px-4 py-3 text-right">
                        {priceData[position.id]?.current_price
                          ? formatCurrency(priceData[position.id].current_price, position.market)
                          : priceLoading ? '...' : '-'}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right">
                      {formatQuantity(position.total_quantity)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(position.total_buy_amount, position.market)}
                    </td>
                    {statusFilter === 'open' && (
                      <>
                        <td className="px-4 py-3 text-right">
                          {priceData[position.id]?.evaluation_amount
                            ? formatCurrency(priceData[position.id].evaluation_amount, position.market)
                            : '-'}
                        </td>
                        <td className={`px-4 py-3 text-right ${getProfitLossClass(priceData[position.id]?.profit_loss)}`}>
                          {priceData[position.id]?.profit_loss != null
                            ? formatCurrency(priceData[position.id].profit_loss, position.market)
                            : '-'}
                        </td>
                        <td className={`px-4 py-3 text-right ${getProfitLossClass(priceData[position.id]?.profit_rate)}`}>
                          {priceData[position.id]?.profit_rate != null
                            ? formatPercent(priceData[position.id].profit_rate)
                            : '-'}
                        </td>
                      </>
                    )}
                    {statusFilter === 'closed' && (
                      <>
                        <td className={`px-4 py-3 text-right ${getProfitLossClass(position.profit_loss)}`}>
                          {formatCurrency(position.profit_loss, position.market)}
                        </td>
                        <td className={`px-4 py-3 text-right ${getProfitLossClass(position.profit_rate)}`}>
                          {formatPercent(position.profit_rate)}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3 text-right text-gray-500">
                      {formatHours(position.status === 'open' ? calcHoldingHours(position.opened_at) : position.holding_period_hours)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`badge ${getStatusBadgeClass(position.status)}`}>
                        {getStatusLabel(position.status)}
                      </span>
                    </td>
                    {adminMode && (
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={(e) => handleDelete(e, position)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded"
                          title="삭제"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {positions.map(position => (
              <Card key={position.id}>
                {adminMode && (
                  <div className="flex justify-end mb-2">
                    <button
                      onClick={(e) => handleDelete(e, position)}
                      className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      삭제
                    </button>
                  </div>
                )}
                <Link to={`/positions/${position.id}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{position.ticker_name || position.ticker}</p>
                          {position.status === 'open' && !position.is_info_confirmed && (
                            <span className="badge bg-yellow-100 text-yellow-800 text-xs">미수정</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">{position.ticker}</p>
                        {/* 남은 계획 표시 */}
                        {position.status === 'open' && (position.remaining_buys > 0 || position.remaining_take_profits > 0 || position.remaining_stop_losses > 0) && (
                          <div className="flex gap-2 text-xs">
                            {position.remaining_buys > 0 && (
                              <span className="text-blue-600">매수 {position.remaining_buys}건</span>
                            )}
                            {position.remaining_take_profits > 0 && (
                              <span className="text-red-600">익절 {position.remaining_take_profits}건</span>
                            )}
                            {position.remaining_stop_losses > 0 && (
                              <span className="text-gray-600">손절 {position.remaining_stop_losses}건</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className={`badge ${getStatusBadgeClass(position.status)}`}>
                      {getStatusLabel(position.status)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-gray-500">평균매수가</p>
                      <p className="font-medium">{formatCurrency(position.average_buy_price, position.market)}</p>
                    </div>
                    {position.status === 'open' && (
                      <div>
                        <p className="text-gray-500">현재가</p>
                        <p className="font-medium">
                          {priceData[position.id]?.current_price
                            ? formatCurrency(priceData[position.id].current_price, position.market)
                            : priceLoading ? '...' : '-'}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-gray-500">수량</p>
                      <p className="font-medium">{formatQuantity(position.total_quantity)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">매수금액</p>
                      <p className="font-medium">{formatCurrency(position.total_buy_amount, position.market)}</p>
                    </div>
                    {position.status === 'open' && priceData[position.id]?.profit_rate != null && (
                      <div>
                        <p className="text-gray-500">평가손익</p>
                        <p className={`font-medium ${getProfitLossClass(priceData[position.id].profit_rate)}`}>
                          {formatPercent(priceData[position.id].profit_rate)}
                        </p>
                      </div>
                    )}
                    {position.status === 'closed' && (
                      <div>
                        <p className="text-gray-500">수익률</p>
                        <p className={`font-medium ${getProfitLossClass(position.profit_rate)}`}>
                          {formatPercent(position.profit_rate)}
                        </p>
                      </div>
                    )}
                  </div>
                </Link>
              </Card>
            ))}
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
