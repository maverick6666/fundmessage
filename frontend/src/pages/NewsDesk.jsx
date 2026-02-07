import { useState, useEffect, useCallback, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import { newsdeskService } from '../services/newsdeskService';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { useSidePanelStore } from '../stores/useSidePanelStore';
import { Button } from '../components/common/Button';
import { formatDate } from '../utils/formatters';

// 날짜 선택기 컴포넌트
function DatePicker({ selectedDate, onDateChange, history }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 날짜 이동
  const moveDate = (direction) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + direction);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (current <= today) {
      onDateChange(current.toISOString().split('T')[0]);
    }
  };

  const formatDisplayDate = (dateStr) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  const isToday = (dateStr) => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr === today;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center gap-1">
        {/* 이전 버튼 */}
        <button
          onClick={() => moveDate(-1)}
          className="w-8 h-8 flex items-center justify-center border-2 border-black dark:border-gray-500 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* 날짜 표시 & 드롭다운 트리거 */}
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 px-4 h-8 border-2 border-black dark:border-gray-500 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-mono font-bold text-sm"
        >
          {formatDisplayDate(selectedDate)}
          <svg className={`w-3 h-3 transition-transform ${showDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* 다음 버튼 */}
        <button
          onClick={() => moveDate(1)}
          disabled={isToday(selectedDate)}
          className="w-8 h-8 flex items-center justify-center border-2 border-black dark:border-gray-500 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 드롭다운 */}
      {showDropdown && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-gray-800 border-2 border-black dark:border-gray-500 shadow-lg min-w-[180px]">
          <div className="py-1">
            {history.map((item) => (
              <button
                key={item.date}
                onClick={() => {
                  onDateChange(item.date);
                  setShowDropdown(false);
                }}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between ${
                  item.date === selectedDate ? 'bg-primary-50 dark:bg-primary-900/30 font-bold' : ''
                }`}
              >
                <span className="font-mono">{formatDisplayDate(item.date)}</span>
                {item.date === selectedDate && (
                  <svg className="w-4 h-4 text-primary-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
            {history.length === 0 && (
              <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                이전 기록 없음
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// 벤치마크 차트 컴포넌트
function BenchmarkChart({ selected, period, onPeriodChange }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef({});
  const { isCurrentThemeDark } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const colors = {
    kospi: '#ef4444',
    nasdaq: '#3b82f6',
    sp500: '#22c55e',
    fund: '#a855f7'
  };

  const periods = [
    { id: '1W', label: '1W' },
    { id: '1M', label: '1M' },
    { id: '3M', label: '3M' },
    { id: '6M', label: '6M' },
    { id: '1Y', label: '1Y' }
  ];

  // 데이터 로드
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await newsdeskService.getBenchmarkData(period);
        setData(result);
      } catch (err) {
        console.error('Failed to fetch benchmark data:', err);
        setError('벤치마크 데이터를 불러올 수 없습니다');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [period]);

  // 차트 초기화
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: isCurrentThemeDark ? '#9ca3af' : '#6b7280'
      },
      grid: {
        vertLines: { color: isCurrentThemeDark ? '#374151' : '#e5e7eb' },
        horzLines: { color: isCurrentThemeDark ? '#374151' : '#e5e7eb' }
      },
      width: chartContainerRef.current.clientWidth,
      height: 200,
      rightPriceScale: {
        borderVisible: false
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false
      },
      crosshair: {
        mode: 1
      }
    });

    chartRef.current = chart;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [isCurrentThemeDark]);

  // 데이터 & 시리즈 업데이트
  useEffect(() => {
    if (!chartRef.current || !data) return;

    // 기존 시리즈 제거
    Object.values(seriesRef.current).forEach((series) => {
      try {
        chartRef.current.removeSeries(series);
      } catch (e) {}
    });
    seriesRef.current = {};

    const activeCount = selected.length;

    // 정규화 함수 (2개 이상 선택 시 수익률로 변환)
    const normalizeData = (points) => {
      if (!points || points.length === 0) return [];
      if (activeCount <= 1) {
        return points.map(p => ({ time: p.time, value: p.value }));
      }
      const firstValue = points[0].value;
      return points.map(p => ({
        time: p.time,
        value: ((p.value - firstValue) / firstValue) * 100
      }));
    };

    // 선택된 벤치마크에 대해 시리즈 생성
    selected.forEach((id) => {
      const rawData = data[id];
      if (!rawData || rawData.length === 0) return;

      const series = chartRef.current.addLineSeries({
        color: colors[id],
        lineWidth: 2,
        priceFormat: {
          type: 'custom',
          formatter: (price) => activeCount > 1 ? `${price.toFixed(2)}%` : price.toFixed(2)
        }
      });

      const chartData = normalizeData(rawData);
      series.setData(chartData);
      seriesRef.current[id] = series;
    });

    chartRef.current.timeScale().fitContent();
  }, [data, selected]);

  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-black dark:border-gray-600 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100">
          벤치마크 비교
        </h2>

        {/* 기간 선택 */}
        <div className="flex gap-1">
          {periods.map((p) => (
            <button
              key={p.id}
              onClick={() => onPeriodChange(p.id)}
              className={`px-2.5 py-1 text-xs font-bold border-2 transition-colors ${
                period === p.id
                  ? 'border-black dark:border-white bg-black dark:bg-white text-white dark:text-black'
                  : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 차트 영역 */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 flex items-center justify-center z-10">
            <div className="flex items-center gap-2 text-gray-500">
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">로딩 중...</span>
            </div>
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 bg-white/90 dark:bg-gray-800/90 flex items-center justify-center z-10">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}
        <div ref={chartContainerRef} className="h-[200px]" />
      </div>

      {/* 범례 */}
      <div className="mt-3 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
        {selected.length > 1 && (
          <span className="mr-2 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px]">
            수익률 비교
          </span>
        )}
      </div>
    </div>
  );
}

// 벤치마크 토글 컴포넌트
function BenchmarkToggles({ selected, onChange }) {
  const benchmarks = [
    { id: 'kospi', label: '코스피', color: 'bg-red-500' },
    { id: 'nasdaq', label: '나스닥', color: 'bg-blue-500' },
    { id: 'sp500', label: 'S&P500', color: 'bg-green-500' },
    { id: 'fund', label: '우리팀', color: 'bg-purple-500' },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {benchmarks.map((b) => (
        <button
          key={b.id}
          onClick={() => onChange(b.id)}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium
            border-2 transition-all duration-200
            ${selected.includes(b.id)
              ? 'border-black dark:border-white bg-gray-900 dark:bg-white text-white dark:text-gray-900'
              : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400'
            }
          `}
        >
          <div className={`w-2 h-2 rounded-full ${b.color}`} />
          {b.label}
        </button>
      ))}
    </div>
  );
}

