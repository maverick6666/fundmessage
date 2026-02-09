import { useState, useEffect, useCallback } from 'react';
import { Modal } from '../common/Modal';
import { StockChart } from './StockChart';
import { priceService } from '../../services/priceService';

const TIMEFRAMES = [
  { value: '1d', label: '일봉' },
  { value: '1w', label: '주봉' },
  { value: '1M', label: '월봉' },
];

export function ChartModal({ isOpen, onClose, stock }) {
  const [timeframe, setTimeframe] = useState('1d');
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (isOpen && stock) {
      loadCandles();
    }
  }, [isOpen, stock, timeframe]);

  const loadCandles = async () => {
    if (!stock) return;

    setLoading(true);
    try {
      const result = await priceService.getCandles(stock.ticker, stock.market, timeframe, 100);
      if (result.success && result.data) {
        setCandles(result.data.candles || []);
        setHasMore(result.data.has_more === true);
      }
    } catch (err) {
      console.error('차트 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  // neededBars: 빈 공간을 채우기 위해 필요한 데이터 수 (최대 500)
  const handleLoadMore = useCallback(async (beforeTimestamp, neededBars = 200) => {
    if (!stock || loadingMore || !hasMore) return;

    // API 최대 limit은 500
    const limit = Math.min(Math.max(neededBars, 50), 500);

    setLoadingMore(true);
    try {
      const result = await priceService.getCandles(
        stock.ticker,
        stock.market,
        timeframe,
        limit,
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
  }, [stock, timeframe, loadingMore, hasMore]);

  const handleTimeframeChange = (newTimeframe) => {
    setTimeframe(newTimeframe);
    setHasMore(false);
  };

  if (!stock) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${stock.name} (${stock.ticker})`}
      size="xl"
    >
      <div className="space-y-4">
        {/* 타임프레임 선택 */}
        <div className="flex justify-end gap-2">
          {TIMEFRAMES.map(tf => (
            <button
              key={tf.value}
              onClick={() => handleTimeframeChange(tf.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                timeframe === tf.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {/* 차트 */}
        <div className="rounded-lg overflow-hidden border dark:border-gray-700">
          <StockChart
            candles={candles}
            loading={loading}
            height={400}
            hasMore={hasMore}
            onLoadMore={handleLoadMore}
            loadingMore={loadingMore}
          />
        </div>
      </div>
    </Modal>
  );
}
