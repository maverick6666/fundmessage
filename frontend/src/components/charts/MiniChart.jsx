import { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

export function MiniChart({ chartData, height = 150 }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!chartContainerRef.current || !chartData?.candles?.length) return;

    // 기존 차트 정리
    if (chartRef.current) {
      chartRef.current.remove();
    }

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: height,
      layout: {
        background: { color: 'transparent' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: '#374151' },
      },
      timeScale: {
        timeVisible: false,
        borderVisible: false,
      },
      rightPriceScale: {
        borderVisible: false,
      },
      crosshair: {
        vertLine: { visible: false },
        horzLine: { visible: false },
      },
      handleScale: false,
      handleScroll: false,
      // TradingView 로고 제거
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
    const resizeObserver = new ResizeObserver(entries => {
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
  }, [chartData, height]);

  if (!chartData?.candles?.length) {
    return (
      <div className="flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg p-4" style={{ height }}>
        <p className="text-sm text-gray-500 dark:text-gray-400">차트 데이터 없음</p>
      </div>
    );
  }

  const fromDate = new Date(chartData.from * 1000).toLocaleDateString('ko-KR');
  const toDate = new Date(chartData.to * 1000).toLocaleDateString('ko-KR');

  // 시작가 대비 종가 변화율 계산
  const firstCandle = chartData.candles[0];
  const lastCandle = chartData.candles[chartData.candles.length - 1];
  const changeRate = ((lastCandle.close - firstCandle.open) / firstCandle.open * 100).toFixed(2);
  const isPositive = changeRate >= 0;

  return (
    <div className="rounded-lg overflow-hidden bg-gray-900">
      {/* TradingView 로고 CSS 숨김 */}
      <style>{`
        .tv-lightweight-charts a[href*="tradingview"],
        .tv-lightweight-charts a[target="_blank"],
        [class*="tv-lightweight-charts"] a {
          display: none !important;
        }
      `}</style>
      {/* 헤더 */}
      <div className="px-3 py-2 bg-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">{chartData.name}</span>
          <span className="text-xs text-gray-400">{chartData.ticker}</span>
        </div>
        <span className={`text-sm font-medium ${isPositive ? 'text-red-400' : 'text-blue-400'}`}>
          {isPositive ? '+' : ''}{changeRate}%
        </span>
      </div>

      {/* 차트 */}
      <div ref={chartContainerRef} style={{ height }} />

      {/* 푸터 */}
      <div className="px-3 py-1.5 bg-gray-800 border-t border-gray-700">
        <p className="text-xs text-gray-400">
          {fromDate} ~ {toDate} ({chartData.candles.length}일)
        </p>
      </div>
    </div>
  );
}
