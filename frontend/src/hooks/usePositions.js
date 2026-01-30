import { useState, useEffect, useCallback } from 'react';
import { positionService } from '../services/positionService';

export function usePositions(initialFilters = {}) {
  const [positions, setPositions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    status: null,
    ticker: null,
    opened_by: null,
    page: 1,
    limit: 20,
    ...initialFilters
  });

  const fetchPositions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await positionService.getPositions(filters);
      setPositions(data.positions);
      setTotal(data.total);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  const updateFilters = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: 1 }));
  };

  const setPage = (page) => {
    setFilters(prev => ({ ...prev, page }));
  };

  return {
    positions,
    total,
    loading,
    error,
    filters,
    updateFilters,
    setPage,
    refresh: fetchPositions
  };
}
