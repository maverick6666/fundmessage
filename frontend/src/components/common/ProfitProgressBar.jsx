import { formatPercent, getProfitLossClass } from '../../utils/formatters';

/**
 * 수익률을 프로그레스 바로 시각화하는 컴포넌트
 *
 * @param {number} value - 수익률 (소수점, 예: 0.15 = 15%)
 * @param {number} maxValue - 최대 표시 범위 (기본 0.3 = 30%)
 * @param {string} size - 바 크기 ('sm' | 'md' | 'lg')
 * @param {boolean} showValue - 수치 표시 여부
 */
export function ProfitProgressBar({
  value,
  maxValue = 0.3,
  size = 'md',
  showValue = true
}) {
  if (value == null) {
    return showValue ? <span className="text-gray-400">-</span> : null;
  }

  const isProfit = value > 0;
  const absValue = Math.abs(value);
  const normalized = Math.min(absValue, maxValue) / maxValue;
  const percentage = normalized * 100;

  // 크기별 스타일
  const sizeClasses = {
    sm: 'h-1.5 w-16',
    md: 'h-2 w-20',
    lg: 'h-2.5 w-24',
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base font-medium',
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`${sizeClasses[size]} bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden`}>
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isProfit
              ? 'bg-red-500 dark:bg-red-400'
              : 'bg-blue-500 dark:bg-blue-400'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showValue && (
        <span className={`${textSizeClasses[size]} ${getProfitLossClass(value)} font-medium whitespace-nowrap`}>
          {isProfit ? '+' : ''}{formatPercent(value)}
        </span>
      )}
    </div>
  );
}

/**
 * 컴팩트한 수익률 표시 (바 없이 색상만)
 */
export function ProfitBadge({ value, size = 'md' }) {
  if (value == null) {
    return <span className="text-gray-400">-</span>;
  }

  const isProfit = value > 0;
  const textSizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-0.5',
    lg: 'text-base px-2.5 py-1',
  };

  const bgClass = isProfit
    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
    : value < 0
      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';

  return (
    <span className={`${textSizeClasses[size]} ${bgClass} rounded font-medium`}>
      {isProfit ? '+' : ''}{formatPercent(value)}
    </span>
  );
}
