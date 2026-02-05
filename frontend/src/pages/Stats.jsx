import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle } from '../components/common/Card';
import { statsService } from '../services/statsService';
import { positionService } from '../services/positionService';
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
  const [loading, setLoading] = useState(true);
  const [tickerFilter, setTickerFilter] = useState('open'); // open, closed, all

  useEffect(() => {
    fetchStats();
  }, [user]);

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

  if (loading) {
    return <div className="text-center py-12 text-gray-500">로딩중...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">통계</h1>

      {/* Tabs */}
      <div className="flex gap-2">
        {['team', 'my', 'leaderboard'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab === 'team' ? '팀 전체' : tab === 'my' ? '내 성과' : '리더보드'}
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
              <h3 className="text-sm font-medium text-gray-500 mb-3">전체 자산 (KRW 환산)</h3>
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
                    <span className="text-sm text-gray-400">
                      환율 ₩{formatNumber(exchangeRate, 0)}/$
                    </span>
                  )}
                </div>
                {initialKrwAsset && (
                  <p className="text-xs text-gray-400 mt-1">
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
                    <span className="text-gray-500">KRW 보유</span>
                    <p className="font-medium">{formatCurrency(krwCash, 'KRX')}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">KRW 평가</span>
                    <p className="font-medium">{krwEvaluation > 0 ? formatCurrency(krwEvaluation, 'KRX') : '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">USD 보유</span>
                    <p className="font-medium">{formatCurrency(usdCash, 'USD')}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">USD 평가</span>
                    <p className="font-medium">{(usdEvaluation + usdtEvaluation) > 0 ? formatCurrency(usdEvaluation + usdtEvaluation, 'USD') : '-'}</p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* 통화별 평가자산 */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-3">평가자산</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 통화별 평가자산 */}
              {Object.entries(byCurrency).map(([currency, data]) => (
                <Card key={currency}>
                  <p className="text-sm text-gray-500">{currency} 평가자산</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-bold">
                      {formatCurrency(data.evaluation, currency === 'KRW' ? 'KOSPI' : currency === 'USD' ? 'NASDAQ' : 'CRYPTO')}
                    </p>
                    <span className={`text-sm font-medium ${getProfitLossClass(data.unrealized_pl)}`}>
                      {formatPercent(data.pl_rate)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    투자: {formatCurrency(data.invested, currency === 'KRW' ? 'KOSPI' : currency === 'USD' ? 'NASDAQ' : 'CRYPTO')}
                    {' / '}
                    <span className={getProfitLossClass(data.unrealized_pl)}>
                      {data.unrealized_pl >= 0 ? '+' : ''}{formatCurrency(data.unrealized_pl, currency === 'KRW' ? 'KOSPI' : currency === 'USD' ? 'NASDAQ' : 'CRYPTO')}
                    </span>
                  </p>
                  {currency === 'USD' && exchangeRate && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatKrwEquivalent(data.evaluation)} (₩{exchangeRate.toLocaleString('ko-KR', {maximumFractionDigits: 0})}/$)
                    </p>
                  )}
                  {currency === 'USDT' && exchangeRate && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatKrwEquivalent(data.evaluation)} (₩{exchangeRate.toLocaleString('ko-KR', {maximumFractionDigits: 0})}/$)
                    </p>
                  )}
                </Card>
              ))}
              {/* 진행중 포지션이 없을 때 */}
              {Object.keys(byCurrency).length === 0 && (
                <Card>
                  <p className="text-sm text-gray-500">평가자산</p>
                  <p className="text-2xl font-bold text-gray-400">-</p>
                </Card>
              )}
            </div>
          </div>

          {/* 종료된 포지션 */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-3">실현 성과</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <p className="text-sm text-gray-500">종료 거래</p>
                <p className="text-2xl font-bold">{teamStats.closed_positions?.count || 0}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {teamStats.closed_positions?.winning_trades || 0}승 / {teamStats.closed_positions?.losing_trades || 0}패
                </p>
              </Card>
              <Card>
                <p className="text-sm text-gray-500">승률</p>
                <p className="text-2xl font-bold">{formatPercent(teamStats.closed_positions?.win_rate || 0)}</p>
              </Card>
              <Card>
                <p className="text-sm text-gray-500">실현 손익</p>
                <p className={`text-2xl font-bold ${getProfitLossClass(teamStats.closed_positions?.realized_profit_loss)}`}>
                  {formatCurrency(teamStats.closed_positions?.realized_profit_loss || 0)}
                </p>
              </Card>
              <Card>
                <p className="text-sm text-gray-500">평균 수익률</p>
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
                <span className="text-sm text-gray-500">수익 거래</span>
                <p className="text-lg font-medium text-red-600">{teamStats.closed_positions?.winning_trades || 0}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">손실 거래</span>
                <p className="text-lg font-medium text-blue-600">{teamStats.closed_positions?.losing_trades || 0}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">평균 보유시간</span>
                <p className="text-lg font-medium">{formatHours(teamStats.closed_positions?.avg_holding_hours || 0)}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">평균 수익률</span>
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
                  {teamStats.open_positions?.count > 0 && (
                    <span className="ml-2 text-sm font-normal text-green-600">
                      진행중 - {teamStats.open_positions.count}
                    </span>
                  )}
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
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
                  <tr className="border-b">
                    <th className="py-2 text-left">종목</th>
                    <th className="py-2 text-right">진행</th>
                    <th className="py-2 text-right">종료</th>
                    <th className="py-2 text-right">투자금</th>
                    <th className="py-2 text-right">실현 손익</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickers.length === 0 ? (
                    <tr><td colSpan={5} className="py-4 text-center text-gray-500">해당 종목이 없습니다</td></tr>
                  ) : filteredTickers.map((ticker, i) => (
                    <tr key={i} className="border-b">
                      <td className="py-2">
                        <div>{ticker.ticker_name || ticker.ticker}</div>
                        <div className="text-xs text-gray-400">{ticker.ticker}</div>
                      </td>
                      <td className="py-2 text-right">
                        {ticker.open_count > 0 ? (
                          <span className="text-green-600">{ticker.open_count}</span>
                        ) : '-'}
                      </td>
                      <td className="py-2 text-right">{ticker.closed_count || '-'}</td>
                      <td className="py-2 text-right">
                        {ticker.invested > 0 ? formatCurrency(ticker.invested, ticker.market) : '-'}
                      </td>
                      <td className={`py-2 text-right ${getProfitLossClass(ticker.profit_loss)}`}>
                        {ticker.closed_count > 0 ? formatCurrency(ticker.profit_loss, ticker.market) : '-'}
                      </td>
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
              <p className="text-sm text-gray-500">총 거래</p>
              <p className="text-2xl font-bold">{myStats.overall.total_trades}</p>
            </Card>
            <Card>
              <p className="text-sm text-gray-500">승률</p>
              <p className="text-2xl font-bold">{formatPercent(myStats.overall.win_rate)}</p>
            </Card>
            <Card>
              <p className="text-sm text-gray-500">총 손익</p>
              <p className={`text-2xl font-bold ${getProfitLossClass(myStats.overall.total_profit_loss)}`}>
                {formatCurrency(myStats.overall.total_profit_loss)}
              </p>
            </Card>
            <Card>
              <p className="text-sm text-gray-500">평균 수익률</p>
              <p className={`text-2xl font-bold ${getProfitLossClass(myStats.overall.avg_profit_rate)}`}>
                {formatPercent(myStats.overall.avg_profit_rate)}
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
                  <span className="text-gray-500">수익 거래</span>
                  <span className="font-medium text-red-600">{myStats.overall.winning_trades}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">손실 거래</span>
                  <span className="font-medium text-blue-600">{myStats.overall.losing_trades}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">평균 보유 시간</span>
                  <span className="font-medium">{formatHours(myStats.overall.avg_holding_hours)}</span>
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>최고/최악 거래</CardTitle>
              </CardHeader>
              <div className="space-y-4">
                {myStats.best_trade && (
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-sm text-gray-500">최고 거래</p>
                    <p className="font-medium">{myStats.best_trade.ticker}</p>
                    <p className="text-red-600">{formatPercent(myStats.best_trade.profit_rate)}</p>
                  </div>
                )}
                {myStats.worst_trade && (
                  <div className="p-3 bg-red-50 rounded-lg">
                    <p className="text-sm text-gray-500">최악 거래</p>
                    <p className="font-medium">{myStats.worst_trade.ticker}</p>
                    <p className="text-blue-600">{formatPercent(myStats.worst_trade.profit_rate)}</p>
                  </div>
                )}
              </div>
            </Card>
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
                <tr className="border-b">
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
                  <tr key={entry.rank} className="border-b">
                    <td className="py-2">
                      {entry.rank === 1 && '🥇'}
                      {entry.rank === 2 && '🥈'}
                      {entry.rank === 3 && '🥉'}
                      {entry.rank > 3 && entry.rank}
                    </td>
                    <td className="py-2 font-medium">{entry.user.full_name || entry.user.username}</td>
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
                        <span className="text-green-600 text-xs ml-1">+{entry.open_trades}</span>
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
