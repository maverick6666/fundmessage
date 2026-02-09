import { useState, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { QuickNumberButtons } from '../components/common/NumberInputWithQuickButtons';
import { StockChart } from '../components/charts/StockChart';
import { BuyRequestForm } from '../components/forms/BuyRequestForm';
import { priceService } from '../services/priceService';
import { positionService } from '../services/positionService';

const MARKETS = [
  { value: 'KOSPI', label: '코스피' },
  { value: 'KOSDAQ', label: '코스닥' },
  { value: 'NASDAQ', label: '나스닥' },
  { value: 'NYSE', label: 'NYSE' },
  { value: 'CRYPTO', label: '크립토' },
];

const TIMEFRAMES = [
  { value: '1d', label: '일봉' },
  { value: '1w', label: '주봉' },
  { value: '1M', label: '월봉' },
];

export default function StockSearch() {
  const [market, setMarket] = useState('KOSPI');
  const [searchQuery, setSearchQuery] = useState('');
  const [ticker, setTicker] = useState('');
  const [timeframe, setTimeframe] = useState('1d');

  const [stockInfo, setStockInfo] = useState(null);
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [existingPosition, setExistingPosition] = useState(null);

  // 차트 lazy loading 상태
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [showBuyForm, setShowBuyForm] = useState(false);

  // 검색 자동완성
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef(null);
  const dropdownRef = useRef(null);

  // 검색어 변경 시 자동완성 검색
  useEffect(() => {
    const searchStocks = async () => {
      if (!searchQuery || searchQuery.length < 1) {
        setSearchResults([]);
        setShowDropdown(false);
        return;
      }

      setSearchLoading(true);
      try {
        // 시장 필터: KOSPI/KOSDAQ는 합쳐서, 나머지는 개별
        let marketFilter = null;
        if (market === 'KOSPI' || market === 'KOSDAQ') {
          marketFilter = null; // 둘 다 검색
        } else {
          marketFilter = market;
        }

        const result = await priceService.searchStocks(searchQuery, marketFilter, 15);
        if (result.success) {
          // 시장 필터 적용 (KOSPI/KOSDAQ 중 선택된 것만)
          let filtered = result.data.results;
          if (market === 'KOSPI' || market === 'KOSDAQ') {
            filtered = filtered.filter(s => s.market === 'KOSPI' || s.market === 'KOSDAQ');
          }
          setSearchResults(filtered);
          setShowDropdown(filtered.length > 0);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setSearchLoading(false);
      }
    };

    const debounce = setTimeout(searchStocks, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, market]);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        searchRef.current &&
        !searchRef.current.contains(e.target)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 검색 결과 선택
  const handleSelectStock = (stock) => {
    setTicker(stock.ticker);
    setSearchQuery(stock.name);
    setMarket(stock.market);
    setShowDropdown(false);

    // 선택 후 자동 검색
    handleSearchWithTicker(stock.ticker, stock.market);
  };

  // 종목 검색 (티커 직접 지정)
  const handleSearchWithTicker = useCallback(async (searchTicker, searchMarket) => {
    if (!searchTicker) return;

    setLoading(true);
    setError(null);
    setStockInfo(null);
    setCandles([]);
    setExistingPosition(null);
    setHasMore(false);
    setLoadingMore(false);

    try {
      // 캔들 데이터 조회 (종목 정보 포함) - 200개 요청 (lazy loading으로 더 불러옴)
      const result = await priceService.getCandles(searchTicker, searchMarket, timeframe, 100);

      if (result.success && result.data) {
        setStockInfo({
          ticker: result.data.ticker,
          name: result.data.name,
          market: result.data.market,
        });
        setCandles(result.data.candles || []);
        setHasMore(result.data.has_more === true);

        // 현재가 조회
        try {
          const quoteResult = await priceService.lookupTicker(searchTicker, searchMarket);
          if (quoteResult.success && quoteResult.data) {
            setStockInfo(prev => ({
              ...prev,
              price: quoteResult.data.price,
              name: quoteResult.data.name || prev?.name
            }));
          }
        } catch (e) {
          // 현재가 조회 실패해도 차트는 표시
        }

        // 열린 포지션 확인
        try {
          const positionsResult = await positionService.getPositions({ status: 'open', ticker: searchTicker.toUpperCase() });
          if (positionsResult.positions?.length > 0) {
            setExistingPosition(positionsResult.positions[0]);
          }
        } catch (e) {
          // 포지션 조회 실패해도 무시
        }
      } else {
        setError(result.message || '종목을 찾을 수 없습니다');
      }
    } catch (err) {
      setError(err.response?.data?.message || '조회 실패');
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  // 종목 검색 (입력값으로)
  const handleSearch = useCallback(async () => {
    // 티커가 있으면 티커로 검색
    if (ticker) {
      handleSearchWithTicker(ticker, market);
      return;
    }

    // 검색어가 있으면 검색어로 검색 시도
    if (searchQuery.trim()) {
      // 검색어가 티커 코드 형식인지 확인 (숫자 6자리 또는 알파벳)
      const isTickerFormat = /^[0-9]{6}$/.test(searchQuery) || /^[A-Za-z]+$/.test(searchQuery);

      if (isTickerFormat) {
        setTicker(searchQuery.trim().toUpperCase());
        handleSearchWithTicker(searchQuery.trim().toUpperCase(), market);
      } else {
        setError('검색 결과에서 종목을 선택하세요');
      }
      return;
    }

    setError('종목명 또는 종목코드를 입력하세요');
  }, [ticker, searchQuery, market, handleSearchWithTicker]);

  // 타임프레임 변경 시 다시 조회
  const handleTimeframeChange = useCallback(async (newTimeframe) => {
    setTimeframe(newTimeframe);
    setHasMore(false);
    setLoadingMore(false);

    if (stockInfo) {
      setLoading(true);
      try {
        const result = await priceService.getCandles(stockInfo.ticker, stockInfo.market || market, newTimeframe, 100);
        if (result.success && result.data) {
          setCandles(result.data.candles || []);
          setHasMore(result.data.has_more === true);
        }
      } catch (err) {
        console.error('타임프레임 변경 오류:', err);
      } finally {
        setLoading(false);
      }
    }
  }, [stockInfo, market]);

  // 과거 데이터 추가 로드 (lazy loading)
  // neededBars: 빈 공간을 채우기 위해 필요한 데이터 수 (최대 500)
  const handleLoadMore = useCallback(async (beforeTimestamp, neededBars = 200) => {
    if (!stockInfo || loadingMore || !hasMore) return;

    // API 최대 limit은 500
    const limit = Math.min(Math.max(neededBars, 50), 500);

    setLoadingMore(true);
    try {
      const result = await priceService.getCandles(
        stockInfo.ticker,
        stockInfo.market || market,
        timeframe,
        limit,
        beforeTimestamp
      );

      if (result.success && result.data && result.data.candles?.length > 0) {
        // 기존 캔들 앞에 새로운 과거 데이터 추가
        setCandles(prev => {
          const newCandles = result.data.candles;
          // 중복 제거: 시간을 기준으로 필터링
          const existingTimes = new Set(prev.map(c => c.time));
          const uniqueNewCandles = newCandles.filter(c => !existingTimes.has(c.time));
          return [...uniqueNewCandles, ...prev];
        });
        setHasMore(result.data.has_more === true);
      } else {
        // 더 이상 데이터가 없음
        setHasMore(false);
      }
    } catch (err) {
      console.error('과거 데이터 로드 오류:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [stockInfo, market, timeframe, loadingMore, hasMore]);

  // 엔터 키로 검색
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      setShowDropdown(false);
      handleSearch();
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  // 시장 선택 변경 시 검색어 초기화
  const handleMarketChange = (newMarket) => {
    setMarket(newMarket);
    setSearchQuery('');
    setTicker('');
    setSearchResults([]);
    setShowDropdown(false);
  };

  // 금액 포맷
  const formatPrice = (price) => {
    if (!price) return '-';
    return price.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
  };

  // 매수 요청 성공 시
  const [successMessage, setSuccessMessage] = useState('');

  const handleBuySuccess = () => {
    setShowBuyForm(false);
    setSuccessMessage('매수 요청이 생성되었습니다.');
    // 3초 후 메시지 숨기기
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">종목검색</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">차트를 확인하고 매수 요청을 작성하세요</p>
      </div>

      {/* 검색 폼 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          {/* 시장 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">시장</label>
            <select
              value={market}
              onChange={(e) => handleMarketChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {MARKETS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* 종목명/종목코드 검색 */}
          <div className="flex-1 min-w-[250px] relative" ref={searchRef}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              종목 검색
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setTicker(''); // 직접 입력 시 선택된 티커 초기화
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                placeholder={
                  market === 'CRYPTO'
                    ? '비트코인, BTC 등'
                    : market === 'NASDAQ' || market === 'NYSE'
                    ? 'Apple, AAPL 등'
                    : '삼성전자, 005930 등'
                }
                className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {searchLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <svg className="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              )}
            </div>

            {/* 검색 결과 드롭다운 */}
            {showDropdown && searchResults.length > 0 && (
              <div
                ref={dropdownRef}
                className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-80 overflow-y-auto"
              >
                {searchResults.map((stock, index) => (
                  <button
                    key={`${stock.ticker}-${index}`}
                    type="button"
                    onClick={() => handleSelectStock(stock)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-0 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {stock.name}
                        </span>
                        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                          {stock.ticker}
                        </span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        stock.market === 'KOSPI' || stock.market === 'KOSDAQ'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : stock.market === 'CRYPTO'
                          ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                          : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      }`}>
                        {stock.market}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 검색 버튼 */}
          <Button onClick={handleSearch} loading={loading}>
            검색
          </Button>
        </div>

        {/* 선택된 종목 표시 */}
        {ticker && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">선택된 종목:</span>
            <span className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded text-sm font-medium">
              {ticker}
            </span>
          </div>
        )}

        {error && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {successMessage && (
          <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-sm text-green-600 dark:text-green-400 font-medium">{successMessage}</p>
          </div>
        )}
      </div>

      {/* 종목 정보 */}
      {stockInfo && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {stockInfo.name}
                <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">({stockInfo.ticker})</span>
              </h2>
              {stockInfo.price && (
                <p className="mt-1 text-2xl font-bold text-primary-600 dark:text-primary-400">
                  {formatPrice(stockInfo.price)}
                  <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">
                    {market === 'CRYPTO' ? 'USDT' : (market === 'NASDAQ' || market === 'NYSE') ? 'USD' : '원'}
                  </span>
                </p>
              )}
            </div>

            {/* 타임프레임 선택 */}
            <div className="flex gap-2">
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
          </div>
        </div>
      )}

      {/* 차트 */}
      {(stockInfo || loading) && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
          <StockChart
            candles={candles}
            loading={loading}
            height={450}
            hasMore={hasMore}
            onLoadMore={handleLoadMore}
            loadingMore={loadingMore}
          />
        </div>
      )}

      {/* 매수 요청 버튼 / 폼 */}
      {stockInfo && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700">
          <button
            onClick={() => setShowBuyForm(!showBuyForm)}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {showBuyForm ? '매수 요청 접기' : '매수 요청 작성'}
            </span>
            <svg
              className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${showBuyForm ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showBuyForm && (
            <div className="px-4 pb-4 border-t dark:border-gray-700">
              <div className="pt-4">
                {existingPosition && (
                  <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <div className="flex-1">
                        <h3 className="font-medium text-yellow-800 dark:text-yellow-300">이미 열린 포지션이 있습니다</h3>
                        <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                          {existingPosition.ticker_name || existingPosition.ticker} 포지션이 진행중입니다. 추가매수는 해당 포지션에서 요청해주세요.
                        </p>
                        <Link
                          to={`/positions/${existingPosition.id}`}
                          className="inline-block mt-2 text-sm font-medium text-yellow-800 hover:text-yellow-900 dark:text-yellow-300 dark:hover:text-yellow-200 underline"
                        >
                          열린 포지션으로 이동 →
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
                <BuyRequestFormWithPreset
                  ticker={stockInfo.ticker}
                  tickerName={stockInfo.name}
                  market={market}
                  currentPrice={stockInfo.price}
                  existingPosition={existingPosition}
                  onSuccess={handleBuySuccess}
                  onCancel={() => setShowBuyForm(false)}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// 종목 정보가 미리 채워진 매수 요청 폼
function BuyRequestFormWithPreset({ ticker, tickerName, market, currentPrice, existingPosition, onSuccess, onCancel }) {
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formData, setFormData] = useState({
    buy_orders: [{ price: currentPrice ? String(Math.round(currentPrice * 1000) / 1000) : '', quantity: '' }],
    take_profit_targets: [],  // 초기값 빈 배열 (고급 옵션)
    stop_loss_targets: [],    // 초기값 빈 배열 (고급 옵션)
    memo: '',
  });

  // 매수 추가
  const addBuyOrder = () => {
    if (formData.buy_orders.length < 4) {
      setFormData({
        ...formData,
        buy_orders: [...formData.buy_orders, { price: '', quantity: '' }]
      });
    }
  };

  // 매수 삭제
  const removeBuyOrder = (index) => {
    if (formData.buy_orders.length > 1) {
      const newOrders = formData.buy_orders.filter((_, i) => i !== index);
      setFormData({ ...formData, buy_orders: newOrders });
    }
  };

  // 매수 업데이트
  const updateBuyOrder = (index, field, value) => {
    const newOrders = [...formData.buy_orders];
    newOrders[index] = { ...newOrders[index], [field]: value };
    setFormData({ ...formData, buy_orders: newOrders });
  };

  // 익절 타겟 추가
  const addTakeProfitTarget = () => {
    if (formData.take_profit_targets.length < 4) {
      setFormData({
        ...formData,
        take_profit_targets: [...formData.take_profit_targets, { price: '', quantity: '' }]
      });
    }
  };

  // 익절 타겟 삭제
  const removeTakeProfitTarget = (index) => {
    const newTargets = formData.take_profit_targets.filter((_, i) => i !== index);
    setFormData({ ...formData, take_profit_targets: newTargets });
  };

  // 익절 타겟 업데이트
  const updateTakeProfitTarget = (index, field, value) => {
    const newTargets = [...formData.take_profit_targets];
    newTargets[index] = { ...newTargets[index], [field]: value };
    setFormData({ ...formData, take_profit_targets: newTargets });
  };

  // 손절 타겟 추가
  const addStopLossTarget = () => {
    if (formData.stop_loss_targets.length < 4) {
      setFormData({
        ...formData,
        stop_loss_targets: [...formData.stop_loss_targets, { price: '', quantity: '' }]
      });
    }
  };

  // 손절 타겟 삭제
  const removeStopLossTarget = (index) => {
    const newTargets = formData.stop_loss_targets.filter((_, i) => i !== index);
    setFormData({ ...formData, stop_loss_targets: newTargets });
  };

  // 손절 타겟 업데이트
  const updateStopLossTarget = (index, field, value) => {
    const newTargets = [...formData.stop_loss_targets];
    newTargets[index] = { ...newTargets[index], [field]: value };
    setFormData({ ...formData, stop_loss_targets: newTargets });
  };

  // 유효한 매수 항목들 (가격과 수량이 둘 다 입력된)
  const validBuyOrders = formData.buy_orders.filter(o => o.price && o.quantity);

  // 총 매수 수량
  const totalBuyQuantity = validBuyOrders.reduce((sum, o) => sum + parseFloat(o.quantity || 0), 0);

  // 평균 매수가 (가중평균)
  const avgBuyPrice = totalBuyQuantity > 0
    ? validBuyOrders.reduce((sum, o) => sum + parseFloat(o.price || 0) * parseFloat(o.quantity || 0), 0) / totalBuyQuantity
    : 0;

  // 총 거래대금
  const totalAmount = validBuyOrders.reduce((sum, o) => sum + parseFloat(o.price || 0) * parseFloat(o.quantity || 0), 0);

  // 유효성 검사
  const validateForm = () => {
    const errors = [];
    const MAX_PRICE = 1000000000000; // 1조
    const MAX_QUANTITY = 1000000000; // 10억

    // 매수 검증
    const buyOrders = formData.buy_orders.filter(o => o.price || o.quantity);
    if (buyOrders.length === 0) {
      errors.push('최소 하나의 매수 항목을 입력해주세요.');
    }

    buyOrders.forEach((order, i) => {
      const num = i + 1;
      if (!order.price && order.quantity) {
        errors.push(`매수 ${num}: 매수가를 입력해주세요.`);
      }
      if (order.price && !order.quantity) {
        errors.push(`매수 ${num}: 수량을 입력해주세요.`);
      }
      if (order.price) {
        const price = parseFloat(order.price);
        if (isNaN(price) || price <= 0) {
          errors.push(`매수 ${num}: 매수가가 올바르지 않습니다.`);
        } else if (price > MAX_PRICE) {
          errors.push(`매수 ${num}: 매수가가 너무 큽니다 (최대 ${MAX_PRICE.toLocaleString()}).`);
        }
      }
      if (order.quantity) {
        const qty = parseFloat(order.quantity);
        if (isNaN(qty) || qty <= 0) {
          errors.push(`매수 ${num}: 수량이 올바르지 않습니다.`);
        } else if (qty > MAX_QUANTITY) {
          errors.push(`매수 ${num}: 수량이 너무 큽니다 (최대 ${MAX_QUANTITY.toLocaleString()}).`);
        }
      }
    });

    // 익절 검증
    const takeProfitTargets = formData.take_profit_targets.filter(t => t.price || t.quantity);
    takeProfitTargets.forEach((target, i) => {
      const num = i + 1;
      if (!target.price && target.quantity) {
        errors.push(`익절 ${num}: 익절가를 입력해주세요.`);
      }
      if (target.price && !target.quantity) {
        errors.push(`익절 ${num}: 수량을 입력해주세요.`);
      }
      if (target.price) {
        const price = parseFloat(target.price);
        if (isNaN(price) || price <= 0) {
          errors.push(`익절 ${num}: 익절가가 올바르지 않습니다.`);
        } else if (price > MAX_PRICE) {
          errors.push(`익절 ${num}: 익절가가 너무 큽니다 (최대 ${MAX_PRICE.toLocaleString()}).`);
        } else if (avgBuyPrice > 0 && price <= avgBuyPrice) {
          errors.push(`익절 ${num}: 익절가(${price.toLocaleString()})는 평균 매수가(${avgBuyPrice.toLocaleString()})보다 높아야 합니다.`);
        }
      }
      if (target.quantity) {
        const qty = parseFloat(target.quantity);
        if (isNaN(qty) || qty <= 0) {
          errors.push(`익절 ${num}: 수량이 올바르지 않습니다.`);
        } else if (qty > MAX_QUANTITY) {
          errors.push(`익절 ${num}: 수량이 너무 큽니다 (최대 ${MAX_QUANTITY.toLocaleString()}).`);
        }
      }
    });

    // 손절 검증
    const stopLossTargets = formData.stop_loss_targets.filter(t => t.price || t.quantity);
    stopLossTargets.forEach((target, i) => {
      const num = i + 1;
      if (!target.price && target.quantity) {
        errors.push(`손절 ${num}: 손절가를 입력해주세요.`);
      }
      if (target.price && !target.quantity) {
        errors.push(`손절 ${num}: 수량을 입력해주세요.`);
      }
      if (target.price) {
        const price = parseFloat(target.price);
        if (isNaN(price) || price <= 0) {
          errors.push(`손절 ${num}: 손절가가 올바르지 않습니다.`);
        } else if (price > MAX_PRICE) {
          errors.push(`손절 ${num}: 손절가가 너무 큽니다 (최대 ${MAX_PRICE.toLocaleString()}).`);
        } else if (avgBuyPrice > 0 && price >= avgBuyPrice) {
          errors.push(`손절 ${num}: 손절가(${price.toLocaleString()})는 평균 매수가(${avgBuyPrice.toLocaleString()})보다 낮아야 합니다.`);
        }
      }
      if (target.quantity) {
        const qty = parseFloat(target.quantity);
        if (isNaN(qty) || qty <= 0) {
          errors.push(`손절 ${num}: 수량이 올바르지 않습니다.`);
        } else if (qty > MAX_QUANTITY) {
          errors.push(`손절 ${num}: 수량이 너무 큽니다 (최대 ${MAX_QUANTITY.toLocaleString()}).`);
        }
      }
    });

    // 총 익절/손절 수량이 매수 수량을 초과하는지 확인
    const totalTakeProfitQty = takeProfitTargets
      .filter(t => t.price && t.quantity)
      .reduce((sum, t) => sum + parseFloat(t.quantity || 0), 0);
    const totalStopLossQty = stopLossTargets
      .filter(t => t.price && t.quantity)
      .reduce((sum, t) => sum + parseFloat(t.quantity || 0), 0);

    if (totalBuyQuantity > 0) {
      if (totalTakeProfitQty > totalBuyQuantity) {
        errors.push(`익절 총 수량(${totalTakeProfitQty.toLocaleString()})이 매수 수량(${totalBuyQuantity.toLocaleString()})을 초과합니다.`);
      }
      if (totalStopLossQty > totalBuyQuantity) {
        errors.push(`손절 총 수량(${totalStopLossQty.toLocaleString()})이 매수 수량(${totalBuyQuantity.toLocaleString()})을 초과합니다.`);
      }
    }

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationErrors([]);

    // 이미 열린 포지션이 있는 경우 차단
    if (existingPosition) {
      setValidationErrors([`${ticker}에 이미 열린 포지션이 있습니다. 해당 포지션에서 추가매수를 요청해주세요.`]);
      return;
    }

    // 유효성 검사
    const errors = validateForm();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setLoading(true);

    try {
      const { requestService } = await import('../services/requestService');

      // 유효한 매수 항목들
      const validBuyOrders = formData.buy_orders
        .filter(o => o.price && o.quantity)
        .map(o => ({ price: parseFloat(o.price), quantity: parseFloat(o.quantity) }));

      const data = {
        target_ticker: ticker,
        ticker_name: tickerName,
        target_market: market,
        order_type: 'quantity',
        order_quantity: totalBuyQuantity,
        buy_price: avgBuyPrice,
        buy_orders: validBuyOrders.length > 0 ? validBuyOrders : null,
        take_profit_targets: formData.take_profit_targets
          .filter(t => t.price && t.quantity)
          .map(t => ({ price: parseFloat(t.price), quantity: parseFloat(t.quantity) })),
        stop_loss_targets: formData.stop_loss_targets
          .filter(t => t.price && t.quantity)
          .map(t => ({ price: parseFloat(t.price), quantity: parseFloat(t.quantity) })),
        memo: formData.memo || null,
      };

      if (data.take_profit_targets.length === 0) data.take_profit_targets = null;
      if (data.stop_loss_targets.length === 0) data.stop_loss_targets = null;

      await requestService.createBuyRequest(data);
      onSuccess?.();
    } catch (error) {
      // 에러 핸들링 개선
      let errorMessage = '요청 생성에 실패했습니다.';

      if (error.response) {
        // 서버가 응답을 반환한 경우
        const detail = error.response.data?.detail;
        if (typeof detail === 'string') {
          errorMessage = detail;
        } else if (Array.isArray(detail)) {
          errorMessage = detail.map(d => d.msg || d).join(', ');
        } else if (error.response.status === 401) {
          errorMessage = '로그인이 필요합니다. 다시 로그인해주세요.';
        } else if (error.response.status === 403) {
          errorMessage = '요청 권한이 없습니다. 팀에 가입되어 있는지 확인해주세요.';
        } else if (error.response.status >= 500) {
          errorMessage = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
        }
      } else if (error.request) {
        // 요청은 보냈지만 응답을 받지 못한 경우
        errorMessage = '서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.';
      }

      setValidationErrors([errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (num === null || num === undefined) return '-';
    return num.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
  };

  const getCurrencyUnit = () => {
    if (market === 'NASDAQ' || market === 'NYSE') return ' USD';
    if (market === 'CRYPTO') return ' USDT';
    return '원';
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 종목 정보 표시 */}
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          <strong>{tickerName}</strong> ({ticker}) - {market}
        </p>
      </div>

      {/* 유효성 검사 에러 표시 */}
      {validationErrors.length > 0 && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <h3 className="font-medium text-red-800 dark:text-red-300 text-sm">입력 오류</h3>
              <ul className="mt-1 text-sm text-red-700 dark:text-red-400 list-disc list-inside">
                {validationErrors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 매수 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">매수</label>
          {formData.buy_orders.length < 4 && (
            <button
              type="button"
              onClick={addBuyOrder}
              className="text-xs text-primary-600 hover:text-primary-700"
            >
              + 추가
            </button>
          )}
        </div>
        <div className="space-y-2">
          {formData.buy_orders.map((order, index) => (
            <div key={index} className="space-y-1">
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  step="any"
                  placeholder="매수가"
                  value={order.price}
                  onChange={(e) => updateBuyOrder(index, 'price', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="수량"
                  value={order.quantity}
                  onChange={(e) => updateBuyOrder(index, 'quantity', e.target.value)}
                  className="w-28 px-2 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
                {formData.buy_orders.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeBuyOrder(index)}
                    className="p-1 text-gray-400 hover:text-red-500"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {/* 수량 빠른 입력 버튼 */}
              <div className="ml-auto" style={{ width: '7rem' }}>
                <QuickNumberButtons
                  onAdd={(num) => {
                    const currentQty = parseFloat(order.quantity) || 0;
                    updateBuyOrder(index, 'quantity', String(currentQty + num));
                  }}
                  quickValues={[1, 5, 10, 50, 100]}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 거래대금 요약 */}
      {totalAmount > 0 && (
        <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600 dark:text-gray-400">총 수량</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{formatNumber(totalBuyQuantity)}</span>
          </div>
          <div className="flex justify-between items-center text-sm mt-1">
            <span className="text-gray-600 dark:text-gray-400">평균 매수가</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{formatNumber(avgBuyPrice)}{getCurrencyUnit()}</span>
          </div>
          <div className="flex justify-between items-center mt-2 pt-2 border-t">
            <span className="text-sm text-gray-600">예상 거래대금</span>
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatNumber(totalAmount)}{getCurrencyUnit()}</span>
          </div>
        </div>
      )}

      {/* 고급 옵션 (익절/손절) */}
      <div className="border-t dark:border-gray-700 pt-4">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
        >
          <svg
            className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
          고급 옵션 (익절/손절)
          {(formData.take_profit_targets.length > 0 || formData.stop_loss_targets.length > 0) && (
            <span className="text-xs px-1.5 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded">
              {formData.take_profit_targets.length + formData.stop_loss_targets.length}
            </span>
          )}
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
            {/* 익절 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">익절</label>
                {formData.take_profit_targets.length < 4 && (
                  <button
                    type="button"
                    onClick={addTakeProfitTarget}
                    className="text-xs text-primary-600 hover:text-primary-700"
                  >
                    + 추가
                  </button>
                )}
              </div>
              {formData.take_profit_targets.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">익절 타겟이 없습니다. + 추가 버튼을 눌러 추가하세요.</p>
              ) : (
                <div className="space-y-2">
                  {formData.take_profit_targets.map((target, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <input
                        type="number"
                        step="any"
                        placeholder="익절가"
                        value={target.price}
                        onChange={(e) => updateTakeProfitTarget(index, 'price', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                      />
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="수량"
                        value={target.quantity}
                        onChange={(e) => updateTakeProfitTarget(index, 'quantity', e.target.value)}
                        className="w-28 px-2 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeTakeProfitTarget(index)}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 손절 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">손절</label>
                {formData.stop_loss_targets.length < 4 && (
                  <button
                    type="button"
                    onClick={addStopLossTarget}
                    className="text-xs text-primary-600 hover:text-primary-700"
                  >
                    + 추가
                  </button>
                )}
              </div>
              {formData.stop_loss_targets.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">손절 타겟이 없습니다. + 추가 버튼을 눌러 추가하세요.</p>
              ) : (
                <div className="space-y-2">
                  {formData.stop_loss_targets.map((target, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <input
                        type="number"
                        step="any"
                        placeholder="손절가"
                        value={target.price}
                        onChange={(e) => updateStopLossTarget(index, 'price', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                      />
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="수량"
                        value={target.quantity}
                        onChange={(e) => updateStopLossTarget(index, 'quantity', e.target.value)}
                        className="w-28 px-2 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeStopLossTarget(index)}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 메모 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">메모</label>
        <textarea
          rows={2}
          placeholder="매수 이유..."
          value={formData.memo}
          onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* 버튼 */}
      <div className="flex justify-end gap-3 pt-2">
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
