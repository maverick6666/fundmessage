import { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle } from '../components/common/Card';
import { TabGroup } from '../components/common/TabGroup';
import { SegmentControl } from '../components/common/SegmentControl';
import { FilterPills } from '../components/common/FilterPills';
import { EmptyState } from '../components/common/EmptyState';
import { AttendanceCalendar } from '../components/attendance/AttendanceCalendar';
import { statsService } from '../services/statsService';
import { positionService } from '../services/positionService';
import { useAuth } from '../hooks/useAuth';
import {
  formatCurrency,
  formatPercent,
  formatProfitRate,
  formatHours,
  formatNumber,
  getProfitLossClass
} from '../utils/formatters';
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';

// 기간 필터 옵션
const PERIOD_OPTIONS = [
  { key: '1w', label: '1주' },
  { key: '1m', label: '1개월' },
  { key: '3m', label: '분기' },
  { key: 'all', label: '전체' }
];

// 탭 옵션
const TAB_OPTIONS = [
  { key: 'team', label: '팀 전체' },
  { key: 'my', label: '내 성과' }
];

// 종목 필터 옵션
const TICKER_FILTER_OPTIONS = [
  { key: 'open', label: '진행중' },
  { key: 'closed', label: '종료됨' },
  { key: 'all', label: '전체' }
];

// 히트맵 색상 스케일
function getHeatmapColor(rate) {
  if (rate === null || rate === undefined || rate === 0) return 'bg-slate-600';
  if (rate <= -0.10) return 'bg-rose-700';
  if (rate <= -0.05) return 'bg-rose-500';
  if (rate < -0.01) return 'bg-rose-400';
  if (rate < 0.01) return 'bg-slate-500';
  if (rate < 0.05) return 'bg-emerald-400';
  if (rate < 0.10) return 'bg-emerald-500';
  return 'bg-emerald-700';
}

