import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { Input, Textarea } from '../components/common/Input';
import { SellRequestForm } from '../components/forms/SellRequestForm';
import { positionService } from '../services/positionService';
import { requestService } from '../services/requestService';
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
  const [auditLogs, setAuditLogs] = useState([]);
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [showEditPlansModal, setShowEditPlansModal] = useState(false);
  const [showAddBuyModal, setShowAddBuyModal] = useState(false);
  const [editPlansData, setEditPlansData] = useState({
    buy_plan: [],
    take_profit_targets: [],
    stop_loss_targets: []
  });
  const [addBuyData, setAddBuyData] = useState({
    buy_price: '',
    order_quantity: '',
    buy_orders: [{ price: '', quantity: '' }],
    take_profit_targets: [{ price: '', quantity: '' }],
    stop_loss_targets: [{ price: '', quantity: '' }],
    memo: ''
  });
  const [closeData, setCloseData] = useState({
    ticker_name: '',
    average_buy_price: '',
    total_quantity: '',
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
      // 종료 폼 데이터 초기화 (기존 포지션 정보로)
      setCloseData({
        ticker_name: data.ticker_name || '',
        average_buy_price: data.average_buy_price || '',
        total_quantity: data.total_quantity || '',
        total_sell_amount: '',
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
      // 포지션 정보 수정이 있으면 먼저 업데이트
      const buyPriceChanged = parseFloat(closeData.average_buy_price) !== parseFloat(position.average_buy_price);
      const quantityChanged = parseFloat(closeData.total_quantity) !== parseFloat(position.total_quantity);
      const nameChanged = closeData.ticker_name !== position.ticker_name;

      if (buyPriceChanged || quantityChanged || nameChanged) {
        await positionService.confirmPositionInfo(id, {
          average_buy_price: parseFloat(closeData.average_buy_price),
          total_quantity: parseFloat(closeData.total_quantity),
          ticker_name: closeData.ticker_name || null,
        });
      }

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

  const handleTogglePlan = async (planType, index, completed) => {
    try {
      const updatedPosition = await positionService.togglePlanItem(id, planType, index, completed);
      setPosition(updatedPosition);
      // 이력 새로고침
      if (showAuditLogs) {
        fetchAuditLogs();
      }
    } catch (error) {
      alert(error.response?.data?.detail || '상태 변경에 실패했습니다.');
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const data = await positionService.getAuditLogs(id);
      setAuditLogs(data.logs || []);
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    }
  };

  const toggleAuditLogs = () => {
    if (!showAuditLogs && auditLogs.length === 0) {
      fetchAuditLogs();
    }
    setShowAuditLogs(!showAuditLogs);
  };

  // 계획 수정 모달 열기
  const openEditPlansModal = () => {
    setEditPlansData({
      buy_plan: position.buy_plan?.map(p => ({ ...p })) || [],
      take_profit_targets: position.take_profit_targets?.map(t => ({ ...t })) || [],
      stop_loss_targets: position.stop_loss_targets?.map(t => ({ ...t })) || []
    });
    setShowEditPlansModal(true);
  };

  // 계획 저장
  const handleSavePlans = async () => {
    setActionLoading(true);
    try {
      const updatedPosition = await positionService.updatePlans(id, {
        buyPlan: editPlansData.buy_plan.length > 0 ? editPlansData.buy_plan : null,
        takeProfitTargets: editPlansData.take_profit_targets.length > 0 ? editPlansData.take_profit_targets : null,
        stopLossTargets: editPlansData.stop_loss_targets.length > 0 ? editPlansData.stop_loss_targets : null
      });
      setPosition(updatedPosition);
      setShowEditPlansModal(false);
      if (showAuditLogs) fetchAuditLogs();
    } catch (error) {
      alert(error.response?.data?.detail || '계획 수정에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  // 추가매수 요청
  const handleAddBuyRequest = async () => {
    if (!addBuyData.buy_price || !addBuyData.order_quantity) {
      alert('매수가와 수량을 입력해주세요.');
      return;
    }
    setActionLoading(true);
    try {
      const data = {
        target_ticker: position.ticker,
        ticker_name: position.ticker_name,
        target_market: position.market,
        position_id: position.id,
        order_type: 'quantity',
        order_quantity: parseFloat(addBuyData.order_quantity),
        buy_price: parseFloat(addBuyData.buy_price),
        buy_orders: addBuyData.buy_orders
          .filter(o => o.price && o.quantity)
          .map(o => ({ price: parseFloat(o.price), quantity: parseFloat(o.quantity) })),
        take_profit_targets: addBuyData.take_profit_targets
          .filter(t => t.price && t.quantity)
          .map(t => ({ price: parseFloat(t.price), quantity: parseFloat(t.quantity) })),
        stop_loss_targets: addBuyData.stop_loss_targets
          .filter(t => t.price && t.quantity)
          .map(t => ({ price: parseFloat(t.price), quantity: parseFloat(t.quantity) })),
        memo: addBuyData.memo || null
      };
      if (data.buy_orders.length === 0) data.buy_orders = null;
      if (data.take_profit_targets.length === 0) data.take_profit_targets = null;
      if (data.stop_loss_targets.length === 0) data.stop_loss_targets = null;

      await requestService.createBuyRequest(data);
      setShowAddBuyModal(false);
      setAddBuyData({
        buy_price: '',
        order_quantity: '',
        buy_orders: [{ price: '', quantity: '' }],
        take_profit_targets: [{ price: '', quantity: '' }],
        stop_loss_targets: [{ price: '', quantity: '' }],
        memo: ''
      });
      alert('추가매수 요청이 생성되었습니다.');
    } catch (error) {
      alert(error.response?.data?.detail || '추가매수 요청에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  // 잔량과 계획 수량 비교
  const quantityWarning = useMemo(() => {
    if (!position || position.status === 'closed') return null;

    const totalQty = parseFloat(position.total_quantity) || 0;

    // 익절 계획 수량 합계 (미완료만)
    const tpQty = (position.take_profit_targets || [])
      .filter(t => !t.completed)
      .reduce((sum, t) => sum + (parseFloat(t.quantity) || 0), 0);

    // 손절 계획 수량 합계 (미완료만)
    const slQty = (position.stop_loss_targets || [])
      .filter(t => !t.completed)
      .reduce((sum, t) => sum + (parseFloat(t.quantity) || 0), 0);

    const warnings = [];
    if (tpQty > 0 && tpQty !== totalQty) {
      warnings.push(`익절 계획 수량(${tpQty})이 보유 수량(${totalQty})과 다릅니다`);
    }
    if (slQty > 0 && slQty !== totalQty) {
      warnings.push(`손절 계획 수량(${slQty})이 보유 수량(${totalQty})과 다릅니다`);
    }

    return warnings.length > 0 ? warnings : null;
  }, [position]);

  const formatFieldName = (field) => {
    const names = {
      'average_buy_price': '평균 매입가',
      'total_quantity': '수량',
      'total_buy_amount': '진입 금액',
      'ticker_name': '종목명',
      'is_info_confirmed': '정보 확인',
    };
    // buy_plan[0].completed 같은 형식 처리
    if (field?.includes('buy_plan')) {
      const match = field.match(/buy_plan\[(\d+)\]/);
      return match ? `분할매수 ${parseInt(match[1]) + 1}번` : field;
    }
    if (field?.includes('take_profit')) {
      const match = field.match(/take_profit_targets\[(\d+)\]/);
      return match ? `익절 ${parseInt(match[1]) + 1}번` : field;
    }
    if (field?.includes('stop_loss')) {
      const match = field.match(/stop_loss_targets\[(\d+)\]/);
      return match ? `손절 ${parseInt(match[1]) + 1}번` : field;
    }
    return names[field] || field;
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
          <div className="flex gap-2 flex-wrap">
            {isManager() && needsConfirmation && (
              <Button onClick={() => setShowConfirmModal(true)}>
                정보 확인
              </Button>
            )}
            {isManager() && (
              <Button variant="secondary" onClick={openEditPlansModal}>
                계획 수정
              </Button>
            )}
            <Button variant="secondary" onClick={() => setShowAddBuyModal(true)}>
              추가매수 요청
            </Button>
            <Button variant="secondary" onClick={() => setShowSellModal(true)}>
              매도 요청
            </Button>
            {isManagerOrAdmin() && (
              <Button variant="danger" onClick={() => setShowCloseModal(true)}>
                수동 종료
              </Button>
            )}
          </div>
        )}
      </div>

      {/* 잔량 경고 */}
      {quantityWarning && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="font-medium text-yellow-800">계획 수량 확인 필요</h3>
              {quantityWarning.map((w, i) => (
                <p key={i} className="text-sm text-yellow-700 mt-1">{w}</p>
              ))}
            </div>
          </div>
        </div>
      )}

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
                <p className="text-lg font-medium">{formatCurrency(position.average_buy_price, position.market)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">보유 수량</p>
                <p className="text-lg font-medium">{position.total_quantity}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">진입 금액</p>
                <p className="text-lg font-medium">{formatCurrency(position.total_buy_amount, position.market)}</p>
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
                    <p className="text-lg font-medium">{formatCurrency(position.total_sell_amount, position.market)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">평균 매도가</p>
                    <p className="text-lg font-medium">{formatCurrency(position.average_sell_price, position.market)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">수익금</p>
                    <p className={`text-lg font-medium ${getProfitLossClass(position.profit_loss)}`}>
                      {formatCurrency(position.profit_loss, position.market)}
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

        {/* Buy Plan & Targets */}
        <Card>
          <CardHeader>
            <CardTitle>매매 계획</CardTitle>
          </CardHeader>

          <div className="space-y-4">
            {/* 매수 계획 */}
            {position.buy_plan?.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">분할 매수</p>
                <div className="space-y-1">
                  {position.buy_plan.map((item, i) => {
                    const isCancelled = position.status === 'closed' && !item.completed;
                    return (
                      <div key={i} className={`flex items-center justify-between text-sm p-2 rounded ${item.completed ? 'bg-gray-100' : isCancelled ? 'bg-gray-50' : 'bg-blue-50'}`}>
                        <div className="flex items-center gap-2">
                          {isManager() && (
                            <input
                              type="checkbox"
                              checked={item.completed}
                              onChange={(e) => handleTogglePlan('buy', i, e.target.checked)}
                              className="w-4 h-4 text-primary-600 rounded"
                            />
                          )}
                          <span className={item.completed ? 'text-gray-500 line-through' : isCancelled ? 'text-gray-400 line-through' : 'text-blue-700'}>
                            {formatCurrency(item.price, position.market)}
                            {item.quantity && ` x ${item.quantity}`}
                            {item.ratio && ` (${formatPercent(item.ratio)})`}
                          </span>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          item.completed ? 'bg-green-100 text-green-700' :
                          isCancelled ? 'bg-gray-200 text-gray-500' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {item.completed ? '완료' : isCancelled ? '취소됨' : '대기'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 익절가 */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">익절가</p>
              {position.take_profit_targets?.length > 0 ? (
                <div className="space-y-1">
                  {position.take_profit_targets.map((target, i) => {
                    const isCancelled = position.status === 'closed' && !target.completed;
                    return (
                      <div key={i} className={`flex items-center justify-between text-sm p-2 rounded ${target.completed ? 'bg-gray-100' : isCancelled ? 'bg-gray-50' : 'bg-red-50'}`}>
                        <div className="flex items-center gap-2">
                          {isManager() && (
                            <input
                              type="checkbox"
                              checked={target.completed}
                              onChange={(e) => handleTogglePlan('take_profit', i, e.target.checked)}
                              className="w-4 h-4 text-primary-600 rounded"
                            />
                          )}
                          <span className={target.completed ? 'text-gray-500 line-through' : isCancelled ? 'text-gray-400 line-through' : 'text-red-700'}>
                            {formatCurrency(target.price, position.market)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={target.completed ? 'text-gray-500' : isCancelled ? 'text-gray-400' : 'text-red-600'}>x {target.quantity ?? formatPercent(target.ratio)}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            target.completed ? 'bg-green-100 text-green-700' :
                            isCancelled ? 'bg-gray-200 text-gray-500' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {target.completed ? '완료' : isCancelled ? '취소됨' : '대기'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500">설정 안됨</p>
              )}
            </div>

            {/* 손절가 */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">손절가</p>
              {position.stop_loss_targets?.length > 0 ? (
                <div className="space-y-1">
                  {position.stop_loss_targets.map((target, i) => {
                    const isCancelled = position.status === 'closed' && !target.completed;
                    return (
                      <div key={i} className={`flex items-center justify-between text-sm p-2 rounded ${target.completed ? 'bg-gray-100' : isCancelled ? 'bg-gray-50' : 'bg-blue-50'}`}>
                        <div className="flex items-center gap-2">
                          {isManager() && (
                            <input
                              type="checkbox"
                              checked={target.completed}
                              onChange={(e) => handleTogglePlan('stop_loss', i, e.target.checked)}
                              className="w-4 h-4 text-primary-600 rounded"
                            />
                          )}
                          <span className={target.completed ? 'text-gray-500 line-through' : isCancelled ? 'text-gray-400 line-through' : 'text-blue-700'}>
                            {formatCurrency(target.price, position.market)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={target.completed ? 'text-gray-500' : isCancelled ? 'text-gray-400' : 'text-blue-600'}>x {target.quantity ?? formatPercent(target.ratio)}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            target.completed ? 'bg-green-100 text-green-700' :
                            isCancelled ? 'bg-gray-200 text-gray-500' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {target.completed ? '완료' : isCancelled ? '취소됨' : '대기'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
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

          {/* 수정 이력 토글 */}
          <button
            onClick={toggleAuditLogs}
            className="mt-4 pt-4 border-t w-full flex items-center justify-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <span>{showAuditLogs ? '수정 이력 접기' : '수정 이력 보기'}</span>
            <svg className={`w-4 h-4 transition-transform ${showAuditLogs ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* 수정 이력 목록 */}
          {showAuditLogs && (
            <div className="mt-4 space-y-2">
              {auditLogs.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">수정 이력이 없습니다</p>
              ) : (
                auditLogs.map(log => (
                  <div key={log.id} className="p-3 bg-gray-50 rounded-lg text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-700">{log.user?.full_name || '알 수 없음'}</span>
                      <span className="text-xs text-gray-400">{formatDate(log.created_at)}</span>
                    </div>
                    {log.field_name ? (
                      <p className="text-gray-600">
                        <span className="font-medium">{formatFieldName(log.field_name)}</span>
                        {': '}
                        <span className="text-red-500 line-through">{log.old_value ?? '-'}</span>
                        {' → '}
                        <span className="text-green-600">{log.new_value ?? '-'}</span>
                      </p>
                    ) : log.changes ? (
                      <div className="space-y-1">
                        {Object.entries(log.changes).map(([field, vals]) => (
                          <p key={field} className="text-gray-600">
                            <span className="font-medium">{formatFieldName(field)}</span>
                            {': '}
                            <span className="text-red-500 line-through">{vals.old ?? '-'}</span>
                            {' → '}
                            <span className="text-green-600">{vals.new ?? '-'}</span>
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-600">{log.action}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Sell Request Modal */}
      <Modal
        isOpen={showSellModal}
        onClose={() => setShowSellModal(false)}
        title="매도 요청"
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
        title="포지션 종료"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            포지션 정보를 확인하고 청산 금액을 입력해주세요. 정보가 다르면 수정 가능합니다.
          </p>

          <div className="border-b pb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">포지션 정보</h4>
            <Input
              label="종목명"
              type="text"
              value={closeData.ticker_name}
              onChange={(e) => setCloseData({ ...closeData, ticker_name: e.target.value })}
              placeholder="예: 삼성전자"
            />
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Input
                label="평균 매입가"
                type="number"
                value={closeData.average_buy_price}
                onChange={(e) => setCloseData({ ...closeData, average_buy_price: e.target.value })}
                placeholder="예: 72500"
              />
              <Input
                label="수량"
                type="number"
                value={closeData.total_quantity}
                onChange={(e) => setCloseData({ ...closeData, total_quantity: e.target.value })}
                placeholder="예: 100"
              />
            </div>
            {closeData.average_buy_price && closeData.total_quantity && (
              <div className="mt-2 text-sm text-gray-600">
                진입 금액: <span className="font-medium">{formatCurrency(parseFloat(closeData.average_buy_price) * parseFloat(closeData.total_quantity), position.market)}</span>
              </div>
            )}
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">청산 정보</h4>
            <Input
              label="청산 금액 (실제 계좌로 돌아온 금액)"
              type="number"
              value={closeData.total_sell_amount}
              onChange={(e) => setCloseData({ ...closeData, total_sell_amount: e.target.value })}
              placeholder="예: 10500000"
              required
            />
          </div>

          {closeData.total_sell_amount && closeData.average_buy_price && closeData.total_quantity && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">예상 수익금</span>
                <span className={getProfitLossClass(parseFloat(closeData.total_sell_amount) - (parseFloat(closeData.average_buy_price) * parseFloat(closeData.total_quantity)))}>
                  {formatCurrency(parseFloat(closeData.total_sell_amount) - (parseFloat(closeData.average_buy_price) * parseFloat(closeData.total_quantity)), position.market)}
                </span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-600">예상 수익률</span>
                <span className={getProfitLossClass(parseFloat(closeData.total_sell_amount) - (parseFloat(closeData.average_buy_price) * parseFloat(closeData.total_quantity)))}>
                  {formatPercent((parseFloat(closeData.total_sell_amount) - (parseFloat(closeData.average_buy_price) * parseFloat(closeData.total_quantity))) / (parseFloat(closeData.average_buy_price) * parseFloat(closeData.total_quantity)))}
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
                  {formatCurrency(parseFloat(confirmData.average_buy_price) * parseFloat(confirmData.total_quantity), position.market)}
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

      {/* Edit Plans Modal */}
      <Modal
        isOpen={showEditPlansModal}
        onClose={() => setShowEditPlansModal(false)}
        title="매매 계획 수정"
        size="lg"
      >
        <div className="space-y-6 max-h-[70vh] overflow-y-auto">
          {/* 분할 매수 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">분할 매수</label>
              <button
                type="button"
                onClick={() => setEditPlansData({
                  ...editPlansData,
                  buy_plan: [...editPlansData.buy_plan, { price: '', quantity: '', completed: false }]
                })}
                className="text-xs text-primary-600 hover:text-primary-700"
              >
                + 추가
              </button>
            </div>
            <div className="space-y-2">
              {editPlansData.buy_plan.map((item, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    type="number"
                    step="any"
                    placeholder="매수가"
                    value={item.price}
                    onChange={(e) => {
                      const newPlan = [...editPlansData.buy_plan];
                      newPlan[i] = { ...newPlan[i], price: e.target.value };
                      setEditPlansData({ ...editPlansData, buy_plan: newPlan });
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder="수량"
                    value={item.quantity}
                    onChange={(e) => {
                      const newPlan = [...editPlansData.buy_plan];
                      newPlan[i] = { ...newPlan[i], quantity: e.target.value };
                      setEditPlansData({ ...editPlansData, buy_plan: newPlan });
                    }}
                    className="w-24 px-2 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <label className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={(e) => {
                        const newPlan = [...editPlansData.buy_plan];
                        newPlan[i] = { ...newPlan[i], completed: e.target.checked };
                        setEditPlansData({ ...editPlansData, buy_plan: newPlan });
                      }}
                      className="w-4 h-4"
                    />
                    완료
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const newPlan = editPlansData.buy_plan.filter((_, idx) => idx !== i);
                      setEditPlansData({ ...editPlansData, buy_plan: newPlan });
                    }}
                    className="p-1 text-gray-400 hover:text-red-500"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 익절 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">익절</label>
              <button
                type="button"
                onClick={() => setEditPlansData({
                  ...editPlansData,
                  take_profit_targets: [...editPlansData.take_profit_targets, { price: '', quantity: '', completed: false }]
                })}
                className="text-xs text-primary-600 hover:text-primary-700"
              >
                + 추가
              </button>
            </div>
            <div className="space-y-2">
              {editPlansData.take_profit_targets.map((item, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    type="number"
                    step="any"
                    placeholder="익절가"
                    value={item.price}
                    onChange={(e) => {
                      const newTargets = [...editPlansData.take_profit_targets];
                      newTargets[i] = { ...newTargets[i], price: e.target.value };
                      setEditPlansData({ ...editPlansData, take_profit_targets: newTargets });
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder="수량"
                    value={item.quantity}
                    onChange={(e) => {
                      const newTargets = [...editPlansData.take_profit_targets];
                      newTargets[i] = { ...newTargets[i], quantity: e.target.value };
                      setEditPlansData({ ...editPlansData, take_profit_targets: newTargets });
                    }}
                    className="w-24 px-2 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <label className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={(e) => {
                        const newTargets = [...editPlansData.take_profit_targets];
                        newTargets[i] = { ...newTargets[i], completed: e.target.checked };
                        setEditPlansData({ ...editPlansData, take_profit_targets: newTargets });
                      }}
                      className="w-4 h-4"
                    />
                    완료
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const newTargets = editPlansData.take_profit_targets.filter((_, idx) => idx !== i);
                      setEditPlansData({ ...editPlansData, take_profit_targets: newTargets });
                    }}
                    className="p-1 text-gray-400 hover:text-red-500"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 손절 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">손절</label>
              <button
                type="button"
                onClick={() => setEditPlansData({
                  ...editPlansData,
                  stop_loss_targets: [...editPlansData.stop_loss_targets, { price: '', quantity: '', completed: false }]
                })}
                className="text-xs text-primary-600 hover:text-primary-700"
              >
                + 추가
              </button>
            </div>
            <div className="space-y-2">
              {editPlansData.stop_loss_targets.map((item, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    type="number"
                    step="any"
                    placeholder="손절가"
                    value={item.price}
                    onChange={(e) => {
                      const newTargets = [...editPlansData.stop_loss_targets];
                      newTargets[i] = { ...newTargets[i], price: e.target.value };
                      setEditPlansData({ ...editPlansData, stop_loss_targets: newTargets });
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder="수량"
                    value={item.quantity}
                    onChange={(e) => {
                      const newTargets = [...editPlansData.stop_loss_targets];
                      newTargets[i] = { ...newTargets[i], quantity: e.target.value };
                      setEditPlansData({ ...editPlansData, stop_loss_targets: newTargets });
                    }}
                    className="w-24 px-2 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <label className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={(e) => {
                        const newTargets = [...editPlansData.stop_loss_targets];
                        newTargets[i] = { ...newTargets[i], completed: e.target.checked };
                        setEditPlansData({ ...editPlansData, stop_loss_targets: newTargets });
                      }}
                      className="w-4 h-4"
                    />
                    완료
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const newTargets = editPlansData.stop_loss_targets.filter((_, idx) => idx !== i);
                      setEditPlansData({ ...editPlansData, stop_loss_targets: newTargets });
                    }}
                    className="p-1 text-gray-400 hover:text-red-500"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowEditPlansModal(false)}>
              취소
            </Button>
            <Button onClick={handleSavePlans} loading={actionLoading}>
              저장
            </Button>
          </div>
        </div>
      </Modal>

      {/* Additional Buy Request Modal */}
      <Modal
        isOpen={showAddBuyModal}
        onClose={() => setShowAddBuyModal(false)}
        title="추가매수 요청"
        size="lg"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              <strong>{position.ticker_name || position.ticker}</strong>에 추가매수 요청을 작성합니다.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="매수가"
              type="number"
              step="any"
              value={addBuyData.buy_price}
              onChange={(e) => setAddBuyData({ ...addBuyData, buy_price: e.target.value })}
              placeholder="희망 매수가"
              required
            />
            <Input
              label="수량"
              type="number"
              step="any"
              value={addBuyData.order_quantity}
              onChange={(e) => setAddBuyData({ ...addBuyData, order_quantity: e.target.value })}
              placeholder="매수 수량"
              required
            />
          </div>

          {/* 분할 매수 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">분할 매수 (선택)</label>
              {addBuyData.buy_orders.length < 4 && (
                <button
                  type="button"
                  onClick={() => setAddBuyData({
                    ...addBuyData,
                    buy_orders: [...addBuyData.buy_orders, { price: '', quantity: '' }]
                  })}
                  className="text-xs text-primary-600 hover:text-primary-700"
                >
                  + 추가
                </button>
              )}
            </div>
            <div className="space-y-2">
              {addBuyData.buy_orders.map((order, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    type="number"
                    step="any"
                    placeholder="매수가"
                    value={order.price}
                    onChange={(e) => {
                      const newOrders = [...addBuyData.buy_orders];
                      newOrders[i] = { ...newOrders[i], price: e.target.value };
                      setAddBuyData({ ...addBuyData, buy_orders: newOrders });
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder="수량"
                    value={order.quantity}
                    onChange={(e) => {
                      const newOrders = [...addBuyData.buy_orders];
                      newOrders[i] = { ...newOrders[i], quantity: e.target.value };
                      setAddBuyData({ ...addBuyData, buy_orders: newOrders });
                    }}
                    className="w-24 px-2 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  {addBuyData.buy_orders.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const newOrders = addBuyData.buy_orders.filter((_, idx) => idx !== i);
                        setAddBuyData({ ...addBuyData, buy_orders: newOrders });
                      }}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 익절 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">익절 (선택)</label>
              {addBuyData.take_profit_targets.length < 4 && (
                <button
                  type="button"
                  onClick={() => setAddBuyData({
                    ...addBuyData,
                    take_profit_targets: [...addBuyData.take_profit_targets, { price: '', quantity: '' }]
                  })}
                  className="text-xs text-primary-600 hover:text-primary-700"
                >
                  + 추가
                </button>
              )}
            </div>
            <div className="space-y-2">
              {addBuyData.take_profit_targets.map((target, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    type="number"
                    step="any"
                    placeholder="익절가"
                    value={target.price}
                    onChange={(e) => {
                      const newTargets = [...addBuyData.take_profit_targets];
                      newTargets[i] = { ...newTargets[i], price: e.target.value };
                      setAddBuyData({ ...addBuyData, take_profit_targets: newTargets });
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder="수량"
                    value={target.quantity}
                    onChange={(e) => {
                      const newTargets = [...addBuyData.take_profit_targets];
                      newTargets[i] = { ...newTargets[i], quantity: e.target.value };
                      setAddBuyData({ ...addBuyData, take_profit_targets: newTargets });
                    }}
                    className="w-24 px-2 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  {addBuyData.take_profit_targets.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const newTargets = addBuyData.take_profit_targets.filter((_, idx) => idx !== i);
                        setAddBuyData({ ...addBuyData, take_profit_targets: newTargets });
                      }}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 손절 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">손절 (선택)</label>
              {addBuyData.stop_loss_targets.length < 4 && (
                <button
                  type="button"
                  onClick={() => setAddBuyData({
                    ...addBuyData,
                    stop_loss_targets: [...addBuyData.stop_loss_targets, { price: '', quantity: '' }]
                  })}
                  className="text-xs text-primary-600 hover:text-primary-700"
                >
                  + 추가
                </button>
              )}
            </div>
            <div className="space-y-2">
              {addBuyData.stop_loss_targets.map((target, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    type="number"
                    step="any"
                    placeholder="손절가"
                    value={target.price}
                    onChange={(e) => {
                      const newTargets = [...addBuyData.stop_loss_targets];
                      newTargets[i] = { ...newTargets[i], price: e.target.value };
                      setAddBuyData({ ...addBuyData, stop_loss_targets: newTargets });
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder="수량"
                    value={target.quantity}
                    onChange={(e) => {
                      const newTargets = [...addBuyData.stop_loss_targets];
                      newTargets[i] = { ...newTargets[i], quantity: e.target.value };
                      setAddBuyData({ ...addBuyData, stop_loss_targets: newTargets });
                    }}
                    className="w-24 px-2 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  {addBuyData.stop_loss_targets.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const newTargets = addBuyData.stop_loss_targets.filter((_, idx) => idx !== i);
                        setAddBuyData({ ...addBuyData, stop_loss_targets: newTargets });
                      }}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 메모 */}
          <Textarea
            label="메모 (선택)"
            rows={2}
            placeholder="추가매수 사유..."
            value={addBuyData.memo}
            onChange={(e) => setAddBuyData({ ...addBuyData, memo: e.target.value })}
          />

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowAddBuyModal(false)}>
              취소
            </Button>
            <Button onClick={handleAddBuyRequest} loading={actionLoading}>
              추가매수 요청
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
