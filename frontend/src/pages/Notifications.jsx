import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { notificationService } from '../services/notificationService';
import { useWebSocket } from '../hooks/useWebSocket';
import { formatRelativeTime } from '../utils/formatters';

const getNotificationIcon = (type) => {
  switch (type) {
    case 'request_approved':
      return (
        <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      );
    case 'request_rejected':
      return (
        <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      );
    case 'discussion_opened':
    case 'discussion_requested':
    case 'reopen_requested':
      return (
        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
      );
    case 'new_request':
      return (
        <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
          <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      );
    case 'early_close_requested':
      return (
        <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
          <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
      );
    case 'user_pending_approval':
      return (
        <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
          <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        </div>
      );
    default:
      return (
        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
      );
  }
};

export function Notifications() {
  const navigate = useNavigate();
  const { subscribe, isConnected } = useWebSocket();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('unread'); // unread, read, all
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, [filter]);

  // WebSocket으로 새 알림 실시간 추가
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = subscribe('notification', (data) => {
      const newNotification = {
        ...data,
        is_read: false,
        created_at: data.created_at || new Date().toISOString()
      };
      // 읽지 않음/전체 필터일 때만 추가
      if (filter !== 'read') {
        setNotifications(prev => [newNotification, ...prev]);
      }
    });

    return unsubscribe;
  }, [isConnected, subscribe, filter]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const data = await notificationService.getNotifications({
        unreadOnly: filter === 'unread'
      });
      let filtered = data.notifications || [];
      if (filter === 'read') {
        filtered = filtered.filter(n => n.is_read);
      }
      setNotifications(filtered);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = async (notification) => {
    // 읽음 처리
    if (!notification.is_read) {
      try {
        await notificationService.markAsRead([notification.id]);
        setNotifications(prev =>
          prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
        );
      } catch (error) {
        console.error('Failed to mark as read:', error);
      }
    }

    // 관련 페이지로 이동
    const type = notification.notification_type;

    if (type === 'user_pending_approval') {
      navigate('/team');
    } else if (type === 'new_request') {
      navigate('/requests');
    } else if (type === 'discussion_requested' || type === 'reopen_requested') {
      // 토론 요청 알림은 요청 페이지로 이동
      navigate('/requests');
    } else if (type === 'discussion_opened' && notification.related_id) {
      // 토론 개시 알림은 토론방으로 이동
      navigate(`/discussions/${notification.related_id}`);
    } else if (notification.related_type === 'discussion' && notification.related_id) {
      navigate(`/discussions/${notification.related_id}`);
    } else if (notification.related_type === 'position' && notification.related_id) {
      navigate(`/positions/${notification.related_id}`);
    } else if (notification.related_type === 'request' && notification.related_id) {
      navigate('/my-requests');
    } else {
      // 기본: 알림 페이지에 유지
      navigate('/notifications');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleMarkSingleRead = async (e, notificationId) => {
    e.stopPropagation();
    try {
      await notificationService.markAsRead([notificationId]);
      if (filter === 'unread') {
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
      } else {
        setNotifications(prev =>
          prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
        );
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleDelete = async (e, notificationId) => {
    e.stopPropagation();
    try {
      await notificationService.deleteNotification(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const handleDeleteAll = () => {
    setShowDeleteAllConfirm(true);
  };

  const confirmDeleteAll = async () => {
    try {
      await notificationService.deleteAllNotifications();
      setNotifications([]);
      setShowDeleteAllConfirm(false);
    } catch (error) {
      console.error('Failed to delete all notifications:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold dark:text-gray-100">알림</h1>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleMarkAllRead}
          >
            모두 읽음
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            onClick={handleDeleteAll}
          >
            모두 삭제
          </Button>
        </div>
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-2">
        {[
          { key: 'unread', label: '읽지 않음' },
          { key: 'read', label: '읽음' },
          { key: 'all', label: '전체' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f.key
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">로딩중...</div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {filter === 'unread' ? '읽지 않은 알림이 없습니다' : filter === 'read' ? '읽은 알림이 없습니다' : '알림이 없습니다'}
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map(notification => (
            <Card
              key={notification.id}
              className={`cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                !notification.is_read ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : ''
              }`}
              onClick={() => handleNotificationClick(notification)}
            >
              <div className="flex items-start gap-4">
                {getNotificationIcon(notification.notification_type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${!notification.is_read ? 'text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}>
                      {notification.title}
                    </span>
                    {!notification.is_read && (
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    )}
                  </div>
                  {notification.message && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                      {notification.message}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                    {formatRelativeTime(notification.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!notification.is_read && (
                    <button
                      onClick={(e) => handleMarkSingleRead(e, notification.id)}
                      className="px-2 py-1 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 rounded transition-colors"
                    >
                      읽음
                    </button>
                  )}
                  <button
                    onClick={(e) => handleDelete(e, notification.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:text-gray-500 dark:hover:text-red-400 dark:hover:bg-red-900/20 rounded transition-colors"
                    title="삭제"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 모두 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={showDeleteAllConfirm}
        onClose={() => setShowDeleteAllConfirm(false)}
        onConfirm={confirmDeleteAll}
        title="알림 전체 삭제"
        message="모든 알림을 삭제하시겠습니까?"
        confirmText="삭제"
        confirmVariant="danger"
      />
    </div>
  );
}
