import { useState, useEffect } from 'react';
import { useTheme, THEMES } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { notificationService } from '../services/notificationService';

export function Settings() {
  const { appTheme, setAppTheme, themes } = useTheme();
  const { isManagerOrAdmin, adminMode, toggleAdminMode } = useAuth();
  const [selectedTheme, setSelectedTheme] = useState(appTheme);

  const handleThemeChange = (themeId) => {
    setSelectedTheme(themeId);
    setAppTheme(themeId);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          설정
        </h1>
        <p className="mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          앱의 모양과 동작을 사용자 지정하세요
        </p>
      </div>

      {/* 관리자 모드 섹션 (팀장/관리자만) */}
      {isManagerOrAdmin() && (
        <section className="pb-6" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            관리자 모드
          </h2>
          <div
            className="flex items-center justify-between p-4 rounded-lg"
            style={{ backgroundColor: 'var(--color-bg-secondary)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{
                  backgroundColor: adminMode ? 'rgba(239, 68, 68, 0.1)' : 'var(--color-bg-tertiary)',
                  color: adminMode ? 'var(--color-danger)' : 'var(--color-text-secondary)',
                }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  관리자 모드 활성화
                </p>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  포지션, 요청, 토론 삭제 버튼이 표시됩니다
                </p>
              </div>
            </div>
            <button
              onClick={toggleAdminMode}
              className="relative w-12 h-7 rounded-full p-1 transition-colors"
              style={{ backgroundColor: adminMode ? 'var(--color-danger)' : 'var(--color-text-muted)' }}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${adminMode ? 'translate-x-5' : ''}`}
              />
            </button>
          </div>
          {adminMode && (
            <p className="mt-3 text-sm flex items-center gap-2" style={{ color: 'var(--color-danger)' }}>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              관리자 모드가 활성화되어 있습니다. 삭제 시 복구할 수 없으니 주의하세요.
            </p>
          )}
        </section>
      )}

      {/* 알림 설정 섹션 */}
      <NotificationSettings />

      {/* 테마 설정 섹션 */}
      <section>
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
          테마
        </h2>

        {/* 컴팩트 테마 선택 그리드 */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2">
          {Object.values(THEMES).map((theme) => (
            <ThemeChip
              key={theme.id}
              theme={theme}
              isSelected={selectedTheme === theme.id}
              onSelect={() => handleThemeChange(theme.id)}
            />
          ))}
        </div>
      </section>

      {/* 현재 테마 미리보기 */}
      <section>
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
          현재 테마 미리보기
        </h2>
        <Card>
          <ThemePreview theme={THEMES[selectedTheme]} />
        </Card>
      </section>
    </div>
  );
}

function NotificationSettings() {
  const [pushStatus, setPushStatus] = useState('checking'); // checking, unsupported, denied, unsubscribed, subscribed, error
  const [pushError, setPushError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkPushStatus();
  }, []);

  const checkPushStatus = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushStatus('unsupported');
      return;
    }
    if (!('Notification' in window)) {
      setPushStatus('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setPushStatus('denied');
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setPushStatus(sub ? 'subscribed' : 'unsubscribed');
    } catch {
      setPushStatus('unsubscribed');
    }
  };

  const handleSubscribe = async () => {
    setLoading(true);
    setPushError(null);
    try {
      const result = await notificationService.initPushNotifications();
      if (result) {
        setPushStatus('subscribed');
      } else {
        setPushStatus(Notification.permission === 'denied' ? 'denied' : 'error');
        setPushError('구독에 실패했습니다. 브라우저 설정에서 알림을 허용해주세요.');
      }
    } catch (err) {
      setPushStatus('error');
      setPushError(err.message || '알 수 없는 오류');
    }
    setLoading(false);
  };

  const handleUnsubscribe = async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await notificationService.unsubscribePush(sub.endpoint);
        await sub.unsubscribe();
      }
      setPushStatus('unsubscribed');
    } catch {
      // ignore
    }
    setLoading(false);
  };

  const statusConfig = {
    checking: { label: '확인 중...', color: 'var(--color-text-muted)' },
    unsupported: { label: '미지원 브라우저', color: 'var(--color-text-muted)' },
    denied: { label: '차단됨', color: 'var(--color-danger)' },
    unsubscribed: { label: '비활성', color: 'var(--color-warning, #f59e0b)' },
    subscribed: { label: '활성', color: 'var(--color-success, #22c55e)' },
    error: { label: '오류', color: 'var(--color-danger)' },
  };

  const status = statusConfig[pushStatus] || statusConfig.checking;

  return (
    <section className="pb-6" style={{ borderBottom: '1px solid var(--color-border)' }}>
      <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
        Push 알림
      </h2>
      <div
        className="flex items-center justify-between p-4 rounded-lg"
        style={{ backgroundColor: 'var(--color-bg-secondary)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'var(--color-bg-tertiary)', color: status.color }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div>
            <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
              Push 알림
              <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded-full" style={{ backgroundColor: status.color + '20', color: status.color }}>
                {status.label}
              </span>
            </p>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {pushStatus === 'unsupported' && '이 브라우저는 Push 알림을 지원하지 않습니다'}
              {pushStatus === 'denied' && '브라우저 설정에서 알림을 허용해주세요'}
              {pushStatus === 'subscribed' && '새 요청, 승인, 토론 알림을 받습니다'}
              {pushStatus === 'unsubscribed' && '활성화하면 중요 알림을 받을 수 있습니다'}
              {pushStatus === 'error' && (pushError || '구독 중 오류가 발생했습니다')}
              {pushStatus === 'checking' && '상태 확인 중...'}
            </p>
          </div>
        </div>
        <div>
          {pushStatus === 'unsubscribed' && (
            <Button onClick={handleSubscribe} disabled={loading} size="sm">
              {loading ? '...' : '활성화'}
            </Button>
          )}
          {pushStatus === 'subscribed' && (
            <Button onClick={handleUnsubscribe} disabled={loading} variant="secondary" size="sm">
              {loading ? '...' : '해제'}
            </Button>
          )}
          {pushStatus === 'error' && (
            <Button onClick={handleSubscribe} disabled={loading} size="sm">
              {loading ? '...' : '재시도'}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

function ThemeChip({ theme, isSelected, onSelect }) {
  return (
    <button
      onClick={onSelect}
      className={`
        relative group flex flex-col items-center p-2 rounded-lg border-2 transition-all duration-200
        ${isSelected
          ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)] ring-opacity-30 scale-105'
          : 'border-transparent hover:border-[var(--color-border)] hover:scale-102'
        }
      `}
      style={{
        backgroundColor: isSelected ? 'var(--color-bg-tertiary)' : 'transparent',
      }}
      title={theme.description}
    >
      {/* 테마 프리뷰 색상 칩 */}
      <div
        className={`w-full aspect-[2/1] rounded-md ${theme.preview} transition-transform group-hover:scale-105`}
        style={{ minHeight: '28px' }}
      />

      {/* 테마명 */}
      <span
        className={`mt-1.5 text-xs font-medium truncate w-full text-center transition-colors ${
          isSelected ? '' : 'opacity-70 group-hover:opacity-100'
        }`}
        style={{ color: 'var(--color-text-primary)' }}
      >
        {theme.name}
      </span>

      {/* 다크 모드 인디케이터 */}
      {theme.isDark && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-gray-800 rounded-full flex items-center justify-center">
          <svg className="w-2.5 h-2.5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
          </svg>
        </span>
      )}

      {/* 선택 체크마크 */}
      {isSelected && (
        <span
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
          </svg>
        </span>
      )}
    </button>
  );
}

function ThemePreview({ theme }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {theme.name} 테마
          </h3>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {theme.description}
          </p>
        </div>
        <div className={`w-12 h-12 rounded-lg ${theme.preview}`} />
      </div>

      {/* 버튼 미리보기 */}
      <div>
        <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
          버튼
        </p>
        <div className="flex flex-wrap gap-2">
          <Button>기본 버튼</Button>
          <Button variant="secondary">보조 버튼</Button>
          <Button variant="danger">위험 버튼</Button>
          <Button variant="success">성공 버튼</Button>
        </div>
      </div>

      {/* 뱃지 미리보기 */}
      <div>
        <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
          뱃지
        </p>
        <div className="flex flex-wrap gap-2">
          <span className="badge badge-pending">대기중</span>
          <span className="badge badge-approved">승인</span>
          <span className="badge badge-rejected">거부</span>
          <span className="badge badge-discussion">토론중</span>
          <span className="badge badge-open">오픈</span>
          <span className="badge badge-closed">종료</span>
        </div>
      </div>

      {/* 카드 미리보기 */}
      <div>
        <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
          카드
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="card">
            <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              수익률
            </div>
            <div className="text-xl font-bold text-green-500">
              +12.5%
            </div>
          </div>
          <div className="card">
            <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              손실률
            </div>
            <div className="text-xl font-bold text-red-500">
              -3.2%
            </div>
          </div>
        </div>
      </div>

      {/* 입력 필드 미리보기 */}
      <div>
        <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
          입력 필드
        </p>
        <input
          type="text"
          className="input"
          placeholder="텍스트를 입력하세요..."
          readOnly
        />
      </div>

      {/* 텍스트 미리보기 */}
      <div>
        <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
          텍스트 스타일
        </p>
        <div className="space-y-1">
          <p style={{ color: 'var(--color-text-primary)' }}>주요 텍스트 (Primary)</p>
          <p style={{ color: 'var(--color-text-secondary)' }}>보조 텍스트 (Secondary)</p>
          <p style={{ color: 'var(--color-text-muted)' }}>흐린 텍스트 (Muted)</p>
        </div>
      </div>
    </div>
  );
}
