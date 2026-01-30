import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { usePositions } from '../hooks/usePositions';
import { priceService } from '../services/priceService';
import {
  formatCurrency,
  formatPercent,
  formatHours,
  getStatusBadgeClass,
  getStatusLabel,
  getProfitLossClass
} from '../utils/formatters';

export function Positions() {
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
                </tr>
              </thead>
              <tbody className="divide-y">
                {positions.map(position => (
                  <tr key={position.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link to={`/positions/${position.id}`} className="hover:text-primary-600 flex items-center gap-2">
                        <div>
                          <p className="font-medium">{position.ticker_name || position.ticker}</p>
                          <p className="text-sm text-gray-500">{position.ticker}</p>
                        </div>
                        {position.status === 'open' && !position.is_info_confirmed && (
                          <span className="text-yellow-500" title="정보 확인 필요">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </span>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(position.average_buy_price)}
                    </td>
                    {statusFilter === 'open' && (
                      <td className="px-4 py-3 text-right">
                        {priceData[position.id]?.current_price
                          ? formatCurrency(priceData[position.id].current_price)
                          : priceLoading ? '...' : '-'}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right">
                      {position.total_quantity}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(position.total_buy_amount)}
                    </td>
                    {statusFilter === 'open' && (
                      <>
                        <td className="px-4 py-3 text-right">
                          {priceData[position.id]?.evaluation_amount
                            ? formatCurrency(priceData[position.id].evaluation_amount)
                            : '-'}
                        </td>
                        <td className={`px-4 py-3 text-right ${getProfitLossClass(priceData[position.id]?.profit_loss)}`}>
                          {priceData[position.id]?.profit_loss != null
                            ? formatCurrency(priceData[position.id].profit_loss)
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
                          {formatCurrency(position.profit_loss)}
                        </td>
                        <td className={`px-4 py-3 text-right ${getProfitLossClass(position.profit_rate)}`}>
                          {formatPercent(position.profit_rate)}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3 text-right text-gray-500">
                      {formatHours(position.holding_period_hours)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`badge ${getStatusBadgeClass(position.status)}`}>
                        {getStatusLabel(position.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {positions.map(position => (
              <Card key={position.id}>
                <Link to={`/positions/${position.id}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="font-medium">{position.ticker_name || position.ticker}</p>
                        <p className="text-sm text-gray-500">{position.ticker}</p>
                      </div>
                      {position.status === 'open' && !position.is_info_confirmed && (
                        <span className="text-yellow-500" title="정보 확인 필요">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                    </div>
                    <span className={`badge ${getStatusBadgeClass(position.status)}`}>
                      {getStatusLabel(position.status)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-gray-500">평균매수가</p>
                      <p className="font-medium">{formatCurrency(position.average_buy_price)}</p>
                    </div>
                    {position.status === 'open' && (
                      <div>
                        <p className="text-gray-500">현재가</p>
                        <p className="font-medium">
                          {priceData[position.id]?.current_price
                            ? formatCurrency(priceData[position.id].current_price)
                            : priceLoading ? '...' : '-'}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-gray-500">수량</p>
                      <p className="font-medium">{position.total_quantity}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">매수금액</p>
                      <p className="font-medium">{formatCurrency(position.total_buy_amount)}</p>
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
