import { useCallback, useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import { useTheme } from '../../context/ThemeContext';

const RANGE_EPSILON = 0.001;

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
  const lastCandlesLengthRef = useRef(0);
  const isAdjustingRangeRef = useRef(false);
  const isLoadRequestPendingRef = useRef(false);

  // Refs for stable callback access (prevents chart recreation)
  const candlesRef = useRef(candles);
  const hasMoreRef = useRef(hasMore);
  const onLoadMoreRef = useRef(onLoadMore);
  const loadingMoreRef = useRef(loadingMore);

  // Keep refs in sync
  candlesRef.current = candles;
  hasMoreRef.current = hasMore;
  onLoadMoreRef.current = onLoadMore;
  loadingMoreRef.current = loadingMore;

  const { isCurrentThemeDark } = useTheme();

  // 뷰포트에 빈 공간이 있으면 (왼쪽에 데이터가 없는 영역이 보이면) 과거 데이터 로드
  // 빈 공간 크기를 계산해서 필요한 만큼 한 번에 요청
  const maybeLoadMore = useCallback(() => {
    if (!chartRef.current) return;
    if (!candlesRef.current || candlesRef.current.length === 0) return;
    if (!hasMoreRef.current || !onLoadMoreRef.current) return;
    if (loadingMoreRef.current || isLoadRequestPendingRef.current) return;

    const logicalRange = chartRef.current.timeScale().getVisibleLogicalRange();
    if (!logicalRange) return;

    // 뷰포트 왼쪽이 데이터 범위를 벗어났으면 (빈 공간이 보이면) 로드
    // logicalRange.from < 0 이면 첫번째 데이터보다 왼쪽이 보이는 것
    if (logicalRange.from < 0) {
      const oldestDataTime = candlesRef.current[0]?.time;
      if (!oldestDataTime) return;

      // 빈 공간 크기 계산 (여유분 20% 추가)
      const emptyBars = Math.abs(logicalRange.from);
      const neededBars = Math.ceil(emptyBars * 1.2);

      isLoadRequestPendingRef.current = true;
      // 필요한 데이터 수량을 함께 전달
      onLoadMoreRef.current(oldestDataTime, neededBars);
    }
  }, []);

  // 오른쪽 끝만 제한 (미래는 데이터가 없으므로), 왼쪽은 자유롭게 스크롤 허용
  const clampRightEdge = useCallback(() => {
    if (!chartRef.current) return;
    if (!candlesRef.current || candlesRef.current.length < 2) return;

    const timeScale = chartRef.current.timeScale();
    const logicalRange = timeScale.getVisibleLogicalRange();
    if (!logicalRange) return;

    const lastIndex = candlesRef.current.length - 1;

    let nextFrom = logicalRange.from;
    let nextTo = logicalRange.to;

    if (!Number.isFinite(nextFrom) || !Number.isFinite(nextTo) || nextTo <= nextFrom) return;

    const visibleSpan = nextTo - nextFrom;
    let shouldClamp = false;

    // 오른쪽 끝만 제한 (미래로 스크롤 방지)
    if (nextTo > lastIndex + RANGE_EPSILON) {
      nextTo = lastIndex;
      nextFrom = nextTo - visibleSpan;
      shouldClamp = true;
    }

    if (!shouldClamp) return;

    isAdjustingRangeRef.current = true;
    timeScale.setVisibleLogicalRange({ from: nextFrom, to: nextTo });

    requestAnimationFrame(() => {
      isAdjustingRangeRef.current = false;
    });
  }, []);

  const handleVisibleLogicalRangeChange = useCallback(() => {
    if (isAdjustingRangeRef.current) return;

    clampRightEdge();
    maybeLoadMore();
  }, [clampRightEdge, maybeLoadMore]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chartColors = isCurrentThemeDark
      ? {
          background: '#1a1a2e',
          text: '#d1d5db',
          grid: '#2d2d44',
          border: '#3d3d5c',
        }
      : {
          background: '#ffffff',
          text: '#333333',
          grid: '#f0f0f0',
          border: '#e0e0e0',
        };

    const chart = createChart(chartContainerRef.current, {
      autoSize: true,
      height,
      layout: {
        background: { color: chartColors.background },
        textColor: chartColors.text,
      },
      grid: {
        vertLines: { color: chartColors.grid },
        horzLines: { color: chartColors.grid },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: chartColors.border,
        rightOffset: 0,
        barSpacing: 8,
        fixLeftEdge: false,  // 왼쪽 스크롤 허용 (과거 데이터 자동 로드)
        fixRightEdge: true,
        rightBarStaysOnScroll: true,
        lockVisibleTimeRangeOnResize: true,
      },
      rightPriceScale: {
        borderColor: chartColors.border,
        autoScale: true,
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
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
      // Y축이 0 아래로 내려가지 않도록 autoscale 조정
      // scaleMargins.bottom=0.3 적용 후에도 스케일이 음수가 되지 않도록
      // minValue를 충분히 높여서 margin 확장 후에도 0 이상 유지
      autoscaleInfoProvider: (original) => {
        const res = original();
        if (res !== null && res.priceRange) {
          const { minValue, maxValue } = res.priceRange;
          const range = maxValue - minValue;
          // scaleMargins: top=0.1, bottom=0.3 → 데이터가 60% 영역 차지
          // bottom 30%가 minValue 아래로 확장됨 (range * 0.3 / 0.6 = range * 0.5)
          const marginExtension = range * 0.5;

          // margin 확장 후에도 0 이상이 되도록 minValue 조정
          if (minValue - marginExtension < 0) {
            // minValue를 marginExtension 이상으로 설정
            res.priceRange.minValue = marginExtension * 1.1; // 약간의 여유
          }
        }
        return res;
      },
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

    chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleLogicalRangeChange);

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleLogicalRangeChange);
      chart.remove();
      chartRef.current = null;
      candlestickSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [height, isCurrentThemeDark, handleVisibleLogicalRangeChange]);

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
      const isInitialLoad = lastCandlesLengthRef.current === 0;
      const prevLength = lastCandlesLengthRef.current;
      const addedCount = candles.length - prevLength;

      if (!isInitialLoad && addedCount > 0 && chartRef.current) {
        // 과거 데이터 로드: 논리적 인덱스 기반으로 뷰 위치 유지
        // 빈 공간은 새 데이터로 채워지고, 뷰포인트는 유지됨
        const timeScale = chartRef.current.timeScale();
        const logicalRange = timeScale.getVisibleLogicalRange();

        candlestickSeriesRef.current.setData(candlestickData);
        volumeSeriesRef.current.setData(volumeData);

        // 새 데이터가 앞에 추가되면 논리적 인덱스가 밀림
        // 동일한 "시각적 위치"를 유지하려면 추가된 개수만큼 오프셋 적용
        if (logicalRange) {
          const newFrom = logicalRange.from + addedCount;
          const newTo = logicalRange.to + addedCount;

          isAdjustingRangeRef.current = true;
          timeScale.setVisibleLogicalRange({ from: newFrom, to: newTo });

          requestAnimationFrame(() => {
            isAdjustingRangeRef.current = false;

            // 빈 공간이 아직 남아있으면 추가 로드
            const updatedRange = timeScale.getVisibleLogicalRange();
            if (updatedRange && updatedRange.from < 0) {
              maybeLoadMore();
            }
          });
        }

        lastCandlesLengthRef.current = candles.length;
      } else {
        candlestickSeriesRef.current.setData(candlestickData);
        volumeSeriesRef.current.setData(volumeData);

        lastCandlesLengthRef.current = candles.length;

        if (isInitialLoad && chartRef.current) {
          chartRef.current.timeScale().fitContent();

          requestAnimationFrame(() => {
            clampRightEdge();
            maybeLoadMore();
          });
        }
      }
    } catch (err) {
      console.error('Chart update failed:', err);
    }
  }, [candles, clampRightEdge, maybeLoadMore]);

  useEffect(() => {
    if (loading) {
      lastCandlesLengthRef.current = 0;
      isLoadRequestPendingRef.current = false;
    }
  }, [loading]);

  const prevLoadingMoreRef = useRef(loadingMore);
  useEffect(() => {
    const wasLoading = prevLoadingMoreRef.current;
    prevLoadingMoreRef.current = loadingMore;

    if (!loadingMore) {
      isLoadRequestPendingRef.current = false;
    }

    // 로딩 완료 후 오른쪽 끝 제한만 적용
    // maybeLoadMore는 사용자 인터랙션에서만 호출 (무한 루프 방지)
    if (wasLoading && !loadingMore) {
      requestAnimationFrame(() => {
        clampRightEdge();
      });
    }
  }, [loadingMore, clampRightEdge]);

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
