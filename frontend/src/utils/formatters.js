import { format, formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

export function formatNumber(value, decimals = 0) {
  if (value == null) return '-';
  return new Intl.NumberFormat('ko-KR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

// 수량 포맷 - 뒷자리 0 제거
export function formatQuantity(value) {
  if (value == null) return '-';
  const num = parseFloat(value);
  if (Number.isInteger(num)) {
    return num.toLocaleString('ko-KR');
  }
  // 소수점 뒷자리 0 제거
  return parseFloat(num.toFixed(8)).toLocaleString('ko-KR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  });
}

// 가격 포맷 - 뒷자리 0 제거
export function formatPrice(value, market = 'KRX') {
  if (value == null) return '-';
  const num = parseFloat(value);

  const isUS = market === 'NASDAQ' || market === 'NYSE' || market === 'USD';
  const isCrypto = market === 'CRYPTO' || market === 'USDT';

  if (isUS) {
    // 달러 - 최대 소수점 3자리, 뒷자리 0 제거
    const formatted = parseFloat(num.toFixed(3));
    return '$' + formatted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  }

  if (isCrypto) {
    // USDT - 최대 소수점 4자리, 뒷자리 0 제거
    const formatted = parseFloat(num.toFixed(4));
    return formatted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + ' USDT';
  }

  // 원화 - 소수점 없음
  return '₩' + Math.round(num).toLocaleString('ko-KR');
}

export function formatCurrency(value, market = 'KRX') {
  if (value == null) return '-';

  // 시장별 통화 및 소수점 설정
  const isUS = market === 'NASDAQ' || market === 'NYSE' || market === 'USD';
  const isCrypto = market === 'CRYPTO' || market === 'USDT';

  if (isUS) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 3,
    }).format(value);
  }

  if (isCrypto) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(value) + ' USDT';
  }

  // 한국 주식 (KRX, KOSPI, KOSDAQ)
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value, decimals = 2) {
  if (value == null) return '-';
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatDate(date, formatStr = 'yyyy-MM-dd HH:mm') {
  if (!date) return '-';
  return format(new Date(date), formatStr, { locale: ko });
}

export function formatRelativeTime(date) {
  if (!date) return '-';
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ko });
}

export function formatHours(hours) {
  if (hours == null) return '-';
  if (hours < 1) return '1시간 미만';
  hours = Math.floor(hours);
  if (hours < 24) {
    return `${hours}시간`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (remainingHours === 0) {
    return `${days}일`;
  }
  return `${days}일 ${remainingHours}시간`;
}

// 진행중 포지션의 보유기간을 opened_at으로부터 계산
export function calcHoldingHours(openedAt) {
  if (!openedAt) return null;
  const opened = new Date(openedAt);
  const now = new Date();
  const diffMs = now - opened;
  return diffMs / (1000 * 60 * 60); // hours as float
}

export function getStatusBadgeClass(status) {
  const classes = {
    pending: 'badge-pending',
    approved: 'badge-approved',
    rejected: 'badge-rejected',
    discussion: 'badge-discussion',
    open: 'badge-open',
    closed: 'badge-closed',
  };
  return classes[status] || 'badge-pending';
}

export function getStatusLabel(status) {
  const labels = {
    pending: '대기중',
    approved: '승인됨',
    rejected: '거부됨',
    discussion: '토론중',
    open: '진행중',
    closed: '종료',
  };
  return labels[status] || status;
}

export function getRequestTypeLabel(type) {
  return type === 'buy' ? '매수' : '매도';
}

export function getProfitLossClass(value) {
  if (value == null || value === 0) return 'text-gray-600';
  return value > 0 ? 'text-red-600' : 'text-blue-600';
}

// 가격과 수량을 명확하게 표시
// 예: "₩20,000 (50주)" 또는 "$150.00 (10 shares)"
// ratio가 있으면 percentage로 표시 (legacy 데이터 지원)
export function formatPriceQuantity(price, quantity, market = 'KRX', ratio = null) {
  if (price == null) return '-';

  const formattedPrice = formatCurrency(price, market);

  // quantity 또는 ratio 중 하나 사용
  if (quantity != null) {
    const formattedQty = formatQuantity(quantity);

    // 시장별 단위 결정
    const isKorean = market === 'KOSPI' || market === 'KOSDAQ' || market === 'KRX';
    const isCrypto = market === 'CRYPTO' || market === 'USDT';

    let unit = '';
    if (isKorean) {
      unit = '주';
    } else if (!isCrypto) {
      unit = ' shares';
    }

    return `${formattedPrice} (${formattedQty}${unit})`;
  } else if (ratio != null) {
    // legacy: ratio로 표시
    return `${formattedPrice} (${formatPercent(ratio)})`;
  }

  return formattedPrice;
}
