import { useState } from 'react';
import { Button } from '../common/Button';
import { Input, Textarea } from '../common/Input';
import { requestService } from '../../services/requestService';

export function SellRequestForm({ position, onSuccess, onCancel }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    sell_quantity: '',
    sell_price: '',
    sell_reason: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = {
        position_id: position.id,
        sell_quantity: parseFloat(formData.sell_quantity),
        sell_price: formData.sell_price ? parseFloat(formData.sell_price) : null,
        sell_reason: formData.sell_reason || null,
      };

      await requestService.createSellRequest(data);
      onSuccess?.();
    } catch (error) {
      alert(error.response?.data?.detail || '요청 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          <strong className="dark:text-gray-200">{position.ticker_name || position.ticker}</strong> ({position.ticker})
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          보유 수량: {position.total_quantity}
        </p>
      </div>

      <Input
        label="매도 수량"
        type="number"
        step="any"
        min="0"
        max={position.total_quantity}
        placeholder={`최대 ${position.total_quantity}`}
        value={formData.sell_quantity}
        onChange={(e) => setFormData({ ...formData, sell_quantity: e.target.value })}
        required
      />

      <Input
        label="매도 가격 (비워두면 시장가)"
        type="number"
        step="any"
        placeholder="시장가"
        value={formData.sell_price}
        onChange={(e) => setFormData({ ...formData, sell_price: e.target.value })}
      />

      <Textarea
        label="매도 사유"
        placeholder="익절가 도달, 손절, 기타 사유..."
        rows={3}
        value={formData.sell_reason}
        onChange={(e) => setFormData({ ...formData, sell_reason: e.target.value })}
      />

      <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
        <Button type="button" variant="secondary" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" variant="danger" loading={loading}>
          매도 요청
        </Button>
      </div>
    </form>
  );
}
