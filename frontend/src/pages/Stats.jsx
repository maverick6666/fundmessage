import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle } from '../components/common/Card';
import { ProfitProgressBar } from '../components/common/ProfitProgressBar';
import { AttendanceCalendar } from '../components/attendance/AttendanceCalendar';
import { statsService } from '../services/statsService';
import { positionService } from '../services/positionService';
import { userService } from '../services/userService';
import { useAuth } from '../hooks/useAuth';
import {
  formatCurrency,
  formatPercent,
  formatHours,
  formatNumber,
  getProfitLossClass
} from '../utils/formatters';

export function Stats() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('team');
  const [myStats, setMyStats] = useState(null);
  const [teamStats, setTeamStats] = useState(null);
  const [teamSettings, setTeamSettings] = useState(null);
  const [exchangeRate, setExchangeRate] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [selectedMemberStats, setSelectedMemberStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tickerFilter, setTickerFilter] = useState('open'); // open, closed, all

  useEffect(() => {
    fetchStats();
  }, [user]);

  const fetchStats = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [my, team, rate, settings, members] = await Promise.all([
        statsService.getUserStats(user.id),
        statsService.getTeamStats(),
        statsService.getExchangeRate().catch(() => ({ usd_krw: null })),
        positionService.getTeamSettings().catch(() => null),
        userService.getTeamMembers().catch(() => ({ members: [] }))
      ]);
      setMyStats(my);
      setTeamStats(team);
      setExchangeRate(rate.usd_krw);
      setTeamSettings(settings);
      setTeamMembers(members.members || []);
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

  if (loading) {
    return <div className="text-center py-12 text-gray-500 dark:text-gray-400">로딩중...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold dark:text-gray-100">통계</h1>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {['team', 'my', 'members', 'leaderboard'].map(tab => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              if (tab !== 'members') {
                setSelectedMemberId(null);
                setSelectedMemberStats(null);
              }
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            {tab === 'team' ? '팀 전체' : tab === 'my' ? '내 성과' : tab === 'members' ? '팀원' : '리더보드'}
          </button>
        ))}
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
          {/* 전체 자산 요약 */}
          {totalKrwAsset !== null && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">전체 자산 (KRW 환산)</h3>
              <Card>
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">KRW 보유</span>
                    <p className="font-medium dark:text-gray-200">{formatCurrency(krwCash, 'KRX')}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">KRW 평가</span>
                    <p className="font-medium dark:text-gray-200">{krwEvaluation > 0 ? formatCurrency(krwEvaluation, 'KRX') : '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">USD 보유</span>
                    <p className="font-medium dark:text-gray-200">{formatCurrency(usdCash, 'USD')}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">USD 평가</span>
                    <p className="font-medium dark:text-gray-200">{(usdEvaluation + usdtEvaluation) > 0 ? formatCurrency(usdEvaluation + usdtEvaluation, 'USD') : '-'}</p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* 통화별 평가자산 */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">평가자산</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 통화별 평가자산 */}
              {Object.entries(byCurrency).map(([currency, data]) => (
                <Card key={currency}>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{currency} 평가자산</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-bold">
                      {formatCurrency(data.evaluation, currency === 'KRW' ? 'KOSPI' : currency === 'USD' ? 'NASDAQ' : 'CRYPTO')}
                    </p>
                    <span className={`text-sm font-medium ${getProfitLossClass(data.unrealized_pl)}`}>
                      {formatPercent(data.pl_rate)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    투자: {formatCurrency(data.invested, currency === 'KRW' ? 'KOSPI' : currency === 'USD' ? 'NASDAQ' : 'CRYPTO')}
                    {' / '}
                    <span className={getProfitLossClass(data.unrealized_pl)}>
                      {data.unrealized_pl >= 0 ? '+' : ''}{formatCurrency(data.unrealized_pl, currency === 'KRW' ? 'KOSPI' : currency === 'USD' ? 'NASDAQ' : 'CRYPTO')}
                    </span>
                  </p>
                  {currency === 'USD' && exchangeRate && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {formatKrwEquivalent(data.evaluation)} (₩{exchangeRate.toLocaleString('ko-KR', {maximumFractionDigits: 0})}/$)
                    </p>
                  )}
                  {currency === 'USDT' && exchangeRate && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {formatKrwEquivalent(data.evaluation)} (₩{exchangeRate.toLocaleString('ko-KR', {maximumFractionDigits: 0})}/$)
                    </p>
                  )}
                </Card>
              ))}
              {/* 진행중 포지션이 없을 때 */}
              {Object.keys(byCurrency).length === 0 && (
                <Card>
                  <p className="text-sm text-gray-500 dark:text-gray-400">평가자산</p>
                  <p className="text-2xl font-bold text-gray-400">-</p>
                </Card>
              )}
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
                <p className="text-2xl font-bold">{formatPercent(teamStats.closed_positions?.win_rate || 0)}</p>
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
                  {formatPercent(teamStats.closed_positions?.avg_profit_rate || 0)}
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
                  {formatPercent(teamStats.closed_positions?.avg_profit_rate || 0)}
                </p>
              </div>
            </div>
          </Card>

          {/* 종목별 현황 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between w-full">
                <CardTitle>
                  종목별 현황
                  <span className="ml-2 text-sm font-normal text-gray-400">
                    {tickerFilter === 'open' && `진행중 ${filteredTickers.length}`}
                    {tickerFilter === 'closed' && `종료됨 ${filteredTickers.length}`}
                    {tickerFilter === 'all' && `전체 ${filteredTickers.length}`}
                  </span>
                </CardTitle>
                <div className="flex gap-1">
                  {[
                    { key: 'open', label: '진행중' },
                    { key: 'closed', label: '종료됨' },
                    { key: 'all', label: '전체' }
                  ].map(f => (
                    <button
                      key={f.key}
                      onClick={() => setTickerFilter(f.key)}
                      className={`px-3 py-1 text-xs rounded-full ${
                        tickerFilter === f.key
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
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
                    <tr><td colSpan={5} className="py-4 text-center text-gray-500 dark:text-gray-400">해당 종목이 없습니다</td></tr>
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
                              ? (ticker.unrealized_rate > 0 ? '+' : '') + formatPercent(ticker.unrealized_rate)
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
                            {ticker.profit_rate !== 0 ? formatPercent(ticker.profit_rate) : '-'}
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
                            {ticker.avg_profit_rate !== 0 ? formatPercent(ticker.avg_profit_rate) : '-'}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">평균 수익률</p>
              <ProfitProgressBar value={myStats.overall.avg_profit_rate} size="lg" />
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
                    <p className="text-red-600 dark:text-red-400">{formatPercent(myStats.best_trade.profit_rate)}</p>
                  </div>
                )}
                {myStats.worst_trade && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="text-sm text-gray-500 dark:text-gray-400">최악 거래</p>
                    <p className="font-medium dark:text-gray-200">{myStats.worst_trade.ticker}</p>
                    <p className="text-blue-600 dark:text-blue-400">{formatPercent(myStats.worst_trade.profit_rate)}</p>
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

      {/* Team Members */}
      {activeTab === 'members' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 팀원 목록 */}
          <Card>
            <CardHeader>
              <CardTitle>팀원 목록</CardTitle>
            </CardHeader>
            <div className="space-y-1">
              {teamMembers.map((member) => (
                <button
                  key={member.id}
                  onClick={async () => {
                    setSelectedMemberId(member.id);
                    try {
                      const stats = await statsService.getUserStats(member.id);
                      setSelectedMemberStats(stats);
                    } catch (error) {
                      console.error('Failed to fetch member stats:', error);
                      setSelectedMemberStats(null);
                    }
                  }}
                  className={`w-full px-3 py-2 text-left rounded-lg transition-colors ${
                    selectedMemberId === member.id
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium dark:text-gray-200">{member.full_name || member.username}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      member.role === 'manager'
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                        : member.role === 'admin'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {member.role === 'manager' ? '팀장' : member.role === 'admin' ? '관리자' : '팀원'}
                    </span>
                  </div>
                </button>
              ))}
              {teamMembers.length === 0 && (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">팀원이 없습니다</p>
              )}
            </div>
          </Card>

          {/* 선택된 팀원 통계 */}
          <div className="lg:col-span-2 space-y-4">
            {selectedMemberStats ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {teamMembers.find(m => m.id === selectedMemberId)?.full_name || '팀원'} 통계
                    </CardTitle>
                  </CardHeader>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-sm text-gray-500 dark:text-gray-400">총 거래</p>
                      <p className="text-xl font-bold dark:text-gray-100">{selectedMemberStats.overall?.total_trades || 0}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-500 dark:text-gray-400">승률</p>
                      <p className="text-xl font-bold dark:text-gray-100">{formatPercent(selectedMemberStats.overall?.win_rate || 0)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-500 dark:text-gray-400">총 손익</p>
                      <p className={`text-xl font-bold ${getProfitLossClass(selectedMemberStats.overall?.total_profit_loss)}`}>
                        {formatCurrency(selectedMemberStats.overall?.total_profit_loss || 0)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">평균 수익률</p>
                      <ProfitProgressBar value={selectedMemberStats.overall?.avg_profit_rate || 0} size="md" />
                    </div>
                  </div>
                </Card>

                {selectedMemberStats.best_trade && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">최고 거래</p>
                      <p className="font-medium dark:text-gray-200">{selectedMemberStats.best_trade.ticker}</p>
                      <ProfitProgressBar value={selectedMemberStats.best_trade.profit_rate} size="sm" />
                    </Card>
                    {selectedMemberStats.worst_trade && (
                      <Card>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">최악 거래</p>
                        <p className="font-medium dark:text-gray-200">{selectedMemberStats.worst_trade.ticker}</p>
                        <ProfitProgressBar value={selectedMemberStats.worst_trade.profit_rate} size="sm" />
                      </Card>
                    )}
                  </div>
                )}
              </>
            ) : (
              <Card>
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <p>팀원을 선택하면 통계를 볼 수 있습니다</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      {activeTab === 'leaderboard' && teamStats && (
        <Card>
          <CardHeader>
            <CardTitle>리더보드</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b dark:border-gray-700">
                  <th className="py-2 text-left">순위</th>
                  <th className="py-2 text-left">팀원</th>
                  <th className="py-2 text-right">실현 손익</th>
                  <th className="py-2 text-right">미실현 손익</th>
                  <th className="py-2 text-right">총 손익</th>
                  <th className="py-2 text-right">승률</th>
                  <th className="py-2 text-right">거래</th>
                </tr>
              </thead>
              <tbody>
                {teamStats.leaderboard.map((entry) => (
                  <tr key={entry.rank} className="border-b dark:border-gray-700">
                    <td className="py-2">
                      {entry.rank === 1 && '🥇'}
                      {entry.rank === 2 && '🥈'}
                      {entry.rank === 3 && '🥉'}
                      {entry.rank > 3 && entry.rank}
                    </td>
                    <td className="py-2 font-medium dark:text-gray-200">{entry.user.full_name || entry.user.username}</td>
                    <td className={`py-2 text-right ${getProfitLossClass(entry.realized_pl)}`}>
                      {formatCurrency(entry.realized_pl)}
                    </td>
                    <td className={`py-2 text-right ${getProfitLossClass(entry.unrealized_pl)}`}>
                      {entry.unrealized_pl !== 0 ? formatCurrency(entry.unrealized_pl) : '-'}
                    </td>
                    <td className={`py-2 text-right font-medium ${getProfitLossClass(entry.total_profit_loss)}`}>
                      {formatCurrency(entry.total_profit_loss)}
                    </td>
                    <td className="py-2 text-right">{formatPercent(entry.win_rate)}</td>
                    <td className="py-2 text-right">
                      {entry.closed_trades}
                      {entry.open_trades > 0 && (
                        <span className="text-green-600 dark:text-green-400 text-xs ml-1">+{entry.open_trades}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
