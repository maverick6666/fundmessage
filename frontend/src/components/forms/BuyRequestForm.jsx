import { useState, useEffect, useCallback } from 'react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { requestService } from '../../services/requestService';
import { priceService } from '../../services/priceService';

const MARKETS = [
  { value: 'KOSPI', label: '코스피' },
  { value: 'KOSDAQ', label: '코스닥' },
  { value: 'NASDAQ', label: '나스닥' },
  { value: 'NYSE', label: '뉴욕증권거래소' },
  { value: 'CRYPTO', label: '크립토' },
];

export function BuyRequestForm({ onSuccess, onCancel }) {
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [formData, setFormData] = useState({
    target_ticker: '',
    ticker_name: '',
    target_market: 'KOSPI',
    order_quantity: '',
    buy_price: '',
    take_profit_targets: [{ price: '', quantity: '' }],
    stop_loss_targets: [{ price: '', quantity: '' }],
    memo: '',
  });
  const [currentPrice, setCurrentPrice] = useState(null);

  // 거래대금 계산
  const totalAmount = formData.order_quantity && formData.buy_price
    ? parseFloat(formData.order_quantity) * parseFloat(formData.buy_price)
    : null;

  // 매수 수량 변경 시 익절/손절 수량 자동 맞춤
  useEffect(() => {
    if (!formData.order_quantity) return;
    const qty = formData.order_quantity;

    setFormData(prev => ({
      ...prev,
      take_profit_targets: prev.take_profit_targets.map(t =>
        (!t.quantity || t.quantity === prev._prevQty) ? { ...t, quantity: qty } : t
      ),
      stop_loss_targets: prev.stop_loss_targets.map(t =>
        (!t.quantity || t.quantity === prev._prevQty) ? { ...t, quantity: qty } : t
      ),
      _prevQty: qty
    }));
  }, [formData.order_quantity]);

  // 종목 코드 조회 (debounce)
  const lookupTicker = useCallback(async (ticker, market) => {
    if (!ticker || ticker.length < 2) {
      setFormData(prev => ({ ...prev, ticker_name: '' }));
      setCurrentPrice(null);
      return;
    }

    setLookupLoading(true);
    try {
      const result = await priceService.lookupTicker(ticker, market);
      if (result.success && result.data) {
        setFormData(prev => ({
          ...prev,
          ticker_name: result.data.name || ''
        }));
        setCurrentPrice(result.data.price);
      } else {
        setFormData(prev => ({ ...prev, ticker_name: '' }));
        setCurrentPrice(null);
      }
    } catch (error) {
      setFormData(prev => ({ ...prev, ticker_name: '' }));
      setCurrentPrice(null);
    } finally {
      setLookupLoading(false);
    }
  }, []);

  // 종목 코드 변경 시 자동 조회
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.target_ticker) {
        lookupTicker(formData.target_ticker, formData.target_market);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.target_ticker, formData.target_market, lookupTicker]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.target_ticker) {
      alert('종목 코드를 입력해주세요.');
      return;
    }

    if (!formData.order_quantity || !formData.buy_price) {
      alert('수량과 매수가를 입력해주세요.');
      return;
    }

    setLoading(true);

    try {
      const data = {
        target_ticker: formData.target_ticker,
        ticker_name: formData.ticker_name || null,
        target_market: formData.target_market,
        order_type: 'quantity',
        order_quantity: parseFloat(formData.order_quantity),
        buy_price: parseFloat(formData.buy_price),
        take_profit_targets: formData.take_profit_targets
          .filter(t => t.price && !isNaN(parseFloat(t.price)))
          .map(t => ({
            price: parseFloat(t.price),
            quantity: t.quantity ? parseFloat(t.quantity) : parseFloat(formData.order_quantity)
          })),
        stop_loss_targets: formData.stop_loss_targets
          .filter(t => t.price && !isNaN(parseFloat(t.price)))
          .map(t => ({
            price: parseFloat(t.price),
            quantity: t.quantity ? parseFloat(t.quantity) : parseFloat(formData.order_quantity)
          })),
        memo: formData.memo || null,
      };

      if (data.take_profit_targets.length === 0) {
        data.take_profit_targets = null;
      }
      if (data.stop_loss_targets.length === 0) {
        data.stop_loss_targets = null;
      }

      await requestService.createBuyRequest(data);
      onSuccess?.();
    } catch (error) {
      alert(error.response?.data?.detail || '요청 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const updateTakeProfit = (index, field, value) => {
    const newTargets = [...formData.take_profit_targets];
    newTargets[index] = { ...newTargets[index], [field]: value };
    setFormData({ ...formData, take_profit_targets: newTargets });
  };

  const updateStopLoss = (index, field, value) => {
    const newTargets = [...formData.stop_loss_targets];
    newTargets[index] = { ...newTargets[index], [field]: value };
    setFormData({ ...formData, stop_loss_targets: newTargets });
  };

  // 현재가를 매수가에 자동 입력
  const applyCurrentPrice = () => {
    if (currentPrice) {
      setFormData({ ...formData, buy_price: currentPrice.toString() });
    }
  };

  // 금액 포맷팅
  const formatNumber = (num) => {
    if (num === null || num === undefined) return '-';
    return num.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 시장 선택 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">시장</label>
        <div className="flex flex-wrap gap-2">
          {MARKETS.map((market) => (
            <button
              key={market.value}
              type="button"
              onClick={() => setFormData({ ...formData, target_market: market.value, target_ticker: '', ticker_name: '' })}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                formData.target_market === market.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {market.label}
            </button>
          ))}
        </div>
      </div>

      {/* 종목 정보 */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Input
              label="종목 코드"
              placeholder={formData.target_market === 'CRYPTO' ? 'BTC' : '005930'}
              value={formData.target_ticker}
              onChange={(e) => setFormData({ ...formData, target_ticker: e.target.value })}
              required
            />
          </div>
          <div>
            <Input
              label="종목명"
              placeholder={lookupLoading ? '조회중...' : '자동 조회됨'}
              value={formData.ticker_name}
              onChange={(e) => setFormData({ ...formData, ticker_name: e.target.value })}
              disabled={lookupLoading}
            />
          </div>
        </div>

        {/* 현재가 표시 */}
        {currentPrice && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <span className="text-sm text-blue-700 dark:text-blue-300">
              현재가: <strong>{formatNumber(currentPrice)}</strong>원
            </span>
            <button
              type="button"
              onClick={applyCurrentPrice}
              className="text-xs bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-800/40 text-blue-700 dark:text-blue-300 px-2 py-1 rounded"
            >
              매수가에 적용
            </button>
          </div>
        )}
      </div>

      {/* 수량과 매수가 */}
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="매수 수량"
          type="number"
          step="any"
          placeholder={formData.target_market === 'CRYPTO' ? '0.5' : '10'}
          value={formData.order_quantity}
          onChange={(e) => setFormData({ ...formData, order_quantity: e.target.value })}
          required
        />
        <Input
          label="매수가"
          type="number"
          step="any"
          placeholder="희망 매수가"
          value={formData.buy_price}
          onChange={(e) => setFormData({ ...formData, buy_price: e.target.value })}
          required
        />
      </div>

      {/* 거래대금 표시 */}
      {totalAmount !== null && (
        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">예상 거래대금</span>
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {formatNumber(totalAmount)}원
            </span>
          </div>
        </div>
      )}

      {/* 익절가 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">익절 목표</label>
        {formData.take_profit_targets.map((target, index) => (
          <div key={index} className="flex gap-2 mb-2 items-center">
            <Input
              placeholder="목표가"
              type="number"
              step="any"
              value={target.price}
              onChange={(e) => updateTakeProfit(index, 'price', e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder="수량"
              type="number"
              step="any"
              value={target.quantity}
              onChange={(e) => updateTakeProfit(index, 'quantity', e.target.value)}
              className="w-28"
            />
            {formData.take_profit_targets.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  const newTargets = formData.take_profit_targets.filter((_, i) => i !== index);
                  setFormData({ ...formData, take_profit_targets: newTargets });
                }}
                className="text-red-500 hover:text-red-700 px-2 flex-shrink-0"
              >
                X
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setFormData({
            ...formData,
            take_profit_targets: [...formData.take_profit_targets, { price: '', quantity: formData.order_quantity || '' }]
          })}
          className="text-sm text-primary-600 hover:text-primary-700"
        >
          + 익절 추가
        </button>
      </div>

      {/* 손절가 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">손절 목표</label>
        {formData.stop_loss_targets.map((target, index) => (
          <div key={index} className="flex gap-2 mb-2 items-center">
            <Input
              placeholder="손절가"
              type="number"
              step="any"
              value={target.price}
              onChange={(e) => updateStopLoss(index, 'price', e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder="수량"
              type="number"
              step="any"
              value={target.quantity}
              onChange={(e) => updateStopLoss(index, 'quantity', e.target.value)}
              className="w-28"
            />
            {formData.stop_loss_targets.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  const newTargets = formData.stop_loss_targets.filter((_, i) => i !== index);
                  setFormData({ ...formData, stop_loss_targets: newTargets });
                }}
                className="text-red-500 hover:text-red-700 px-2 flex-shrink-0"
              >
                X
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setFormData({
            ...formData,
            stop_loss_targets: [...formData.stop_loss_targets, { price: '', quantity: formData.order_quantity || '' }]
          })}
          className="text-sm text-primary-600 hover:text-primary-700"
        >
          + 손절 추가
        </button>
      </div>

      {/* 메모 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">메모 (선택)</label>
        <textarea
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          rows={2}
          placeholder="매수 이유, 차트 분석 등..."
          value={formData.memo}
          onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
        <Button type="button" variant="secondary" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" loading={loading}>
          매수 요청
        </Button>
      </div>
    </form>
  );
}