// 키워드 버블 컴포넌트
function KeywordBubble({ keyword, count, sentimentScore, isSelected, onClick, index }) {
  const size = Math.max(48, Math.min(96, 40 + count * 4));

  const getBubbleColor = () => {
    if (sentimentScore > 0.3) return 'bg-emerald-500/20 border-emerald-500/50 text-emerald-700 dark:text-emerald-300';
    if (sentimentScore < -0.3) return 'bg-rose-500/20 border-rose-500/50 text-rose-700 dark:text-rose-300';
    return 'bg-slate-500/20 border-slate-500/50 text-slate-700 dark:text-slate-300';
  };

  const selectedStyle = isSelected
    ? 'ring-2 ring-offset-2 ring-primary-500 dark:ring-offset-gray-900 scale-110'
    : 'hover:scale-105';

  return (
    <button
      onClick={onClick}
      className={`
        relative flex items-center justify-center rounded-full border-2
        transition-all duration-300 cursor-pointer font-medium
        ${getBubbleColor()} ${selectedStyle}
      `}
      style={{
        width: size,
        height: size,
        animationDelay: `${index * 100}ms`
      }}
    >
      <span className="text-xs text-center leading-tight px-1 line-clamp-2">
        {keyword}
      </span>
      <span className="absolute -bottom-1 -right-1 text-[10px] bg-white dark:bg-gray-800 px-1 rounded-full border">
        {count}
      </span>
    </button>
  );
}

