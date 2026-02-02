import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { Input } from '../components/common/Input';
import { positionService } from '../services/positionService';
import { requestService } from '../services/requestService';
import { useAuth } from '../hooks/useAuth';
import {
  formatCurrency,
  formatPercent,
  formatRelativeTime,
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
  const [settingsData, setSettingsData] = useState({ initial_capital: '' });
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [positionData, requestData, settings] = await Promise.all([
        positionService.getPositions({ status: 'open', limit: 10 }),
        requestService.getRequests({ limit: 5 }),
        positionService.getTeamSettings().catch(() => null)
      ]);
      setPositions(positionData.positions);
      setRequests(requestData.requests);
      if (settings) {
        setTeamSettings(settings);
        setSettingsData({ initial_capital: settings.initial_capital || '' });
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!settingsData.initial_capital) {
      alert('초기 자본금을 입력해주세요.');
      return;
    }
    setActionLoading(true);
    try {
      await positionService.updateTeamSettings({
        initial_capital: parseFloat(settingsData.initial_capital)
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

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const unconfirmedCount = positions.filter(p => !p.is_info_confirmed).length;
  const totalInvested = positions.reduce((sum, p) => sum + (Number(p.total_buy_amount) || 0), 0);
  const initialCapital = Number(teamSettings?.initial_capital) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">대시보드</h1>
        {isManager() && (
          <Button variant="secondary" onClick={() => setShowSettingsModal(true)}>
            팀 설정
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">초기 자본금</p>
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
            {initialCapital > 0 ? formatCurrency(initialCapital) : '-'}
          </p>
        </Card>

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

        {isManagerOrAdmin() && (
          <Card>
            <p className="text-sm text-gray-500">대기중 요청</p>
            <p className="text-2xl font-bold mt-1 text-yellow-600">{pendingCount}</p>
          </Card>
        )}

        <Card>
          <p className="text-sm text-gray-500">총 투자금액</p>
          <p className="text-2xl font-bold mt-1">
            {formatCurrency(totalInvested)}
          </p>
          {initialCapital > 0 && (
            <p className="text-sm text-gray-500 mt-1">
              투자 비율: {formatPercent(totalInvested / initialCapital)}
            </p>
          )}
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
            <div className="text-center py-8 text-gray-500">로딩중...</div>
          ) : positions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">열린 포지션이 없습니다</div>
          ) : (
            <div className="space-y-3">
              {positions.map(position => (
                <Link
                  key={position.id}
                  to={`/positions/${position.id}`}
                  className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="font-medium">{position.ticker_name || position.ticker}</p>
                        <p className="text-sm text-gray-500">{position.ticker}</p>
                      </div>
                      {!position.is_info_confirmed && (
                        <span className="text-yellow-500" title="정보 확인 필요">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(position.average_buy_price)}</p>
                      <p className="text-sm text-gray-500">
                        {position.total_quantity}주
                      </p>
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

      {/* Team Settings Modal */}
      <Modal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        title="팀 설정"
      >
        <div className="space-y-4">
          <Input
            label="초기 자본금"
            type="number"
            value={settingsData.initial_capital}
            onChange={(e) => setSettingsData({ ...settingsData, initial_capital: e.target.value })}
            placeholder="예: 100000000"
            required
          />
          <p className="text-sm text-gray-500">
            팀 펀드의 초기 자본금을 입력하세요. 투자 비율 계산에 사용됩니다.
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
    </div>
  );
}
