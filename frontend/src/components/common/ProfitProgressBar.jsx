import { formatPercent, formatCurrency, getProfitLossClass } from '../../utils/formatters';

/**
 * 타겟 기반 프로그레스 계산 유틸 함수
 *
 * @param {number} currentPrice - 현재가
 * @param {number} averagePrice - 평균 매입가
 * @param {Array} takeProfitTargets - 익절 타겟 [{price, quantity, completed}]
 * @param {Array} stopLossTargets - 손절 타겟 [{price, quantity, completed}]
 * @returns {{ progress: number, direction: 'profit' | 'loss' | 'neutral', targetInfo: object | null }}
 */
export function calculateTargetProgress(currentPrice, averagePrice, takeProfitTargets = [], stopLossTargets = []) {
  const validTpTargets = (takeProfitTargets || []).filter(t => t.price && !t.completed);
  const validSlTargets = (stopLossTargets || []).filter(t => t.price && !t.completed);

  if (!currentPrice || !averagePrice) {
    return { progress: 0, direction: 'neutral', targetInfo: null };
  }

  if (validTpTargets.length === 0 && validSlTargets.length === 0) {
    return { progress: 0, direction: 'neutral', targetInfo: null };
  }

  const sortedTpTargets = [...validTpTargets].sort((a, b) => a.price - b.price);
  const sortedSlTargets = [...validSlTargets].sort((a, b) => b.price - a.price);

  const isProfit = currentPrice > averagePrice;

  let progress = 0;
  let targetInfo = null;
  let direction = 'neutral';

  if (isProfit && sortedTpTargets.length > 0) {
    direction = 'profit';
    let accumulatedProgress = 0;
    const progressPerTarget = 100 / sortedTpTargets.length;

    for (let i = 0; i < sortedTpTargets.length; i++) {
      const target = sortedTpTargets[i];
      const prevPrice = i === 0 ? averagePrice : sortedTpTargets[i - 1].price;

      if (currentPrice >= target.price) {
        accumulatedProgress += progressPerTarget;
      } else {
        const rangeTotal = target.price - prevPrice;
        const rangeCurrent = currentPrice - prevPrice;
        const rangeProgress = rangeTotal > 0 ? (rangeCurrent / rangeTotal) * progressPerTarget : 0;
        accumulatedProgress += Math.max(0, rangeProgress);
        targetInfo = { index: i + 1, price: target.price, total: sortedTpTargets.length };
        break;
      }
    }

    progress = Math.min(100, accumulatedProgress);
    if (!targetInfo && sortedTpTargets.length > 0) {
      targetInfo = { index: sortedTpTargets.length, price: sortedTpTargets[sortedTpTargets.length - 1].price, total: sortedTpTargets.length, completed: true };
    }
  } else if (!isProfit && sortedSlTargets.length > 0) {
    direction = 'loss';
    let accumulatedProgress = 0;
    const progressPerTarget = 100 / sortedSlTargets.length;

    for (let i = 0; i < sortedSlTargets.length; i++) {
      const target = sortedSlTargets[i];
      const prevPrice = i === 0 ? averagePrice : sortedSlTargets[i - 1].price;

      if (currentPrice <= target.price) {
        accumulatedProgress += progressPerTarget;
      } else {
        const rangeTotal = prevPrice - target.price;
        const rangeCurrent = prevPrice - currentPrice;
        const rangeProgress = rangeTotal > 0 ? (rangeCurrent / rangeTotal) * progressPerTarget : 0;
        accumulatedProgress += Math.max(0, rangeProgress);
        targetInfo = { index: i + 1, price: target.price, total: sortedSlTargets.length };
        break;
      }
    }

    progress = Math.min(100, accumulatedProgress);
    if (!targetInfo && sortedSlTargets.length > 0) {
      targetInfo = { index: sortedSlTargets.length, price: sortedSlTargets[sortedSlTargets.length - 1].price, total: sortedSlTargets.length, completed: true };
    }
  }

  return { progress, direction, targetInfo };
}

/**
 * 타겟 기반 수익률 프로그레스 바
 *
 * 익절/손절 타겟이 있을 때만 표시
 * 현재가가 타겟에 가까워질수록 바가 채워짐
 * 1차 타겟 도달 시 2차 타겟까지 계속 진행
 *
 * @param {number} currentPrice - 현재가
 * @param {number} averagePrice - 평균 매입가
 * @param {Array} takeProfitTargets - 익절 타겟 [{price, quantity, completed}]
 * @param {Array} stopLossTargets - 손절 타겟 [{price, quantity, completed}]
 * @param {string} market - 시장 (KRX, NASDAQ 등)
 * @param {string} size - 바 크기 ('sm' | 'md' | 'lg')
 */