export function Stats() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('team');
  const [myStats, setMyStats] = useState(null);
  const [teamStats, setTeamStats] = useState(null);
  const [teamSettings, setTeamSettings] = useState(null);
  const [exchangeRate, setExchangeRate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tickerFilter, setTickerFilter] = useState('open'); // open, closed, all
  const [tickerViewMode, setTickerViewMode] = useState('table'); // table, heatmap
  const [periodFilter, setPeriodFilter] = useState('all'); // 1w, 1m, 3m, all
  const [chartData, setChartData] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);

  useEffect(() => {
    fetchStats();
  }, [user]);

  // 자산 히스토리 데이터 로드
  useEffect(() => {
    const fetchAssetHistory = async () => {
      setChartLoading(true);
      try {
        const data = await statsService.getAssetHistory(periodFilter);
        setChartData(data || []);
      } catch (error) {
        console.error('Failed to fetch asset history:', error);
        setChartData([]);
      } finally {
        setChartLoading(false);
      }
    };
    fetchAssetHistory();
  }, [periodFilter]);

  const fetchStats = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [my, team, rate, settings] = await Promise.all([
        statsService.getUserStats(user.id),
        statsService.getTeamStats(),
        statsService.getExchangeRate().catch(() => ({ usd_krw: null })),
        positionService.getTeamSettings().catch(() => null)
      ]);
      setMyStats(my);
      setTeamStats(team);
      setExchangeRate(rate.usd_krw);
      setTeamSettings(settings);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatKrwEquivalent = (usdAmount) => {
    if (!exchangeRate || !usdAmount) return null;
    const krwValue = usdAmount * exchangeRate;
    return `≈ ${new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(krwValue)}`;
  };

  const filteredTickers = teamStats?.by_ticker?.filter(t => {
    if (tickerFilter === 'open') return t.open_count > 0;
    if (tickerFilter === 'closed') return t.closed_count > 0;
    return true;
  }) || [];

  // 차트 데이터가 없을 때 표시할 메시지
  const hasChartData = chartData && chartData.length > 0;

  if (loading) {
    return <div className="text-center py-12 text-gray-500 dark:text-gray-400">로딩중...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header with title, tabs, and period filter */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-2xl font-bold dark:text-gray-100">통계</h1>

          {/* Period Filter - SegmentControl */}
          <SegmentControl
            options={PERIOD_OPTIONS}
            value={periodFilter}
            onChange={setPeriodFilter}
            size="sm"
          />
        </div>

        {/* Tabs - TabGroup */}
        <TabGroup
          tabs={TAB_OPTIONS}
          activeTab={activeTab}
          onChange={setActiveTab}
          variant="primary"
        />
      </div>

      {/* Team Stats */}
      {activeTab === 'team' && teamStats && (() => {
        // 자산 계산
        const capitalKrw = Number(teamSettings?.initial_capital_krw) || 0;
        const capitalUsd = Number(teamSettings?.initial_capital_usd) || 0;
        const byCurrency = teamStats.open_positions?.by_currency || {};

        const krwInvested = byCurrency['KRW']?.invested || 0;
        const krwEvaluation = byCurrency['KRW']?.evaluation || 0;
        const usdInvested = byCurrency['USD']?.invested || 0;
        const usdEvaluation = byCurrency['USD']?.evaluation || 0;
        const usdtInvested = byCurrency['USDT']?.invested || 0;
        const usdtEvaluation = byCurrency['USDT']?.evaluation || 0;

        // 보유 현금 (자본금 - 투자금)
        const krwCash = capitalKrw - krwInvested;
        const usdCash = capitalUsd - usdInvested - usdtInvested;

        // KRW 기준 전체 자산 = KRW 현금 + KRW 평가 + (USD 현금 + USD 평가 + USDT 평가) * 환율
        const totalKrwAsset = exchangeRate
          ? krwCash + krwEvaluation + (usdCash + usdEvaluation + usdtEvaluation) * exchangeRate
          : null;

        // 초기 자산 (KRW 환산)
        const initialKrwAsset = exchangeRate
          ? capitalKrw + capitalUsd * exchangeRate
          : null;

        // 수익률
        const totalReturnRate = (initialKrwAsset && initialKrwAsset > 0 && totalKrwAsset !== null)
          ? (totalKrwAsset - initialKrwAsset) / initialKrwAsset
          : null;

        return (
        <div className="space-y-6">
          {/* 전체 자산 요약 - 히어로 섹션 */}
          {totalKrwAsset !== null && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">전체 자산 (KRW 환산)</h3>
              <Card className="overflow-hidden">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <p className="text-3xl font-bold">
                    {formatCurrency(totalKrwAsset, 'KRX')}
                  </p>
                  {totalReturnRate !== null && (
                    <span className={`text-lg font-bold ${getProfitLossClass(totalReturnRate)}`}>
                      {totalReturnRate >= 0 ? '+' : ''}{formatPercent(totalReturnRate)}
                    </span>
                  )}
                  {exchangeRate && (
                    <span className="text-sm text-gray-400 dark:text-gray-500">
                      환율 ₩{formatNumber(exchangeRate, 0)}/$
                    </span>
                  )}
                </div>
                {initialKrwAsset && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    초기자산: {formatCurrency(initialKrwAsset, 'KRX')}
                    {totalKrwAsset !== null && (
                      <span className={`ml-2 ${getProfitLossClass(totalKrwAsset - initialKrwAsset)}`}>
                        {totalKrwAsset - initialKrwAsset >= 0 ? '+' : ''}{formatCurrency(totalKrwAsset - initialKrwAsset, 'KRX')}
                      </span>
                    )}
                  </p>
                )}

                {/* 수익 추이 차트 */}
                <div className="mt-4 -mx-4 -mb-4">
                  <div className="h-40 w-full">
                    {chartLoading ? (
                      <div className="h-full flex items-center justify-center text-gray-400">
                        <span className="text-sm">차트 로딩중...</span>
                      </div>
                    ) : hasChartData ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={totalReturnRate >= 0 ? '#10b981' : '#f43f5e'} stopOpacity={0.3}/>
                              <stop offset="95%" stopColor={totalReturnRate >= 0 ? '#10b981' : '#f43f5e'} stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <XAxis
                            dataKey="date"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: '#6b7280' }}
                            interval="preserveStartEnd"
                          />
                          <YAxis hide domain={['dataMin - 500000', 'dataMax + 500000']} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'rgba(17, 24, 39, 0.95)',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '8px 12px'
                            }}
                            labelStyle={{ color: '#9ca3af', fontSize: '12px' }}
                            formatter={(value) => [formatCurrency(value, 'KRX'), '자산']}
                          />
                          <Area
                            type="monotone"
                            dataKey="value"
                            stroke={totalReturnRate >= 0 ? '#10b981' : '#f43f5e'}
                            strokeWidth={2}
                            fill="url(#colorValue)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                        <span className="text-sm">자산 히스토리 데이터가 없습니다</span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              {/* 보유 현황 카드 그리드 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400">KRW 보유</span>
                  <p className="font-semibold text-lg dark:text-gray-200">{formatCurrency(krwCash, 'KRX')}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400">KRW 평가</span>
                  <p className="font-semibold text-lg dark:text-gray-200">{krwEvaluation > 0 ? formatCurrency(krwEvaluation, 'KRX') : '-'}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400">USD 보유</span>
                  <p className="font-semibold text-lg dark:text-gray-200">{formatCurrency(usdCash, 'USD')}</p>
                  {exchangeRate && usdCash > 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-500">≈{formatCurrency(usdCash * exchangeRate, 'KRX')}</p>
                  )}
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400">USD 평가</span>
                  <p className="font-semibold text-lg dark:text-gray-200">{(usdEvaluation + usdtEvaluation) > 0 ? formatCurrency(usdEvaluation + usdtEvaluation, 'USD') : '-'}</p>
                  {exchangeRate && (usdEvaluation + usdtEvaluation) > 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-500">≈{formatCurrency((usdEvaluation + usdtEvaluation) * exchangeRate, 'KRX')}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 통화별 평가자산 */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">평가자산</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* KRW 평가자산 - 항상 표시 */}
              <Card>
                <p className="text-sm text-gray-500 dark:text-gray-400">KRW 평가자산</p>
                {byCurrency['KRW'] ? (
                  <>
                    <div className="flex items-baseline gap-2">
                      <p className="text-2xl font-bold">
                        {formatCurrency(byCurrency['KRW'].evaluation, 'KOSPI')}
                      </p>
                      <span className={`text-sm font-medium ${getProfitLossClass(byCurrency['KRW'].unrealized_pl)}`}>
                        {formatPercent(byCurrency['KRW'].pl_rate)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      투자: {formatCurrency(byCurrency['KRW'].invested, 'KOSPI')}
                      {' / '}
                      <span className={getProfitLossClass(byCurrency['KRW'].unrealized_pl)}>
                        {byCurrency['KRW'].unrealized_pl >= 0 ? '+' : ''}{formatCurrency(byCurrency['KRW'].unrealized_pl, 'KOSPI')}
                      </span>
                    </p>
                  </>
                ) : (
                  <p className="text-2xl font-bold text-gray-400 dark:text-gray-500">-</p>
                )}
              </Card>

              {/* USD 평가자산 - 항상 표시 */}
              <Card>
                <p className="text-sm text-gray-500 dark:text-gray-400">USD 평가자산</p>
                {byCurrency['USD'] || byCurrency['USDT'] ? (
                  <>
                    <div className="flex items-baseline gap-2">
                      <p className="text-2xl font-bold">
                        {formatCurrency((byCurrency['USD']?.evaluation || 0) + (byCurrency['USDT']?.evaluation || 0), 'NASDAQ')}
                      </p>
                      <span className={`text-sm font-medium ${getProfitLossClass((byCurrency['USD']?.unrealized_pl || 0) + (byCurrency['USDT']?.unrealized_pl || 0))}`}>
                        {formatPercent(((byCurrency['USD']?.pl_rate || 0) + (byCurrency['USDT']?.pl_rate || 0)) / ((byCurrency['USD'] ? 1 : 0) + (byCurrency['USDT'] ? 1 : 0)) || 0)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      투자: {formatCurrency((byCurrency['USD']?.invested || 0) + (byCurrency['USDT']?.invested || 0), 'NASDAQ')}
                      {' / '}
                      <span className={getProfitLossClass((byCurrency['USD']?.unrealized_pl || 0) + (byCurrency['USDT']?.unrealized_pl || 0))}>
                        {((byCurrency['USD']?.unrealized_pl || 0) + (byCurrency['USDT']?.unrealized_pl || 0)) >= 0 ? '+' : ''}{formatCurrency((byCurrency['USD']?.unrealized_pl || 0) + (byCurrency['USDT']?.unrealized_pl || 0), 'NASDAQ')}
                      </span>
                    </p>
                    {exchangeRate && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {formatKrwEquivalent((byCurrency['USD']?.evaluation || 0) + (byCurrency['USDT']?.evaluation || 0))} (₩{exchangeRate.toLocaleString('ko-KR', {maximumFractionDigits: 0})}/$)
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-2xl font-bold text-gray-400 dark:text-gray-500">-</p>
                )}
              </Card>
            </div>
          </div>

          {/* 종료된 포지션 */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">실현 성과</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <p className="text-sm text-gray-500 dark:text-gray-400">종료 거래</p>
                <p className="text-2xl font-bold">{teamStats.closed_positions?.count || 0}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {teamStats.closed_positions?.winning_trades || 0}승 / {teamStats.closed_positions?.losing_trades || 0}패
                </p>
              </Card>
              <Card>
                <p className="text-sm text-gray-500 dark:text-gray-400">승률</p>
                <div className="flex items-center gap-3">
                  {/* 원형 승률 표시 */}
                  <div className="relative w-12 h-12">
                    <svg className="w-12 h-12 transform -rotate-90">
                      <circle
                        cx="24"
                        cy="24"
                        r="20"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                        className="text-gray-200 dark:text-gray-700"
                      />
                      <circle
                        cx="24"
                        cy="24"
                        r="20"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                        strokeDasharray={`${(teamStats.closed_positions?.win_rate || 0) * 125.6} 125.6`}
                        className="text-emerald-500"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                      {Math.round((teamStats.closed_positions?.win_rate || 0) * 100)}%
                    </span>
                  </div>
                  <p className="text-2xl font-bold">{formatPercent(teamStats.closed_positions?.win_rate || 0)}</p>
                </div>
              </Card>
              <Card>
                <p className="text-sm text-gray-500 dark:text-gray-400">실현 손익</p>
                <p className={`text-2xl font-bold ${getProfitLossClass(teamStats.closed_positions?.realized_profit_loss)}`}>
                  {formatCurrency(teamStats.closed_positions?.realized_profit_loss || 0)}
                </p>
              </Card>
              <Card>
                <p className="text-sm text-gray-500 dark:text-gray-400">평균 수익률</p>
                <p className={`text-2xl font-bold ${getProfitLossClass(teamStats.closed_positions?.avg_profit_rate)}`}>
                  {formatProfitRate(teamStats.closed_positions?.avg_profit_rate || 0)}
                </p>
              </Card>
            </div>
          </div>

          {/* 팀 상세지표 */}
          <Card>
            <CardHeader>
              <CardTitle>팀 상세지표</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">수익 거래</span>
                <p className="text-lg font-medium text-red-600 dark:text-red-400">{teamStats.closed_positions?.winning_trades || 0}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">손실 거래</span>
                <p className="text-lg font-medium text-blue-600 dark:text-blue-400">{teamStats.closed_positions?.losing_trades || 0}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">평균 보유시간</span>
                <p className="text-lg font-medium dark:text-gray-200">{formatHours(teamStats.closed_positions?.avg_holding_hours || 0)}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">평균 수익률</span>
                <p className={`text-lg font-medium ${getProfitLossClass(teamStats.closed_positions?.avg_profit_rate)}`}>
                  {formatProfitRate(teamStats.closed_positions?.avg_profit_rate || 0)}
                </p>
              </div>
            </div>
          </Card>

          {/* 종목별 현황 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between w-full flex-wrap gap-2">
                <CardTitle>
                  종목별 현황
                  <span className="ml-2 text-sm font-normal text-gray-400">
                    {tickerFilter === 'open' && `진행중 ${filteredTickers.length}`}
                    {tickerFilter === 'closed' && `종료됨 ${filteredTickers.length}`}
                    {tickerFilter === 'all' && `전체 ${filteredTickers.length}`}
                  </span>
                </CardTitle>
                <div className="flex gap-2 items-center">
                  {/* 뷰 모드 토글 */}
                  <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-0.5 rounded-md">
                    <button
                      onClick={() => setTickerViewMode('table')}
                      className={`p-1.5 rounded ${
                        tickerViewMode === 'table'
                          ? 'bg-white dark:bg-gray-700 shadow-sm'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                      title="테이블 뷰"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setTickerViewMode('heatmap')}
                      className={`p-1.5 rounded ${
                        tickerViewMode === 'heatmap'
                          ? 'bg-white dark:bg-gray-700 shadow-sm'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                      title="히트맵 뷰"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                      </svg>
                    </button>
                  </div>

                  {/* 필터 버튼 - FilterPills */}
                  <FilterPills
                    options={TICKER_FILTER_OPTIONS}
                    value={tickerFilter}
                    onChange={setTickerFilter}
                    size="sm"
                  />
                </div>
              </div>
            </CardHeader>
            {/* 히트맵 뷰 */}
            {tickerViewMode === 'heatmap' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {filteredTickers.length === 0 ? (
                  <div className="col-span-full">
                    <EmptyState
                      icon="chart"
                      title="해당 종목이 없습니다"
                      description={tickerFilter === 'open' ? '진행중인 포지션이 없습니다' : '종료된 포지션이 없습니다'}
                    />
                  </div>
                ) : (
                  filteredTickers.map((ticker, i) => {
                    const rate = tickerFilter === 'open' ? ticker.unrealized_rate :
                                 tickerFilter === 'closed' ? ticker.profit_rate :
                                 ticker.avg_profit_rate;
                    return (
                      <div
                        key={i}
                        className={`${getHeatmapColor(rate)} rounded-lg p-3 flex flex-col items-center justify-center min-h-[100px] transition-transform hover:scale-105`}
                      >
                        <span className="font-semibold text-white text-sm text-center truncate w-full">
                          {ticker.ticker_name || ticker.ticker}
                        </span>
                        <span className="text-white/70 text-xs mt-0.5">
                          {ticker.ticker}
                        </span>
                        <span className="text-white font-bold text-lg mt-1">
                          {rate !== 0 && rate !== null
                            ? formatProfitRate(rate)
                            : '-'
                          }
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* 테이블 뷰 */}
            {tickerViewMode === 'table' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b dark:border-gray-700">
                    <th className="py-2 text-left">종목</th>
                    {tickerFilter === 'open' && (
                      <>
                        <th className="py-2 text-right">투자금</th>
                        <th className="py-2 text-right">평가금액</th>
                        <th className="py-2 text-right">미실현 손익</th>
                        <th className="py-2 text-right">수익률</th>
                      </>
                    )}
                    {tickerFilter === 'closed' && (
                      <>
                        <th className="py-2 text-right">거래금액</th>
                        <th className="py-2 text-right">실현 손익</th>
                        <th className="py-2 text-right">수익률</th>
                        <th className="py-2 text-right">평균 보유</th>
                      </>
                    )}
                    {tickerFilter === 'all' && (
                      <>
                        <th className="py-2 text-center">진행/종료</th>
                        <th className="py-2 text-right">투자금</th>
                        <th className="py-2 text-right">손익</th>
                        <th className="py-2 text-right">수익률</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredTickers.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <EmptyState
                          icon="chart"
                          title="해당 종목이 없습니다"
                          description={tickerFilter === 'open' ? '진행중인 포지션이 없습니다' : '종료된 포지션이 없습니다'}
                        />
                      </td>
                    </tr>
                  ) : filteredTickers.map((ticker, i) => (
                    <tr key={i} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="py-2.5">
                        <div className="font-medium dark:text-gray-200">{ticker.ticker_name || ticker.ticker}</div>
                        <div className="text-xs text-gray-400 dark:text-gray-500">{ticker.ticker} · {ticker.market}</div>
                      </td>
                      {tickerFilter === 'open' && (
                        <>
                          <td className="py-2.5 text-right">
                            {formatCurrency(ticker.invested, ticker.market)}
                          </td>
                          <td className="py-2.5 text-right">
                            {ticker.evaluation > 0 ? formatCurrency(ticker.evaluation, ticker.market) : '-'}
                          </td>
                          <td className={`py-2.5 text-right ${getProfitLossClass(ticker.unrealized_pl)}`}>
                            {ticker.unrealized_pl !== 0
                              ? (ticker.unrealized_pl > 0 ? '+' : '') + formatCurrency(ticker.unrealized_pl, ticker.market)
                              : '-'}
                          </td>
                          <td className={`py-2.5 text-right font-medium ${getProfitLossClass(ticker.unrealized_rate)}`}>
                            {ticker.unrealized_rate !== 0
                              ? formatProfitRate(ticker.unrealized_rate)
                              : '-'}
                          </td>
                        </>
                      )}
                      {tickerFilter === 'closed' && (
                        <>
                          <td className="py-2.5 text-right">
                            {ticker.closed_volume > 0 ? formatCurrency(ticker.closed_volume, ticker.market) : '-'}
                          </td>
                          <td className={`py-2.5 text-right ${getProfitLossClass(ticker.profit_loss)}`}>
                            {ticker.profit_loss !== 0
                              ? (ticker.profit_loss > 0 ? '+' : '') + formatCurrency(ticker.profit_loss, ticker.market)
                              : '-'}
                          </td>
                          <td className={`py-2.5 text-right font-medium ${getProfitLossClass(ticker.profit_rate)}`}>
                            {ticker.profit_rate !== 0 ? formatProfitRate(ticker.profit_rate) : '-'}
                          </td>
                          <td className="py-2.5 text-right text-gray-500">
                            {ticker.avg_holding_hours > 0 ? formatHours(ticker.avg_holding_hours) : '-'}
                          </td>
                        </>
                      )}
                      {tickerFilter === 'all' && (
                        <>
                          <td className="py-2.5 text-center">
                            {ticker.open_count > 0 && <span className="text-green-600 dark:text-green-400 font-medium">{ticker.open_count}</span>}
                            {ticker.open_count > 0 && ticker.closed_count > 0 && <span className="text-gray-300 dark:text-gray-600 mx-1">/</span>}
                            {ticker.closed_count > 0 && <span className="text-gray-500 dark:text-gray-400">{ticker.closed_count}</span>}
                            {ticker.open_count === 0 && ticker.closed_count === 0 && '-'}
                          </td>
                          <td className="py-2.5 text-right">
                            {ticker.invested > 0
                              ? formatCurrency(ticker.invested, ticker.market)
                              : ticker.closed_volume > 0
                                ? formatCurrency(ticker.closed_volume, ticker.market)
                                : '-'}
                          </td>
                          <td className="py-2.5 text-right">
                            {ticker.open_count > 0 && ticker.unrealized_pl !== 0 && (
                              <div className={getProfitLossClass(ticker.unrealized_pl)}>
                                <span className="text-xs text-gray-400 dark:text-gray-500">미실현 </span>
                                {ticker.unrealized_pl > 0 ? '+' : ''}{formatCurrency(ticker.unrealized_pl, ticker.market)}
                              </div>
                            )}
                            {ticker.closed_count > 0 && ticker.profit_loss !== 0 && (
                              <div className={getProfitLossClass(ticker.profit_loss)}>
                                <span className="text-xs text-gray-400 dark:text-gray-500">실현 </span>
                                {ticker.profit_loss > 0 ? '+' : ''}{formatCurrency(ticker.profit_loss, ticker.market)}
                              </div>
                            )}
                            {ticker.unrealized_pl === 0 && ticker.profit_loss === 0 && '-'}
                          </td>
                          <td className={`py-2.5 text-right font-medium ${getProfitLossClass(ticker.avg_profit_rate)}`}>
                            {ticker.avg_profit_rate !== 0 ? formatProfitRate(ticker.avg_profit_rate) : '-'}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </Card>
        </div>
        );
      })()}

      {/* My Stats */}
      {activeTab === 'my' && myStats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <p className="text-sm text-gray-500 dark:text-gray-400">총 거래</p>
              <p className="text-2xl font-bold">{myStats.overall.total_trades}</p>
            </Card>
            <Card>
              <p className="text-sm text-gray-500 dark:text-gray-400">승률</p>
              <p className="text-2xl font-bold">{formatPercent(myStats.overall.win_rate)}</p>
            </Card>
            <Card>
              <p className="text-sm text-gray-500 dark:text-gray-400">총 손익</p>
              <p className={`text-2xl font-bold ${getProfitLossClass(myStats.overall.total_profit_loss)}`}>
                {formatCurrency(myStats.overall.total_profit_loss)}
              </p>
            </Card>
            <Card>
              <p className="text-sm text-gray-500 dark:text-gray-400">평균 수익률</p>
              <p className={`text-2xl font-bold ${getProfitLossClass(myStats.overall.avg_profit_rate)}`}>
                {formatProfitRate(myStats.overall.avg_profit_rate)}
              </p>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>상세 지표</CardTitle>
              </CardHeader>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">수익 거래</span>
                  <span className="font-medium text-red-600">{myStats.overall.winning_trades}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">손실 거래</span>
                  <span className="font-medium text-blue-600">{myStats.overall.losing_trades}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">평균 보유 시간</span>
                  <span className="font-medium dark:text-gray-200">{formatHours(myStats.overall.avg_holding_hours)}</span>
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>최고/최악 거래</CardTitle>
              </CardHeader>
              <div className="space-y-4">
                {myStats.best_trade && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-sm text-gray-500 dark:text-gray-400">최고 거래</p>
                    <p className="font-medium dark:text-gray-200">{myStats.best_trade.ticker}</p>
                    <p className="text-red-600 dark:text-red-400">{formatProfitRate(myStats.best_trade.profit_rate)}</p>
                  </div>
                )}
                {myStats.worst_trade && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="text-sm text-gray-500 dark:text-gray-400">최악 거래</p>
                    <p className="font-medium dark:text-gray-200">{myStats.worst_trade.ticker}</p>
                    <p className="text-blue-600 dark:text-blue-400">{formatProfitRate(myStats.worst_trade.profit_rate)}</p>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* 출석 현황 */}
          <div className="mt-6">
            <h3 className="text-lg font-medium mb-4 dark:text-gray-200">출석 현황</h3>
            <AttendanceCalendar />
          </div>
        </div>
      )}

    </div>
  );
}
