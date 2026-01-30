import { useState } from 'react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { requestService } from '../../services/requestService';

const MARKETS = [
  { value: 'KOSPI', label: '코스피' },
  { value: 'KOSDAQ', label: '코스닥' },
  { value: 'NASDAQ', label: '나스닥' },
  { value: 'NYSE', label: '뉴욕증권거래소' },
  { value: 'CRYPTO', label: '크립토' },
];

export function BuyRequestForm({ onSuccess, onCancel }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    target_ticker: '',
    ticker_name: '',
    target_market: 'KOSPI',
    order_type: 'amount', // 'amount' 또는 'quantity'
    order_amount: '',     // 매수 금액
    order_quantity: '',   // 매수 수량
    buy_price: '',        // 매수 희망가 (비어있으면 시장가)
    take_profit_targets: [{ price: '', ratio: '1' }],
    stop_loss_targets: [{ price: '', ratio: '1' }],
    memo: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = {
        target_ticker: formData.target_ticker,
        ticker_name: formData.ticker_name || null,
        target_market: formData.target_market,
        order_type: formData.order_type,
        order_amount: formData.order_type === 'amount' && formData.order_amount
          ? parseFloat(formData.order_amount)
          : null,
        order_quantity: formData.order_type === 'quantity' && formData.order_quantity
          ? parseFloat(formData.order_quantity)
          : null,
        buy_price: formData.buy_price ? parseFloat(formData.buy_price) : null,
        take_profit_targets: formData.take_profit_targets
          .filter(t => t.price)
          .map(t => ({ price: parseFloat(t.price), ratio: parseFloat(t.ratio) })),
        stop_loss_targets: formData.stop_loss_targets
          .filter(t => t.price)
          .map(t => ({ price: parseFloat(t.price), ratio: parseFloat(t.ratio) })),
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
    newTargets[index][field] = value;
    setFormData({ ...formData, take_profit_targets: newTargets });
  };

  const updateStopLoss = (index, field, value) => {
    const newTargets = [...formData.stop_loss_targets];
    newTargets[index][field] = value;
    setFormData({ ...formData, stop_loss_targets: newTargets });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 시장 선택 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">시장</label>
        <div className="flex flex-wrap gap-2">
          {MARKETS.map((market) => (
            <button
              key={market.value}
              type="button"
              onClick={() => setFormData({ ...formData, target_market: market.value })}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                formData.target_market === market.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {market.label}
            </button>
          ))}
        </div>
      </div>

      {/* 종목 정보 */}
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="종목 코드"
          placeholder={formData.target_market === 'CRYPTO' ? 'BTC' : '005930'}
          value={formData.target_ticker}
          onChange={(e) => setFormData({ ...formData, target_ticker: e.target.value })}
          required
        />
        <Input
          label="종목명 (선택)"
          placeholder={formData.target_market === 'CRYPTO' ? '비트코인' : '삼성전자'}
          value={formData.ticker_name}
          onChange={(e) => setFormData({ ...formData, ticker_name: e.target.value })}
        />
      </div>

      {/* 매수 방법 선택 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">매수 방법</label>
        <div className="flex gap-4">
          <label className="flex items-center">
            <input
              type="radio"
              name="order_type"
              value="amount"
              checked={formData.order_type === 'amount'}
              onChange={(e) => setFormData({ ...formData, order_type: e.target.value })}
              className="mr-2"
            />
            금액으로
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="order_type"
              value="quantity"
              checked={formData.order_type === 'quantity'}
              onChange={(e) => setFormData({ ...formData, order_type: e.target.value })}
              className="mr-2"
            />
            수량으로
          </label>
        </div>
      </div>

      {/* 금액 또는 수량 입력 */}
      <div className="grid grid-cols-2 gap-4">
        {formData.order_type === 'amount' ? (
          <Input
            label="매수 금액"
            type="number"
            placeholder="1000000"
            value={formData.order_amount}
            onChange={(e) => setFormData({ ...formData, order_amount: e.target.value })}
            required
          />
        ) : (
          <Input
            label="매수 수량"
            type="number"
            step="any"
            placeholder={formData.target_market === 'CRYPTO' ? '0.5' : '10'}
            value={formData.order_quantity}
            onChange={(e) => setFormData({ ...formData, order_quantity: e.target.value })}
            required
          />
        )}
        <Input
          label="매수 희망가 (비우면 시장가)"
          type="number"
          step="any"
          placeholder="시장가"
          value={formData.buy_price}
          onChange={(e) => setFormData({ ...formData, buy_price: e.target.value })}
        />
      </div>

      {/* 익절가 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">익절가</label>
        {formData.take_profit_targets.map((target, index) => (
          <div key={index} className="flex gap-2 mb-2">
            <Input
              placeholder="가격"
              type="number"
              step="any"
              value={target.price}
              onChange={(e) => updateTakeProfit(index, 'price', e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder="비중"
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={target.ratio}
              onChange={(e) => updateTakeProfit(index, 'ratio', e.target.value)}
              className="w-24"
            />
            {index > 0 && (
              <button
                type="button"
                onClick={() => {
                  const newTargets = formData.take_profit_targets.filter((_, i) => i !== index);
                  setFormData({ ...formData, take_profit_targets: newTargets });
                }}
                className="text-red-500 hover:text-red-700 px-2"
              >
                X
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setFormData({ ...formData, take_profit_targets: [...formData.take_profit_targets, { price: '', ratio: '' }] })}
          className="text-sm text-primary-600 hover:text-primary-700"
        >
          + 분할 익절 추가
        </button>
      </div>

      {/* 손절가 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">손절가</label>
        {formData.stop_loss_targets.map((target, index) => (
          <div key={index} className="flex gap-2 mb-2">
            <Input
              placeholder="가격"
              type="number"
              step="any"
              value={target.price}
              onChange={(e) => updateStopLoss(index, 'price', e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder="비중"
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={target.ratio}
              onChange={(e) => updateStopLoss(index, 'ratio', e.target.value)}
              className="w-24"
            />
          </div>
        ))}
      </div>

      {/* 메모 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">메모 (선택)</label>
        <textarea
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          rows={2}
          placeholder="매수 이유, 차트 분석 등..."
          value={formData.memo}
          onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
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