// 감성 게이지 컴포넌트
function SentimentGauge({ sentiment, selectedKeyword }) {
  const positiveRatio = sentiment?.positive_ratio || 0.33;
  const negativeRatio = sentiment?.negative_ratio || 0.33;
  const neutralRatio = sentiment?.neutral_ratio || 0.34;

  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-black dark:border-gray-600 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100">
          시장 감성
        </h3>
        {selectedKeyword && (
          <span className="text-xs px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded">
            {selectedKeyword}
          </span>
        )}
      </div>

      <div className="h-8 flex rounded overflow-hidden border border-gray-200 dark:border-gray-700">
        <div
          className="bg-gradient-to-r from-emerald-400 to-emerald-500 flex items-center justify-center transition-all duration-500"
          style={{ width: `${positiveRatio * 100}%` }}
        >
          {positiveRatio > 0.15 && (
            <span className="text-xs font-bold text-white">
              {Math.round(positiveRatio * 100)}%
            </span>
          )}
        </div>
        <div
          className="bg-gradient-to-r from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-700 flex items-center justify-center transition-all duration-500"
          style={{ width: `${neutralRatio * 100}%` }}
        >
          {neutralRatio > 0.15 && (
            <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
              {Math.round(neutralRatio * 100)}%
            </span>
          )}
        </div>
        <div
          className="bg-gradient-to-r from-rose-400 to-rose-500 flex items-center justify-center transition-all duration-500"
          style={{ width: `${negativeRatio * 100}%` }}
        >
          {negativeRatio > 0.15 && (
            <span className="text-xs font-bold text-white">
              {Math.round(negativeRatio * 100)}%
            </span>
          )}
        </div>
      </div>

      <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          호재
        </span>
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-slate-400" />
          중립
        </span>
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-rose-500" />
          악재
        </span>
      </div>
    </div>
  );
}

// 뉴스 카드 컴포넌트
function NewsCard({ card, type = 'news', onClick }) {
  const isColumn = type === 'column';

  const categoryColors = {
    '경제': 'bg-blue-500',
    '기업': 'bg-purple-500',
    '정책': 'bg-amber-500',
    '글로벌': 'bg-teal-500',
    '기술': 'bg-cyan-500',
    'default': 'bg-gray-500'
  };

  const categoryColor = categoryColors[card.category] || categoryColors.default;

  return (
    <button
      onClick={onClick}
      className="group text-left w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white"
    >
      <div className={`
        relative overflow-hidden bg-white dark:bg-gray-800
        border-2 border-black dark:border-gray-600
        hover:border-primary-500 dark:hover:border-primary-400
        transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg
      `}>
        <div className={`h-1 ${isColumn ? 'bg-gradient-to-r from-amber-500 to-orange-500' : categoryColor}`} />

        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${
              isColumn ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'
            }`}>
              {isColumn ? 'AI 칼럼' : card.category || 'NEWS'}
            </span>
            {card.source && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                {card.source}
              </span>
            )}
          </div>

          <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base leading-tight mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-2">
            {card.title}
          </h3>

          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
            {card.summary}
          </p>
        </div>

        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <svg className="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </button>
  );
}

// 주목 종목 카드 컴포넌트
function TopStockCard({ stock, rank, onClick }) {
  const rankColors = ['bg-amber-500', 'bg-gray-400', 'bg-orange-600'];
  const rankBg = rankColors[rank - 1] || 'bg-gray-500';

  return (
    <button
      onClick={onClick}
      className="group text-left w-full focus:outline-none"
    >
      <div className="relative overflow-hidden bg-white dark:bg-gray-800 border-2 border-black dark:border-gray-600 hover:border-primary-500 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
        <div className={`absolute top-0 left-0 ${rankBg} text-white text-xs font-bold px-2 py-1`}>
          #{rank}
        </div>

        <div className="p-4 pt-8">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-bold text-gray-900 dark:text-gray-100 text-lg group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
              {stock.name}
            </h4>
            <span className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 text-gray-600 dark:text-gray-400">
              {stock.market}
            </span>
          </div>

          <p className="text-sm font-mono text-gray-500 dark:text-gray-400 mb-3">
            {stock.ticker}
          </p>

          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 rounded-full"
                style={{ width: `${Math.min((stock.mention_count || 0) * 10, 100)}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {stock.mention_count || 0}회 언급
            </span>
          </div>

          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
            {stock.reason}
          </p>
        </div>
      </div>
    </button>
  );
}

