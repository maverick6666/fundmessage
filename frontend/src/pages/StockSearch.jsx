import { useState, useCallback, useEffect } from 'react';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { StockChart } from '../components/charts/StockChart';
import { BuyRequestForm } from '../components/forms/BuyRequestForm';
import { priceService } from '../services/priceService';

const MARKETS = [
  { value: 'KOSPI', label: '코스피' },
  { value: 'KOSDAQ', label: '코스닥' },
  { value: 'NASDAQ', label: '나스닥' },
  { value: 'NYSE', label: 'NYSE' },
  { value: 'CRYPTO', label: '크립토' },
];

const TIMEFRAMES = [
  { value: '1d', label: '일봉' },
  { value: '1w', label: '주봉' },
  { value: '1M', label: '월봉' },
];

export default function StockSearch() {
  const [market, setMarket] = useState('KOSPI');
  const [ticker, setTicker] = useState('');
  const [timeframe, setTimeframe] = useState('1d');

  const [stockInfo, setStockInfo] = useState(null);
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [showBuyForm, setShowBuyForm] = useState(false);

  // 종목 검색
  const handleSearch = useCallback(async () => {
    if (!ticker.trim()) {
      setError('종목코드를 입력하세요');
      return;
    }

    setLoading(true);
    setError(null);
    setStockInfo(null);
    setCandles([]);

    try {
      // 캔들 데이터 조회 (종목 정보 포함)
      const result = await priceService.getCandles(ticker.trim(), market, timeframe, 200);

      console.log('API Response:', result);

      if (result.success && result.data) {
        console.log('Candles count:', result.data.candles?.length);
        console.log('First candle:', result.data.candles?.[0]);

        setStockInfo({
          ticker: result.data.ticker,
          name: result.data.name,
          market: result.data.market,
        });
        setCandles(result.data.candles || []);

        // 현재가 조회
        try {
          const quoteResult = await priceService.lookupTicker(ticker.trim(), market);
          if (quoteResult.success && quoteResult.data) {
            setStockInfo(prev => ({
              ...prev,
              price: quoteResult.data.price,
              name: quoteResult.data.name || prev?.name
            }));
          }
        } catch (e) {
          // 현재가 조회 실패해도 차트는 표시
        }
      } else {
        setError(result.message || '종목을 찾을 수 없습니다');
      }
    } catch (err) {
      setError(err.response?.data?.message || '조회 실패');
    } finally {
      setLoading(false);
    }
  }, [ticker, market, timeframe]);

  // 타임프레임 변경 시 다시 조회
  const handleTimeframeChange = useCallback(async (newTimeframe) => {
    setTimeframe(newTimeframe);

    if (stockInfo) {
      setLoading(true);
      try {
        const result = await priceService.getCandles(stockInfo.ticker, market, newTimeframe, 200);
        if (result.success && result.data) {
          setCandles(result.data.candles || []);
        }
      } catch (err) {
        console.error('타임프레임 변경 오류:', err);
      } finally {
        setLoading(false);
      }
    }
  }, [stockInfo, market]);

  // 엔터 키로 검색
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 금액 포맷
  const formatPrice = (price) => {
    if (!price) return '-';
    return price.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
  };

  // 매수 요청 성공 시
  const handleBuySuccess = () => {
    setShowBuyForm(false);
    alert('매수 요청이 생성되었습니다.');
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">종목검색</h1>
        <p className="mt-1 text-sm text-gray-500">차트를 확인하고 매수 요청을 작성하세요</p>
      </div>

      {/* 검색 폼 */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex flex-wrap gap-3 items-end">
          {/* 시장 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">시장</label>
            <select
              value={market}
              onChange={(e) => setMarket(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {MARKETS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* 종목코드 입력 */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">종목코드</label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={market === 'CRYPTO' ? 'BTC' : '005930'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* 검색 버튼 */}
          <Button onClick={handleSearch} loading={loading}>
            검색
          </Button>
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}
      </div>

      {/* 종목 정보 */}
      {stockInfo && (
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {stockInfo.name}
                <span className="ml-2 text-sm font-normal text-gray-500">({stockInfo.ticker})</span>
              </h2>
              {stockInfo.price && (
                <p className="mt-1 text-2xl font-bold text-primary-600">
                  {formatPrice(stockInfo.price)}
                  <span className="text-sm font-normal text-gray-500 ml-1">
                    {market === 'CRYPTO' ? 'USDT' : '원'}
                  </span>
                </p>
              )}
            </div>

            {/* 타임프레임 선택 */}
            <div className="flex gap-2">
              {TIMEFRAMES.map(tf => (
                <button
                  key={tf.value}
                  onClick={() => handleTimeframeChange(tf.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    timeframe === tf.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 차트 */}
      {(stockInfo || loading) && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <StockChart candles={candles} loading={loading} height={450} />
        </div>
      )}

      {/* 매수 요청 버튼 / 폼 */}
      {stockInfo && (
        <div className="bg-white rounded-xl shadow-sm border">
          <button
            onClick={() => setShowBuyForm(!showBuyForm)}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
          >
            <span className="font-medium text-gray-900">
              {showBuyForm ? '매수 요청 접기' : '매수 요청 작성'}
            </span>
            <svg
              className={`w-5 h-5 text-gray-500 transition-transform ${showBuyForm ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showBuyForm && (
            <div className="px-4 pb-4 border-t">
              <div className="pt-4">
                <BuyRequestFormWithPreset
                  ticker={stockInfo.ticker}
                  tickerName={stockInfo.name}
                  market={market}
                  currentPrice={stockInfo.price}
                  onSuccess={handleBuySuccess}
                  onCancel={() => setShowBuyForm(false)}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// 종목 정보가 미리 채워진 매수 요청 폼
function BuyRequestFormWithPreset({ ticker, tickerName, market, currentPrice, onSuccess, onCancel }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    order_quantity: '',
    buy_price: currentPrice ? String(currentPrice) : '',
    take_profit_targets: [{ price: '', quantity: '' }],
    stop_loss_targets: [{ price: '', quantity: '' }],
    memo: '',
  });

  // 익절 타겟 추가
  const addTakeProfitTarget = () => {
    if (formData.take_profit_targets.length < 4) {
      setFormData({
        ...formData,
        take_profit_targets: [...formData.take_profit_targets, { price: '', quantity: '' }]
      });
    }
  };

  // 익절 타겟 삭제
  const removeTakeProfitTarget = (index) => {
    if (formData.take_profit_targets.length > 1) {
      const newTargets = formData.take_profit_targets.filter((_, i) => i !== index);
      setFormData({ ...formData, take_profit_targets: newTargets });
    }
  };

  // 손절 타겟 추가
  const addStopLossTarget = () => {
    if (formData.stop_loss_targets.length < 4) {
      setFormData({
        ...formData,
        stop_loss_targets: [...formData.stop_loss_targets, { price: '', quantity: '' }]
      });
    }
  };

  // 손절 타겟 삭제
  const removeStopLossTarget = (index) => {
    if (formData.stop_loss_targets.length > 1) {
      const newTargets = formData.stop_loss_targets.filter((_, i) => i !== index);
      setFormData({ ...formData, stop_loss_targets: newTargets });
    }
  };

  // 익절 타겟 업데이트
  const updateTakeProfitTarget = (index, field, value) => {
    const newTargets = [...formData.take_profit_targets];
    newTargets[index] = { ...newTargets[index], [field]: value };
    setFormData({ ...formData, take_profit_targets: newTargets });
  };

  // 손절 타겟 업데이트
  const updateStopLossTarget = (index, field, value) => {
    const newTargets = [...formData.stop_loss_targets];
    newTargets[index] = { ...newTargets[index], [field]: value };
    setFormData({ ...formData, stop_loss_targets: newTargets });
  };

  // 거래대금 계산
  const totalAmount = formData.order_quantity && formData.buy_price
    ? parseFloat(formData.order_quantity) * parseFloat(formData.buy_price)
    : null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.order_quantity || !formData.buy_price) {
      alert('수량과 매수가를 입력해주세요.');
      return;
    }

    setLoading(true);

    try {
      const { requestService } = await import('../services/requestService');

      const data = {
        target_ticker: ticker,
        ticker_name: tickerName,
        target_market: market,
        order_type: 'quantity',
        order_quantity: parseFloat(formData.order_quantity),
        buy_price: parseFloat(formData.buy_price),
        take_profit_targets: formData.take_profit_targets
          .filter(t => t.price && t.quantity)
          .map(t => ({ price: parseFloat(t.price), quantity: parseFloat(t.quantity) })),
        stop_loss_targets: formData.stop_loss_targets
          .filter(t => t.price && t.quantity)
          .map(t => ({ price: parseFloat(t.price), quantity: parseFloat(t.quantity) })),
        memo: formData.memo || null,
      };

      if (data.take_profit_targets.length === 0) data.take_profit_targets = null;
      if (data.stop_loss_targets.length === 0) data.stop_loss_targets = null;

      await requestService.createBuyRequest(data);
      onSuccess?.();
    } catch (error) {
      alert(error.response?.data?.detail || '요청 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (num === null || num === undefined) return '-';
    return num.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 종목 정보 표시 */}
      <div className="p-3 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-700">
          <strong>{tickerName}</strong> ({ticker}) - {market}
        </p>
      </div>

      {/* 수량과 매수가 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">매수 수량</label>
          <input
            type="number"
            step="any"
            placeholder={market === 'CRYPTO' ? '0.5' : '10'}
            value={formData.order_quantity}
            onChange={(e) => setFormData({ ...formData, order_quantity: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">매수가</label>
          <input
            type="number"
            step="any"
            placeholder="희망 매수가"
            value={formData.buy_price}
            onChange={(e) => setFormData({ ...formData, buy_price: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            required
          />
        </div>
      </div>

      {/* 거래대금 */}
      {totalAmount !== null && (
        <div className="p-3 bg-gray-50 rounded-lg flex justify-between items-center">
          <span className="text-sm text-gray-600">예상 거래대금</span>
          <span className="text-lg font-bold text-gray-900">{formatNumber(totalAmount)}원</span>
        </div>
      )}

      {/* 분할 익절 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">분할 익절</label>
          {formData.take_profit_targets.length < 4 && (
            <button
              type="button"
              onClick={addTakeProfitTarget}
              className="text-xs text-primary-600 hover:text-primary-700"
            >
              + 익절 추가
            </button>
          )}
        </div>
        <div className="space-y-2">
          {formData.take_profit_targets.map((target, index) => (
            <div key={index} className="flex gap-2 items-center">
              <input
                type="number"
                step="any"
                placeholder="익절가"
                value={target.price}
                onChange={(e) => updateTakeProfitTarget(index, 'price', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              />
              <input
                type="number"
                step="any"
                min="0"
                placeholder="수량"
                value={target.quantity}
                onChange={(e) => updateTakeProfitTarget(index, 'quantity', e.target.value)}
                className="w-24 px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              />
              {formData.take_profit_targets.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTakeProfitTarget(index)}
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

      {/* 분할 손절 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">분할 손절</label>
          {formData.stop_loss_targets.length < 4 && (
            <button
              type="button"
              onClick={addStopLossTarget}
              className="text-xs text-primary-600 hover:text-primary-700"
            >
              + 손절 추가
            </button>
          )}
        </div>
        <div className="space-y-2">
          {formData.stop_loss_targets.map((target, index) => (
            <div key={index} className="flex gap-2 items-center">
              <input
                type="number"
                step="any"
                placeholder="손절가"
                value={target.price}
                onChange={(e) => updateStopLossTarget(index, 'price', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              />
              <input
                type="number"
                step="any"
                min="0"
                placeholder="수량"
                value={target.quantity}
                onChange={(e) => updateStopLossTarget(index, 'quantity', e.target.value)}
                className="w-24 px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              />
              {formData.stop_loss_targets.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeStopLossTarget(index)}
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
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
        <textarea
          rows={2}
          placeholder="매수 이유..."
          value={formData.memo}
          onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* 버튼 */}
      <div className="flex justify-end gap-3 pt-2">
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
