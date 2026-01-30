import { format, formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

export function formatNumber(value, decimals = 0) {
  if (value == null) return '-';
  return new Intl.NumberFormat('ko-KR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatCurrency(value, currency = 'KRW') {
  if (value == null) return '-';
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency,
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
