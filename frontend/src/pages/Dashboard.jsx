import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { Input } from '../components/common/Input';
import { positionService } from '../services/positionService';
import { requestService } from '../services/requestService';
import { priceService } from '../services/priceService';
import { useAuth } from '../hooks/useAuth';
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
  const [positions, setPositions] = useState([]);
  const [requests, setRequests] = useState([]);
  const [teamSettings, setTeamSettings] = useState(null);
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [positionData, requestData, settings] = await Promise.all([
        priceService.getPositionsWithPrices().catch(() => ({ positions: [] })),
        requestService.getRequests({ limit: 3 }),
        positionService.getTeamSettings().catch(() => null)
      ]);
      setPositions(positionData.positions || []);
      setRequests(requestData.requests);
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
      alert('팀 설정이 저장되었습니다.');
    } catch (error) {
      alert(error.response?.data?.detail || '설정 저장에 실패했습니다.');
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
      alert('변환 전 금액과 변환 후 금액을 입력해주세요.');
      return;
    }

    const fromAmount = parseFloat(exchangeData.fromAmount);
    const toAmount = parseFloat(exchangeData.toAmount);
    const exchangeRate = exchangeData.exchangeRate ? parseFloat(exchangeData.exchangeRate) : null;

    // 잔액 확인
    if (exchangeData.direction === 'krw_to_usd') {
      const krwBalance = Number(teamSettings?.initial_capital_krw) || 0;
      if (fromAmount > krwBalance) {
        alert(`원화 잔액이 부족합니다. 잔액: ${formatNumber(krwBalance)}원`);
        return;
      }
    } else {
      const usdBalance = Number(teamSettings?.initial_capital_usd) || 0;
      if (fromAmount > usdBalance) {
        alert(`달러 잔액이 부족합니다. 잔액: $${formatNumber(usdBalance, 2)}`);
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
      alert('환전이 완료되었습니다.');
    } catch (error) {
      alert(error.response?.data?.detail || '환전에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const unconfirmedCount = positions.filter(p => !p.is_info_confirmed).length;

  // 시장별 투자금액 계산
  const krwInvested = positions
    .filter(p => p.market === 'KOSPI' || p.market === 'KOSDAQ' || p.market === 'KRX')
    .reduce((sum, p) => sum + (Number(p.total_buy_amount) || 0), 0);
  const usdInvested = positions
    .filter(p => p.market === 'NASDAQ' || p.market === 'NYSE')
    .reduce((sum, p) => sum + (Number(p.total_buy_amount) || 0), 0);
  const usdtInvested = positions
    .filter(p => p.market === 'CRYPTO')
    .reduce((sum, p) => sum + (Number(p.total_buy_amount) || 0), 0);

  const initialCapitalKrw = Number(teamSettings?.initial_capital_krw) || 0;
  const initialCapitalUsd = Number(teamSettings?.initial_capital_usd) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">대시보드</h1>
        {isManager() && (
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 원화 자본금 */}
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">원화 자본금</p>
            {isManager() && (
              <button
                onClick={() => setShowSettingsModal(true)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}
          </div>
          <p className="text-2xl font-bold mt-1">
            {initialCapitalKrw > 0 ? formatCurrency(initialCapitalKrw, 'KRX') : '-'}
          </p>
          {initialCapitalKrw > 0 && krwInvested > 0 && (
            <p className="text-sm text-gray-500 mt-1">
              투자: {formatCurrency(krwInvested, 'KRX')} ({formatPercent(krwInvested / initialCapitalKrw)})
            </p>
          )}
        </Card>

        {/* 달러 자본금 */}
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">달러 자본금</p>
            {isManager() && (
              <button
                onClick={() => setShowSettingsModal(true)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}
          </div>
          <p className="text-2xl font-bold mt-1">
            {initialCapitalUsd > 0 ? formatCurrency(initialCapitalUsd, 'USD') : '-'}
          </p>
          {initialCapitalUsd > 0 && (usdInvested > 0 || usdtInvested > 0) && (
            <p className="text-sm text-gray-500 mt-1">
              투자: {formatCurrency(usdInvested + usdtInvested, 'USD')} ({formatPercent((usdInvested + usdtInvested) / initialCapitalUsd)})
            </p>
          )}
        </Card>

        {/* 열린 포지션 */}
        <Card>
          <p className="text-sm text-gray-500">열린 포지션</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-2xl font-bold">{positions.length}</p>
            {unconfirmedCount > 0 && (
              <span className="text-yellow-500 text-sm flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {unconfirmedCount}
              </span>
            )}
          </div>
        </Card>

        {/* 대기중 요청 (매니저만) */}
        {isManagerOrAdmin() && (
          <Card>
            <p className="text-sm text-gray-500">대기중 요청</p>
            <p className="text-2xl font-bold mt-1 text-yellow-600">{pendingCount}</p>
          </Card>
        )}
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
            <div className="text-center py-8 text-gray-500">로딩중...</div>
          ) : positions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">열린 포지션이 없습니다</div>
          ) : (
            <div className="space-y-2">
              {positions.map(position => (
                <Link
                  key={position.id}
                  to={`/positions/${position.id}`}
                  className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{position.ticker_name || position.ticker}</span>
                      <span className="text-xs text-gray-400">{position.ticker}</span>
                      {!position.is_info_confirmed && (
                        <span className="text-yellow-500" title="정보 확인 필요">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                    </div>
                    {position.profit_rate != null && (
                      <span className={`text-sm font-medium ${getProfitLossClass(position.profit_rate)}`}>
                        {position.profit_rate >= 0 ? '+' : ''}{formatPercent(position.profit_rate)}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 text-sm">
                    <div className="flex justify-between text-gray-500">
                      <span>평단</span>
                      <span className="text-gray-700">{formatCurrency(position.average_buy_price, position.market)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>현재가</span>
                      <span className="text-gray-700">{position.current_price ? formatCurrency(position.current_price, position.market) : '-'}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>수량</span>
                      <span className="text-gray-700">{formatNumber(position.quantity)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>평가금액</span>
                      <span className={position.profit_loss != null ? getProfitLossClass(position.profit_loss) : 'text-gray-700'}>
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
            <div className="text-center py-8 text-gray-500">로딩중...</div>
          ) : requests.length === 0 ? (
            <div className="text-center py-8 text-gray-500">요청이 없습니다</div>
          ) : (
            <div className="space-y-3">
              {requests.map(request => (
                <div
                  key={request.id}
                  className="p-3 bg-gray-50 rounded-lg"
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
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>{request.requester.full_name}</span>
                    <span>{formatRelativeTime(request.created_at)}</span>
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
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2 font-medium">날짜</th>
                  <th className="pb-2 font-medium">From</th>
                  <th className="pb-2 font-medium">To</th>
                  <th className="pb-2 font-medium">환율</th>
                  <th className="pb-2 font-medium">메모</th>
                </tr>
              </thead>
              <tbody>
                {teamSettings.exchange_history.slice(-5).reverse().map((ex, i) => (
                  <tr key={i} className="border-b last:border-0">
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
                    <td className="py-2 text-gray-500">{ex.memo || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
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
          <p className="text-sm text-gray-500">
            팀 펀드의 자본금을 입력하세요. 투자 비율 계산에 사용됩니다.
          </p>
          <div className="flex justify-end gap-3 pt-4 border-t">
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
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              달러 → 원화
            </button>
          </div>

          {/* 현재 잔액 표시 */}
          <div className="p-3 bg-gray-50 rounded-lg text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">원화 잔액:</span>
              <span className="font-medium">{formatCurrency(initialCapitalKrw, 'KRX')}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-gray-500">달러 잔액:</span>
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

          <div className="flex justify-end gap-3 pt-4 border-t">
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
