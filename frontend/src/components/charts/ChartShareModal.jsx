import { useState, useEffect, useRef, useCallback } from 'react';
import { createChart } from 'lightweight-charts';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { priceService } from '../../services/priceService';
import { useToast } from '../../context/ToastContext';
import { useTheme } from '../../context/ThemeContext';
import { SEARCH_DEBOUNCE_MS, CHART_CANDLE_LIMIT } from '../../utils/constants';

const RANGE_EPSILON = 0.001;

export function ChartShareModal({ isOpen, onClose, onShare }) {
  const toast = useToast();
  const { isCurrentThemeDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selectedRange, setSelectedRange] = useState({ from: null, to: null });
  const [isSelecting, setIsSelecting] = useState(false);

  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candlestickSeriesRef = useRef(null);
  const isSelectingRef = useRef(false);
  const startTimeRef = useRef(null);

  // StockChart와 동일한 refs (과거 데이터 로딩용)
  const lastCandlesLengthRef = useRef(0);
  const isAdjustingRangeRef = useRef(false);
  const isLoadRequestPendingRef = useRef(false);
  const candlesRef = useRef(candles);
  const hasMoreRef = useRef(hasMore);
  const loadingMoreRef = useRef(loadingMore);
  const selectedStockRef = useRef(selectedStock);

  // Keep refs in sync
  candlesRef.current = candles;
  hasMoreRef.current = hasMore;
  loadingMoreRef.current = loadingMore;
  selectedStockRef.current = selectedStock;

  // 종목 검색 (디바운싱 적용)
  useEffect(() => {
    if (searchQuery.length < 1) {
      setSearchResults([]);
      return;
    }

    const searchStocks = async () => {
      setSearchLoading(true);
      try {
        const result = await priceService.searchStocks(searchQuery, null, 10);
        setSearchResults(result.data?.results || []);
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    };

    const debounce = setTimeout(searchStocks, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  // 과거 데이터 로드 함수
  const loadMoreCandles = useCallback(async (beforeTime, neededBars) => {
    if (!selectedStockRef.current) return;

    setLoadingMore(true);
    try {
      const data = await priceService.getCandles(
        selectedStockRef.current.ticker,
        selectedStockRef.current.market,
        '1d',
        Math.max(neededBars, 50),
        beforeTime
      );

      const newCandles = data.data?.candles || [];
      if (newCandles.length === 0) {
        setHasMore(false);
      } else {
        // 기존 캔들 앞에 새 캔들 추가 (중복 제거)
        setCandles(prev => {
          const existingTimes = new Set(prev.map(c => c.time));
          const uniqueNew = newCandles.filter(c => !existingTimes.has(c.time));
          return [...uniqueNew, ...prev].sort((a, b) => a.time - b.time);
        });
      }
    } catch (error) {
      console.error('Failed to load more candles:', error);
    } finally {
      setLoadingMore(false);
    }
  }, []);

  // 뷰포트에 빈 공간이 있으면 과거 데이터 로드
  const maybeLoadMore = useCallback(() => {
    if (!chartRef.current) return;
    if (!candlesRef.current || candlesRef.current.length === 0) return;
    if (!hasMoreRef.current) return;
    if (loadingMoreRef.current || isLoadRequestPendingRef.current) return;

    const logicalRange = chartRef.current.timeScale().getVisibleLogicalRange();
    if (!logicalRange) return;

    if (logicalRange.from < 0) {
      const oldestDataTime = candlesRef.current[0]?.time;
      if (!oldestDataTime) return;

      const emptyBars = Math.abs(logicalRange.from);
      const neededBars = Math.ceil(emptyBars * 1.2);

      isLoadRequestPendingRef.current = true;
      loadMoreCandles(oldestDataTime, neededBars);
    }
  }, [loadMoreCandles]);

  // 오른쪽 끝 제한
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

  // 종목 선택
  const handleSelectStock = async (stock) => {
    setSelectedStock(stock);
    setSearchResults([]);
    setSearchQuery(stock.name);
    setLoading(true);
    setHasMore(true);
    lastCandlesLengthRef.current = 0;

    try {
      const data = await priceService.getCandles(stock.ticker, stock.market, '1d', CHART_CANDLE_LIMIT);
      setCandles(data.data?.candles || []);
    } catch (error) {
      console.error('Failed to load candles:', error);
    } finally {
      setLoading(false);
    }
  };

  // 차트 생성 (candles 제외 - StockChart 패턴)
  useEffect(() => {
    if (!isOpen || !chartContainerRef.current) return;

    // 기존 차트 정리
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      candlestickSeriesRef.current = null;
    }

    const chartColors = isCurrentThemeDark
      ? {
          background: '#1f2937',
          text: '#d1d5db',
          grid: '#374151',
          border: '#4b5563',
        }
      : {
          background: '#ffffff',
          text: '#333333',
          grid: '#f0f0f0',
          border: '#e0e0e0',
        };

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 300,
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
        fixLeftEdge: false,
        fixRightEdge: true,
        rightBarStaysOnScroll: true,
        lockVisibleTimeRangeOnResize: true,
      },
      rightPriceScale: {
        borderColor: chartColors.border,
      },
      leftPriceScale: {
        visible: false,
      },
      crosshair: {
        mode: 0,
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

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;

    // 과거 데이터 로딩을 위한 구독
    chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleLogicalRangeChange);

    // 범위 선택 핸들러
    chart.subscribeClick((param) => {
      if (param.time) {
        if (!isSelectingRef.current) {
          isSelectingRef.current = true;
          startTimeRef.current = param.time;
          setIsSelecting(true);
          setSelectedRange({ from: param.time, to: null });
        } else {
          isSelectingRef.current = false;
          const endTime = param.time;
          const startTime = startTimeRef.current;
          if (startTime < endTime) {
            setSelectedRange({ from: startTime, to: endTime });
          } else {
            setSelectedRange({ from: endTime, to: startTime });
          }
          startTimeRef.current = null;
          setIsSelecting(false);
        }
      }
    });

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleLogicalRangeChange);
      chart.remove();
      chartRef.current = null;
      candlestickSeriesRef.current = null;
    };
  }, [isOpen, isCurrentThemeDark, handleVisibleLogicalRangeChange]);

  // 데이터 업데이트 (차트 재생성 없이 - StockChart 패턴 완전 적용)
  useEffect(() => {
    if (!chartRef.current || !candlestickSeriesRef.current) return;
    if (!candles || candles.length === 0) return;

    const candlestickData = candles.map(candle => ({
      time: candle.time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
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

  // loadingMore 상태 변경 처리
  const prevLoadingMoreRef = useRef(loadingMore);
  useEffect(() => {
    const wasLoading = prevLoadingMoreRef.current;
    prevLoadingMoreRef.current = loadingMore;

    if (!loadingMore) {
      isLoadRequestPendingRef.current = false;
    }

    // 로딩 완료 후 오른쪽 끝 제한만 적용
    if (wasLoading && !loadingMore) {
      requestAnimationFrame(() => {
        clampRightEdge();
      });
    }
  }, [loadingMore, clampRightEdge]);

  // 선택된 범위 하이라이트
  useEffect(() => {
    if (!chartRef.current || !candlestickSeriesRef.current) return;

    if (selectedRange.from && selectedRange.to) {
      const markers = [
        { time: selectedRange.from, position: 'belowBar', color: '#2196F3', shape: 'arrowUp', text: '시작' },
        { time: selectedRange.to, position: 'belowBar', color: '#2196F3', shape: 'arrowUp', text: '끝' },
      ];
      candlestickSeriesRef.current.setMarkers(markers);
    } else if (selectedRange.from) {
      const markers = [
        { time: selectedRange.from, position: 'belowBar', color: '#2196F3', shape: 'arrowUp', text: '시작' },
      ];
      candlestickSeriesRef.current.setMarkers(markers);
    } else {
      candlestickSeriesRef.current.setMarkers([]);
    }
  }, [selectedRange]);

  // 공유하기
  const handleShare = () => {
    if (!selectedStock || !selectedRange.from || !selectedRange.to) {
      toast.warning('종목과 기간을 선택해주세요.');
      return;
    }

    const selectedCandles = candles.filter(
      c => c.time >= selectedRange.from && c.time <= selectedRange.to
    );

    if (selectedCandles.length === 0) {
      toast.warning('선택된 기간에 데이터가 없습니다.');
      return;
    }

    const chartData = {
      ticker: selectedStock.ticker,
      name: selectedStock.name,
      market: selectedStock.market,
      from: selectedRange.from,
      to: selectedRange.to,
      candles: selectedCandles.map(c => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      })),
    };

    const fromDate = new Date(selectedRange.from * 1000).toLocaleDateString('ko-KR');
    const toDate = new Date(selectedRange.to * 1000).toLocaleDateString('ko-KR');
    const content = `📈 ${selectedStock.name} (${selectedStock.ticker}) 차트 공유\n기간: ${fromDate} ~ ${toDate} (${selectedCandles.length}일)`;

    onShare(content, chartData);
    handleClose();
  };

  const handleClose = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedStock(null);
    setCandles([]);
    setSelectedRange({ from: null, to: null });
    setIsSelecting(false);
    setHasMore(true);
    setLoadingMore(false);
    isSelectingRef.current = false;
    startTimeRef.current = null;
    lastCandlesLengthRef.current = 0;
    isLoadRequestPendingRef.current = false;
    onClose();
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '-';
    return new Date(timestamp * 1000).toLocaleDateString('ko-KR');
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="차트 공유" size="lg">
      <style>{`
        .tv-lightweight-charts a[href*="tradingview"],
        .tv-lightweight-charts a[target="_blank"],
        [class*="tv-lightweight-charts"] a {
          display: none !important;
        }
        .chart-share-container table tr td:first-child {
          width: 0 !important;
          min-width: 0 !important;
          padding: 0 !important;
        }
      `}</style>
      <div className="space-y-4">
        {/* 종목 검색 */}
        <div className="relative">
          <div className="relative">
            <Input
              label="종목 검색"
              placeholder="종목명 또는 코드 입력..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchLoading && (
              <div className="absolute right-3 top-[38px]">
                <svg className="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            )}
          </div>
          {searchResults.length > 0 && !selectedStock && (
            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {searchResults.map((stock) => (
                <button
                  key={`${stock.market}-${stock.ticker}`}
                  onClick={() => handleSelectStock(stock)}
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex justify-between items-center"
                >
                  <span className="font-medium text-gray-900 dark:text-gray-100">{stock.name}</span>
                  <span className="text-sm text-gray-500">{stock.ticker} · {stock.market}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 차트 영역 */}
        <div className="relative border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div ref={chartContainerRef} className="chart-share-container" style={{ height: 300 }} />

          {/* 로딩 오버레이 */}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/75 dark:bg-gray-800/75">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>차트 로딩중...</span>
              </div>
            </div>
          )}

          {/* 과거 데이터 로딩 인디케이터 - StockChart와 동일 */}
          {loadingMore && !loading && (
            <div className="absolute left-2 top-2 flex items-center gap-2 rounded-lg border border-gray-200 bg-white/90 px-3 py-1.5 shadow-sm dark:border-gray-700 dark:bg-gray-800/90">
              <svg className="h-4 w-4 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-xs text-gray-600 dark:text-gray-400">과거 데이터 로딩...</span>
            </div>
          )}

          {/* 빈 상태 오버레이 */}
          {!loading && candles.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-800">
              <p className="text-gray-500 dark:text-gray-400">종목을 검색하세요</p>
            </div>
          )}
        </div>

        {/* 선택 가이드 & 상태 */}
        {candles.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              {isSelecting ? (
                <>📍 <strong>끝점</strong>을 클릭하세요</>
              ) : selectedRange.from && selectedRange.to ? (
                <>✅ 선택 완료: {formatTime(selectedRange.from)} ~ {formatTime(selectedRange.to)}</>
              ) : (
                <>👆 차트에서 <strong>시작점</strong>을 클릭하세요</>
              )}
            </p>
          </div>
        )}

        {/* 선택된 범위 정보 */}
        {selectedRange.from && selectedRange.to && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
              <p className="text-gray-500 dark:text-gray-400">시작일</p>
              <p className="font-medium text-gray-900 dark:text-gray-100">{formatTime(selectedRange.from)}</p>
            </div>
            <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
              <p className="text-gray-500 dark:text-gray-400">종료일</p>
              <p className="font-medium text-gray-900 dark:text-gray-100">{formatTime(selectedRange.to)}</p>
            </div>
          </div>
        )}

        {/* 버튼 */}
        <div className="flex justify-end gap-2 pt-4 border-t dark:border-gray-700">
          {selectedRange.from && (
            <Button
              variant="secondary"
              onClick={() => {
                setSelectedRange({ from: null, to: null });
                setIsSelecting(false);
                isSelectingRef.current = false;
                startTimeRef.current = null;
                if (candlestickSeriesRef.current) {
                  candlestickSeriesRef.current.setMarkers([]);
                }
              }}
            >
              다시 선택
            </Button>
          )}
          <Button variant="secondary" onClick={handleClose}>취소</Button>
          <Button
            onClick={handleShare}
            disabled={!selectedStock || !selectedRange.from || !selectedRange.to}
          >
            공유하기
          </Button>
        </div>
      </div>
    </Modal>
  );
}
