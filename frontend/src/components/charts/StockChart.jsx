import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart } from 'lightweight-charts';

export function StockChart({
  candles,
  loading,
  height = 400,
  hasMore = false,
  onLoadMore = null,
  loadingMore = false
}) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candlestickSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const isLoadingMoreRef = useRef(false);
  const lastCandlesLengthRef = useRef(0);

  // 과거 데이터 로드 트리거
  const handleVisibleRangeChange = useCallback((newVisibleRange) => {
    if (!onLoadMore || !hasMore || isLoadingMoreRef.current || loadingMore) return;
    if (!candles || candles.length === 0) return;

    // 현재 보이는 범위의 첫번째 시간
    const visibleFrom = newVisibleRange?.from;
    if (!visibleFrom) return;

    // 데이터의 가장 오래된 시간
    const oldestDataTime = candles[0]?.time;
    if (!oldestDataTime) return;

    // 보이는 범위가 데이터 시작점에 가까우면 더 불러오기
    // 차트의 왼쪽 경계가 데이터의 10% 이내에 도달하면 로드
    const dataRange = candles[candles.length - 1].time - oldestDataTime;
    const bufferThreshold = Math.max(dataRange * 0.1, 86400 * 5); // 최소 5일

    if (visibleFrom <= oldestDataTime + bufferThreshold) {
      isLoadingMoreRef.current = true;
      onLoadMore(oldestDataTime);
    }
  }, [candles, hasMore, onLoadMore, loadingMore]);

  // 차트 초기화
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: height,
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
      },
      rightPriceScale: {
        borderColor: '#e0e0e0',
      },
      crosshair: {
        mode: 1,
      },
    });

    // 캔들스틱 시리즈
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#ef5350',      // 한국식: 상승 = 빨강
      downColor: '#26a69a',    // 하락 = 파랑/초록
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

    // 거래량 시리즈
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

    // 리사이즈 핸들러
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    // 보이는 범위 변경 감지 (lazy loading용)
    const unsubscribe = chart.timeScale().subscribeVisibleTimeRangeChange(handleVisibleRangeChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      unsubscribe();
      chart.remove();
    };
  }, [height, handleVisibleRangeChange]);

  // 캔들 데이터 업데이트
  useEffect(() => {
    console.log('StockChart received candles:', candles?.length);

    if (!candlestickSeriesRef.current || !volumeSeriesRef.current) {
      console.log('Chart series not ready');
      return;
    }
    if (!candles || candles.length === 0) {
      console.log('No candles data');
      return;
    }

    console.log('Setting chart data with', candles.length, 'candles');

    const candlestickData = candles.map(candle => ({
      time: candle.time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));

    const volumeData = candles.map(candle => ({
      time: candle.time,
      value: candle.volume,
      color: candle.close >= candle.open ? '#ef535080' : '#26a69a80',
    }));

    try {
      candlestickSeriesRef.current.setData(candlestickData);
      volumeSeriesRef.current.setData(volumeData);

      // 새 데이터를 처음 로드한 경우에만 최신 위치로 스크롤
      // 과거 데이터를 추가로 불러온 경우에는 현재 위치 유지
      const isInitialLoad = lastCandlesLengthRef.current === 0;
      const isNewStock = lastCandlesLengthRef.current > 0 &&
        Math.abs(lastCandlesLengthRef.current - candles.length) < candles.length * 0.5;

      if (isInitialLoad || !isNewStock) {
        if (chartRef.current && lastCandlesLengthRef.current === 0) {
          chartRef.current.timeScale().scrollToPosition(-1, false);
        }
      }

      lastCandlesLengthRef.current = candles.length;
      isLoadingMoreRef.current = false;
    } catch (err) {
      console.error('차트 업데이트 오류:', err);
      isLoadingMoreRef.current = false;
    }
  }, [candles]);

  // 새 종목 검색 시 lastCandlesLength 리셋
  useEffect(() => {
    if (loading) {
      lastCandlesLengthRef.current = 0;
    }
  }, [loading]);

  return (
    <div className="relative">
      <div ref={chartContainerRef} style={{ height: `${height}px` }} />

      {/* 메인 로딩 */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
          <div className="flex items-center gap-2 text-gray-500">
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>로딩 중...</span>
          </div>
        </div>
      )}

      {/* 과거 데이터 로딩 인디케이터 */}
      {loadingMore && !loading && (
        <div className="absolute top-2 left-2 flex items-center gap-2 px-3 py-1.5 bg-white/90 dark:bg-gray-800/90 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <svg className="animate-spin h-4 w-4 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