// 폴백 UI 컴포넌트
function FallbackUI({ status, errorMessage, onGenerate, onViewPrevious, generating, isManager }) {
  // 상태별 UI
  if (status === 'pending') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] bg-gray-50 dark:bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
        <div className="w-20 h-20 mb-6 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-900/30 dark:to-primary-800/30 flex items-center justify-center">
          <svg className="w-10 h-10 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          뉴스데스크 준비 중...
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6 text-center max-w-md">
          AI가 오늘의 뉴스를 분석하여 인사이트를 생성합니다.<br />
          매일 오전 5:30, 오후 5:30에 자동으로 업데이트됩니다.
        </p>
        {isManager && (
          <Button onClick={onGenerate} loading={generating} className="gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            지금 생성하기
          </Button>
        )}
      </div>
    );
  }

  if (status === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] bg-gradient-to-br from-primary-50 to-blue-50 dark:from-gray-800 dark:to-gray-900 rounded-lg border-2 border-primary-200 dark:border-primary-800">
        <div className="relative w-24 h-24 mb-6">
          {/* 회전 링 */}
          <div className="absolute inset-0 border-4 border-primary-200 dark:border-primary-800 rounded-full" />
          <div className="absolute inset-0 border-4 border-transparent border-t-primary-500 rounded-full animate-spin" />
          {/* 내부 아이콘 */}
          <div className="absolute inset-3 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-primary-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          AI가 분석 중입니다
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
          뉴스를 수집하고 인사이트를 생성하고 있습니다.<br />
          <span className="text-sm">약 1-2분 정도 소요됩니다...</span>
        </p>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] bg-red-50 dark:bg-red-900/10 rounded-lg border-2 border-red-200 dark:border-red-800">
        <div className="w-20 h-20 mb-6 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          뉴스데스크 생성 실패
        </h2>
        {errorMessage && (
          <p className="text-red-600 dark:text-red-400 mb-4 text-center max-w-md text-sm">
            {errorMessage}
          </p>
        )}
        <div className="flex gap-3">
          {isManager && (
            <Button onClick={onGenerate} loading={generating} className="gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              다시 시도
            </Button>
          )}
          <Button variant="secondary" onClick={onViewPrevious} className="gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            이전 뉴스데스크 보기
          </Button>
        </div>
      </div>
    );
  }

  // 기본: 데이터 없음
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] bg-gray-50 dark:bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
      <div className="w-20 h-20 mb-6 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center">
        <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        선택한 날짜의 뉴스데스크가 없습니다
      </h2>
      <p className="text-gray-500 dark:text-gray-400 mb-6 text-center max-w-md">
        다른 날짜를 선택하거나 새로 생성해주세요.
      </p>
      <Button variant="secondary" onClick={onViewPrevious} className="gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
        </svg>
        이전 기록 보기
      </Button>
    </div>
  );
}

