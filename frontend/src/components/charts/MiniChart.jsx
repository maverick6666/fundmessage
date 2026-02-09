import { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import { useTheme } from '../../context/ThemeContext';

export function MiniChart({ chartData, height = 150, loading = false }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const { isCurrentThemeDark } = useTheme();

  useEffect(() => {
    if (!chartContainerRef.current || !chartData?.candles?.length) return;

    // 기존 차트 정리
    if (chartRef.current) {
      chartRef.current.remove();
    }

    // 테마에 따른 색상 설정
    const chartColors = isCurrentThemeDark
      ? {
          background: '#1f2937',
          headerBg: '#111827',
          text: '#9ca3af',
          grid: '#374151',
          border: '#4b5563',
        }
      : {
          background: '#ffffff',
          headerBg: '#f9fafb',
          text: '#6b7280',
          grid: '#e5e7eb',
          border: '#d1d5db',
        };

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: height,
      layout: {
        background: { color: chartColors.background },
        textColor: chartColors.text,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: chartColors.grid },
      },
      timeScale: {
        timeVisible: false,
        borderVisible: false,
      },
      rightPriceScale: {
        borderVisible: false,
      },
      leftPriceScale: {
        visible: false,
      },
      crosshair: {
        vertLine: { visible: false },
        horzLine: { visible: false },
      },
      handleScale: false,
      handleScroll: false,
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
      scaleMargins: { top: 0.1, bottom: 0.1 },
    });

    const candlestickData = chartData.candles.map(candle => ({
      time: candle.time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));

    candlestickSeries.setData(candlestickData);
    chart.timeScale().fitContent();

    chartRef.current = chart;

    // 리사이즈 핸들러
    const resizeObserver = new ResizeObserver(() => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    });

    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [chartData, height, isCurrentThemeDark]);

  const fromDate = chartData?.from ? new Date(chartData.from * 1000).toLocaleDateString('ko-KR') : '';
  const toDate = chartData?.to ? new Date(chartData.to * 1000).toLocaleDateString('ko-KR') : '';

  // 시작가 대비 종가 변화율 계산
  const firstCandle = chartData?.candles?.[0];
  const lastCandle = chartData?.candles?.[chartData?.candles?.length - 1];
  const changeRate = firstCandle && lastCandle
    ? ((lastCandle.close - firstCandle.open) / firstCandle.open * 100).toFixed(2)
    : '0.00';
  const isPositive = parseFloat(changeRate) >= 0;

  return (
    <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      {/* TradingView 로고 CSS 숨김 및 왼쪽 가격축 셀 제거 */}
      <style>{`
        .tv-lightweight-charts a[href*="tradingview"],
        .tv-lightweight-charts a[target="_blank"],
        [class*="tv-lightweight-charts"] a {
          display: none !important;
        }
        .mini-chart-container table tr td:first-child {
          width: 0 !important;
          min-width: 0 !important;
          padding: 0 !important;
        }
      `}</style>

      {/* 헤더 */}
      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{chartData?.name || '-'}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{chartData?.ticker || ''}</span>
        </div>
        <span className={`text-sm font-medium ${isPositive ? 'text-red-500 dark:text-red-400' : 'text-blue-500 dark:text-blue-400'}`}>
          {isPositive ? '+' : ''}{changeRate}%
        </span>
      </div>

      {/* 차트 */}
      <div ref={chartContainerRef} className="mini-chart-container" style={{ height }} />

      {/* 푸터 */}
      <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {fromDate && toDate ? `${fromDate} ~ ${toDate} (${chartData?.candles?.length || 0}일)` : '-'}
        </p>
      </div>

      {/* 로딩 오버레이 - StockChart와 동일한 패턴 */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/75 dark:bg-gray-800/75">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-sm">로딩 중...</span>
          </div>
        </div>
      )}

      {/* 데이터 없음 오버레이 */}
      {!loading && !chartData?.candles?.length && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">차트 데이터 없음</p>
        </div>
      )}
    </div>
  );
}
