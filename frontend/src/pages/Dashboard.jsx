import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { Input } from '../components/common/Input';
import { positionService } from '../services/positionService';
import { requestService } from '../services/requestService';
import { priceService } from '../services/priceService';
import { reportService } from '../services/reportService';
import { columnService } from '../services/columnService';
import { statsService } from '../services/statsService';
import { userService } from '../services/userService';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import {
  formatCurrency,
  formatPercent,
  formatRelativeTime,
  formatNumber,
  formatDate,
  getStatusBadgeClass,
  getStatusLabel,
  getRequestTypeLabel,
  getProfitLossClass
} from '../utils/formatters';

export function Dashboard() {
  const { user, isManagerOrAdmin, isManager } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'team'
  const [positions, setPositions] = useState([]);
  const [requests, setRequests] = useState([]);
  const [teamSettings, setTeamSettings] = useState(null);
  const [reports, setReports] = useState([]);
  const [columns, setColumns] = useState([]);
  const [showVerifiedColumns, setShowVerifiedColumns] = useState(true); // 기본: 검증된 칼럼만
  const [teamRanking, setTeamRanking] = useState({ members: [], avg_week_attendance_rate: 0 });
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamStats, setTeamStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showExchangeModal, setShowExchangeModal] = useState(false);
  const [settingsData, setSettingsData] = useState({ initial_capital_krw: '', initial_capital_usd: '' });
  const [exchangeData, setExchangeData] = useState({
    direction: 'krw_to_usd', // or 'usd_to_krw'
    fromAmount: '',
    toAmount: '',
    exchangeRate: '',
    memo: ''
  });
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [selectedMemberStats, setSelectedMemberStats] = useState(null);
  const [memberStatsLoading, setMemberStatsLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  // 칼럼 필터 변경 시 다시 fetch
  const fetchColumns = async (verified) => {
    try {
      const data = await columnService.getColumns({ limit: 3, verified: verified ? true : null });
      setColumns(data.columns || []);
    } catch (error) {
      console.error('Failed to fetch columns:', error);
    }
  };

  useEffect(() => {
    fetchColumns(showVerifiedColumns);
  }, [showVerifiedColumns]);

  // 팀원 클릭 시 상세 통계 조회
  const handleMemberClick = async (memberId) => {
    if (selectedMemberId === memberId) {
      setSelectedMemberId(null);
      setSelectedMemberStats(null);
      return;
    }
    setSelectedMemberId(memberId);
    setMemberStatsLoading(true);
    try {
      const stats = await statsService.getUserStats(memberId);
      setSelectedMemberStats(stats);
    } catch (error) {
      console.error('Failed to fetch member stats:', error);
      setSelectedMemberStats(null);
    } finally {
      setMemberStatsLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      const [positionData, requestData, settings, reportsData, columnsData, rankingData, membersData, statsData] = await Promise.all([
        priceService.getPositionsWithPrices().catch(() => ({ positions: [] })),
        requestService.getRequests({ limit: 3 }),
        positionService.getTeamSettings().catch(() => null),
        reportService.getReports({ limit: 3 }).catch(() => ({ reports: [] })),
        columnService.getColumns({ limit: 3, verified: true }).catch(() => ({ columns: [] })),
        statsService.getTeamRanking().catch(() => ({ members: [], avg_week_attendance_rate: 0 })),
        userService.getTeamMembers().catch(() => ({ members: [] })),
        statsService.getTeamStats().catch(() => null)
      ]);
      setPositions(positionData.positions || []);
      setRequests(requestData.requests);
      setReports(reportsData.reports || []);
      setColumns(columnsData.columns || []);
      setTeamRanking(rankingData || { members: [], avg_week_attendance_rate: 0 });
      setTeamMembers(membersData.members || []);
      setTeamStats(statsData);
      if (settings) {
        setTeamSettings(settings);
        setSettingsData({
          initial_capital_krw: settings.initial_capital_krw || '',
          initial_capital_usd: settings.initial_capital_usd || ''
        });
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setActionLoading(true);
    try {
      await positionService.updateTeamSettings({
        initial_capital_krw: settingsData.initial_capital_krw ? parseFloat(settingsData.initial_capital_krw) : null,
        initial_capital_usd: settingsData.initial_capital_usd ? parseFloat(settingsData.initial_capital_usd) : null
      });
      setShowSettingsModal(false);
      fetchData();
      toast.success('팀 설정이 저장되었습니다.');
    } catch (error) {
      toast.error(error.response?.data?.detail || '설정 저장에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  // 환전 금액 변경 핸들러
  const handleExchangeAmountChange = (field, value) => {
    const newData = { ...exchangeData, [field]: value };

    // 환율이 있으면 자동 계산
    if (field === 'fromAmount' && newData.exchangeRate) {
      if (newData.direction === 'krw_to_usd') {
        newData.toAmount = value ? (parseFloat(value) / parseFloat(newData.exchangeRate)).toFixed(2) : '';
      } else {
        newData.toAmount = value ? (parseFloat(value) * parseFloat(newData.exchangeRate)).toFixed(0) : '';
      }
    }

    if (field === 'exchangeRate' && newData.fromAmount) {
      if (newData.direction === 'krw_to_usd') {
        newData.toAmount = newData.fromAmount ? (parseFloat(newData.fromAmount) / parseFloat(value)).toFixed(2) : '';
      } else {
        newData.toAmount = newData.fromAmount ? (parseFloat(newData.fromAmount) * parseFloat(value)).toFixed(0) : '';
      }
    }

    // toAmount 직접 입력 시 환율 자동 계산
    if (field === 'toAmount' && newData.fromAmount && value) {
      const from = parseFloat(newData.fromAmount);
      const to = parseFloat(value);
      if (from > 0 && to > 0) {
        if (newData.direction === 'krw_to_usd') {
          newData.exchangeRate = (from / to).toFixed(2);
        } else {
          newData.exchangeRate = (to / from).toFixed(2);
        }
      }
    }

    setExchangeData(newData);
  };

  const handleExchangeDirectionChange = (direction) => {
    setExchangeData({
      direction,
      fromAmount: '',
      toAmount: '',
      exchangeRate: exchangeData.exchangeRate, // 환율은 유지
      memo: exchangeData.memo
    });
  };

  const handleExchange = async () => {
    if (!exchangeData.fromAmount || !exchangeData.toAmount) {
      toast.warning('변환 전 금액과 변환 후 금액을 입력해주세요.');
      return;
    }

    const fromAmount = parseFloat(exchangeData.fromAmount);
    const toAmount = parseFloat(exchangeData.toAmount);
    const exchangeRate = exchangeData.exchangeRate ? parseFloat(exchangeData.exchangeRate) : null;

    // 잔액 확인
    if (exchangeData.direction === 'krw_to_usd') {
      const krwBalance = Number(teamSettings?.initial_capital_krw) || 0;
      if (fromAmount > krwBalance) {
        toast.warning(`원화 잔액이 부족합니다. 잔액: ${formatNumber(krwBalance)}원`);
        return;
      }
    } else {
      const usdBalance = Number(teamSettings?.initial_capital_usd) || 0;
      if (fromAmount > usdBalance) {
        toast.warning(`달러 잔액이 부족합니다. 잔액: $${formatNumber(usdBalance, 2)}`);
        return;
      }
    }

    setActionLoading(true);
    try {
      await positionService.exchangeCurrency({
        fromCurrency: exchangeData.direction === 'krw_to_usd' ? 'KRW' : 'USD',
        toCurrency: exchangeData.direction === 'krw_to_usd' ? 'USD' : 'KRW',
        fromAmount,
        toAmount,
        exchangeRate: exchangeRate || null,
        memo: exchangeData.memo || null
      });
      setShowExchangeModal(false);
      setExchangeData({ direction: 'krw_to_usd', fromAmount: '', toAmount: '', exchangeRate: '', memo: '' });
      fetchData();
      toast.success('환전이 완료되었습니다.');
    } catch (error) {
      toast.error(error.response?.data?.detail || '환전에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const unconfirmedCount = positions.filter(p => !p.is_info_confirmed).length;

  // 시장별 투자금액 계산
  const krwPositions = positions.filter(p => p.market === 'KOSPI' || p.market === 'KOSDAQ' || p.market === 'KRX');
  const usdPositions = positions.filter(p => p.market === 'NASDAQ' || p.market === 'NYSE' || p.market === 'CRYPTO');

  const krwInvested = krwPositions.reduce((sum, p) => sum + (Number(p.total_buy_amount) || 0), 0);
  const usdInvested = usdPositions.reduce((sum, p) => sum + (Number(p.total_buy_amount) || 0), 0);

  // 평가금액 계산
  const krwEvaluation = krwPositions.reduce((sum, p) => sum + (Number(p.evaluation_amount) || Number(p.total_buy_amount) || 0), 0);
  const usdEvaluation = usdPositions.reduce((sum, p) => sum + (Number(p.evaluation_amount) || Number(p.total_buy_amount) || 0), 0);

  const initialCapitalKrw = Number(teamSettings?.initial_capital_krw) || 0;
  const initialCapitalUsd = Number(teamSettings?.initial_capital_usd) || 0;

  // 현금 잔액 (자본금 - 투자금액)
  const krwCash = Math.max(0, initialCapitalKrw - krwInvested);
  const usdCash = Math.max(0, initialCapitalUsd - usdInvested);

  // 총 자산 (현금 + 평가금액)
  const krwTotalAssets = krwCash + krwEvaluation;
  const usdTotalAssets = usdCash + usdEvaluation;

  // 역할 라벨
  const getRoleLabel = (role) => {
    switch (role) {
      case 'manager': return '팀장';
      case 'admin': return '관리자';
      default: return '팀원';
    }
  };

  // 역할 색상
  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'manager': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'admin': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      default: return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>대시보드</h1>
          <div className="flex gap-2">
            {['dashboard', 'team'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {tab === 'dashboard' ? '대시보드' : '팀 정보'}
              </button>
            ))}
          </div>
        </div>
        {isManager() && activeTab === 'dashboard' && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowExchangeModal(true)}>
              환전
            </Button>
            <Button variant="secondary" onClick={() => setShowSettingsModal(true)}>
              팀 설정
            </Button>
          </div>
        )}
      </div>

      {/* Dashboard Tab Content */}
      {activeTab === 'dashboard' && (
      <>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 원화 자본금 */}
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">원화 자본금</p>
            {isManager() && (
              <button
                onClick={() => setShowSettingsModal(true)}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}
          </div>
          <p className="text-2xl font-bold mt-1 dark:text-gray-100">
            {initialCapitalKrw > 0 ? formatCurrency(initialCapitalKrw, 'KRX') : '-'}
          </p>
          {initialCapitalKrw > 0 && krwInvested > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              투자: {formatCurrency(krwInvested, 'KRX')} ({formatPercent(krwInvested / initialCapitalKrw)})
            </p>
          )}
        </Card>

        {/* 달러 자본금 */}
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">달러 자본금</p>
            {isManager() && (
              <button
                onClick={() => setShowSettingsModal(true)}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}
          </div>
          <p className="text-2xl font-bold mt-1 dark:text-gray-100">
            {initialCapitalUsd > 0 ? formatCurrency(initialCapitalUsd, 'USD') : '-'}
          </p>
          {initialCapitalUsd > 0 && usdInvested > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              투자: {formatCurrency(usdInvested, 'USD')} ({formatPercent(usdInvested / initialCapitalUsd)})
            </p>
          )}
        </Card>

        {/* 원화 평가가치 */}
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">원화 평가가치</p>
            {initialCapitalKrw > 0 && krwTotalAssets !== initialCapitalKrw && (
              <span className={`text-sm font-semibold ${krwTotalAssets > initialCapitalKrw ? 'text-red-500 dark:text-red-400' : 'text-blue-500 dark:text-blue-400'}`}>
                {krwTotalAssets > initialCapitalKrw ? '+' : ''}{formatPercent((krwTotalAssets - initialCapitalKrw) / initialCapitalKrw)}
              </span>
            )}
          </div>
          <p className="text-2xl font-bold mt-1 dark:text-gray-100">
            {krwTotalAssets > 0 ? formatCurrency(krwTotalAssets, 'KRX') : '-'}
          </p>
        </Card>

        {/* 달러 평가가치 */}
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">달러 평가가치</p>
            {initialCapitalUsd > 0 && usdTotalAssets !== initialCapitalUsd && (
              <span className={`text-sm font-semibold ${usdTotalAssets > initialCapitalUsd ? 'text-red-500 dark:text-red-400' : 'text-blue-500 dark:text-blue-400'}`}>
                {usdTotalAssets > initialCapitalUsd ? '+' : ''}{formatPercent((usdTotalAssets - initialCapitalUsd) / initialCapitalUsd)}
              </span>
            )}
          </div>
          <p className="text-2xl font-bold mt-1 dark:text-gray-100">
            {usdTotalAssets > 0 ? formatCurrency(usdTotalAssets, 'USD') : '-'}
          </p>
        </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Open Positions */}
          <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>열린 포지션</CardTitle>
              <Link to="/positions" className="text-sm text-primary-600 hover:text-primary-700">
                전체보기
              </Link>
            </div>
          </CardHeader>

          {loading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">로딩중...</div>
          ) : positions.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">열린 포지션이 없습니다</div>
          ) : (
            <div className="space-y-2">
              {positions.map(position => (
                <Link
                  key={position.id}
                  to={`/positions/${position.id}`}
                  className="block p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors min-w-0"
                >
                  <div className="flex items-center justify-between gap-2 mb-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="font-medium truncate">{position.ticker_name || position.ticker}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{position.ticker}</span>
                      {!position.is_info_confirmed && (
                        <span className="text-yellow-500 shrink-0" title="정보 확인 필요">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                    </div>
                    {position.profit_rate != null && (
                      <span className={`text-sm font-medium shrink-0 whitespace-nowrap ${getProfitLossClass(position.profit_rate)}`}>
                        {position.profit_rate >= 0 ? '+' : ''}{formatPercent(position.profit_rate)}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 text-sm">
                    <div className="flex justify-between text-gray-500 dark:text-gray-400">
                      <span>평단</span>
                      <span className="text-gray-700 dark:text-gray-300">{formatCurrency(position.average_buy_price, position.market)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500 dark:text-gray-400">
                      <span>현재가</span>
                      <span className="text-gray-700 dark:text-gray-300">{position.current_price ? formatCurrency(position.current_price, position.market) : '-'}</span>
                    </div>
                    <div className="flex justify-between text-gray-500 dark:text-gray-400">
                      <span>수량</span>
                      <span className="text-gray-700 dark:text-gray-300">{formatNumber(position.quantity)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500 dark:text-gray-400">
                      <span>평가금액</span>
                      <span className={position.profit_loss != null ? getProfitLossClass(position.profit_loss) : 'text-gray-700 dark:text-gray-300'}>
                        {position.evaluation_amount ? formatCurrency(position.evaluation_amount, position.market) : '-'}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Requests */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>최근 요청</CardTitle>
              <Link to={isManagerOrAdmin() ? '/requests' : '/my-requests'} className="text-sm text-primary-600 hover:text-primary-700">
                전체보기
              </Link>
            </div>
          </CardHeader>

          {loading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">로딩중...</div>
          ) : requests.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">요청이 없습니다</div>
          ) : (
            <div className="space-y-3">
              {requests.map(request => (
                <div
                  key={request.id}
                  className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`badge ${request.request_type === 'buy' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                        {getRequestTypeLabel(request.request_type)}
                      </span>
                      <span className="font-medium">{request.target_ticker}</span>
                    </div>
                    <span className={`badge ${getStatusBadgeClass(request.status)}`}>
                      {getStatusLabel(request.status)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                    <span>{request.requester.full_name}</span>
                    <span>{formatRelativeTime(request.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          </Card>
        </div>

        {/* Recent Reports and Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Reports */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>최근 보고서</CardTitle>
                <Link to="/reports" className="text-sm text-primary-600 hover:text-primary-700">
                  전체보기
                </Link>
              </div>
            </CardHeader>

            {reports.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">보고서가 없습니다</div>
            ) : (
              <div className="space-y-3">
                {reports.map(report => (
                  <Link
                    key={report.position_id}
                    to={`/positions/${report.position_id}`}
                    className="block p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors min-w-0"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1 min-w-0">
                      <span className="font-medium dark:text-gray-100 truncate min-w-0">{report.ticker_name || report.ticker}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0 whitespace-nowrap">{report.note_count}개 노트</span>
                    </div>
                    {report.latest_note && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        {report.latest_note.title}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* Columns */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle>칼럼</CardTitle>
                  {/* 필터 토글 */}
                  <div className="flex rounded-lg overflow-hidden border dark:border-gray-600">
                    <button
                      onClick={() => setShowVerifiedColumns(true)}
                      className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                        showVerifiedColumns
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      검증됨
                    </button>
                    <button
                      onClick={() => setShowVerifiedColumns(false)}
                      className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                        !showVerifiedColumns
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      전체
                    </button>
                  </div>
                </div>
                <Link to="/reports?tab=columns" className="text-sm text-primary-600 hover:text-primary-700">
                  전체보기
                </Link>
              </div>
            </CardHeader>

            {columns.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                {showVerifiedColumns ? '검증된 칼럼이 없습니다' : '작성된 칼럼이 없습니다'}
              </div>
            ) : (
              <div className="space-y-3">
                {columns.map(column => (
                  <div
                    key={column.id}
                    className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg min-w-0"
                  >
                    <div className="flex items-center gap-2 mb-1 min-w-0">
                      <p className="font-medium dark:text-gray-100 truncate flex-1 min-w-0">{column.title}</p>
                      {column.is_verified && (
                        <span className="shrink-0" title="검증됨">
                          <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                      <span>{column.author?.full_name}</span>
                      <span>{formatRelativeTime(column.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* 환전 이력 */}
        {teamSettings?.exchange_history && teamSettings.exchange_history.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>환전 이력</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
                    <th className="pb-2 font-medium">날짜</th>
                    <th className="pb-2 font-medium">From</th>
                    <th className="pb-2 font-medium">To</th>
                    <th className="pb-2 font-medium">환율</th>
                    <th className="pb-2 font-medium">메모</th>
                  </tr>
                </thead>
                <tbody>
                  {teamSettings.exchange_history.slice(-5).reverse().map((ex, i) => (
                    <tr key={i} className="border-b last:border-0 dark:border-gray-700">
                      <td className="py-2">{formatDate(ex.timestamp, 'MM/dd HH:mm')}</td>
                      <td className="py-2">
                        {ex.from_currency === 'KRW'
                          ? `₩${formatNumber(ex.from_amount, 0)}`
                          : `$${formatNumber(ex.from_amount, 2)}`}
                      </td>
                      <td className="py-2">
                        {ex.to_currency === 'KRW'
                          ? `₩${formatNumber(ex.to_amount, 0)}`
                          : `$${formatNumber(ex.to_amount, 2)}`}
                      </td>
                      <td className="py-2">{ex.exchange_rate ? formatNumber(ex.exchange_rate, 2) : '-'}</td>
                      <td className="py-2 text-gray-500 dark:text-gray-400">{ex.memo || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </>
      )}

      {/* Team Info Tab Content */}
      {activeTab === 'team' && (
        <div className="space-y-4">
          {/* 팀원별 상세 통계 (세로로 쌓기) */}
          {loading ? (
            <Card>
              <div className="text-center py-6 text-gray-500 dark:text-gray-400">로딩중...</div>
            </Card>
          ) : teamRanking.members.length === 0 ? (
            <Card>
              <div className="text-center py-6 text-gray-500 dark:text-gray-400">팀원 정보가 없습니다</div>
            </Card>
          ) : (
            teamRanking.members.map((member) => (
              <Card key={member.id}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CardTitle>{member.full_name}</CardTitle>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${getRoleBadgeClass(member.role)}`}>
                      {getRoleLabel(member.role)}
                    </span>
                  </div>
                </CardHeader>

                {/* 거래 통계 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400">총 거래</p>
                    <p className="text-lg font-bold dark:text-gray-100">{member.total_trades || 0}</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400">승률</p>
                    <p className="text-lg font-bold dark:text-gray-100">{member.win_rate || 0}%</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400">총 손익</p>
                    <p className={`text-lg font-bold ${getProfitLossClass(member.total_profit)}`}>
                      {formatCurrency(member.total_profit || 0)}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400">평균 수익률</p>
                    <p className={`text-lg font-bold ${getProfitLossClass(member.avg_profit_rate)}`}>
                      {member.avg_profit_rate >= 0 ? '+' : ''}{member.avg_profit_rate}%
                    </p>
                  </div>
                </div>

                {/* 상세 통계 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400">성공</p>
                    <p className="text-lg font-bold text-red-600 dark:text-red-400">{member.winning_trades || 0}</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400">실패</p>
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{member.losing_trades || 0}</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400">열린 포지션</p>
                    <p className="text-lg font-bold dark:text-gray-100">{member.open_positions || 0}</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400">종료 포지션</p>
                    <p className="text-lg font-bold dark:text-gray-100">{member.closed_positions || 0}</p>
                  </div>
                </div>

                {/* 출석 현황 */}
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-medium text-blue-800 dark:text-blue-300">출석 현황</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-blue-600 dark:text-blue-400">이번주</p>
                      <p className="text-xl font-bold text-blue-800 dark:text-blue-200">
                        {member.week_attendance_rate}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-600 dark:text-blue-400">이번달</p>
                      <p className="text-xl font-bold text-blue-800 dark:text-blue-200">
                        {member.month_attendance_rate || 0}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-600 dark:text-blue-400">전체</p>
                      <p className="text-xl font-bold text-blue-800 dark:text-blue-200">
                        {member.total_attendance_rate || 0}%
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}

          {/* 리더보드 */}
          {teamStats?.leaderboard && (
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
      )}

      {/* Team Settings Modal */}
      <Modal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        title="팀 설정"
      >
        <div className="space-y-4">
          <Input
            label="원화 자본금 (KRW)"
            type="number"
            value={settingsData.initial_capital_krw}
            onChange={(e) => setSettingsData({ ...settingsData, initial_capital_krw: e.target.value })}
            placeholder="예: 100000000"
          />
          <Input
            label="달러 자본금 (USD)"
            type="number"
            step="0.01"
            value={settingsData.initial_capital_usd}
            onChange={(e) => setSettingsData({ ...settingsData, initial_capital_usd: e.target.value })}
            placeholder="예: 10000"
          />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            팀 펀드의 자본금을 입력하세요. 투자 비율 계산에 사용됩니다.
          </p>
          <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
            <Button variant="secondary" onClick={() => setShowSettingsModal(false)}>
              취소
            </Button>
            <Button onClick={handleSaveSettings} loading={actionLoading}>
              저장
            </Button>
          </div>
        </div>
      </Modal>

      {/* Exchange Modal */}
      <Modal
        isOpen={showExchangeModal}
        onClose={() => setShowExchangeModal(false)}
        title="환전"
      >
        <div className="space-y-4">
          {/* 방향 선택 */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleExchangeDirectionChange('krw_to_usd')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                exchangeData.direction === 'krw_to_usd'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              원화 → 달러
            </button>
            <button
              type="button"
              onClick={() => handleExchangeDirectionChange('usd_to_krw')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                exchangeData.direction === 'usd_to_krw'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              달러 → 원화
            </button>
          </div>

          {/* 현재 잔액 표시 */}
          <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">원화 잔액:</span>
              <span className="font-medium">{formatCurrency(initialCapitalKrw, 'KRX')}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-gray-500 dark:text-gray-400">달러 잔액:</span>
              <span className="font-medium">{formatCurrency(initialCapitalUsd, 'USD')}</span>
            </div>
          </div>

          <Input
            label={exchangeData.direction === 'krw_to_usd' ? '환전할 원화 금액' : '환전할 달러 금액'}
            type="number"
            step={exchangeData.direction === 'krw_to_usd' ? '1' : '0.01'}
            value={exchangeData.fromAmount}
            onChange={(e) => handleExchangeAmountChange('fromAmount', e.target.value)}
            placeholder={exchangeData.direction === 'krw_to_usd' ? '예: 1000000' : '예: 1000'}
          />

          <Input
            label={exchangeData.direction === 'krw_to_usd' ? '변환 후 달러 금액' : '변환 후 원화 금액'}
            type="number"
            step={exchangeData.direction === 'krw_to_usd' ? '0.01' : '1'}
            value={exchangeData.toAmount}
            onChange={(e) => handleExchangeAmountChange('toAmount', e.target.value)}
            placeholder={exchangeData.direction === 'krw_to_usd' ? '예: 740.74' : '예: 1350000'}
          />

          <Input
            label="환율 (선택 - 금액 입력 시 자동 계산)"
            type="number"
            step="0.01"
            value={exchangeData.exchangeRate}
            onChange={(e) => handleExchangeAmountChange('exchangeRate', e.target.value)}
            placeholder="예: 1350.50"
          />

          <Input
            label="메모 (선택)"
            value={exchangeData.memo}
            onChange={(e) => setExchangeData({ ...exchangeData, memo: e.target.value })}
            placeholder="환전 사유..."
          />

          <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
            <Button variant="secondary" onClick={() => setShowExchangeModal(false)}>
              취소
            </Button>
            <Button onClick={handleExchange} loading={actionLoading}>
              환전
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
