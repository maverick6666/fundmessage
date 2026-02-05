import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle } from '../components/common/Card';
import { statsService } from '../services/statsService';
import { useAuth } from '../hooks/useAuth';
import {
  formatCurrency,
  formatPercent,
  formatHours,
  getProfitLossClass
} from '../utils/formatters';

export function Stats() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('team');
  const [myStats, setMyStats] = useState(null);
  const [teamStats, setTeamStats] = useState(null);
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
      const [my, team, rate] = await Promise.all([
        statsService.getUserStats(user.id),
        statsService.getTeamStats(),
        statsService.getExchangeRate().catch(() => ({ usd_krw: null }))
      ]);
      setMyStats(my);
      setTeamStats(team);
      setExchangeRate(rate.usd_krw);
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
      {activeTab === 'team' && teamStats && (
        <div className="space-y-6">
          {/* 진행중 포지션 - 통화별 평가자산 */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-3">진행중 포지션</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <p className="text-sm text-gray-500">포지션 수</p>
                <p className="text-2xl font-bold">{teamStats.open_positions?.count || 0}</p>
              </Card>

              {/* 통화별 평가자산 */}
              {Object.entries(teamStats.open_positions?.by_currency || {}).map(([currency, data]) => (
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
                <p className="text-sm text-gray-500">수익 팩터</p>
                <p className="text-2xl font-bold">{(teamStats.closed_positions?.profit_factor || 0).toFixed(2)}</p>
              </Card>
            </div>
          </div>

          {/* 종목별 현황 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between w-full">
                <CardTitle>종목별 현황</CardTitle>
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
      )}

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
                <div className="flex justify-between">
                  <span className="text-gray-500">수익 팩터</span>
                  <span className="font-medium">{myStats.overall.profit_factor.toFixed(2)}</span>
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
