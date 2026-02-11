import { useState, useEffect, useRef } from 'react';
import { priceService } from '../services/priceService';

export function useStockSearch(market, debounceMs = 300) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!searchQuery || searchQuery.length < 1) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setSearchLoading(true);
    const debounce = setTimeout(async () => {
      try {
        // 시장 필터: KOSPI/KOSDAQ는 합쳐서, 나머지는 개별
        let marketFilter = null;
        if (market !== 'KOSPI' && market !== 'KOSDAQ') {
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
        console.error('Stock search failed:', err);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(debounce);
  }, [searchQuery, market, debounceMs]);

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowDropdown(false);
  };

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    searchLoading,
    showDropdown,
    setShowDropdown,
    dropdownRef,
    clearSearch,
  };
}
