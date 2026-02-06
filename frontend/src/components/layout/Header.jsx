import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useTheme } from '../../context/ThemeContext';
import { useNavigate, Link } from 'react-router-dom';
import { notificationService } from '../../services/notificationService';

export function Header({ onMenuClick }) {
  const { user, logout } = useAuth();
  const { subscribe, isConnected } = useWebSocket();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = subscribe('notification', (data) => {
      setUnreadCount(prev => prev + 1);

      setToast({
        id: data.id,
        title: data.title,
        message: data.message,
        type: data.notification_type,
        related_type: data.related_type,
        related_id: data.related_id
      });
    });

    return unsubscribe;
  }, [isConnected, subscribe]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const fetchUnreadCount = async () => {
    try {
      const count = await notificationService.getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleToastClick = () => {
    if (!toast) return;
    if (toast.related_type === 'position' && toast.related_id) {
      navigate(`/positions/${toast.related_id}`);
    } else if (toast.related_type === 'discussion' && toast.related_id) {
      navigate(`/discussions/${toast.related_id}`);
    } else if (toast.type === 'user_pending_approval') {
      navigate('/team');
    } else {
      navigate('/notifications');
    }
    setToast(null);
  };

  const getToastColor = (type) => {
    switch (type) {
      case 'request_approved': return 'bg-green-500';
      case 'request_rejected': return 'bg-red-500';
      case 'discussion_opened':
      case 'discussion_requested':
      case 'reopen_requested':
        return 'bg-blue-500';
      case 'new_request': return 'bg-orange-500';
      case 'early_close_requested': return 'bg-yellow-500';
      default: return 'bg-primary-500';
    }
  };

  const getToastIconPath = (type) => {
    switch (type) {
      case 'request_approved':
        return 'M5 13l4 4L19 7';
      case 'request_rejected':
        return 'M6 18L18 6M6 6l12 12';
      case 'discussion_opened':
      case 'discussion_requested':
      case 'reopen_requested':
        return 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z';
      case 'new_request':
        return 'M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z';
      default:
        return 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9';
    }
  };

  return (
    <>
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 h-16 flex items-center px-4 sticky top-0 z-40 transition-colors duration-200">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 mr-2 transition-colors"
        >
          <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="flex items-center">
          <h1 className="text-xl font-bold text-primary-600 dark:text-primary-400">Fund Messenger</h1>
        </div>

        <div className="ml-auto flex items-center space-x-3">
          {/* 다크모드 토글 */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={theme === 'dark' ? '라이트 모드' : '다크 모드'}
          >
            {theme === 'dark' ? (
              <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          {/* 알림 버튼 */}
          <Link
            to="/notifications"
            className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>

          <span className="text-sm text-gray-600 dark:text-gray-300">
            {user?.full_name}
            <span className="ml-2 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
              {user?.role === 'manager' ? '팀장' : user?.role === 'admin' ? '관리자' : '팀원'}
            </span>
          </span>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* 토스트 알림 */}
      {toast && (
        <div
          className="fixed top-20 right-4 z-50 max-w-sm w-full cursor-pointer"
          style={{
            animation: 'slideInRight 0.3s ease-out'
          }}
          onClick={handleToastClick}
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 flex items-start gap-3 hover:shadow-xl transition-shadow">
            <div className={`w-8 h-8 rounded-full ${getToastColor(toast.type)} flex items-center justify-center flex-shrink-0`}>
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={getToastIconPath(toast.type)} />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{toast.title}</p>
              {toast.message && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{toast.message}</p>
              )}
              <p className="text-xs text-primary-500 dark:text-primary-400 mt-1">클릭하여 확인</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setToast(null); }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