export function TargetProgressBar({
  currentPrice,
  averagePrice,
  takeProfitTargets = [],
  stopLossTargets = [],
  market,
  size = 'md'
}) {
  // 타겟이 없으면 표시 안 함
  const validTpTargets = (takeProfitTargets || []).filter(t => t.price && !t.completed);
  const validSlTargets = (stopLossTargets || []).filter(t => t.price && !t.completed);

  if (validTpTargets.length === 0 && validSlTargets.length === 0) {
    return null;
  }

  if (!currentPrice || !averagePrice) {
    return null;
  }

  // 타겟 가격 정렬 (익절: 높은 순, 손절: 낮은 순)
  const sortedTpTargets = [...validTpTargets].sort((a, b) => a.price - b.price);
  const sortedSlTargets = [...validSlTargets].sort((a, b) => b.price - a.price);

  // 현재 방향 결정
  const isProfit = currentPrice > averagePrice;

  let progress = 0;
  let targetInfo = null;
  let direction = 'neutral';

  if (isProfit && sortedTpTargets.length > 0) {
    // 익절 방향
    direction = 'profit';

    // 어느 타겟 구간에 있는지 확인
    let accumulatedProgress = 0;
    const progressPerTarget = 100 / sortedTpTargets.length;

    for (let i = 0; i < sortedTpTargets.length; i++) {
      const target = sortedTpTargets[i];
      const prevPrice = i === 0 ? averagePrice : sortedTpTargets[i - 1].price;

      if (currentPrice >= target.price) {
        // 이 타겟을 넘어섬
        accumulatedProgress += progressPerTarget;
      } else {
        // 이 타겟 구간 내에 있음
        const rangeTotal = target.price - prevPrice;
        const rangeCurrent = currentPrice - prevPrice;
        const rangeProgress = rangeTotal > 0 ? (rangeCurrent / rangeTotal) * progressPerTarget : 0;
        accumulatedProgress += Math.max(0, rangeProgress);
        targetInfo = { index: i + 1, price: target.price, total: sortedTpTargets.length };
        break;
      }
    }

    progress = Math.min(100, accumulatedProgress);
    if (!targetInfo && sortedTpTargets.length > 0) {
      targetInfo = { index: sortedTpTargets.length, price: sortedTpTargets[sortedTpTargets.length - 1].price, total: sortedTpTargets.length, completed: true };
    }
  } else if (!isProfit && sortedSlTargets.length > 0) {
    // 손절 방향
    direction = 'loss';

    let accumulatedProgress = 0;
    const progressPerTarget = 100 / sortedSlTargets.length;

    for (let i = 0; i < sortedSlTargets.length; i++) {
      const target = sortedSlTargets[i];
      const prevPrice = i === 0 ? averagePrice : sortedSlTargets[i - 1].price;

      if (currentPrice <= target.price) {
        // 이 타겟을 넘어섬 (손절 방향)
        accumulatedProgress += progressPerTarget;
      } else {
        // 이 타겟 구간 내에 있음
        const rangeTotal = prevPrice - target.price;
        const rangeCurrent = prevPrice - currentPrice;
        const rangeProgress = rangeTotal > 0 ? (rangeCurrent / rangeTotal) * progressPerTarget : 0;
        accumulatedProgress += Math.max(0, rangeProgress);
        targetInfo = { index: i + 1, price: target.price, total: sortedSlTargets.length };
        break;
      }
    }

    progress = Math.min(100, accumulatedProgress);
    if (!targetInfo && sortedSlTargets.length > 0) {
      targetInfo = { index: sortedSlTargets.length, price: sortedSlTargets[sortedSlTargets.length - 1].price, total: sortedSlTargets.length, completed: true };
    }
  }

  // 수익률 계산
  const profitRate = ((currentPrice - averagePrice) / averagePrice) * 100;

  // 크기별 스타일
  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-2.5',
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base font-medium',
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className={`${textSizeClasses[size]} ${getProfitLossClass(profitRate / 100)} font-medium`}>
          {profitRate >= 0 ? '+' : ''}{profitRate.toFixed(2)}%
        </span>
        {targetInfo && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {targetInfo.completed
              ? (direction === 'profit' ? '익절 도달' : '손절 도달')
              : `${targetInfo.index}차 ${direction === 'profit' ? '익절' : '손절'}`}
          </span>
        )}
      </div>
      <div className={`w-full ${sizeClasses[size]} bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            direction === 'profit'
              ? 'bg-red-500 dark:bg-red-400'
              : direction === 'loss'
                ? 'bg-blue-500 dark:bg-blue-400'
                : 'bg-gray-400'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
      {targetInfo && !targetInfo.completed && (
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{formatCurrency(averagePrice, market)}</span>
          <span className={direction === 'profit' ? 'text-red-500' : 'text-blue-500'}>
            {formatCurrency(targetInfo.price, market)}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * 단순 수익률 프로그레스 바 (기존)
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
