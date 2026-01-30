import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { Input } from '../components/common/Input';
import { SellRequestForm } from '../components/forms/SellRequestForm';
import { positionService } from '../services/positionService';
import { useAuth } from '../hooks/useAuth';
import {
  formatCurrency,
  formatPercent,
  formatDate,
  formatHours,
  getStatusBadgeClass,
  getStatusLabel,
  getProfitLossClass
} from '../utils/formatters';

export function PositionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isManagerOrAdmin, isManager } = useAuth();
  const [position, setPosition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSellModal, setShowSellModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [closeData, setCloseData] = useState({
    total_sell_amount: '',
  });
  const [confirmData, setConfirmData] = useState({
    average_buy_price: '',
    total_quantity: '',
    ticker_name: '',
  });
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchPosition();
  }, [id]);

  const fetchPosition = async () => {
    try {
      const data = await positionService.getPosition(id);
      setPosition(data);
      // 확인 폼 데이터 초기화
      setConfirmData({
        average_buy_price: data.average_buy_price || '',
        total_quantity: data.total_quantity || '',
        ticker_name: data.ticker_name || '',
      });
    } catch (error) {
      console.error('Failed to fetch position:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    if (!closeData.total_sell_amount) {
      alert('청산 금액을 입력해주세요.');
      return;
    }
    setActionLoading(true);
    try {
      await positionService.closePosition(id, {
        total_sell_amount: parseFloat(closeData.total_sell_amount),
      });
      setShowCloseModal(false);
      fetchPosition();
    } catch (error) {
      alert(error.response?.data?.detail || '포지션 종료에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!confirmData.average_buy_price || !confirmData.total_quantity) {
      alert('평균 매입가와 수량을 입력해주세요.');
      return;
    }
    setActionLoading(true);
    try {
      await positionService.confirmPositionInfo(id, {
        average_buy_price: parseFloat(confirmData.average_buy_price),
        total_quantity: parseFloat(confirmData.total_quantity),
        ticker_name: confirmData.ticker_name || null,
      });
      setShowConfirmModal(false);
      fetchPosition();
      alert('포지션 정보가 확인되었습니다.');
    } catch (error) {
      alert(error.response?.data?.detail || '포지션 정보 확인에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-500">로딩중...</div>;
  }

  if (!position) {
    return <div className="text-center py-12 text-gray-500">포지션을 찾을 수 없습니다</div>;
  }

  const needsConfirmation = position.status === 'open' && !position.is_info_confirmed;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold">{position.ticker_name || position.ticker}</h1>
            <p className="text-gray-500">{position.ticker} | {position.market}</p>
          </div>
          <span className={`badge ${getStatusBadgeClass(position.status)}`}>
            {getStatusLabel(position.status)}
          </span>
          {needsConfirmation && (
            <span className="flex items-center gap-1 text-yellow-600 text-sm bg-yellow-50 px-2 py-1 rounded">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              정보 확인 필요
            </span>
          )}
        </div>

        {position.status === 'open' && (
          <div className="flex gap-2">
            {isManager() && needsConfirmation && (
              <Button onClick={() => setShowConfirmModal(true)}>
                정보 확인
              </Button>
            )}
            <Button variant="secondary" onClick={() => setShowSellModal(true)}>
              정리 요청
            </Button>
            {isManagerOrAdmin() && (
              <Button variant="danger" onClick={() => setShowCloseModal(true)}>
                수동 종료
              </Button>
            )}
          </div>
        )}
      </div>

      {/* 정보 미확인 알림 */}
      {needsConfirmation && isManager() && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="font-medium text-yellow-800">포지션 정보 확인이 필요합니다</h3>
              <p className="text-sm text-yellow-700 mt-1">
                실제 체결 내역을 확인하여 평균 매입가와 수량을 정확하게 수정해주세요.
              </p>
              <Button
                size="sm"
                className="mt-2"
                onClick={() => setShowConfirmModal(true)}
              >
                정보 확인하기
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Position Info */}
        <Card>
          <CardHeader>
            <CardTitle>포지션 정보</CardTitle>
          </CardHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">평균 매입가</p>
                <p className="text-lg font-medium">{formatCurrency(position.average_buy_price)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">보유 수량</p>
                <p className="text-lg font-medium">{position.total_quantity}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">진입 금액</p>
                <p className="text-lg font-medium">{formatCurrency(position.total_buy_amount)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">보유 기간</p>
                <p className="text-lg font-medium">{formatHours(position.holding_period_hours)}</p>
              </div>
            </div>

            {position.status === 'closed' && (
              <div className="pt-4 border-t">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">청산 금액</p>
                    <p className="text-lg font-medium">{formatCurrency(position.total_sell_amount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">평균 매도가</p>
                    <p className="text-lg font-medium">{formatCurrency(position.average_sell_price)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">수익금</p>
                    <p className={`text-lg font-medium ${getProfitLossClass(position.profit_loss)}`}>
                      {formatCurrency(position.profit_loss)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">수익률</p>
                    <p className={`text-lg font-medium ${getProfitLossClass(position.profit_rate)}`}>
                      {formatPercent(position.profit_rate)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Targets */}
        <Card>
          <CardHeader>
            <CardTitle>목표가 설정</CardTitle>
          </CardHeader>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">익절가</p>
              {position.take_profit_targets?.length > 0 ? (
                <div className="space-y-1">
                  {position.take_profit_targets.map((target, i) => (
                    <div key={i} className="flex justify-between text-sm bg-red-50 p-2 rounded">
                      <span className="text-red-700">{formatCurrency(target.price)}</span>
                      <span className="text-red-600">{formatPercent(target.ratio)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">설정 안됨</p>
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">손절가</p>
              {position.stop_loss_targets?.length > 0 ? (
                <div className="space-y-1">
                  {position.stop_loss_targets.map((target, i) => (
                    <div key={i} className="flex justify-between text-sm bg-blue-50 p-2 rounded">
                      <span className="text-blue-700">{formatCurrency(target.price)}</span>
                      <span className="text-blue-600">{formatPercent(target.ratio)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">설정 안됨</p>
              )}
            </div>
          </div>
        </Card>

        {/* Audit Info */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>이력</CardTitle>
          </CardHeader>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500">개설자</p>
              <p className="font-medium">{position.opened_by?.full_name || '-'}</p>
            </div>
            <div>
              <p className="text-gray-500">개설 일시</p>
              <p className="font-medium">{formatDate(position.opened_at)}</p>
            </div>
            <div>
              <p className="text-gray-500">정보 확인</p>
              <p className="font-medium">
                {position.is_info_confirmed ? (
                  <span className="text-green-600">완료</span>
                ) : (
                  <span className="text-yellow-600">미확인</span>
                )}
              </p>
            </div>
            {position.status === 'closed' && (
              <>
                <div>
                  <p className="text-gray-500">종료자</p>
                  <p className="font-medium">{position.closed_by?.full_name || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">종료 일시</p>
                  <p className="font-medium">{formatDate(position.closed_at)}</p>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Sell Request Modal */}
      <Modal
        isOpen={showSellModal}
        onClose={() => setShowSellModal(false)}
        title="정리 요청"
      >
        <SellRequestForm
          position={position}
          onSuccess={() => {
            setShowSellModal(false);
            fetchPosition();
          }}
          onCancel={() => setShowSellModal(false)}
        />
      </Modal>

      {/* Close Position Modal */}
      <Modal
        isOpen={showCloseModal}
        onClose={() => setShowCloseModal(false)}
        title="포지션 수동 종료"
      >
        <div className="space-y-4">
          <div className="bg-gray-50 p-3 rounded-lg text-sm">
            <p className="text-gray-600">진입 금액: <span className="font-medium">{formatCurrency(position.total_buy_amount)}</span></p>
          </div>
          <Input
            label="청산 금액 (실제 계좌로 돌아온 금액)"
            type="number"
            value={closeData.total_sell_amount}
            onChange={(e) => setCloseData({ ...closeData, total_sell_amount: e.target.value })}
            placeholder="예: 10500000"
            required
          />
          {closeData.total_sell_amount && position.total_buy_amount && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">예상 수익금</span>
                <span className={getProfitLossClass(parseFloat(closeData.total_sell_amount) - parseFloat(position.total_buy_amount))}>
                  {formatCurrency(parseFloat(closeData.total_sell_amount) - parseFloat(position.total_buy_amount))}
                </span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-600">예상 수익률</span>
                <span className={getProfitLossClass(parseFloat(closeData.total_sell_amount) - parseFloat(position.total_buy_amount))}>
                  {formatPercent((parseFloat(closeData.total_sell_amount) - parseFloat(position.total_buy_amount)) / parseFloat(position.total_buy_amount))}
                </span>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowCloseModal(false)}>
              취소
            </Button>
            <Button variant="danger" onClick={handleClose} loading={actionLoading}>
              종료
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirm Position Info Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="포지션 정보 확인"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            실제 체결 내역을 확인하여 정확한 정보를 입력해주세요.
          </p>
          <Input
            label="종목명"
            type="text"
            value={confirmData.ticker_name}
            onChange={(e) => setConfirmData({ ...confirmData, ticker_name: e.target.value })}
            placeholder="예: 삼성전자"
          />
          <Input
            label="평균 매입가"
            type="number"
            value={confirmData.average_buy_price}
            onChange={(e) => setConfirmData({ ...confirmData, average_buy_price: e.target.value })}
            placeholder="예: 72500"
            required
          />
          <Input
            label="수량"
            type="number"
            value={confirmData.total_quantity}
            onChange={(e) => setConfirmData({ ...confirmData, total_quantity: e.target.value })}
            placeholder="예: 100"
            required
          />
          {confirmData.average_buy_price && confirmData.total_quantity && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">진입 금액</span>
                <span className="font-medium">
                  {formatCurrency(parseFloat(confirmData.average_buy_price) * parseFloat(confirmData.total_quantity))}
                </span>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>
              취소
            </Button>
            <Button onClick={handleConfirm} loading={actionLoading}>
              확인 완료
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
