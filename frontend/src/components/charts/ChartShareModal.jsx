import { useState, useEffect, useRef, useCallback } from 'react';
import { createChart } from 'lightweight-charts';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { priceService } from '../../services/priceService';

export function ChartShareModal({ isOpen, onClose, onShare }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedStock, setSelectedStock] = useState(null);
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRange, setSelectedRange] = useState({ from: null, to: null });
  const [isSelecting, setIsSelecting] = useState(false);

  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candlestickSeriesRef = useRef(null);

  // 종목 검색 (디바운싱 적용)
  useEffect(() => {
    if (searchQuery.length < 1) {
      setSearchResults([]);
      return;
    }

    const searchStocks = async () => {
      try {
        const result = await priceService.searchStocks(searchQuery, null, 10);
        // API 응답: { success: true, data: [...] }
        setSearchResults(result.data || result || []);
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResults([]);
      }
    };

    const debounce = setTimeout(searchStocks, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  // 종목 선택
  const handleSelectStock = async (stock) => {
    setSelectedStock(stock);
    setSearchResults([]);
    setSearchQuery(stock.name);
    setLoading(true);

    try {
      const data = await priceService.getCandles(stock.ticker, stock.market, '1d', 100);
      setCandles(data.data || []);
    } catch (error) {
      console.error('Failed to load candles:', error);
    } finally {
      setLoading(false);
    }
  };

  // 차트 초기화
  useEffect(() => {
    if (!isOpen || !chartContainerRef.current || candles.length === 0) return;

    // 기존 차트 정리
    if (chartRef.current) {
      chartRef.current.remove();
    }

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 300,
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
      },
      crosshair: {
        mode: 0, // Normal mode for selection
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#ef5350',
      downColor: '#26a69a',
      borderVisible: false,
      wickUpColor: '#ef5350',
      wickDownColor: '#26a69a',
    });

    const candlestickData = candles.map(candle => ({
      time: candle.time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));

    candlestickSeries.setData(candlestickData);
    chart.timeScale().fitContent();

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;

    // 범위 선택 핸들러
    let startTime = null;

    chart.subscribeClick((param) => {
      if (param.time) {
        if (!isSelecting) {
          // 시작점 설정
          setIsSelecting(true);
          startTime = param.time;
          setSelectedRange({ from: param.time, to: null });
        } else {
          // 끝점 설정
          setIsSelecting(false);
          const endTime = param.time;
          // 시간 순서 정렬
          if (startTime < endTime) {
            setSelectedRange({ from: startTime, to: endTime });
          } else {
            setSelectedRange({ from: endTime, to: startTime });
          }
          startTime = null;
        }
      }
    });

    return () => {
      chart.remove();
    };
  }, [isOpen, candles]);

  // 선택된 범위 하이라이트
  useEffect(() => {
    if (!chartRef.current || !candlestickSeriesRef.current) return;

    if (selectedRange.from && selectedRange.to) {
      // 선택된 범위에 마커 추가
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
      alert('종목과 기간을 선택해주세요.');
      return;
    }

    // 선택된 범위의 캔들 데이터 추출
    const selectedCandles = candles.filter(
      c => c.time >= selectedRange.from && c.time <= selectedRange.to
    );

    if (selectedCandles.length === 0) {
      alert('선택된 기간에 데이터가 없습니다.');
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

    // 차트 설명 텍스트 생성
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
    onClose();
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '-';
    return new Date(timestamp * 1000).toLocaleDateString('ko-KR');
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="차트 공유" size="lg">
      <div className="space-y-4">
        {/* 종목 검색 */}
        <div className="relative">
          <Input
            label="종목 검색"
            placeholder="종목명 또는 코드 입력..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchResults.length > 0 && (
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
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          {loading ? (
            <div className="h-[300px] flex items-center justify-center bg-gray-50 dark:bg-gray-800">
              <div className="flex items-center gap-2 text-gray-500">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>차트 로딩중...</span>
              </div>
            </div>
          ) : candles.length > 0 ? (
            <div ref={chartContainerRef} />
          ) : (
            <div className="h-[300px] flex items-center justify-center bg-gray-50 dark:bg-gray-800">
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
