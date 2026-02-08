import { useCallback, useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

export function StockChart({
  candles,
  loading,
  height = 400,
  hasMore = false,
  onLoadMore = null,
  loadingMore = false,
}) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candlestickSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const isLoadingMoreRef = useRef(false);
  const lastCandlesLengthRef = useRef(0);

  const handleVisibleRangeChange = useCallback(
    (newVisibleRange) => {
      if (!onLoadMore || !hasMore || isLoadingMoreRef.current || loadingMore) return;
      if (!candles || candles.length === 0) return;

      const visibleFrom = typeof newVisibleRange?.from === 'number' ? newVisibleRange.from : null;
      if (!visibleFrom) return;

      const oldestDataTime = candles[0]?.time;
      const newestDataTime = candles[candles.length - 1]?.time;
      if (!oldestDataTime || !newestDataTime) return;

      const dataRange = newestDataTime - oldestDataTime;
      const bufferThreshold = Math.max(dataRange * 0.1, 86400 * 5);

      if (visibleFrom <= oldestDataTime + bufferThreshold) {
        isLoadingMoreRef.current = true;
        onLoadMore(oldestDataTime);
      }
    },
    [candles, hasMore, onLoadMore, loadingMore]
  );

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      autoSize: true,
      height,
      layout: {
        background: { color: '#ffffff' },
        textColor: '#333',
      },
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#e0e0e0',
        rightOffset: 0,
        barSpacing: 8,
      },
      rightPriceScale: {
        borderColor: '#e0e0e0',
      },
      leftPriceScale: {
        visible: false,
      },
      crosshair: {
        mode: 1,
      },
      watermark: {
        visible: false,
      },
      attributionLogo: false,
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#ef5350',
      downColor: '#26a69a',
      borderVisible: false,
      wickUpColor: '#ef5350',
      wickDownColor: '#26a69a',
    });

    candlestickSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.1,
        bottom: 0.3,
      },
    });

    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0.02,
      },
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;
    volumeSeriesRef.current = volumeSeries;

    chart.timeScale().subscribeVisibleTimeRangeChange(handleVisibleRangeChange);

    return () => {
      chart.timeScale().unsubscribeVisibleTimeRangeChange(handleVisibleRangeChange);
      chart.remove();
      chartRef.current = null;
      candlestickSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [height, handleVisibleRangeChange]);

  useEffect(() => {
    if (!candlestickSeriesRef.current || !volumeSeriesRef.current) return;
    if (!candles || candles.length === 0) return;

    const candlestickData = candles.map((candle) => ({
      time: candle.time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));

    const volumeData = candles.map((candle) => ({
      time: candle.time,
      value: candle.volume,
      color: candle.close >= candle.open ? '#ef535080' : '#26a69a80',
    }));

    try {
      candlestickSeriesRef.current.setData(candlestickData);
      volumeSeriesRef.current.setData(volumeData);

      const isInitialLoad = lastCandlesLengthRef.current === 0;
      if (isInitialLoad && chartRef.current) {
        // Fill the plotting area with current data range without extra leading offset.
        chartRef.current.timeScale().fitContent();
      }

      lastCandlesLengthRef.current = candles.length;
      isLoadingMoreRef.current = false;
    } catch (err) {
      console.error('Chart update failed:', err);
      isLoadingMoreRef.current = false;
    }
  }, [candles]);

  useEffect(() => {
    if (loading) {
      lastCandlesLengthRef.current = 0;
    }
  }, [loading]);

  return (
    <div className="relative">
      <style>{`
        .tv-lightweight-charts a[href*="tradingview"],
        .tv-lightweight-charts a[target="_blank"],
        [class*="tv-lightweight-charts"] a,
        div[style*="position: absolute"] > a[href*="tradingview"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
        /* Hide left price scale cell */
        .stock-chart-container table tr td:first-child {
          width: 0 !important;
          min-width: 0 !important;
          padding: 0 !important;
        }
      `}</style>

      <div
        ref={chartContainerRef}
        className="stock-chart-container"
        style={{ height: `${height}px`, width: '100%' }}
      />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
          <div className="flex items-center gap-2 text-gray-500">
            <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>로딩 중...</span>
          </div>
        </div>
      )}

      {loadingMore && !loading && (
        <div className="absolute left-2 top-2 flex items-center gap-2 rounded-lg border border-gray-200 bg-white/90 px-3 py-1.5 shadow-sm dark:border-gray-700 dark:bg-gray-800/90">
          <svg className="h-4 w-4 animate-spin text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-xs text-gray-600 dark:text-gray-400">과거 데이터 로딩...</span>
        </div>
      )}

      {!loading && (!candles || candles.length === 0) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
          <p className="text-gray-500">종목을 검색하세요</p>
        </div>
      )}
    </div>
  );
}
