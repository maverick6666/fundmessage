import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { discussionService } from '../services/discussionService';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import { formatRelativeTime } from '../utils/formatters';

export function Discussions() {
  const navigate = useNavigate();
  const { adminMode } = useAuth();
  const toast = useToast();
  const [discussions, setDiscussions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('open');

  useEffect(() => {
    fetchDiscussions();
  }, [statusFilter]);

  const handleDelete = async (e, discussion) => {
    e.stopPropagation();
    if (!window.confirm(`토론 "${discussion.title}"을(를) 정말 삭제하시겠습니까?\n\n모든 메시지가 함께 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.`)) return;
    try {
      await discussionService.deleteDiscussion(discussion.id);
      fetchDiscussions();
    } catch (error) {
      toast.error(error.response?.data?.detail || '삭제에 실패했습니다.');
    }
  };

  const fetchDiscussions = async () => {
    setLoading(true);
    try {
      const data = await discussionService.getDiscussions({
        status: statusFilter === 'all' ? null : statusFilter,
        limit: 50
      });
      setDiscussions(data.discussions);
    } catch (error) {
      console.error('Failed to fetch discussions:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold dark:text-gray-100">토론방</h1>

      {/* 필터 탭 */}
      <div className="flex gap-2">
        {[
          { key: 'open', label: '진행중' },
          { key: 'closed', label: '종료됨' },
          { key: 'all', label: '전체' }
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === f.key
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
      ) : discussions.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">토론이 없습니다</div>
      ) : (
        <div className="space-y-2">
          {discussions.map(discussion => (
            <Card
              key={discussion.id}
              className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              onClick={() => navigate(`/discussions/${discussion.id}`)}
            >
              <div className="flex items-start gap-4">
                {/* 상태 아이콘 */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                  discussion.status === 'open'
                    ? 'bg-green-100 dark:bg-green-900/30'
                    : 'bg-gray-100 dark:bg-gray-700'
                }`}>
                  <svg className={`w-6 h-6 ${
                    discussion.status === 'open' ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>

                {/* 토론 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {discussion.title}
                    </span>
                    <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded ${
                      discussion.status === 'open'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {discussion.status === 'open' ? '진행중' : '종료'}
                    </span>
                  </div>

                  {/* 종목 정보 */}
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
                    {discussion.ticker_name && (
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {discussion.ticker_name}
                      </span>
                    )}
                    {discussion.ticker && (
                      <span className="text-gray-400 dark:text-gray-500">({discussion.ticker})</span>
                    )}
                    {discussion.requester && (
                      <>
                        <span className="text-gray-300 dark:text-gray-600">|</span>
                        <span>요청자: {discussion.requester.full_name}</span>
                      </>
                    )}
                  </div>

                  {/* 마지막 메시지 미리보기 */}
                  {discussion.last_message ? (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-600 dark:text-gray-400 font-medium">
                        {discussion.last_message.user}:
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 truncate">
                        {discussion.last_message.content}
                      </span>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400 dark:text-gray-500">메시지 없음</div>
                  )}
                </div>

                {/* 시간 및 메시지 수 */}
                <div className="text-right flex-shrink-0">
                  <div className="text-xs text-gray-400 dark:text-gray-500">
                    {discussion.last_message
                      ? formatRelativeTime(discussion.last_message.created_at)
                      : formatRelativeTime(discussion.opened_at)
                    }
                  </div>
                  {discussion.message_count > 0 && (
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {discussion.message_count}개 메시지
                    </div>
                  )}
                  {adminMode && (
                    <button
                      onClick={(e) => handleDelete(e, discussion)}
                      className="mt-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 p-1 rounded"
                      title="삭제"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
