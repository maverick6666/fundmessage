import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createChart } from 'lightweight-charts';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { newsdeskService } from '../services/newsdeskService';
import { commentService } from '../services/commentService';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { useSidePanelStore } from '../stores/useSidePanelStore';
import { Button } from '../components/common/Button';
import { formatDate, getEffectiveNewsDeskDate, getKSTToday, getKSTHour } from '../utils/formatters';

// 미니 캘린더 날짜 선택기 컴포넌트
function MiniCalendarPicker({ selectedDate, onDateChange, history }) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date(selectedDate);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const calendarRef = useRef(null);

  const todayKST = getKSTToday();

  // history에서 뉴스데스크 존재하는 날짜 Set 생성
  const existingDates = useMemo(() => {
    if (!Array.isArray(history)) return new Set();
    return new Set(history.map(h => h.publish_date));
  }, [history]);

  // 외부 클릭 시 캘린더 닫기
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target)) {
        setShowCalendar(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 날짜 이동 (화살표 버튼)
  const moveDate = (direction) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + direction);
    const dateStr = current.toISOString().split('T')[0];
    if (dateStr <= todayKST) {
      onDateChange(dateStr);
      setViewDate({ year: current.getFullYear(), month: current.getMonth() });
    }
  };

  // 월 이동
  const moveMonth = (direction) => {
    setViewDate(prev => {
      let newMonth = prev.month + direction;
      let newYear = prev.year;
      if (newMonth < 0) {
        newMonth = 11;
        newYear--;
      } else if (newMonth > 11) {
        newMonth = 0;
        newYear++;
      }
      return { year: newYear, month: newMonth };
    });
  };

  // 해당 월의 날짜 배열 생성
  const getDaysInMonth = () => {
    const { year, month } = viewDate;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const days = [];
    // 이전 달 빈 칸
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    // 현재 달 날짜들
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  };

  // 날짜 문자열 생성
  const getDateStr = (day) => {
    if (!day) return null;
    const { year, month } = viewDate;
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  // 날짜 상태 확인
  const getDayStatus = (day) => {
    if (!day) return { disabled: true };
    const dateStr = getDateStr(day);
    const isToday = dateStr === todayKST;
    const isFuture = dateStr > todayKST;
    const isSelected = dateStr === selectedDate;
    const hasNewsDesk = existingDates.has(dateStr);

    // 7일 이전 체크
    const sevenDaysAgo = new Date(todayKST);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
    const isOlderThan7Days = dateStr < sevenDaysAgoStr;

    return {
      isToday,
      isFuture,
      isSelected,
      hasNewsDesk,
      isOlderThan7Days,
      disabled: isFuture
    };
  };

  // 날짜 클릭 핸들러
  const handleDayClick = (day) => {
    const dateStr = getDateStr(day);
    const status = getDayStatus(day);
    if (!status.disabled) {
      onDateChange(dateStr);
      setShowCalendar(false);
    }
  };

  const formatDisplayDate = (dateStr) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
  const days = getDaysInMonth();

  // 현재 월이 오늘이 포함된 월인지
  const today = new Date(todayKST);
  const isCurrentMonthView = viewDate.year === today.getFullYear() && viewDate.month === today.getMonth();

  // 다음 월 버튼 비활성화 (미래 월 방지)
  const canGoNext = !isCurrentMonthView || viewDate.month < today.getMonth() || viewDate.year < today.getFullYear();

  return (
    <div className="relative" ref={calendarRef}>
      <div className="flex items-center gap-1">
        {/* 이전 날짜 버튼 */}
        <button
          onClick={() => moveDate(-1)}
          className="w-8 h-8 flex items-center justify-center border-2 border-black dark:border-gray-500 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* 날짜 표시 & 캘린더 트리거 */}
        <button
          onClick={() => {
            setShowCalendar(!showCalendar);
            // 캘린더 열 때 선택된 날짜의 월로 이동
            if (!showCalendar) {
              const d = new Date(selectedDate);
              setViewDate({ year: d.getFullYear(), month: d.getMonth() });
            }
          }}
          className="flex items-center gap-2 px-4 h-8 border-2 border-black dark:border-gray-500 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-mono font-bold text-sm"
        >
          {formatDisplayDate(selectedDate)}
          <svg className={`w-3 h-3 transition-transform ${showCalendar ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* 다음 날짜 버튼 */}
        <button
          onClick={() => moveDate(1)}
          disabled={selectedDate >= todayKST}
          className="w-8 h-8 flex items-center justify-center border-2 border-black dark:border-gray-500 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 미니 캘린더 드롭다운 */}
      {showCalendar && (
        <div className="absolute top-full right-0 mt-2 z-50 bg-white dark:bg-gray-800 border-2 border-black dark:border-gray-600 shadow-xl w-72 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* 월 네비게이션 헤더 */}
          <div className="flex items-center justify-between px-3 py-2 border-b-2 border-black dark:border-gray-600 bg-gray-50 dark:bg-gray-900">
            <button
              onClick={() => moveMonth(-1)}
              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="font-bold text-sm tracking-wide">
              {viewDate.year}년 {viewDate.month + 1}월
            </span>
            <button
              onClick={() => moveMonth(1)}
              disabled={isCurrentMonthView}
              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
            {weekDays.map((day, i) => (
              <div
                key={day}
                className={`text-center text-xs font-medium py-2 ${
                  i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div className="grid grid-cols-7 p-2 gap-0.5">
            {days.map((day, i) => {
              const status = getDayStatus(day);
              const dayOfWeek = i % 7;

              return (
                <button
                  key={i}
                  onClick={() => day && handleDayClick(day)}
                  disabled={!day || status.disabled}
                  className={`
                    aspect-square flex flex-col items-center justify-center text-sm relative
                    transition-all duration-150 rounded
                    ${!day ? 'cursor-default' : ''}
                    ${status.disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
                    ${status.isSelected
                      ? 'bg-black dark:bg-white text-white dark:text-black font-bold'
                      : status.isToday
                        ? 'ring-2 ring-primary-500 ring-inset font-bold'
                        : status.isFuture
                          ? 'text-gray-300 dark:text-gray-600'
                          : status.isOlderThan7Days
                            ? 'text-gray-400 dark:text-gray-500 opacity-60'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }
                    ${day && dayOfWeek === 0 && !status.isSelected ? 'text-red-500' : ''}
                    ${day && dayOfWeek === 6 && !status.isSelected ? 'text-blue-500' : ''}
                  `}
                  title={status.isOlderThan7Days ? '7일 이전 (생성 불가)' : status.hasNewsDesk ? '뉴스데스크 있음' : ''}
                >
                  {day && (
                    <>
                      <span>{day}</span>
                      {/* 뉴스데스크 존재 표시 (초록색 점) */}
                      {status.hasNewsDesk && (
                        <div className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${status.isSelected ? 'bg-white dark:bg-black' : 'bg-emerald-500'}`} />
                      )}
                      {/* 7일 이전 표시 (회색 점선) */}
                      {status.isOlderThan7Days && !status.hasNewsDesk && (
                        <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full border border-gray-400 dark:border-gray-500" />
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>

          {/* 범례 */}
          <div className="flex items-center justify-center gap-4 px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>존재</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full border border-gray-400" />
              <span>생성 불가</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 ring-2 ring-primary-500 ring-inset rounded" />
              <span>오늘</span>
            </div>
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
    if (!chartContainerRef.current || chartContainerRef.current.clientWidth === 0) return;

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
      },
      // TradingView 로고 제거
      watermark: {
        visible: false,
      },
      attributionLogo: false,
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
      const firstValue = points[0]?.value;
      if (!firstValue) return points.map(p => ({ time: p.time, value: p.value }));
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
      {/* TradingView 로고 CSS 숨김 */}
      <style>{`
        .tv-lightweight-charts a[href*="tradingview"],
        .tv-lightweight-charts a[target="_blank"],
        [class*="tv-lightweight-charts"] a {
          display: none !important;
        }
      `}</style>
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

      {/* 차트 영역 - TradingView 로고 숨김 */}
      <div className="relative [&_a[href*='tradingview']]:hidden [&_a[target='_blank']]:hidden">
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
        <div ref={chartContainerRef} className="h-[220px]" />
      </div>

      {/* 범례 - 선택된 벤치마크 표시 */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {selected.map((id) => (
          <div key={id} className="flex items-center gap-1.5">
            <div
              className="w-3 h-0.5 rounded-full"
              style={{ backgroundColor: colors[id] }}
            />
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {id === 'kospi' && '코스피'}
              {id === 'nasdaq' && '나스닥'}
              {id === 'sp500' && 'S&P500'}
              {id === 'fund' && '우리팀'}
            </span>
          </div>
        ))}
        {selected.length > 1 && (
          <span className="ml-auto px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] text-gray-500 dark:text-gray-400">
            수익률 비교 모드
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

// 키워드 트리맵 타일 컴포넌트 (탐욕/공포 스타일)
function KeywordTile({ keyword, count, greedScore, category, isSelected, onClick, index, totalCount }) {
  // greedScore: 0.0 (극도의 공포) ~ 1.0 (극도의 탐욕)
  const score = greedScore ?? 0.5;

  // 크기 계산 (count 기반, 전체 비율로 조정)
  const minSize = 1;
  const maxSize = 3;
  const sizeRatio = Math.min(count / Math.max(totalCount * 0.3, 1), 1);
  const flexGrow = minSize + (maxSize - minSize) * sizeRatio;

  // 탐욕/공포 색상 (초록 ~ 빨강 그라데이션)
  const getGreedFearColor = () => {
    if (score >= 0.7) return 'bg-emerald-500/90 text-white border-emerald-600';
    if (score >= 0.55) return 'bg-emerald-400/80 text-white border-emerald-500';
    if (score >= 0.45) return 'bg-slate-400/70 text-white border-slate-500';
    if (score >= 0.3) return 'bg-rose-400/80 text-white border-rose-500';
    return 'bg-rose-500/90 text-white border-rose-600';
  };

  // 감성 라벨
  const getSentimentLabel = () => {
    if (score >= 0.7) return '극도의 탐욕';
    if (score >= 0.55) return '탐욕';
    if (score >= 0.45) return '중립';
    if (score >= 0.3) return '공포';
    return '극도의 공포';
  };

  const selectedStyle = isSelected
    ? 'ring-2 ring-offset-1 ring-black dark:ring-white scale-[1.02] z-10'
    : 'hover:scale-[1.01] hover:z-10';

  return (
    <button
      onClick={onClick}
      className={`
        relative flex flex-col items-center justify-center p-3 min-h-[72px]
        border-2 transition-all duration-200 cursor-pointer
        ${getGreedFearColor()} ${selectedStyle}
      `}
      style={{
        flex: `${flexGrow} 1 0`,
        animationDelay: `${index * 50}ms`
      }}
      title={`${keyword}: ${getSentimentLabel()} (${Math.round(score * 100)}점)`}
    >
      <span
        className="text-xs font-bold text-center leading-tight break-words hyphens-auto"
        style={{ wordBreak: 'break-word' }}
      >
        {keyword}
      </span>
      <div className="flex items-center gap-1.5 mt-1">
        <span className="text-xs opacity-80">{count}회</span>
        {category && (
          <span className="text-[10px] px-1.5 py-0.5 bg-black/20 rounded">
            {category}
          </span>
        )}
      </div>
      {/* 감성 인디케이터 바 */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/10">
        <div
          className="h-full bg-white/40 transition-all duration-300"
          style={{ width: `${score * 100}%` }}
        />
      </div>
    </button>
  );
}

// 탐욕/공포 게이지 컴포넌트 (Fear & Greed Index 스타일)
function GreedFearGauge({ sentiment, selectedKeyword }) {
  // 새로운 스키마: greed_ratio, fear_ratio, overall_score
  const greedRatio = sentiment?.greed_ratio ?? 0.5;
  const fearRatio = sentiment?.fear_ratio ?? 0.5;
  const overallScore = sentiment?.overall_score ?? 50;
  const topGreed = sentiment?.top_greed || [];
  const topFear = sentiment?.top_fear || [];

  // 점수에 따른 라벨
  const getScoreLabel = (score) => {
    if (score >= 75) return { text: '극도의 탐욕', color: 'text-emerald-500' };
    if (score >= 55) return { text: '탐욕', color: 'text-emerald-400' };
    if (score >= 45) return { text: '중립', color: 'text-slate-400' };
    if (score >= 25) return { text: '공포', color: 'text-rose-400' };
    return { text: '극도의 공포', color: 'text-rose-500' };
  };

  const label = getScoreLabel(overallScore);

  // 게이지 포인터 위치 (0~100 → 0%~100%)
  const pointerPosition = `${overallScore}%`;

  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-black dark:border-gray-600 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100">
          탐욕/공포 지수
        </h3>
        {selectedKeyword && (
          <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded font-medium">
            {selectedKeyword}
          </span>
        )}
      </div>

      {/* 메인 점수 표시 */}
      <div className="text-center mb-4">
        <div className="text-4xl font-black tabular-nums text-gray-900 dark:text-gray-100">
          {overallScore}
        </div>
        <div className={`text-sm font-bold ${label.color}`}>
          {label.text}
        </div>
      </div>

      {/* 게이지 바 */}
      <div className="relative h-6 rounded-full overflow-hidden bg-gradient-to-r from-rose-500 via-slate-400 to-emerald-500">
        {/* 포인터 */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-white shadow-lg transition-all duration-500 ease-out"
          style={{ left: pointerPosition, transform: 'translateX(-50%)' }}
        >
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-white" />
        </div>
      </div>

      {/* 스케일 라벨 */}
      <div className="flex justify-between mt-1.5 text-[10px] text-gray-500 dark:text-gray-400">
        <span>0</span>
        <span>25</span>
        <span>50</span>
        <span>75</span>
        <span>100</span>
      </div>

      {/* 비율 바 */}
      <div className="flex gap-2 mt-4">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-rose-500 font-medium">공포</span>
            <span className="text-xs text-gray-500">{Math.round(fearRatio * 100)}%</span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-rose-500 rounded-full transition-all duration-500"
              style={{ width: `${fearRatio * 100}%` }}
            />
          </div>
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-emerald-500 font-medium">탐욕</span>
            <span className="text-xs text-gray-500">{Math.round(greedRatio * 100)}%</span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${greedRatio * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* 탐욕/공포 요인 */}
      {(topGreed.length > 0 || topFear.length > 0) && (
        <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
          {topFear.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-rose-500 uppercase mb-1.5">공포 요인</div>
              <ul className="space-y-1">
                {topFear.slice(0, 3).map((item, idx) => (
                  <li key={idx} className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-rose-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {topGreed.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-emerald-500 uppercase mb-1.5">탐욕 요인</div>
              <ul className="space-y-1">
                {topGreed.slice(0, 3).map((item, idx) => (
                  <li key={idx} className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-emerald-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
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

          <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base leading-tight mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
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

// 주목 종목 카드 컴포넌트 (개선된 디자인)
function TopStockCard({ stock, rank, onClick }) {
  // 순위별 메달 색상
  const rankStyles = {
    1: { bg: 'bg-amber-500', icon: '🥇', gradient: 'from-amber-400 to-amber-600' },
    2: { bg: 'bg-slate-400', icon: '🥈', gradient: 'from-slate-300 to-slate-500' },
    3: { bg: 'bg-orange-600', icon: '🥉', gradient: 'from-orange-500 to-orange-700' }
  };
  const style = rankStyles[rank] || { bg: 'bg-gray-500', icon: '', gradient: 'from-gray-400 to-gray-600' };

  // 등락률 색상
  const priceChange = stock.price_change || 0;
  const isPositive = priceChange > 0;
  const isNegative = priceChange < 0;
  const changeColor = isPositive ? 'text-emerald-500' : isNegative ? 'text-rose-500' : 'text-gray-500';
  const changePrefix = isPositive ? '+' : '';

  // 감성 색상
  const sentimentStyles = {
    'positive': { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', label: '탐욕' },
    'negative': { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-300', label: '공포' },
    'neutral': { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-400', label: '중립' }
  };
  const sentimentStyle = sentimentStyles[stock.sentiment] || sentimentStyles.neutral;

  return (
    <button
      onClick={onClick}
      className="group text-left w-full focus:outline-none"
    >
      <div className="relative overflow-hidden bg-white dark:bg-gray-800 border-2 border-black dark:border-gray-600 hover:border-primary-500 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
        {/* 상단 그라데이션 바 */}
        <div className={`h-1.5 bg-gradient-to-r ${style.gradient}`} />

        <div className="p-4">
          {/* 헤더: 순위 + 종목명 + 마켓 */}
          <div className="flex items-start gap-3 mb-3">
            <div className={`w-8 h-8 ${style.bg} rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0`}>
              {rank}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-gray-900 dark:text-gray-100 text-base leading-tight group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
                {stock.name}
              </h4>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                  {stock.ticker}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded">
                  {stock.market}
                </span>
              </div>
            </div>
          </div>

          {/* 메트릭스: 등락률 + 언급횟수 */}
          <div className="flex items-center gap-3 mb-3">
            {/* 등락률 */}
            {priceChange !== 0 && (
              <div className={`flex items-center gap-1 text-sm font-bold ${changeColor}`}>
                <svg className={`w-3.5 h-3.5 ${isNegative ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
                {changePrefix}{Math.abs(priceChange).toFixed(1)}%
              </div>
            )}

            {/* 언급횟수 뱃지 */}
            <div className="flex items-center gap-1 px-2 py-0.5 bg-primary-50 dark:bg-primary-900/30 rounded-full">
              <svg className="w-3 h-3 text-primary-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" clipRule="evenodd" />
              </svg>
              <span className="text-xs font-medium text-primary-600 dark:text-primary-400">
                {stock.mention_count || 0}회
              </span>
            </div>

            {/* 감성 뱃지 */}
            <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${sentimentStyle.bg} ${sentimentStyle.text}`}>
              {sentimentStyle.label}
            </div>
          </div>

          {/* 사유 */}
          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
            {stock.reason}
          </p>
        </div>

        {/* 호버 시 화살표 */}
        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <svg className="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </button>
  );
}

// 폴백 UI 컴포넌트
function FallbackUI({ status, errorMessage, onViewPrevious, selectedDate, isBeforeSix }) {
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
        <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
          AI가 오늘의 뉴스를 분석하여 인사이트를 생성합니다.<br />
          매일 오전 6시에 자동으로 업데이트됩니다.
        </p>
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
        <p className="text-gray-500 dark:text-gray-400 mb-6 text-center max-w-md text-sm">
          다음 자동 생성 시 재시도됩니다.
        </p>
        <Button variant="secondary" onClick={onViewPrevious} className="gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          이전 뉴스데스크 보기
        </Button>
      </div>
    );
  }

  // 6시 이전 오늘 날짜: 새벽 안내
  if (status === 'empty' && selectedDate === getKSTToday() && isBeforeSix) {
    return (
      <div className="relative flex flex-col items-center justify-center min-h-[400px] rounded-lg border border-amber-200/60 dark:border-amber-700/30 overflow-hidden">
        {/* 새벽 그라데이션 배경 */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-amber-950/80 to-amber-800/60 dark:from-slate-950 dark:via-amber-950/60 dark:to-amber-900/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-orange-400/20 via-transparent to-transparent" />

        {/* 수평선 */}
        <div className="absolute bottom-[38%] left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />

        {/* 일출 SVG */}
        <div className="relative z-10 mb-5 newsdesk-sunrise-icon">
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
            {/* 광선 */}
            <g className="newsdesk-sun-rays" opacity="0.6">
              <line x1="40" y1="12" x2="40" y2="20" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
              <line x1="56" y1="17" x2="52" y2="24" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
              <line x1="24" y1="17" x2="28" y2="24" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
              <line x1="64" y1="28" x2="58" y2="32" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="16" y1="28" x2="22" y2="32" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" />
            </g>
            {/* 반원 태양 */}
            <path d="M24 48 A16 16 0 0 1 56 48" fill="url(#sunGrad)" />
            {/* 수평선 */}
            <line x1="10" y1="48" x2="70" y2="48" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
            <defs>
              <linearGradient id="sunGrad" x1="40" y1="48" x2="40" y2="28" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#fbbf24" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* 텍스트 */}
        <h2 className="relative z-10 text-xl font-bold text-amber-50 mb-2 tracking-tight">
          오늘의 뉴스데스크는 오전 6시에 공개됩니다
        </h2>
        <p className="relative z-10 text-amber-200/70 text-sm text-center max-w-sm leading-relaxed">
          AI가 어제 시장과 오늘 새벽 뉴스를 분석하고 있습니다
        </p>
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
        다른 날짜를 선택해주세요.
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

// 사이드 패널용 문서 뷰어 (마크다운 렌더링)
function NewsDetailPanel({ content, documentId, onClose }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    if (documentId) fetchComments();
  }, [documentId]);

  const fetchComments = async () => {
    if (!documentId) return;
    setCommentsLoading(true);
    try {
      const data = await commentService.getComments({
        document_type: 'news',
        document_id: documentId,
      });
      setComments(Array.isArray(data) ? data : (data?.comments || []));
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !documentId) return;
    try {
      await commentService.createComment({
        document_type: 'news',
        document_id: documentId,
        content: newComment.trim(),
      });
      setNewComment('');
      fetchComments();
    } catch (error) {
      console.error('Failed to create comment:', error);
    }
  };

  const handleEditComment = async (commentId) => {
    if (!editContent.trim()) return;
    try {
      await commentService.updateComment(commentId, editContent.trim());
      setEditingId(null);
      setEditContent('');
      fetchComments();
    } catch (error) {
      console.error('Failed to update comment:', error);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await commentService.deleteComment(commentId);
      fetchComments();
    } catch (error) {
      console.error('Failed to delete comment:', error);
    }
  };

  if (!content) return null;

  const bodyContent = content.content || content.detail || content.summary || '';

  // 종목 분석의 경우 detail 필드 사용
  const displayContent = content.type === 'stock' ? (content.detail || content.reason || '') : bodyContent;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center gap-2">
          {content.type === 'column' && (
            <span className="w-6 h-6 bg-gradient-to-br from-amber-400 to-orange-500 rounded flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </span>
          )}
          {content.type === 'stock' && (
            <span className="w-6 h-6 bg-gradient-to-br from-orange-400 to-red-500 rounded flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
              </svg>
            </span>
          )}
          {content.type === 'news' && (
            <span className="w-6 h-6 bg-gray-900 dark:bg-gray-100 rounded flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white dark:text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9" />
              </svg>
            </span>
          )}
          <h2 className="text-lg font-bold dark:text-gray-100">
            {content.type === 'column' ? 'AI 칼럼' : content.type === 'stock' ? '종목 분석' : '뉴스 상세'}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {/* 제목 */}
        <h3 className="text-xl font-bold mb-3 dark:text-gray-100 leading-tight">
          {content.title || content.name}
        </h3>

        {/* 메타 정보 */}
        <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
          {content.source && (
            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
              {content.source}
            </span>
          )}
          {content.category && (
            <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded">
              {content.category}
            </span>
          )}
          {content.market && (
            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded font-mono text-xs">
              {content.market}
            </span>
          )}
          {content.ticker && (
            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded font-mono text-xs">
              {content.ticker}
            </span>
          )}
        </div>

        {/* 본문 - 마크다운 렌더링 */}
        <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-bold prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-strong:text-gray-900 dark:prose-strong:text-gray-100 prose-ul:text-gray-700 dark:prose-ul:text-gray-300 prose-ol:text-gray-700 dark:prose-ol:text-gray-300">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {displayContent}
          </ReactMarkdown>
        </div>

        {/* 관련 뉴스 (종목의 경우) */}
        {content.related_news && content.related_news.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">관련 뉴스</h4>
            <ul className="space-y-2">
              {content.related_news.map((news, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <span className="text-primary-500 mt-0.5">•</span>
                  <span>{news}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 키워드 */}
        {content.keywords && content.keywords.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap gap-2">
              {content.keywords.map((kw, idx) => (
                <span key={idx} className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                  #{kw}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 원문 링크 */}
        {content.url && (
          <a
            href={content.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-6 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 text-sm font-medium"
          >
            원문 보기
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}

        {/* 댓글 섹션 */}
        {documentId && (
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              의견 {comments.length > 0 ? `(${comments.length})` : ''}
            </h4>

            {/* 댓글 입력 */}
            <form onSubmit={handleSubmitComment} className="flex gap-2 mb-4">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="의견을 남겨보세요..."
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <button
                type="submit"
                disabled={!newComment.trim()}
                className="px-3 py-2 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                등록
              </button>
            </form>

            {/* 댓글 목록 */}
            {commentsLoading ? (
              <div className="text-center py-4 text-sm text-gray-400">로딩중...</div>
            ) : comments.length === 0 ? (
              <div className="text-center py-6 text-sm text-gray-400 dark:text-gray-500">
                아직 의견이 없습니다
              </div>
            ) : (
              <div className="space-y-3">
                {comments.map((comment) => {
                  const isAuthor = comment.user_id === user?.id;
                  return (
                    <div key={comment.id} className="group">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-xs font-medium text-white">
                          {comment.user?.full_name?.charAt(0) || '?'}
                        </div>
                        <span className="text-sm font-medium dark:text-gray-200">
                          {comment.user?.full_name || '알 수 없음'}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(comment.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          {comment.updated_at && comment.updated_at !== comment.created_at && (
                            <span className="ml-1 opacity-70">(수정됨)</span>
                          )}
                        </span>
                        {isAuthor && editingId !== comment.id && (
                          <div className="ml-auto opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                            <button
                              onClick={() => { setEditingId(comment.id); setEditContent(comment.content); }}
                              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                              수정
                            </button>
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              className="text-xs text-red-400 hover:text-red-600"
                            >
                              삭제
                            </button>
                          </div>
                        )}
                      </div>
                      {editingId === comment.id ? (
                        <div className="ml-8 flex gap-2">
                          <input
                            type="text"
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="flex-1 px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none"
                            autoFocus
                            onKeyDown={(e) => { if (e.key === 'Enter') handleEditComment(comment.id); if (e.key === 'Escape') setEditingId(null); }}
                          />
                          <button onClick={() => handleEditComment(comment.id)} className="text-xs text-primary-500 hover:text-primary-600 font-medium">저장</button>
                          <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 hover:text-gray-600">취소</button>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-700 dark:text-gray-300 ml-8 leading-relaxed">
                          {comment.content}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// 메인 뉴스데스크 컴포넌트
export function NewsDesk() {
  const { isCurrentThemeDark } = useTheme();
  const { openPanel, closePanel } = useSidePanelStore();

  const [newsDesk, setNewsDesk] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedKeyword, setSelectedKeyword] = useState(null);
  const [selectedBenchmarks, setSelectedBenchmarks] = useState(['kospi', 'fund']);
  const [benchmarkPeriod, setBenchmarkPeriod] = useState('1M');
  const [selectedDate, setSelectedDate] = useState(() => getEffectiveNewsDeskDate());
  const [history, setHistory] = useState([]);

  // 히스토리 로드
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await newsdeskService.getNewsDeskHistory(30);
        setHistory(data?.items || []);
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
      // 항상 날짜별 엔드포인트 사용 (시간대 불일치 방지)
      const data = await newsdeskService.getNewsDeskByDate(date);
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
      const prev = history.find(h => h.publish_date !== selectedDate);
      if (prev) {
        setSelectedDate(prev.publish_date);
      }
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
  const handleCardClick = (card, type, cardIndex = 0) => {
    const documentId = newsDesk?.id ? newsDesk.id * 100 + cardIndex : null;
    openPanel({
      type: 'custom',
      data: {
        render: () => (
          <NewsDetailPanel
            content={{ ...card, type }}
            documentId={documentId}
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
            <MiniCalendarPicker
              selectedDate={selectedDate}
              onDateChange={handleDateChange}
              history={history}
            />
          </div>
        </div>

        <FallbackUI
          status={newsDesk?.status || 'empty'}
          errorMessage={newsDesk?.error_message}
          onViewPrevious={handleViewPrevious}
          selectedDate={selectedDate}
          isBeforeSix={getKSTHour() < 6}
        />
      </div>
    );
  }

  // 메인 렌더링 (방어적 데이터 처리)
  const columns = Array.isArray(newsDesk.columns) ? newsDesk.columns : [];
  const newsCards = Array.isArray(newsDesk.news_cards) ? newsDesk.news_cards : [];
  const keywords = Array.isArray(newsDesk.keywords) ? newsDesk.keywords : [];
  const sentiment = (newsDesk.sentiment && typeof newsDesk.sentiment === 'object' && !Array.isArray(newsDesk.sentiment)) ? newsDesk.sentiment : {};
  const topStocks = Array.isArray(newsDesk.top_stocks) ? newsDesk.top_stocks : [];

  // 키워드별 감성 맵 (키워드 클릭 시 게이지 업데이트용)
  const keywordSentimentMap = {};
  keywords.forEach(k => {
    keywordSentimentMap[k.keyword] = {
      greed_ratio: k.greed_score || 0.5,
      fear_ratio: 1 - (k.greed_score || 0.5),
      overall_score: Math.round((k.greed_score || 0.5) * 100),
      top_greed: k.top_greed || [],
      top_fear: k.top_fear || []
    };
  });

  // 선택된 키워드가 있으면 해당 감성 데이터 사용
  const displaySentiment = selectedKeyword && keywordSentimentMap[selectedKeyword]
    ? keywordSentimentMap[selectedKeyword]
    : sentiment;

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
          <MiniCalendarPicker
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
            history={history}
          />
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

      {/* 메인 콘텐츠 영역 - 2컬럼 (동일 높이 시작) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* 왼쪽: 뉴스 카드 그리드 (3/5) */}
        <div className="lg:col-span-3 space-y-6">
          {/* AI 칼럼 섹션 */}
          {columns.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <span className="w-6 h-6 bg-gradient-to-br from-amber-500 to-orange-500 rounded flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </span>
                AI 칼럼
                <span className="text-xs font-normal text-amber-600 dark:text-amber-400 ml-1">
                  ({columns.length})
                </span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {columns.map((col, idx) => (
                  <NewsCard
                    key={`col-${idx}`}
                    card={col}
                    type="column"
                    onClick={() => handleCardClick(col, 'column', idx)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 뉴스 섹션 */}
          {newsCards.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <span className="w-6 h-6 bg-gray-900 dark:bg-gray-100 rounded flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-white dark:text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9" />
                  </svg>
                </span>
                오늘의 뉴스
                <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-1">
                  ({newsCards.length})
                </span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {newsCards.map((card, idx) => (
                  <NewsCard
                    key={`news-${idx}`}
                    card={card}
                    type="news"
                    onClick={() => handleCardClick(card, 'news', 20 + idx)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 둘 다 없는 경우 */}
          {columns.length === 0 && newsCards.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9" />
              </svg>
              <p className="text-sm">오늘의 콘텐츠가 없습니다</p>
            </div>
          )}
        </div>

        {/* 오른쪽: 시각화 영역 (2/5) - 같은 높이에서 시작 */}
        <div className="lg:col-span-2 space-y-4">
          {/* 탐욕/공포 게이지 */}
          <GreedFearGauge sentiment={displaySentiment} selectedKeyword={selectedKeyword} />

          {/* 키워드 트리맵 */}
          {keywords.length > 0 && (
            <div className="bg-white dark:bg-gray-800 border-2 border-black dark:border-gray-600 p-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100 mb-3">
                키워드 히트맵
              </h3>
              <div className="flex flex-wrap gap-1">
                {keywords.map((kw, idx) => (
                  <KeywordTile
                    key={idx}
                    keyword={kw.keyword}
                    count={kw.count}
                    greedScore={kw.greed_score}
                    category={kw.category}
                    isSelected={selectedKeyword === kw.keyword}
                    onClick={() => handleKeywordClick(kw.keyword)}
                    index={idx}
                    totalCount={keywords.reduce((sum, k) => sum + k.count, 0)}
                  />
                ))}
              </div>
              {/* 범례 */}
              <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400">
                  <div className="w-3 h-3 bg-rose-500 rounded-sm" />
                  <span>공포</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400">
                  <div className="w-3 h-3 bg-slate-400 rounded-sm" />
                  <span>중립</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400">
                  <div className="w-3 h-3 bg-emerald-500 rounded-sm" />
                  <span>탐욕</span>
                </div>
              </div>
            </div>
          )}
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
                onClick={() => handleCardClick({ ...stock, title: stock.name }, 'stock', 50 + idx)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
