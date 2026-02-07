import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { Input } from '../components/common/Input';
import { StockChart } from '../components/charts/StockChart';
import { ProfitProgressBar, TargetProgressBar } from '../components/common/ProfitProgressBar';
import ReactMarkdown from 'react-markdown';
import { AIDecisionNoteModal } from '../components/ai/AIDecisionNoteModal';
import { aiService } from '../services/aiService';
import { positionService } from '../services/positionService';
import { priceService } from '../services/priceService';
import { discussionService } from '../services/discussionService';
import { decisionNoteService } from '../services/decisionNoteService';
import { tradingPlanService } from '../services/tradingPlanService';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import {
  formatCurrency,
  formatPercent,
  formatDate,
  formatHours,
  formatQuantity,
  formatPriceQuantity,
  calcHoldingHours,
  getStatusBadgeClass,
  getStatusLabel,
  getProfitLossClass
} from '../utils/formatters';

const TIMEFRAMES = [
  { value: '1d', label: '일봉' },
  { value: '1w', label: '주봉' },
  { value: '1M', label: '월봉' },
];

export function PositionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isManagerOrAdmin, isManager, adminMode } = useAuth();
  const toast = useToast();
  const [position, setPosition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [discussions, setDiscussions] = useState([]);
  const [showDiscussionModal, setShowDiscussionModal] = useState(false);
  const [discussionTitle, setDiscussionTitle] = useState('');
  const [closeData, setCloseData] = useState({
    ticker_name: '',
    average_buy_price: '',
    total_quantity: '',
    total_sell_amount: '',
  });
  const [actionLoading, setActionLoading] = useState(false);

  // 차트 상태
  const [timeframe, setTimeframe] = useState('1d');
  const [candles, setCandles] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPrice, setCurrentPrice] = useState(null);

  // 의사결정 노트
  const [decisionNotes, setDecisionNotes] = useState([]);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [expandedNoteId, setExpandedNoteId] = useState(null);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showOperationReportModal, setShowOperationReportModal] = useState(false);
  const [generatedReport, setGeneratedReport] = useState('');
  const [reportGenerating, setReportGenerating] = useState(false);

  // 인라인 편집 상태
  const [editingInfo, setEditingInfo] = useState(false);
  const [infoData, setInfoData] = useState({ average_buy_price: '', total_quantity: '', ticker_name: '' });

  // 계획 항목 편집 상태
  const [editingPlanItem, setEditingPlanItem] = useState(null);
  const [editPlanData, setEditPlanData] = useState({ price: '', quantity: '' });

  // 매매계획 이력 상태
  const [tradingPlans, setTradingPlans] = useState([]);
  const [showPlanHistory, setShowPlanHistory] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [planMemo, setPlanMemo] = useState('');

  // 체결 확인 모달
  const [executeConfirmModal, setExecuteConfirmModal] = useState({
    show: false,
    planType: null,
    index: null,
    item: null,
    confirmMsg: '',
    pnl: null
  });

  useEffect(() => {
    fetchPosition();
    fetchDiscussions();
    fetchDecisionNotes();
    fetchTradingPlans();
  }, [id]);

  // 차트 데이터 로드
  useEffect(() => {
    if (position?.ticker && position?.market) {
      loadChartData();
    }
  }, [position?.ticker, position?.market, timeframe]);

  const loadChartData = async () => {
    if (!position) return;
    setChartLoading(true);
    try {
      const result = await priceService.getCandles(position.ticker, position.market, timeframe, 200);
      if (result.success && result.data) {
        setCandles(result.data.candles || []);
        setHasMore(result.data.has_more === true);
      }

      // 현재가 조회
      try {
        const quoteResult = await priceService.lookupTicker(position.ticker, position.market);
        if (quoteResult.success && quoteResult.data) {
          setCurrentPrice(quoteResult.data.price);
        }
      } catch (e) {
        // 현재가 조회 실패해도 무시
      }
    } catch (err) {
      console.error('차트 로드 실패:', err);
    } finally {
      setChartLoading(false);
    }
  };

  const handleLoadMore = useCallback(async (beforeTimestamp) => {
    if (!position || loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const result = await priceService.getCandles(
        position.ticker,
        position.market,
        timeframe,
        200,
        beforeTimestamp
      );

      if (result.success && result.data && result.data.candles?.length > 0) {
        setCandles(prev => {
          const newCandles = result.data.candles;
          const existingTimes = new Set(prev.map(c => c.time));
          const uniqueNewCandles = newCandles.filter(c => !existingTimes.has(c.time));
          return [...uniqueNewCandles, ...prev];
        });
        setHasMore(result.data.has_more === true);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('과거 데이터 로드 오류:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [position, timeframe, loadingMore, hasMore]);

  const fetchDiscussions = async () => {
    try {
      const data = await discussionService.getPositionDiscussions(id);
      setDiscussions(data || []);
    } catch (error) {
      console.error('Failed to fetch discussions:', error);
    }
  };

  const fetchDecisionNotes = async () => {
    try {
      const data = await decisionNoteService.getNotes(id);
      setDecisionNotes(data.notes || []);
    } catch (error) {
      console.error('Failed to fetch decision notes:', error);
    }
  };

  const fetchTradingPlans = async () => {
    try {
      const data = await tradingPlanService.getPlans(id);
      setTradingPlans(data.plans || []);
    } catch (error) {
      console.error('Failed to fetch trading plans:', error);
    }
  };

  const handleSaveTradingPlan = async () => {
    if (!position) return;
    setSavingPlan(true);
    try {
      const planData = {
        buy_plan: position.buy_plan || [],
        take_profit_targets: position.take_profit_targets || [],
        stop_loss_targets: position.stop_loss_targets || [],
        memo: planMemo || null
      };
      await tradingPlanService.createPlan(id, planData);
      setPlanMemo('');
      fetchTradingPlans();
      toast.success('매매계획이 저장되었습니다.');
    } catch (error) {
      toast.error(error.response?.data?.detail || '저장에 실패했습니다.');
    } finally {
      setSavingPlan(false);
    }
  };

  const handleSubmitTradingPlan = async (planId) => {
    try {
      await tradingPlanService.submitPlan(id, planId);
      fetchTradingPlans();
      toast.success('매매계획이 제출되었습니다.');
    } catch (error) {
      toast.error(error.response?.data?.detail || '제출에 실패했습니다.');
    }
  };

  const handleDeleteTradingPlan = async (planId) => {
    if (!window.confirm('이 계획을 삭제하시겠습니까?')) return;
    try {
      await tradingPlanService.deletePlan(id, planId);
      fetchTradingPlans();
    } catch (error) {
      toast.error(error.response?.data?.detail || '삭제에 실패했습니다.');
    }
  };

  const handleSaveNote = async () => {
    if (!noteTitle.trim() || !noteContent.trim()) {
      toast.warning('제목과 내용을 입력해주세요.');
      return;
    }
    try {
      if (editingNoteId) {
        await decisionNoteService.updateNote(id, editingNoteId, {
          title: noteTitle, content: noteContent
        });
      } else {
        await decisionNoteService.createNote(id, {
          title: noteTitle, content: noteContent
        });
      }
      setShowNoteForm(false);
      setEditingNoteId(null);
      setNoteTitle('');
      setNoteContent('');
      fetchDecisionNotes();
    } catch (error) {
      toast.error(error.response?.data?.detail || '저장에 실패했습니다.');
    }
  };

  const handleEditNote = (note) => {
    setEditingNoteId(note.id);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setShowNoteForm(true);
  };

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm('이 노트를 삭제하시겠습니까?')) return;
    try {
      await decisionNoteService.deleteNote(id, noteId);
      fetchDecisionNotes();
    } catch (error) {
      toast.error(error.response?.data?.detail || '삭제에 실패했습니다.');
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
      toast.warning('토론 제목을 입력해주세요.');
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
      toast.error(error.response?.data?.detail || '토론방 생성에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  // 포지션 정보 저장
  const handleSaveInfo = async () => {
    if (!infoData.average_buy_price || !infoData.total_quantity) {
      toast.warning('평균 매입가와 수량을 입력해주세요.');
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
      toast.error(error.response?.data?.detail || '정보 저장에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  // 체크박스 토글 (팀장만)
  const handleTogglePlan = async (planType, index, completed) => {
    // 완료 체크 시 확인 모달 표시 (실제 포지션에 영향을 주므로)
    if (completed) {
      let item = null;
      let pnl = null;
      let typeLabel = '';

      if (planType === 'buy') {
        item = position.buy_plan?.[index];
        typeLabel = '매수';
      } else if (planType === 'take_profit') {
        item = position.take_profit_targets?.[index];
        typeLabel = '익절';
        if (item?.price && item?.quantity) {
          pnl = (parseFloat(item.price) - parseFloat(position.average_buy_price)) * parseFloat(item.quantity);
        }
      } else if (planType === 'stop_loss') {
        item = position.stop_loss_targets?.[index];
        typeLabel = '손절';
        if (item?.price && item?.quantity) {
          pnl = (parseFloat(item.price) - parseFloat(position.average_buy_price)) * parseFloat(item.quantity);
        }
      }

      if (item?.price && item?.quantity) {
        setExecuteConfirmModal({
          show: true,
          planType,
          index,
          item,
          typeLabel,
          pnl
        });
        return;
      }
    }

    // 완료 해제 시 바로 처리
    await executeTogglePlan(planType, index, completed);
  };

  // 실제 체결 처리
  const executeTogglePlan = async (planType, index, completed) => {
    try {
      const updatedPosition = await positionService.togglePlanItem(id, planType, index, completed);
      setPosition(updatedPosition);
      if (showAuditLogs) fetchAuditLogs();

      // 잔량이 0이 되면 포지션 종료 안내
      if (updatedPosition.total_quantity <= 0) {
        toast.info('모든 수량이 체결되었습니다. 포지션 종료 버튼을 눌러 마무리하세요.');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || '상태 변경에 실패했습니다.');
    }
  };

  // 체결 확인
  const confirmExecute = async () => {
    const { planType, index } = executeConfirmModal;
    setExecuteConfirmModal({ show: false, planType: null, index: null, item: null, typeLabel: '', pnl: null });
    await executeTogglePlan(planType, index, true);
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
      const newIndex = updatedPlans[key].length - 1;
      setEditingPlanItem({ planType, index: newIndex });
      setEditPlanData({ price: '', quantity: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || '추가에 실패했습니다.');
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
      setEditingPlanItem(null);
      if (showAuditLogs) fetchAuditLogs();
    } catch (error) {
      toast.error(error.response?.data?.detail || '삭제에 실패했습니다.');
    }
  };

  // 계획 항목 수정 저장
  const handleSavePlanItem = async () => {
    if (!editingPlanItem) return;

    const { planType, index } = editingPlanItem;

    if (!editPlanData.price || !editPlanData.quantity) {
      toast.warning('가격과 수량을 모두 입력해주세요.');
      return;
    }

    const currentPlans = {
      buy_plan: [...(position.buy_plan || [])],
      take_profit_targets: [...(position.take_profit_targets || [])],
      stop_loss_targets: [...(position.stop_loss_targets || [])]
    };

    const key = planType === 'buy' ? 'buy_plan' : planType === 'take_profit' ? 'take_profit_targets' : 'stop_loss_targets';
    currentPlans[key][index] = {
      ...currentPlans[key][index],
      price: parseFloat(editPlanData.price),
      quantity: parseFloat(editPlanData.quantity)
    };

    try {
      const updatedPosition = await positionService.updatePlans(id, {
        buyPlan: currentPlans.buy_plan,
        takeProfitTargets: currentPlans.take_profit_targets,
        stopLossTargets: currentPlans.stop_loss_targets
      });
      setPosition(updatedPosition);
      setEditingPlanItem(null);
      if (showAuditLogs) fetchAuditLogs();
    } catch (error) {
      toast.error(error.response?.data?.detail || '수정에 실패했습니다.');
    }
  };

  const startEditPlanItem = (planType, index, item) => {
    setEditingPlanItem({ planType, index });
    setEditPlanData({ price: item.price || '', quantity: item.quantity || '' });
  };

  const cancelEditPlanItem = () => {
    setEditingPlanItem(null);
    setEditPlanData({ price: '', quantity: '' });
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

  // 잔량 경고
  const quantityWarning = useMemo(() => {
    if (!position || position.status === 'closed') return null;
    const totalQty = parseFloat(position.total_quantity) || 0;
    const tpQty = (position.take_profit_targets || []).filter(t => !t.completed && t.price && t.quantity).reduce((sum, t) => sum + (parseFloat(t.quantity) || 0), 0);
    const slQty = (position.stop_loss_targets || []).filter(t => !t.completed && t.price && t.quantity).reduce((sum, t) => sum + (parseFloat(t.quantity) || 0), 0);
    const warnings = [];
    if (tpQty > totalQty) warnings.push(`익절 계획 수량(${tpQty})이 보유 수량(${totalQty})보다 많습니다`);
    if (slQty > totalQty) warnings.push(`손절 계획 수량(${slQty})이 보유 수량(${totalQty})보다 많습니다`);
    return warnings.length > 0 ? warnings : null;
  }, [position]);

  const hasUncompletedPlans = useMemo(() => {
    if (!position) return false;
    const uncompletedTp = (position.take_profit_targets || []).filter(t => !t.completed && t.price && t.quantity).length;
    const uncompletedSl = (position.stop_loss_targets || []).filter(t => !t.completed && t.price && t.quantity).length;
    const uncompletedBuy = (position.buy_plan || []).filter(b => !b.completed && b.price && b.quantity).length;
    return uncompletedTp > 0 || uncompletedSl > 0 || uncompletedBuy > 0;
  }, [position]);

  const hasOpenDiscussion = useMemo(() => {
    return discussions.some(d => d.status === 'open');
  }, [discussions]);

  // 수익률 계산 (현재가 기준)
  const profitInfo = useMemo(() => {
    if (!position || position.status === 'closed') return null;
    if (!currentPrice || !position.average_buy_price || !position.total_quantity) return null;

    const buyAmount = position.average_buy_price * position.total_quantity;
    const evalAmount = currentPrice * position.total_quantity;
    const profitLoss = evalAmount - buyAmount;
    const profitRate = buyAmount > 0 ? (profitLoss / buyAmount) * 100 : 0;

    return { evalAmount, profitLoss, profitRate };
  }, [position, currentPrice]);

  const handleClose = async () => {
    if (!closeData.total_sell_amount) {
      toast.warning('청산 금액을 입력해주세요.');
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
      toast.error(error.response?.data?.detail || '포지션 종료에 실패했습니다.');
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

  if (loading) return <div className="text-center py-12 text-gray-500 dark:text-gray-400">로딩중...</div>;
  if (!position) return <div className="text-center py-12 text-gray-500 dark:text-gray-400">포지션을 찾을 수 없습니다</div>;

  const needsConfirmation = position.status === 'open' && !position.is_info_confirmed;

  // 계획 항목 렌더링 헬퍼
  const renderPlanItem = (item, index, planType, colorClass, isClosed) => {
    const isCancelled = isClosed && !item.completed;
    const isEditing = editingPlanItem?.planType === planType && editingPlanItem?.index === index;
    const hasValidValues = item.price && item.quantity;

    if (isEditing && !isClosed) {
      return (
        <div key={index} className={`flex items-center gap-2 text-sm p-2 rounded ${colorClass}`}>
          <input
            type="number"
            step="any"
            placeholder="가격"
            value={editPlanData.price}
            onChange={(e) => setEditPlanData({ ...editPlanData, price: e.target.value })}
            className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded text-sm"
            autoFocus
          />
          <span className="dark:text-gray-400">×</span>
          <input
            type="number"
            step="any"
            placeholder="수량"
            value={editPlanData.quantity}
            onChange={(e) => setEditPlanData({ ...editPlanData, quantity: e.target.value })}
            className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded text-sm"
          />
          <button onClick={handleSavePlanItem} className="p-1 text-green-600 hover:text-green-700" title="저장">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </button>
          <button onClick={cancelEditPlanItem} className="p-1 text-gray-400 hover:text-gray-600" title="취소">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      );
    }

    if (!hasValidValues && !isClosed) {
      return (
        <div key={index} className={`flex items-center justify-between text-sm p-2 rounded ${colorClass}`}>
          <span className="text-gray-400 dark:text-gray-500 italic cursor-pointer hover:text-gray-600 dark:hover:text-gray-300" onClick={() => startEditPlanItem(planType, index, item)}>
            클릭하여 가격/수량 입력
          </span>
          <button onClick={() => handleRemovePlanItem(planType, index)} className="p-1 text-gray-400 hover:text-red-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      );
    }

    return (
      <div key={index} className={`flex items-center justify-between text-sm p-2 rounded ${item.completed ? 'bg-gray-100 dark:bg-gray-700' : isCancelled ? 'bg-gray-50 dark:bg-gray-800' : colorClass}`}>
        <div className="flex items-center gap-2 flex-1">
          {isManager() && !isClosed && hasValidValues && (
            <input
              type="checkbox"
              checked={item.completed}
              onChange={(e) => handleTogglePlan(planType, index, e.target.checked)}
              className="w-4 h-4 text-primary-600 rounded"
            />
          )}
          <span
            className={`${item.completed ? 'text-gray-500 dark:text-gray-400 line-through' : isCancelled ? 'text-gray-400 dark:text-gray-500 line-through' : 'dark:text-gray-200'} ${!isClosed ? 'cursor-pointer hover:underline' : ''}`}
            onClick={() => !isClosed && startEditPlanItem(planType, index, item)}
          >
            {formatPriceQuantity(item.price, item.quantity, position.market)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded ${
            item.completed ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
            isCancelled ? 'bg-gray-200 text-gray-500 dark:bg-gray-600 dark:text-gray-400' :
            'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
          }`}>
            {item.completed ? '완료' : isCancelled ? '취소됨' : '대기'}
          </span>
          {!isClosed && (
            <button onClick={() => handleRemovePlanItem(planType, index)} className="p-1 text-gray-400 hover:text-red-500">
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
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <svg className="w-5 h-5 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold dark:text-gray-100">{position.ticker_name || position.ticker}</h1>
            <p className="text-gray-500 dark:text-gray-400">{position.ticker} | {position.market}</p>
          </div>
          <span className={`badge ${getStatusBadgeClass(position.status)}`}>{getStatusLabel(position.status)}</span>
          {needsConfirmation && (
            <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400 text-sm bg-yellow-50 dark:bg-yellow-900/20 px-2 py-1 rounded">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              정보 확인 필요
            </span>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          {adminMode && (
            <Button
              variant="secondary"
              className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
              onClick={async () => {
                if (!window.confirm(`포지션 "${position.ticker_name || position.ticker}"을(를) 정말 삭제하시겠습니까?\n\n연관된 모든 요청, 토론, 의사결정 노트가 함께 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.`)) return;
                try {
                  await positionService.deletePosition(id);
                  toast.success('포지션이 삭제되었습니다.');
                  navigate('/positions');
                } catch (error) {
                  toast.error(error.response?.data?.detail || '삭제에 실패했습니다.');
                }
              }}
            >
              삭제
            </Button>
          )}

          {position.status === 'open' && (
            <>
              {isManagerOrAdmin() ? (
                <>
                  <Button variant="secondary" onClick={() => {
                    setDiscussionTitle(`${position.ticker_name || position.ticker} 토론`);
                    setShowDiscussionModal(true);
                  }}>토론방 열기</Button>
                  <Button variant="danger" onClick={() => setShowCloseModal(true)}>포지션 종료</Button>
                </>
              ) : (
                <>
                  {!hasOpenDiscussion && (
                    <Button variant="secondary" onClick={async () => {
                      try {
                        await positionService.requestDiscussion(id);
                        toast.success('토론 요청이 매니저에게 전송되었습니다.');
                      } catch (error) {
                        toast.error(error.response?.data?.detail || '토론 요청에 실패했습니다.');
                      }
                    }}>토론 요청</Button>
                  )}
                  <Button variant="danger" onClick={async () => {
                    if (!window.confirm('포지션 조기종료를 요청하시겠습니까?')) return;
                    try {
                      await positionService.requestEarlyClose(id);
                      toast.success('조기종료 요청이 매니저에게 전송되었습니다.');
                    } catch (error) {
                      toast.error(error.response?.data?.detail || '조기종료 요청에 실패했습니다.');
                    }
                  }}>조기종료 요청</Button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* 포지션 상태 알림 */}
      {position.status_info?.alert && (
        <div className={`border rounded-lg p-4 ${
          position.status_info.alert === 'danger'
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
        }`}>
          <div className="flex items-start gap-3">
            <svg className={`w-5 h-5 mt-0.5 ${
              position.status_info.alert === 'danger'
                ? 'text-red-600 dark:text-red-400'
                : 'text-yellow-600 dark:text-yellow-400'
            }`} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className={`font-medium ${
                position.status_info.alert === 'danger'
                  ? 'text-red-800 dark:text-red-300'
                  : 'text-yellow-800 dark:text-yellow-300'
              }`}>
                {position.status_info.status === 'needs_close' ? '포지션 종료가 필요합니다' : '매매 계획이 필요합니다'}
              </h3>
              <p className={`text-sm mt-1 ${
                position.status_info.alert === 'danger'
                  ? 'text-red-700 dark:text-red-400'
                  : 'text-yellow-700 dark:text-yellow-400'
              }`}>
                {position.status_info.status === 'needs_close'
                  ? '잔여 수량이 0입니다. 포지션 종료 버튼을 눌러 마무리하세요.'
                  : '보유 중인 수량에 대한 익절/손절 계획을 추가하세요.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 잔량 경고 */}
      {quantityWarning && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="font-medium text-yellow-800 dark:text-yellow-300">계획 수량 확인 필요</h3>
              {quantityWarning.map((w, i) => <p key={i} className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">{w}</p>)}
            </div>
          </div>
        </div>
      )}

      {/* 포지션 정보 바 (상단 가로) */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-4">
        {editingInfo ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Input label="종목명" value={infoData.ticker_name} onChange={(e) => setInfoData({ ...infoData, ticker_name: e.target.value })} placeholder="예: 삼성전자" />
              <Input label="평균 매입가" type="number" step="any" value={infoData.average_buy_price} onChange={(e) => setInfoData({ ...infoData, average_buy_price: e.target.value })} required />
              <Input label="수량" type="number" step="any" value={infoData.total_quantity} onChange={(e) => setInfoData({ ...infoData, total_quantity: e.target.value })} required />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">진입 금액</p>
                <p className="text-lg font-semibold dark:text-gray-200">
                  {infoData.average_buy_price && infoData.total_quantity
                    ? formatCurrency(parseFloat(infoData.average_buy_price) * parseFloat(infoData.total_quantity), position.market)
                    : '-'}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditingInfo(false)}>취소</Button>
              <Button size="sm" onClick={handleSaveInfo} loading={actionLoading}>저장</Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-8 flex-wrap">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">평균 매입가</p>
                <p className="text-lg font-semibold dark:text-gray-200">{formatCurrency(position.average_buy_price, position.market)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">보유 수량</p>
                <p className="text-lg font-semibold dark:text-gray-200">{formatQuantity(position.total_quantity)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">진입 금액</p>
                <p className="text-lg font-semibold dark:text-gray-200">{formatCurrency(position.total_buy_amount, position.market)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">보유 기간</p>
                <p className="text-lg font-semibold dark:text-gray-200">{formatHours(position.status === 'open' ? calcHoldingHours(position.opened_at) : position.holding_period_hours)}</p>
              </div>
              {position.status === 'open' && currentPrice && (
                <>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">현재가</p>
                    <p className="text-lg font-semibold dark:text-gray-200">{formatCurrency(currentPrice, position.market)}</p>
                  </div>
                  <div className="min-w-[160px]">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">평가손익</p>
                    <TargetProgressBar
                      currentPrice={currentPrice}
                      averagePrice={position.average_buy_price}
                      takeProfitTargets={position.take_profit_targets}
                      stopLossTargets={position.stop_loss_targets}
                      market={position.market}
                      size="md"
                    />
                    {/* 타겟이 없으면 단순 프로그레스바 표시 */}
                    {!(position.take_profit_targets?.some(t => t.price && !t.completed) || position.stop_loss_targets?.some(t => t.price && !t.completed)) && profitInfo && (
                      <ProfitProgressBar value={profitInfo.profitRate / 100} size="lg" />
                    )}
                  </div>
                  {/* 실현손익 (부분 익절/손절 시) */}
                  {position.realized_profit_loss != null && parseFloat(position.realized_profit_loss) !== 0 && (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">실현손익</p>
                      <p className={`text-lg font-bold ${getProfitLossClass(parseFloat(position.realized_profit_loss))}`}>
                        {formatCurrency(position.realized_profit_loss, position.market)}
                      </p>
                    </div>
                  )}
                </>
              )}
              {position.status === 'closed' && (
                <>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">청산 금액</p>
                    <p className="text-lg font-semibold dark:text-gray-200">{formatCurrency(position.total_sell_amount, position.market)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">수익률</p>
                    <ProfitProgressBar value={position.profit_rate} size="lg" />
                  </div>
                </>
              )}
            </div>
            {isManager() && position.status === 'open' && (
              <button onClick={() => setEditingInfo(true)} className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 차트 + 매매계획 (나란히) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* 차트 (3/5) - self-start로 높이 고정 */}
        <div className="lg:col-span-3 lg:self-start bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
            <h3 className="font-semibold dark:text-gray-200">차트</h3>
            <div className="flex gap-2">
              {TIMEFRAMES.map(tf => (
                <button
                  key={tf.value}
                  onClick={() => setTimeframe(tf.value)}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    timeframe === tf.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </div>
          <StockChart
            candles={candles}
            loading={chartLoading}
            height={350}
            hasMore={hasMore}
            onLoadMore={handleLoadMore}
            loadingMore={loadingMore}
          />
        </div>

        {/* 매매 계획 (2/5) */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold dark:text-gray-200">매매 계획</h3>
            {position.status === 'open' && (
              <button
                onClick={() => setShowPlanHistory(!showPlanHistory)}
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                {showPlanHistory ? '이력 숨기기' : `이력 보기 (${tradingPlans.length})`}
              </button>
            )}
          </div>

          <div className="space-y-4">
            {/* 매수 계획 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">매수</p>
                {position.status === 'open' && (
                  <button onClick={() => handleAddPlanItem('buy')} className="text-xs text-primary-600 hover:text-primary-700">+ 추가</button>
                )}
              </div>
              <div className="space-y-1">
                {(position.buy_plan || []).length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">설정 안됨</p>
                ) : (
                  position.buy_plan.map((item, i) => renderPlanItem(item, i, 'buy', 'bg-blue-50 dark:bg-blue-900/20', position.status === 'closed'))
                )}
              </div>
            </div>

            {/* 익절 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">익절가</p>
                {position.status === 'open' && (
                  <button onClick={() => handleAddPlanItem('take_profit')} className="text-xs text-primary-600 hover:text-primary-700">+ 추가</button>
                )}
              </div>
              <div className="space-y-1">
                {(position.take_profit_targets || []).length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">설정 안됨</p>
                ) : (
                  position.take_profit_targets.map((item, i) => renderPlanItem(item, i, 'take_profit', 'bg-red-50 dark:bg-red-900/20', position.status === 'closed'))
                )}
              </div>
            </div>

            {/* 손절 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">손절가</p>
                {position.status === 'open' && (
                  <button onClick={() => handleAddPlanItem('stop_loss')} className="text-xs text-primary-600 hover:text-primary-700">+ 추가</button>
                )}
              </div>
              <div className="space-y-1">
                {(position.stop_loss_targets || []).length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">설정 안됨</p>
                ) : (
                  position.stop_loss_targets.map((item, i) => renderPlanItem(item, i, 'stop_loss', 'bg-blue-50 dark:bg-blue-900/20', position.status === 'closed'))
                )}
              </div>
            </div>

            {/* 계획 저장 */}
            {position.status === 'open' && (
              <div className="pt-4 border-t dark:border-gray-700 space-y-2">
                <input
                  type="text"
                  placeholder="메모 (선택)"
                  value={planMemo}
                  onChange={(e) => setPlanMemo(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <Button
                  size="sm"
                  className="w-full"
                  onClick={handleSaveTradingPlan}
                  loading={savingPlan}
                >
                  현재 계획 저장
                </Button>
              </div>
            )}

            {/* 계획 이력 */}
            {showPlanHistory && tradingPlans.length > 0 && (
              <div className="pt-4 border-t dark:border-gray-700">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">저장된 계획</p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {tradingPlans.map(plan => (
                    <div key={plan.id} className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium dark:text-gray-200">v{plan.version}</span>
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded ${
                            plan.status === 'submitted'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                          }`}>
                            {plan.status === 'submitted' ? '제출됨' : '임시저장'}
                          </span>
                          {plan.status === 'draft' && (
                            <>
                              <button
                                onClick={() => handleSubmitTradingPlan(plan.id)}
                                className="text-primary-600 hover:text-primary-700 dark:text-primary-400"
                                title="제출"
                              >
                                제출
                              </button>
                              <button
                                onClick={() => handleDeleteTradingPlan(plan.id)}
                                className="text-red-500 hover:text-red-600"
                                title="삭제"
                              >
                                삭제
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <p className="text-gray-500 dark:text-gray-400">
                        {plan.user?.full_name} · {formatDate(plan.created_at)}
                      </p>
                      {plan.memo && (
                        <p className="mt-1 text-gray-600 dark:text-gray-300">{plan.memo}</p>
                      )}
                      <div className="mt-1 text-gray-500 dark:text-gray-400">
                        매수 {(plan.buy_plan || []).length}개 · 익절 {(plan.take_profit_targets || []).length}개 · 손절 {(plan.stop_loss_targets || []).length}개
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 토론방 */}
      {discussions.length > 0 && (
        <Card>
          <CardHeader><CardTitle>토론방</CardTitle></CardHeader>
          <div className="space-y-2">
            {discussions.map(discussion => (
              <div key={discussion.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div
                  className="flex-1 cursor-pointer hover:opacity-80"
                  onClick={() => navigate(`/discussions/${discussion.id}`)}
                >
                  <p className="font-medium text-gray-900 dark:text-gray-100">{discussion.title}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{discussion.opened_by?.full_name} · {formatDate(discussion.opened_at)}{discussion.message_count > 0 && ` · 메시지 ${discussion.message_count}개`}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded ${discussion.status === 'open' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300'}`}>
                    {discussion.status === 'open' ? '진행중' : '종료'}
                  </span>
                  {isManager() && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!window.confirm(`토론 "${discussion.title}"을(를) 삭제하시겠습니까?\n\n모든 메시지가 함께 삭제됩니다.`)) return;
                        discussionService.deleteDiscussion(discussion.id)
                          .then(() => fetchDiscussions())
                          .catch((err) => toast.error(err.response?.data?.detail || '삭제에 실패했습니다.'));
                      }}
                      className="p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      title="토론 삭제"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 의사결정 노트 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <CardTitle>의사결정 노트</CardTitle>
            {isManagerOrAdmin() && !showNoteForm && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowAIModal(true)}
                  className="text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 font-medium flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  AI로 작성
                </button>
                {isManager() && (
                  <button
                    onClick={() => { setShowNoteForm(true); setEditingNoteId(null); setNoteTitle(''); setNoteContent(''); }}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    + 문서 추가
                  </button>
                )}
              </div>
            )}
          </div>
        </CardHeader>

        {showNoteForm && (
          <div className="mb-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700/50">
            <input
              type="text"
              placeholder="노트 제목"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <textarea
              placeholder="마크다운으로 작성할 수 있습니다..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <div className="flex justify-end gap-2 mt-3">
              <Button variant="secondary" size="sm" onClick={() => { setShowNoteForm(false); setEditingNoteId(null); }}>취소</Button>
              <Button size="sm" onClick={handleSaveNote}>{editingNoteId ? '수정' : '저장'}</Button>
            </div>
          </div>
        )}

        {decisionNotes.length === 0 && !showNoteForm ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">작성된 의사결정 노트가 없습니다</p>
        ) : (
          <div className="space-y-2">
            {decisionNotes.map(note => (
              <div key={note.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => setExpandedNoteId(expandedNoteId === note.id ? null : note.id)}
                >
                  <div className="flex items-center gap-3">
                    <svg className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform ${expandedNoteId === note.id ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">{note.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{note.author?.full_name} · {formatDate(note.updated_at || note.created_at)}</p>
                    </div>
                  </div>
                  {isManager() && (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => handleEditNote(note)} className="p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded" title="수정">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button onClick={() => handleDeleteNote(note.id)} className="p-1.5 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 rounded" title="삭제">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
                {expandedNoteId === note.id && (
                  <div className="p-4 border-t border-gray-200 dark:border-gray-700 prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{note.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 이력 */}
      <Card>
        <CardHeader><CardTitle>이력</CardTitle></CardHeader>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><p className="text-gray-500 dark:text-gray-400">개설자</p><p className="font-medium dark:text-gray-200">{position.opened_by?.full_name || '-'}</p></div>
          <div><p className="text-gray-500 dark:text-gray-400">개설 일시</p><p className="font-medium dark:text-gray-200">{formatDate(position.opened_at)}</p></div>
          <div><p className="text-gray-500 dark:text-gray-400">정보 확인</p><p className="font-medium">{position.is_info_confirmed ? <span className="text-green-600 dark:text-green-400">완료</span> : <span className="text-yellow-600 dark:text-yellow-400">미확인</span>}</p></div>
          {position.status === 'closed' && (
            <>
              <div><p className="text-gray-500 dark:text-gray-400">종료자</p><p className="font-medium dark:text-gray-200">{position.closed_by?.full_name || '-'}</p></div>
              <div><p className="text-gray-500 dark:text-gray-400">종료 일시</p><p className="font-medium dark:text-gray-200">{formatDate(position.closed_at)}</p></div>
            </>
          )}
        </div>

        <button onClick={toggleAuditLogs} className="mt-4 pt-4 border-t dark:border-gray-700 w-full flex items-center justify-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
          <span>{showAuditLogs ? '수정 이력 접기' : '수정 이력 보기'}</span>
          <svg className={`w-4 h-4 transition-transform ${showAuditLogs ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showAuditLogs && (
          <div className="mt-4 space-y-2">
            {auditLogs.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">수정 이력이 없습니다</p>
            ) : (
              auditLogs.map(log => (
                <div key={log.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-700 dark:text-gray-300">{log.user?.full_name || '알 수 없음'}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{formatDate(log.created_at)}</span>
                  </div>
                  {log.field_name ? (
                    <p className="text-gray-600 dark:text-gray-400">
                      <span className="font-medium">{formatFieldName(log.field_name)}</span>{': '}
                      <span className="text-red-500 dark:text-red-400 line-through">{log.old_value ?? '-'}</span>{' → '}
                      <span className="text-green-600 dark:text-green-400">{log.new_value ?? '-'}</span>
                    </p>
                  ) : log.changes ? (
                    <div className="space-y-1">
                      {Object.entries(log.changes).map(([field, vals]) => (
                        <p key={field} className="text-gray-600 dark:text-gray-400">
                          <span className="font-medium">{formatFieldName(field)}</span>{': '}
                          <span className="text-red-500 dark:text-red-400 line-through">{vals.old ?? '-'}</span>{' → '}
                          <span className="text-green-600 dark:text-green-400">{vals.new ?? '-'}</span>
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-600 dark:text-gray-400">{log.action}</p>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </Card>

      {/* 체결 확인 모달 */}
      <Modal
        isOpen={executeConfirmModal.show}
        onClose={() => setExecuteConfirmModal({ show: false, planType: null, index: null, item: null, typeLabel: '', pnl: null })}
        title={`${executeConfirmModal.typeLabel} 체결 확인`}
      >
        <div className="space-y-4">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">체결 정보</span>
              <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                executeConfirmModal.planType === 'buy'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  : executeConfirmModal.planType === 'take_profit'
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              }`}>
                {executeConfirmModal.typeLabel}
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
              {executeConfirmModal.item && formatPriceQuantity(executeConfirmModal.item.price, executeConfirmModal.item.quantity, position?.market)}
            </div>
            {executeConfirmModal.pnl !== null && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t dark:border-gray-700">
                <span className="text-sm text-gray-500 dark:text-gray-400">예상 실현손익</span>
                <span className={`text-lg font-semibold ${executeConfirmModal.pnl >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                  {formatCurrency(executeConfirmModal.pnl, position?.market)}
                </span>
              </div>
            )}
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <div className="flex gap-2">
              <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="text-sm text-amber-800 dark:text-amber-200">
                {executeConfirmModal.planType === 'buy' ? (
                  <p>이 작업은 <strong>보유 수량</strong>과 <strong>평균단가</strong>에 반영됩니다.</p>
                ) : (
                  <p>이 작업은 <strong>보유 수량에서 차감</strong>되고 <strong>실현손익</strong>에 반영됩니다.</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
            <Button
              variant="secondary"
              onClick={() => setExecuteConfirmModal({ show: false, planType: null, index: null, item: null, typeLabel: '', pnl: null })}
            >
              취소
            </Button>
            <Button
              variant={executeConfirmModal.planType === 'stop_loss' ? 'danger' : 'primary'}
              onClick={confirmExecute}
            >
              체결 확인
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modals */}
      <Modal isOpen={showCloseModal} onClose={() => setShowCloseModal(false)} title="포지션 종료">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">포지션 정보를 확인하고 청산 금액을 입력해주세요.</p>
          <div className="border-b dark:border-gray-700 pb-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">포지션 정보</h4>
            <Input label="종목명" value={closeData.ticker_name} onChange={(e) => setCloseData({ ...closeData, ticker_name: e.target.value })} />
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Input label="평균 매입가" type="number" value={closeData.average_buy_price} onChange={(e) => setCloseData({ ...closeData, average_buy_price: e.target.value })} />
              <Input label="수량" type="number" value={closeData.total_quantity} onChange={(e) => setCloseData({ ...closeData, total_quantity: e.target.value })} />
            </div>
          </div>
          <Input label="청산 금액 (실제 돌아온 금액)" type="number" value={closeData.total_sell_amount} onChange={(e) => setCloseData({ ...closeData, total_sell_amount: e.target.value })} required />
          {closeData.total_sell_amount && closeData.average_buy_price && closeData.total_quantity && (
            <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">예상 수익금</span>
                <span className={getProfitLossClass(parseFloat(closeData.total_sell_amount) - (parseFloat(closeData.average_buy_price) * parseFloat(closeData.total_quantity)))}>
                  {formatCurrency(parseFloat(closeData.total_sell_amount) - (parseFloat(closeData.average_buy_price) * parseFloat(closeData.total_quantity)), position.market)}
                </span>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
            <Button variant="secondary" onClick={() => setShowCloseModal(false)}>취소</Button>
            <Button variant="danger" onClick={handleClose} loading={actionLoading}>종료</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showDiscussionModal} onClose={() => setShowDiscussionModal(false)} title="토론방 열기">
        <div className="space-y-4">
          <Input label="토론 제목" value={discussionTitle} onChange={(e) => setDiscussionTitle(e.target.value)} placeholder="예: 삼성전자 포지션 논의" required />
          <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
            <Button variant="secondary" onClick={() => setShowDiscussionModal(false)}>취소</Button>
            <Button onClick={handleCreateDiscussion} loading={actionLoading}>토론방 생성</Button>
          </div>
        </div>
      </Modal>

      <AIDecisionNoteModal
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
        sessions={discussions}
        positionId={parseInt(id)}
        onGenerated={(content, title) => {
          setNoteTitle(title || 'AI 의사결정서');
          setNoteContent(content);
          setShowNoteForm(true);
          setEditingNoteId(null);
        }}
      />

      {/* AI 운용보고서 모달 */}
      <Modal
        isOpen={showOperationReportModal}
        onClose={() => {
          setShowOperationReportModal(false);
          setGeneratedReport('');
        }}
        title="AI 운용보고서"
        size="lg"
      >
        <div className="space-y-4">
          {!generatedReport ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <svg className="w-8 h-8 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                AI 운용보고서 생성
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm">
                이 포지션의 모든 정보(요청, 매매계획, 의사결정서, 토론 등)를<br />
                AI가 분석하여 구조화된 운용보고서를 생성합니다.
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-6">
                * AI는 주어진 데이터만 정리합니다. 정보를 창작하지 않습니다.
              </p>
              <Button
                onClick={async () => {
                  setReportGenerating(true);
                  try {
                    const result = await aiService.generateOperationReport(parseInt(id));
                    if (result.success) {
                      setGeneratedReport(result.data.content);
                    } else {
                      toast.error(result.message || '보고서 생성에 실패했습니다.');
                    }
                  } catch (error) {
                    toast.error(error.response?.data?.detail || '보고서 생성 중 오류가 발생했습니다.');
                  } finally {
                    setReportGenerating(false);
                  }
                }}
                loading={reportGenerating}
                className="!bg-purple-600 hover:!bg-purple-700"
              >
                보고서 생성
              </Button>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4 pb-4 border-b dark:border-gray-700">
                <h3 className="font-medium text-gray-900 dark:text-gray-100">생성된 보고서</h3>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedReport);
                      toast.success('클립보드에 복사되었습니다.');
                    }}
                  >
                    복사
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setNoteTitle('운용보고서');
                      setNoteContent(generatedReport);
                      setShowNoteForm(true);
                      setEditingNoteId(null);
                      setShowOperationReportModal(false);
                      setGeneratedReport('');
                    }}
                  >
                    의사결정 노트로 저장
                  </Button>
                </div>
              </div>
              <div className="max-h-[60vh] overflow-y-auto prose dark:prose-invert prose-sm max-w-none">
                <ReactMarkdown>{generatedReport}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
