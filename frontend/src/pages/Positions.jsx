import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { ProfitProgressBar } from '../components/common/ProfitProgressBar';
import { ChartModal } from '../components/charts/ChartModal';
import { QuickNumberButtons } from '../components/common/NumberInputWithQuickButtons';
import { usePositions } from '../hooks/usePositions';
import { priceService } from '../services/priceService';
import { positionService } from '../services/positionService';
import { requestService } from '../services/requestService';
import { useAuth } from '../hooks/useAuth';
import {
  formatCurrency,
  formatPercent,
  formatQuantity,
  formatHours,
  calcHoldingHours,
  getStatusBadgeClass,
  getStatusLabel,
  getProfitLossClass
} from '../utils/formatters';

const MARKETS = [
  { value: 'KOSPI', label: '코스피' },
  { value: 'KOSDAQ', label: '코스닥' },
  { value: 'NASDAQ', label: '나스닥' },
  { value: 'NYSE', label: 'NYSE' },
  { value: 'CRYPTO', label: '크립토' },
];

export function Positions() {
  const { adminMode } = useAuth();
  const [statusFilter, setStatusFilter] = useState('open');
  const { positions, total, loading, error, updateFilters, setPage, filters } = usePositions({ status: 'open' });
  const [priceData, setPriceData] = useState({});
  const [priceLoading, setPriceLoading] = useState(false);
  const [expandedIds, setExpandedIds] = useState(new Set());

  // 종목 검색 상태
  const [showSearch, setShowSearch] = useState(false);
  const [market, setMarket] = useState('KOSPI');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);
  const [stockPrice, setStockPrice] = useState(null);
  const [existingPosition, setExistingPosition] = useState(null);
  const searchRef = useRef(null);
  const dropdownRef = useRef(null);

  // 차트 모달 상태
  const [chartStock, setChartStock] = useState(null);
  const [showChartModal, setShowChartModal] = useState(false);

  // 매수 요청 폼 상태
  const [showBuyForm, setShowBuyForm] = useState(false);
  const [buyFormLoading, setBuyFormLoading] = useState(false);
  const [buyFormSuccess, setBuyFormSuccess] = useState('');

  useEffect(() => {
    if (statusFilter === 'open' && positions.length > 0) {
      fetchPrices();
      const interval = setInterval(fetchPrices, 60000);
      return () => clearInterval(interval);
    }
  }, [positions, statusFilter]);

  // 검색어 변경 시 자동완성
  useEffect(() => {
    const searchStocks = async () => {
      if (!searchQuery || searchQuery.length < 1) {
        setSearchResults([]);
        setShowDropdown(false);
        return;
      }

      setSearchLoading(true);
      try {
        let marketFilter = null;
        if (market !== 'KOSPI' && market !== 'KOSDAQ') {
          marketFilter = market;
        }

        const result = await priceService.searchStocks(searchQuery, marketFilter, 15);
        if (result.success) {
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

  const fetchPrices = async () => {
    try {
      setPriceLoading(true);
      const data = await priceService.getPositionsWithPrices();
      const priceMap = {};
      data.positions?.forEach(p => {
        priceMap[p.id] = p;
      });
      setPriceData(priceMap);
    } catch (err) {
      console.error('시세 조회 실패:', err);
    } finally {
      setPriceLoading(false);
    }
  };

  const handleDelete = async (e, position) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`포지션 "${position.ticker_name || position.ticker}"을(를) 정말 삭제하시겠습니까?\n\n연관된 모든 요청, 토론, 의사결정 노트가 함께 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.`)) return;
    try {
      await positionService.deletePosition(position.id);
      updateFilters({ ...filters });
    } catch (error) {
      alert(error.response?.data?.detail || '삭제에 실패했습니다.');
    }
  };

  const handleStatusChange = (status) => {
    setStatusFilter(status);
    setExpandedIds(new Set());
    updateFilters({ status: status === 'all' ? null : status });
  };

  const toggleExpand = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 종목 선택
  const handleSelectStock = async (stock) => {
    setSelectedStock(stock);
    setSearchQuery(stock.name);
    setMarket(stock.market);
    setShowDropdown(false);
    setShowBuyForm(false);
    setBuyFormSuccess('');

    // 현재가 조회
    try {
      const result = await priceService.lookupTicker(stock.ticker, stock.market);
      if (result.success && result.data) {
        setStockPrice(result.data.price);
      }
    } catch (e) {
      console.error('현재가 조회 실패:', e);
    }

    // 열린 포지션 확인
    try {
      const positionsResult = await positionService.getPositions({ status: 'open', ticker: stock.ticker.toUpperCase() });
      if (positionsResult.positions?.length > 0) {
        setExistingPosition(positionsResult.positions[0]);
      } else {
        setExistingPosition(null);
      }
    } catch (e) {
      setExistingPosition(null);
    }
  };

  // 검색 초기화
  const clearSearch = () => {
    setSelectedStock(null);
    setSearchQuery('');
    setSearchResults([]);
    setShowDropdown(false);
    setStockPrice(null);
    setExistingPosition(null);
    setShowBuyForm(false);
    setBuyFormSuccess('');
  };

  // 시장 변경
  const handleMarketChange = (newMarket) => {
    setMarket(newMarket);
    setSearchQuery('');
    setSelectedStock(null);
    setSearchResults([]);
    setShowDropdown(false);
    setStockPrice(null);
    setExistingPosition(null);
  };

  // 차트 모달 열기
  const openChartModal = (stock) => {
    setChartStock(stock);
    setShowChartModal(true);
  };

  // 매수 요청 성공
  const handleBuySuccess = () => {
    setShowBuyForm(false);
    setBuyFormSuccess('매수 요청이 생성되었습니다.');
    setTimeout(() => setBuyFormSuccess(''), 3000);
    // 포지션 목록 새로고침
    updateFilters({ ...filters });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold dark:text-gray-100">포지션</h1>
        <Button
          variant={showSearch ? 'secondary' : 'primary'}
          size="sm"
          onClick={() => setShowSearch(!showSearch)}
        >
          {showSearch ? '검색 닫기' : '종목 검색'}
        </Button>
      </div>

      {/* 종목 검색 영역 */}
      {showSearch && (
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

            {/* 종목 검색 */}
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
                    setSelectedStock(null);
                  }}
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

            {selectedStock && (
              <button
                onClick={clearSearch}
                className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              >
                초기화
              </button>
            )}
          </div>

          {/* 선택된 종목 정보 */}
          {selectedStock && (
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {selectedStock.name}
                    <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">({selectedStock.ticker})</span>
                  </h3>
                  {stockPrice && (
                    <p className="text-xl font-bold text-primary-600 dark:text-primary-400 mt-1">
                      {stockPrice.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
                      <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">
                        {selectedStock.market === 'CRYPTO' ? 'USDT' : (selectedStock.market === 'NASDAQ' || selectedStock.market === 'NYSE') ? 'USD' : '원'}
                      </span>
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openChartModal(selectedStock)}
                  >
                    차트 보기
                  </Button>
                  {!existingPosition && (
                    <Button
                      size="sm"
                      onClick={() => setShowBuyForm(!showBuyForm)}
                    >
                      {showBuyForm ? '접기' : '매수 요청'}
                    </Button>
                  )}
                </div>
              </div>

              {/* 이미 열린 포지션 경고 */}
              {existingPosition && (
                <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm text-yellow-800 dark:text-yellow-300 font-medium">이미 열린 포지션이 있습니다</p>
                      <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-0.5">추가매수는 해당 포지션에서 요청해주세요.</p>
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

              {/* 성공 메시지 */}
              {buyFormSuccess && (
                <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">{buyFormSuccess}</p>
                </div>
              )}

              {/* 매수 요청 폼 */}
              {showBuyForm && !existingPosition && (
                <div className="mt-4 pt-4 border-t dark:border-gray-600">
                  <SimpleBuyForm
                    stock={selectedStock}
                    currentPrice={stockPrice}
                    onSuccess={handleBuySuccess}
                    onCancel={() => setShowBuyForm(false)}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        {['open', 'closed', 'all'].map(status => (
          <button
            key={status}
            onClick={() => handleStatusChange(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === status
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            {status === 'open' ? '진행중' : status === 'closed' ? '종료' : '전체'}
          </button>
        ))}
      </div>

      {/* Positions List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">로딩중...</div>
      ) : error ? (
        <div className="text-center py-12 text-red-500 dark:text-red-400">{error}</div>
      ) : positions.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">포지션이 없습니다</div>
      ) : (
        <>
          <div className="space-y-4">
            {positions.map(position => {
              const isOpen = position.status === 'open';
              const price = priceData[position.id];
              const profitRate = isOpen ? price?.profit_rate : position.profit_rate;
              const profitLoss = isOpen ? price?.profit_loss : position.profit_loss;
              const holdingHours = isOpen ? calcHoldingHours(position.opened_at) : position.holding_period_hours;
              const expanded = expandedIds.has(position.id);
              const isProfit = profitRate != null && profitRate > 0;
              const isLoss = profitRate != null && profitRate < 0;

              return (
                <div
                  key={position.id}
                  className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border overflow-hidden transition-all ${
                    expanded ? 'shadow-md border-primary-200 dark:border-primary-700' : 'border-gray-200 dark:border-gray-700 hover:shadow-md'
                  }`}
                >
                  {/* Card Header */}
                  <div
                    className="cursor-pointer transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-700/50"
                    onClick={() => toggleExpand(position.id)}
                  >
                    {/* Top Row: Ticker + Status */}
                    <div className="px-5 pt-4 pb-2 flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                            {position.ticker_name || position.ticker}
                          </h3>
                          <span className="text-sm text-gray-400 dark:text-gray-500 font-mono">{position.ticker}</span>
                          {isOpen && !position.is_info_confirmed && (
                            <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-medium px-2 py-0.5 rounded-full">
                              미수정
                            </span>
                          )}
                        </div>
                        {/* Remaining plans */}
                        {isOpen && (position.remaining_buys > 0 || position.remaining_take_profits > 0 || position.remaining_stop_losses > 0) && (
                          <div className="flex gap-3 mt-1">
                            {position.remaining_buys > 0 && (
                              <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">
                                매수 {position.remaining_buys}건
                              </span>
                            )}
                            {position.remaining_take_profits > 0 && (
                              <span className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
                                익절 {position.remaining_take_profits}건
                              </span>
                            )}
                            {position.remaining_stop_losses > 0 && (
                              <span className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                                손절 {position.remaining_stop_losses}건
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${getStatusBadgeClass(position.status)}`}>
                          {getStatusLabel(position.status)}
                        </span>
                        {/* 포지션 상태 알림 */}
                        {position.status_info?.alert && (
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1 ${
                            position.status_info.alert === 'danger'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                          }`}>
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            {position.status_info.message}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Key Metrics Row */}
                    <div className="px-5 pb-4">
                      <div className="flex items-end justify-between gap-4">
                        {/* Left metrics */}
                        <div className="flex gap-6 items-end">
                          <div>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">매수금액</p>
                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                              {formatCurrency(position.total_buy_amount, position.market)}
                            </p>
                          </div>
                          {isOpen && price?.current_price && (
                            <div>
                              <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">현재가</p>
                              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                {formatCurrency(price.current_price, position.market)}
                              </p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">보유기간</p>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{formatHours(holdingHours)}</p>
                          </div>
                        </div>

                        {/* Right: P&L highlight */}
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{isOpen ? '수익률' : '실현 수익률'}</p>
                            <ProfitProgressBar value={profitRate} size="lg" />
                          </div>
                          {/* Expand Arrow */}
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                            expanded ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400' : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
                          }`}>
                            <svg
                              className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                              fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expanded && (
                    <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                      <div className="px-5 py-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
                            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">평균매수가</p>
                            <p className="text-sm font-semibold">{formatCurrency(position.average_buy_price, position.market)}</p>
                          </div>
                          {isOpen && (
                            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
                              <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">현재가</p>
                              <p className="text-sm font-semibold">
                                {price?.current_price
                                  ? formatCurrency(price.current_price, position.market)
                                  : priceLoading ? '...' : '-'}
                              </p>
                            </div>
                          )}
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
                            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">수량</p>
                            <p className="text-sm font-semibold">{formatQuantity(position.total_quantity)}</p>
                          </div>
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
                            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">매수금액</p>
                            <p className="text-sm font-semibold">{formatCurrency(position.total_buy_amount, position.market)}</p>
                          </div>
                          {isOpen && (
                            <>
                              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
                                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">평가금액</p>
                                <p className="text-sm font-semibold">
                                  {price?.evaluation_amount
                                    ? formatCurrency(price.evaluation_amount, position.market)
                                    : '-'}
                                </p>
                              </div>
                              <div className={`rounded-lg p-3 border ${
                                isProfit ? 'bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-800' : isLoss ? 'bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-white border-gray-100 dark:bg-gray-800 dark:border-gray-700'
                              }`}>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">평가손익</p>
                                <p className={`text-sm font-bold ${getProfitLossClass(profitLoss)}`}>
                                  {profitLoss != null
                                    ? formatCurrency(profitLoss, position.market)
                                    : '-'}
                                </p>
                              </div>
                              {/* 실현손익 (부분 익절/손절 시) */}
                              {position.realized_profit_loss != null && parseFloat(position.realized_profit_loss) !== 0 && (
                                <div className={`rounded-lg p-3 border ${
                                  parseFloat(position.realized_profit_loss) > 0
                                    ? 'bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-800'
                                    : 'bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800'
                                }`}>
                                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">실현손익</p>
                                  <p className={`text-sm font-bold ${getProfitLossClass(parseFloat(position.realized_profit_loss))}`}>
                                    {formatCurrency(position.realized_profit_loss, position.market)}
                                  </p>
                                </div>
                              )}
                            </>
                          )}
                          {!isOpen && (
                            <div className={`rounded-lg p-3 border ${
                              isProfit ? 'bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-800' : isLoss ? 'bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-white border-gray-100 dark:bg-gray-800 dark:border-gray-700'
                            }`}>
                              <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">실현손익</p>
                              <p className={`text-sm font-bold ${getProfitLossClass(profitLoss)}`}>
                                {formatCurrency(profitLoss, position.market)}
                              </p>
                            </div>
                          )}
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
                            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">보유기간</p>
                            <p className="text-sm font-semibold">{formatHours(holdingHours)}</p>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <Link
                            to={`/positions/${position.id}`}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 dark:text-primary-400 dark:bg-primary-900/20 dark:hover:bg-primary-900/40 rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                            상세보기
                          </Link>
                          {adminMode && (
                            <button
                              onClick={(e) => handleDelete(e, position)}
                              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-lg transition-colors ml-auto"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              삭제
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {total > filters.limit && (
            <div className="flex justify-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={filters.page === 1}
                onClick={() => setPage(filters.page - 1)}
              >
                이전
              </Button>
              <span className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                {filters.page} / {Math.ceil(total / filters.limit)}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={filters.page >= Math.ceil(total / filters.limit)}
                onClick={() => setPage(filters.page + 1)}
              >
                다음
              </Button>
            </div>
          )}
        </>
      )}

      {/* 차트 모달 */}
      <ChartModal
        isOpen={showChartModal}
        onClose={() => setShowChartModal(false)}
        stock={chartStock}
      />
    </div>
  );
}

// 간단한 매수 요청 폼
function SimpleBuyForm({ stock, currentPrice, onSuccess, onCancel }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formData, setFormData] = useState({
    buy_orders: [{ price: currentPrice ? String(Math.round(currentPrice * 1000) / 1000) : '', quantity: '' }],
    take_profit_targets: [],
    stop_loss_targets: [],
    memo: '',
  });

  // 매수 추가/삭제/업데이트
  const addBuyOrder = () => {
    if (formData.buy_orders.length < 4) {
      setFormData({
        ...formData,
        buy_orders: [...formData.buy_orders, { price: '', quantity: '' }]
      });
    }
  };

  const removeBuyOrder = (index) => {
    if (formData.buy_orders.length > 1) {
      const newOrders = formData.buy_orders.filter((_, i) => i !== index);
      setFormData({ ...formData, buy_orders: newOrders });
    }
  };

  const updateBuyOrder = (index, field, value) => {
    const newOrders = [...formData.buy_orders];
    newOrders[index] = { ...newOrders[index], [field]: value };
    setFormData({ ...formData, buy_orders: newOrders });
  };

  // 익절/손절 관리
  const addTarget = (type) => {
    const key = type === 'tp' ? 'take_profit_targets' : 'stop_loss_targets';
    if (formData[key].length < 4) {
      setFormData({
        ...formData,
        [key]: [...formData[key], { price: '', quantity: '' }]
      });
    }
  };

  const removeTarget = (type, index) => {
    const key = type === 'tp' ? 'take_profit_targets' : 'stop_loss_targets';
    const newTargets = formData[key].filter((_, i) => i !== index);
    setFormData({ ...formData, [key]: newTargets });
  };

  const updateTarget = (type, index, field, value) => {
    const key = type === 'tp' ? 'take_profit_targets' : 'stop_loss_targets';
    const newTargets = [...formData[key]];
    newTargets[index] = { ...newTargets[index], [field]: value };
    setFormData({ ...formData, [key]: newTargets });
  };

  // 유효한 매수 항목
  const validBuyOrders = formData.buy_orders.filter(o => o.price && o.quantity);
  const totalBuyQuantity = validBuyOrders.reduce((sum, o) => sum + parseFloat(o.quantity || 0), 0);
  const avgBuyPrice = totalBuyQuantity > 0
    ? validBuyOrders.reduce((sum, o) => sum + parseFloat(o.price || 0) * parseFloat(o.quantity || 0), 0) / totalBuyQuantity
    : 0;
  const totalAmount = validBuyOrders.reduce((sum, o) => sum + parseFloat(o.price || 0) * parseFloat(o.quantity || 0), 0);

  const getCurrencyUnit = () => {
    if (stock.market === 'NASDAQ' || stock.market === 'NYSE') return ' USD';
    if (stock.market === 'CRYPTO') return ' USDT';
    return '원';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (validBuyOrders.length === 0) {
      setError('최소 하나의 매수 항목을 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      const data = {
        target_ticker: stock.ticker,
        ticker_name: stock.name,
        target_market: stock.market,
        order_type: 'quantity',
        order_quantity: totalBuyQuantity,
        buy_price: avgBuyPrice,
        buy_orders: validBuyOrders.map(o => ({ price: parseFloat(o.price), quantity: parseFloat(o.quantity) })),
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
    } catch (err) {
      setError(err.response?.data?.detail || '요청 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* 매수 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">매수</label>
          {formData.buy_orders.length < 4 && (
            <button type="button" onClick={addBuyOrder} className="text-xs text-primary-600 hover:text-primary-700">
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
                  <button type="button" onClick={() => removeBuyOrder(index)} className="p-1 text-gray-400 hover:text-red-500">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
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
            <span className="font-medium text-gray-900 dark:text-gray-100">{totalBuyQuantity.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center text-sm mt-1">
            <span className="text-gray-600 dark:text-gray-400">평균 매수가</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{avgBuyPrice.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}{getCurrencyUnit()}</span>
          </div>
          <div className="flex justify-between items-center mt-2 pt-2 border-t dark:border-gray-600">
            <span className="text-sm text-gray-600 dark:text-gray-400">예상 거래대금</span>
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{totalAmount.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}{getCurrencyUnit()}</span>
          </div>
        </div>
      )}

      {/* 고급 옵션 */}
      <div className="border-t dark:border-gray-600 pt-4">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
        >
          <svg className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
          고급 옵션 (익절/손절)
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
            {/* 익절 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">익절</label>
                {formData.take_profit_targets.length < 4 && (
                  <button type="button" onClick={() => addTarget('tp')} className="text-xs text-primary-600 hover:text-primary-700">+ 추가</button>
                )}
              </div>
              {formData.take_profit_targets.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">+ 추가 버튼을 눌러 익절 타겟을 추가하세요.</p>
              ) : (
                <div className="space-y-2">
                  {formData.take_profit_targets.map((target, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <input type="number" step="any" placeholder="익절가" value={target.price}
                        onChange={(e) => updateTarget('tp', index, 'price', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg text-sm" />
                      <input type="number" step="any" min="0" placeholder="수량" value={target.quantity}
                        onChange={(e) => updateTarget('tp', index, 'quantity', e.target.value)}
                        className="w-28 px-2 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg text-sm" />
                      <button type="button" onClick={() => removeTarget('tp', index)} className="p-1 text-gray-400 hover:text-red-500">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
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
                  <button type="button" onClick={() => addTarget('sl')} className="text-xs text-primary-600 hover:text-primary-700">+ 추가</button>
                )}
              </div>
              {formData.stop_loss_targets.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">+ 추가 버튼을 눌러 손절 타겟을 추가하세요.</p>
              ) : (
                <div className="space-y-2">
                  {formData.stop_loss_targets.map((target, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <input type="number" step="any" placeholder="손절가" value={target.price}
                        onChange={(e) => updateTarget('sl', index, 'price', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg text-sm" />
                      <input type="number" step="any" min="0" placeholder="수량" value={target.quantity}
                        onChange={(e) => updateTarget('sl', index, 'quantity', e.target.value)}
                        className="w-28 px-2 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg text-sm" />
                      <button type="button" onClick={() => removeTarget('sl', index)} className="p-1 text-gray-400 hover:text-red-500">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
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
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg"
        />
      </div>

      {/* 버튼 */}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>취소</Button>
        <Button type="submit" loading={loading}>매수 요청</Button>
      </div>
    </form>
  );
}