// 사이드 패널용 문서 뷰어
function NewsDetailPanel({ content, onClose }) {
  if (!content) return null;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
        <h2 className="text-lg font-bold dark:text-gray-100">
          {content.type === 'column' ? 'AI 칼럼' : content.type === 'stock' ? '종목 분석' : '뉴스 상세'}
        </h2>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-xl font-bold mb-4 dark:text-gray-100">{content.title}</h3>

        {content.source && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            출처: {content.source}
          </p>
        )}

        <div className="prose dark:prose-invert max-w-none">
          {content.content || content.summary}
        </div>

        {content.url && (
          <a
            href={content.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-4 text-primary-600 hover:text-primary-700 text-sm"
          >
            원문 보기
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}

// 메인 뉴스데스크 컴포넌트
export function NewsDesk() {
  const { isManagerOrAdmin } = useAuth();
  const toast = useToast();
  const { isCurrentThemeDark } = useTheme();
  const { openPanel, closePanel } = useSidePanelStore();

  const [newsDesk, setNewsDesk] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedKeyword, setSelectedKeyword] = useState(null);
  const [selectedBenchmarks, setSelectedBenchmarks] = useState(['kospi', 'fund']);
  const [benchmarkPeriod, setBenchmarkPeriod] = useState('1M');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [history, setHistory] = useState([]);

  // 히스토리 로드
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await newsdeskService.getNewsDeskHistory(7);
        setHistory(data || []);
      } catch (error) {
        console.error('Failed to fetch history:', error);
      }
    };
    fetchHistory();
  }, []);

  // 날짜별 데이터 로드
  const fetchNewsDesk = useCallback(async (date) => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      let data;
      if (date === today) {
        data = await newsdeskService.getTodayNewsDesk();
      } else {
        data = await newsdeskService.getNewsDeskByDate(date);
      }
      setNewsDesk(data);
    } catch (error) {
      console.error('Failed to fetch newsdesk:', error);
      if (error.response?.status === 404) {
        setNewsDesk(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNewsDesk(selectedDate);
  }, [selectedDate, fetchNewsDesk]);

  // 날짜 변경
  const handleDateChange = (date) => {
    setSelectedDate(date);
  };

  // 이전 뉴스데스크 보기
  const handleViewPrevious = () => {
    if (history.length > 0) {
      const prev = history.find(h => h.date !== selectedDate);
      if (prev) {
        setSelectedDate(prev.date);
      }
    }
  };

  // 뉴스데스크 생성
  const handleGenerate = async () => {
    try {
      setGenerating(true);
      toast.info('뉴스데스크를 생성하고 있습니다. 잠시만 기다려주세요...');
      await newsdeskService.generateNewsDesk({ date: selectedDate, force: false });
      toast.success('뉴스데스크가 생성되었습니다!');
      fetchNewsDesk(selectedDate);
      // 히스토리도 갱신
      const updatedHistory = await newsdeskService.getNewsDeskHistory(7);
      setHistory(updatedHistory || []);
    } catch (error) {
      toast.error(error.response?.data?.detail || '뉴스데스크 생성에 실패했습니다.');
    } finally {
      setGenerating(false);
    }
  };

  // 벤치마크 토글
  const handleBenchmarkToggle = (id) => {
    setSelectedBenchmarks(prev =>
      prev.includes(id)
        ? prev.filter(b => b !== id)
        : [...prev, id]
    );
  };

  // 키워드 클릭
  const handleKeywordClick = (keyword) => {
    setSelectedKeyword(prev => prev === keyword ? null : keyword);
  };

  // 뉴스/칼럼 클릭 → 사이드패널
  const handleCardClick = (card, type) => {
    openPanel({
      type: 'custom',
      data: {
        render: () => (
          <NewsDetailPanel
            content={{ ...card, type }}
            onClose={closePanel}
          />
        )
      }
    });
  };

  // 로딩 상태
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 border-4 border-gray-200 dark:border-gray-700 rounded-full" />
            <div className="absolute inset-0 border-4 border-transparent border-t-primary-500 rounded-full animate-spin" />
          </div>
          <p className="text-gray-500 dark:text-gray-400">뉴스데스크 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // 폴백 UI 표시 조건
  const showFallback = !newsDesk || newsDesk.status === 'pending' || newsDesk.status === 'generating' || newsDesk.status === 'failed';

  if (showFallback) {
    return (
      <div className="space-y-6">
        {/* 헤더 */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            뉴스데스크
          </h1>
          <div className="flex items-center gap-3">
            <DatePicker
              selectedDate={selectedDate}
              onDateChange={handleDateChange}
              history={history}
            />
          </div>
        </div>

        <FallbackUI
          status={newsDesk?.status || 'empty'}
          errorMessage={newsDesk?.error_message}
          onGenerate={handleGenerate}
          onViewPrevious={handleViewPrevious}
          generating={generating}
          isManager={isManagerOrAdmin()}
        />
      </div>
    );
  }

  // 메인 렌더링
  const columns = newsDesk.columns || [];
  const newsCards = newsDesk.news_cards || [];
  const keywords = newsDesk.keywords || [];
  const sentiment = newsDesk.sentiment || {};
  const topStocks = newsDesk.top_stocks || [];

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            뉴스데스크
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {formatDate(newsDesk.publish_date, 'yyyy년 M월 d일')} 뉴스 분석
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DatePicker
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
            history={history}
          />
          {isManagerOrAdmin() && (
            <Button
              variant="secondary"
              onClick={handleGenerate}
              loading={generating}
              className="gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              새로고침
            </Button>
          )}
        </div>
      </div>

      {/* 벤치마크 토글 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BenchmarkToggles selected={selectedBenchmarks} onChange={handleBenchmarkToggle} />
      </div>

      {/* 벤치마크 차트 */}
      <BenchmarkChart
        selected={selectedBenchmarks}
        period={benchmarkPeriod}
        onPeriodChange={setBenchmarkPeriod}
      />

      {/* 메인 콘텐츠 영역 - 2컬럼 */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* 왼쪽: 뉴스 카드 (3/5) */}
        <div className="lg:col-span-3 space-y-4">
          {/* AI 칼럼 */}
          {columns.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <span className="w-6 h-6 bg-gradient-to-br from-amber-400 to-orange-500 rounded flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </span>
                AI 칼럼
              </h2>
              {columns.map((col, idx) => (
                <NewsCard
                  key={idx}
                  card={col}
                  type="column"
                  onClick={() => handleCardClick(col, 'column')}
                />
              ))}
            </div>
          )}

          {/* 뉴스 카드 */}
          {newsCards.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <span className="w-6 h-6 bg-gray-900 dark:bg-gray-100 rounded flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-white dark:text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9" />
                  </svg>
                </span>
                오늘의 주요 뉴스
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {newsCards.map((card, idx) => (
                  <NewsCard
                    key={idx}
                    card={card}
                    type="news"
                    onClick={() => handleCardClick(card, 'news')}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 오른쪽: 시각화 영역 (2/5) */}
        <div className="lg:col-span-2 space-y-4">
          {/* 키워드 버블 */}
          {keywords.length > 0 && (
            <div className="bg-white dark:bg-gray-800 border-2 border-black dark:border-gray-600 p-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100 mb-4">
                키워드 클라우드
              </h3>
              <div className="flex flex-wrap gap-3 justify-center py-4">
                {keywords.map((kw, idx) => (
                  <KeywordBubble
                    key={idx}
                    keyword={kw.keyword}
                    count={kw.count}
                    sentimentScore={kw.sentiment_score || 0}
                    isSelected={selectedKeyword === kw.keyword}
                    onClick={() => handleKeywordClick(kw.keyword)}
                    index={idx}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 감성 게이지 */}
          <SentimentGauge sentiment={sentiment} selectedKeyword={selectedKeyword} />
        </div>
      </div>

      {/* 주목 종목 TOP 3 */}
      {topStocks.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <span className="w-6 h-6 bg-gradient-to-br from-orange-400 to-red-500 rounded flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
              </svg>
            </span>
            오늘의 주목 종목 TOP 3
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {topStocks.slice(0, 3).map((stock, idx) => (
              <TopStockCard
                key={idx}
                stock={stock}
                rank={idx + 1}
                onClick={() => handleCardClick({ ...stock, title: stock.name }, 'stock')}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
