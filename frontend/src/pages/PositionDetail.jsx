import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { Input, Textarea } from '../components/common/Input';
import { SellRequestForm } from '../components/forms/SellRequestForm';
import { positionService } from '../services/positionService';
import { requestService } from '../services/requestService';
import { discussionService } from '../services/discussionService';
import { useAuth } from '../hooks/useAuth';
import {
  formatCurrency,
  formatPercent,
  formatDate,
  formatHours,
  formatQuantity,
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
  const [auditLogs, setAuditLogs] = useState([]);
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [discussions, setDiscussions] = useState([]);
  const [showDiscussionModal, setShowDiscussionModal] = useState(false);
  const [discussionTitle, setDiscussionTitle] = useState('');
  const [showAddBuyModal, setShowAddBuyModal] = useState(false);
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
  const [actionLoading, setActionLoading] = useState(false);

  // 인라인 편집 상태
  const [editingInfo, setEditingInfo] = useState(false);
  const [infoData, setInfoData] = useState({ average_buy_price: '', total_quantity: '', ticker_name: '' });

  useEffect(() => {
    fetchPosition();
    fetchDiscussions();
  }, [id]);

  const fetchDiscussions = async () => {
    try {
      const data = await discussionService.getPositionDiscussions(id);
      setDiscussions(data || []);
    } catch (error) {
      console.error('Failed to fetch discussions:', error);
    }
  };

  const fetchPosition = async () => {
    try {
      const data = await positionService.getPosition(id);
      setPosition(data);
      setInfoData({
        average_buy_price: data.average_buy_price || '',
        total_quantity: data.total_quantity || '',
        ticker_name: data.ticker_name || '',
      });
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

  const handleCreateDiscussion = async () => {
    if (!discussionTitle.trim()) {
      alert('토론 제목을 입력해주세요.');
      return;
    }
    setActionLoading(true);
    try {
      const discussion = await discussionService.createDiscussion({
        positionId: parseInt(id),
        title: discussionTitle.trim()
      });
      setShowDiscussionModal(false);
      setDiscussionTitle('');
      fetchDiscussions();
      navigate(`/discussions/${discussion.id}`);
    } catch (error) {
      alert(error.response?.data?.detail || '토론방 생성에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  // 포지션 정보 저장 (인라인)
  const handleSaveInfo = async () => {
    if (!infoData.average_buy_price || !infoData.total_quantity) {
      alert('평균 매입가와 수량을 입력해주세요.');
      return;
    }
    setActionLoading(true);
    try {
      await positionService.confirmPositionInfo(id, {
        average_buy_price: parseFloat(infoData.average_buy_price),
        total_quantity: parseFloat(infoData.total_quantity),
        ticker_name: infoData.ticker_name || null,
      });
      setEditingInfo(false);
      fetchPosition();
      if (showAuditLogs) fetchAuditLogs();
    } catch (error) {
      alert(error.response?.data?.detail || '정보 저장에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  // 체크박스 토글
  const handleTogglePlan = async (planType, index, completed) => {
    try {
      const updatedPosition = await positionService.togglePlanItem(id, planType, index, completed);
      setPosition(updatedPosition);
      if (showAuditLogs) fetchAuditLogs();
    } catch (error) {
      alert(error.response?.data?.detail || '상태 변경에 실패했습니다.');
    }
  };

  // 계획 항목 추가
  const handleAddPlanItem = async (planType) => {
    const newItem = { price: '', quantity: '', completed: false };
    const currentPlans = {
      buy_plan: position.buy_plan || [],
      take_profit_targets: position.take_profit_targets || [],
      stop_loss_targets: position.stop_loss_targets || []
    };

    const key = planType === 'buy' ? 'buy_plan' : planType === 'take_profit' ? 'take_profit_targets' : 'stop_loss_targets';
    const updatedPlans = { ...currentPlans, [key]: [...currentPlans[key], newItem] };

    try {
      const updatedPosition = await positionService.updatePlans(id, {
        buyPlan: updatedPlans.buy_plan,
        takeProfitTargets: updatedPlans.take_profit_targets,
        stopLossTargets: updatedPlans.stop_loss_targets
      });
      setPosition(updatedPosition);
    } catch (error) {
      alert(error.response?.data?.detail || '추가에 실패했습니다.');
    }
  };

  // 계획 항목 삭제
  const handleRemovePlanItem = async (planType, index) => {
    const currentPlans = {
      buy_plan: position.buy_plan || [],
      take_profit_targets: position.take_profit_targets || [],
      stop_loss_targets: position.stop_loss_targets || []
    };

    const key = planType === 'buy' ? 'buy_plan' : planType === 'take_profit' ? 'take_profit_targets' : 'stop_loss_targets';
    const updatedPlans = { ...currentPlans, [key]: currentPlans[key].filter((_, i) => i !== index) };

    try {
      const updatedPosition = await positionService.updatePlans(id, {
        buyPlan: updatedPlans.buy_plan.length > 0 ? updatedPlans.buy_plan : null,
        takeProfitTargets: updatedPlans.take_profit_targets.length > 0 ? updatedPlans.take_profit_targets : null,
        stopLossTargets: updatedPlans.stop_loss_targets.length > 0 ? updatedPlans.stop_loss_targets : null
      });
      setPosition(updatedPosition);
      if (showAuditLogs) fetchAuditLogs();
    } catch (error) {
      alert(error.response?.data?.detail || '삭제에 실패했습니다.');
    }
  };

  // 계획 항목 수정
  const handleUpdatePlanItem = async (planType, index, field, value) => {
    const currentPlans = {
      buy_plan: [...(position.buy_plan || [])],
      take_profit_targets: [...(position.take_profit_targets || [])],
      stop_loss_targets: [...(position.stop_loss_targets || [])]
    };

    const key = planType === 'buy' ? 'buy_plan' : planType === 'take_profit' ? 'take_profit_targets' : 'stop_loss_targets';
    currentPlans[key][index] = { ...currentPlans[key][index], [field]: value };

    try {
      const updatedPosition = await positionService.updatePlans(id, {
        buyPlan: currentPlans.buy_plan,
        takeProfitTargets: currentPlans.take_profit_targets,
        stopLossTargets: currentPlans.stop_loss_targets
      });
      setPosition(updatedPosition);
    } catch (error) {
      alert(error.response?.data?.detail || '수정에 실패했습니다.');
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
    if (!showAuditLogs && auditLogs.length === 0) fetchAuditLogs();
    setShowAuditLogs(!showAuditLogs);
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
        buy_price: '', order_quantity: '',
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

  // 잔량 경고
  const quantityWarning = useMemo(() => {
    if (!position || position.status === 'closed') return null;
    const totalQty = parseFloat(position.total_quantity) || 0;
    const tpQty = (position.take_profit_targets || []).filter(t => !t.completed).reduce((sum, t) => sum + (parseFloat(t.quantity) || 0), 0);
    const slQty = (position.stop_loss_targets || []).filter(t => !t.completed).reduce((sum, t) => sum + (parseFloat(t.quantity) || 0), 0);
    const warnings = [];
    if (tpQty > totalQty) warnings.push(`익절 계획 수량(${tpQty})이 보유 수량(${totalQty})보다 많습니다`);
    if (slQty > totalQty) warnings.push(`손절 계획 수량(${slQty})이 보유 수량(${totalQty})보다 많습니다`);
    return warnings.length > 0 ? warnings : null;
  }, [position]);

  const hasUncompletedPlans = useMemo(() => {
    if (!position) return false;
    const uncompletedTp = (position.take_profit_targets || []).filter(t => !t.completed).length;
    const uncompletedSl = (position.stop_loss_targets || []).filter(t => !t.completed).length;
    const uncompletedBuy = (position.buy_plan || []).filter(b => !b.completed).length;
    return uncompletedTp > 0 || uncompletedSl > 0 || uncompletedBuy > 0;
  }, [position]);

  const handleClose = async () => {
    if (!closeData.total_sell_amount) {
      alert('청산 금액을 입력해주세요.');
      return;
    }
    if (hasUncompletedPlans) {
      const confirmed = window.confirm('미완료된 매매 계획이 있습니다. 정말 종료하시겠습니까?\n(미완료 항목은 "취소됨"으로 표시됩니다)');
      if (!confirmed) return;
    }
    setActionLoading(true);
    try {
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
      await positionService.closePosition(id, { total_sell_amount: parseFloat(closeData.total_sell_amount) });
      setShowCloseModal(false);
      fetchPosition();
    } catch (error) {
      alert(error.response?.data?.detail || '포지션 종료에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  const formatFieldName = (field) => {
    const names = {
      'average_buy_price': '평균 매입가',
      'total_quantity': '수량',
      'total_buy_amount': '진입 금액',
      'ticker_name': '종목명',
      'is_info_confirmed': '정보 확인',
    };
    if (field?.includes('buy_plan')) {
      const match = field.match(/buy_plan\[(\d+)\]/);
      return match ? `매수 ${parseInt(match[1]) + 1}번` : field;
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

  if (loading) return <div className="text-center py-12 text-gray-500">로딩중...</div>;
  if (!position) return <div className="text-center py-12 text-gray-500">포지션을 찾을 수 없습니다</div>;

  const needsConfirmation = position.status === 'open' && !position.is_info_confirmed;

  // 계획 항목 렌더링 헬퍼
  const renderPlanItem = (item, index, planType, colorClass, isClosed) => {
    const isCancelled = isClosed && !item.completed;
    return (
      <div key={index} className={`flex items-center justify-between text-sm p-2 rounded ${item.completed ? 'bg-gray-100' : isCancelled ? 'bg-gray-50' : colorClass}`}>
        <div className="flex items-center gap-2 flex-1">
          {isManager() && !isClosed && (
            <input
              type="checkbox"
              checked={item.completed}
              onChange={(e) => handleTogglePlan(planType, index, e.target.checked)}
              className="w-4 h-4 text-primary-600 rounded"
            />
          )}
          <span className={item.completed ? 'text-gray-500 line-through' : isCancelled ? 'text-gray-400 line-through' : ''}>
            {formatCurrency(item.price, position.market)} × {formatQuantity(item.quantity)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded ${
            item.completed ? 'bg-green-100 text-green-700' :
            isCancelled ? 'bg-gray-200 text-gray-500' :
            'bg-yellow-100 text-yellow-700'
          }`}>
            {item.completed ? '완료' : isCancelled ? '취소됨' : '대기'}
          </span>
          {isManager() && !isClosed && (
            <button
              onClick={() => handleRemovePlanItem(planType, index)}
              className="p-1 text-gray-400 hover:text-red-500"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold">{position.ticker_name || position.ticker}</h1>
            <p className="text-gray-500">{position.ticker} | {position.market}</p>
          </div>
          <span className={`badge ${getStatusBadgeClass(position.status)}`}>{getStatusLabel(position.status)}</span>
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
            <Button variant="secondary" onClick={() => setShowAddBuyModal(true)}>추가매수 요청</Button>
            <Button variant="secondary" onClick={() => setShowSellModal(true)}>매도 요청</Button>
            {isManagerOrAdmin() && (
              <Button variant="secondary" onClick={() => {
                setDiscussionTitle(`${position.ticker_name || position.ticker} 토론`);
                setShowDiscussionModal(true);
              }}>토론방 열기</Button>
            )}
            {isManagerOrAdmin() && (
              <Button variant="danger" onClick={() => setShowCloseModal(true)}>수동 종료</Button>
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
              {quantityWarning.map((w, i) => <p key={i} className="text-sm text-yellow-700 mt-1">{w}</p>)}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Position Info - 인라인 편집 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <CardTitle>포지션 정보</CardTitle>
              {isManager() && position.status === 'open' && !editingInfo && (
                <button onClick={() => setEditingInfo(true)} className="p-1 text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
            </div>
          </CardHeader>

          {editingInfo ? (
            <div className="space-y-4">
              <Input label="종목명" value={infoData.ticker_name} onChange={(e) => setInfoData({ ...infoData, ticker_name: e.target.value })} placeholder="예: 삼성전자" />
              <div className="grid grid-cols-2 gap-4">
                <Input label="평균 매입가" type="number" step="any" value={infoData.average_buy_price} onChange={(e) => setInfoData({ ...infoData, average_buy_price: e.target.value })} required />
                <Input label="수량" type="number" step="any" value={infoData.total_quantity} onChange={(e) => setInfoData({ ...infoData, total_quantity: e.target.value })} required />
              </div>
              {infoData.average_buy_price && infoData.total_quantity && (
                <div className="text-sm text-gray-600">
                  진입 금액: <span className="font-medium">{formatCurrency(parseFloat(infoData.average_buy_price) * parseFloat(infoData.total_quantity), position.market)}</span>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => setEditingInfo(false)}>취소</Button>
                <Button size="sm" onClick={handleSaveInfo} loading={actionLoading}>저장</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">평균 매입가</p>
                  <p className="text-lg font-medium">{formatCurrency(position.average_buy_price, position.market)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">보유 수량</p>
                  <p className="text-lg font-medium">{formatQuantity(position.total_quantity)}</p>
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
                      <p className={`text-lg font-medium ${getProfitLossClass(position.profit_loss)}`}>{formatCurrency(position.profit_loss, position.market)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">수익률</p>
                      <p className={`text-lg font-medium ${getProfitLossClass(position.profit_rate)}`}>{formatPercent(position.profit_rate)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* 매매 계획 - 인라인 추가/삭제 */}
        <Card>
          <CardHeader>
            <CardTitle>매매 계획</CardTitle>
          </CardHeader>

          <div className="space-y-4">
            {/* 매수 계획 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">매수</p>
                {isManager() && position.status === 'open' && (
                  <button onClick={() => handleAddPlanItem('buy')} className="text-xs text-primary-600 hover:text-primary-700">+ 추가</button>
                )}
              </div>
              <div className="space-y-1">
                {(position.buy_plan || []).length === 0 ? (
                  <p className="text-sm text-gray-500">설정 안됨</p>
                ) : (
                  position.buy_plan.map((item, i) => renderPlanItem(item, i, 'buy', 'bg-blue-50', position.status === 'closed'))
                )}
              </div>
            </div>

            {/* 익절 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">익절가</p>
                {isManager() && position.status === 'open' && (
                  <button onClick={() => handleAddPlanItem('take_profit')} className="text-xs text-primary-600 hover:text-primary-700">+ 추가</button>
                )}
              </div>
              <div className="space-y-1">
                {(position.take_profit_targets || []).length === 0 ? (
                  <p className="text-sm text-gray-500">설정 안됨</p>
                ) : (
                  position.take_profit_targets.map((item, i) => renderPlanItem(item, i, 'take_profit', 'bg-red-50', position.status === 'closed'))
                )}
              </div>
            </div>

            {/* 손절 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">손절가</p>
                {isManager() && position.status === 'open' && (
                  <button onClick={() => handleAddPlanItem('stop_loss')} className="text-xs text-primary-600 hover:text-primary-700">+ 추가</button>
                )}
              </div>
              <div className="space-y-1">
                {(position.stop_loss_targets || []).length === 0 ? (
                  <p className="text-sm text-gray-500">설정 안됨</p>
                ) : (
                  position.stop_loss_targets.map((item, i) => renderPlanItem(item, i, 'stop_loss', 'bg-blue-50', position.status === 'closed'))
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Discussions */}
        {discussions.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>토론방</CardTitle></CardHeader>
            <div className="space-y-2">
              {discussions.map(discussion => (
                <div key={discussion.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer" onClick={() => navigate(`/discussions/${discussion.id}`)}>
                  <div>
                    <p className="font-medium text-gray-900">{discussion.title}</p>
                    <p className="text-sm text-gray-500">{discussion.opened_by?.full_name} · {formatDate(discussion.opened_at)}{discussion.message_count > 0 && ` · 메시지 ${discussion.message_count}개`}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${discussion.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                    {discussion.status === 'open' ? '진행중' : '종료'}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 이력 */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>이력</CardTitle></CardHeader>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><p className="text-gray-500">개설자</p><p className="font-medium">{position.opened_by?.full_name || '-'}</p></div>
            <div><p className="text-gray-500">개설 일시</p><p className="font-medium">{formatDate(position.opened_at)}</p></div>
            <div><p className="text-gray-500">정보 확인</p><p className="font-medium">{position.is_info_confirmed ? <span className="text-green-600">완료</span> : <span className="text-yellow-600">미확인</span>}</p></div>
            {position.status === 'closed' && (
              <>
                <div><p className="text-gray-500">종료자</p><p className="font-medium">{position.closed_by?.full_name || '-'}</p></div>
                <div><p className="text-gray-500">종료 일시</p><p className="font-medium">{formatDate(position.closed_at)}</p></div>
              </>
            )}
          </div>

          <button onClick={toggleAuditLogs} className="mt-4 pt-4 border-t w-full flex items-center justify-center gap-1 text-sm text-gray-500 hover:text-gray-700">
            <span>{showAuditLogs ? '수정 이력 접기' : '수정 이력 보기'}</span>
            <svg className={`w-4 h-4 transition-transform ${showAuditLogs ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

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
                        <span className="font-medium">{formatFieldName(log.field_name)}</span>{': '}
                        <span className="text-red-500 line-through">{log.old_value ?? '-'}</span>{' → '}
                        <span className="text-green-600">{log.new_value ?? '-'}</span>
                      </p>
                    ) : log.changes ? (
                      <div className="space-y-1">
                        {Object.entries(log.changes).map(([field, vals]) => (
                          <p key={field} className="text-gray-600">
                            <span className="font-medium">{formatFieldName(field)}</span>{': '}
                            <span className="text-red-500 line-through">{vals.old ?? '-'}</span>{' → '}
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

      {/* Modals */}
      <Modal isOpen={showSellModal} onClose={() => setShowSellModal(false)} title="매도 요청">
        <SellRequestForm position={position} onSuccess={() => { setShowSellModal(false); fetchPosition(); }} onCancel={() => setShowSellModal(false)} />
      </Modal>

      <Modal isOpen={showCloseModal} onClose={() => setShowCloseModal(false)} title="포지션 종료">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">포지션 정보를 확인하고 청산 금액을 입력해주세요.</p>
          <div className="border-b pb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">포지션 정보</h4>
            <Input label="종목명" value={closeData.ticker_name} onChange={(e) => setCloseData({ ...closeData, ticker_name: e.target.value })} />
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Input label="평균 매입가" type="number" value={closeData.average_buy_price} onChange={(e) => setCloseData({ ...closeData, average_buy_price: e.target.value })} />
              <Input label="수량" type="number" value={closeData.total_quantity} onChange={(e) => setCloseData({ ...closeData, total_quantity: e.target.value })} />
            </div>
          </div>
          <Input label="청산 금액 (실제 돌아온 금액)" type="number" value={closeData.total_sell_amount} onChange={(e) => setCloseData({ ...closeData, total_sell_amount: e.target.value })} required />
          {closeData.total_sell_amount && closeData.average_buy_price && closeData.total_quantity && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">예상 수익금</span>
                <span className={getProfitLossClass(parseFloat(closeData.total_sell_amount) - (parseFloat(closeData.average_buy_price) * parseFloat(closeData.total_quantity)))}>
                  {formatCurrency(parseFloat(closeData.total_sell_amount) - (parseFloat(closeData.average_buy_price) * parseFloat(closeData.total_quantity)), position.market)}
                </span>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowCloseModal(false)}>취소</Button>
            <Button variant="danger" onClick={handleClose} loading={actionLoading}>종료</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showDiscussionModal} onClose={() => setShowDiscussionModal(false)} title="토론방 열기">
        <div className="space-y-4">
          <Input label="토론 제목" value={discussionTitle} onChange={(e) => setDiscussionTitle(e.target.value)} placeholder="예: 삼성전자 포지션 논의" required />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowDiscussionModal(false)}>취소</Button>
            <Button onClick={handleCreateDiscussion} loading={actionLoading}>토론방 생성</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showAddBuyModal} onClose={() => setShowAddBuyModal(false)} title="추가매수 요청" size="lg">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700"><strong>{position.ticker_name || position.ticker}</strong>에 추가매수 요청을 작성합니다.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="매수가" type="number" step="any" value={addBuyData.buy_price} onChange={(e) => setAddBuyData({ ...addBuyData, buy_price: e.target.value })} required />
            <Input label="수량" type="number" step="any" value={addBuyData.order_quantity} onChange={(e) => setAddBuyData({ ...addBuyData, order_quantity: e.target.value })} required />
          </div>
          <Textarea label="메모 (선택)" rows={2} placeholder="추가매수 사유..." value={addBuyData.memo} onChange={(e) => setAddBuyData({ ...addBuyData, memo: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowAddBuyModal(false)}>취소</Button>
            <Button onClick={handleAddBuyRequest} loading={actionLoading}>추가매수 요청</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
