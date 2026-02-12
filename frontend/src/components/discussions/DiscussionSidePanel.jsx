import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { discussionService } from '../../services/discussionService';
import { useAuth } from '../../hooks/useAuth';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useTheme } from '../../context/ThemeContext';
import { formatDate } from '../../utils/formatters';

/**
 * DiscussionSidePanel - SidePanel 내에서 표시되는 간소화된 토론/채팅 패널
 *
 * Props:
 *   - discussionId: 토론 ID
 *   - onClose: 패널 닫기 콜백
 */
export function DiscussionSidePanel({ discussionId, onClose }) {
  const navigate = useNavigate();
  const { user, canWrite } = useAuth();
  const { joinDiscussion, leaveDiscussion, subscribe, sendMessage: wsSendMessage } = useWebSocket();
  const { isCurrentThemeDark } = useTheme();

  const [discussion, setDiscussion] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // 데이터 로드 & WebSocket 구독
  useEffect(() => {
    if (!discussionId) return;

    const id = parseInt(discussionId);

    // 데이터 로드
    fetchDiscussion();
    fetchMessages();

    // WebSocket 룸 입장
    joinDiscussion(id);

    // 다른 사용자의 메시지 수신
    const unsubReceived = subscribe('message_received', (data) => {
      if (data.discussion_id === id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.id)) return prev;
          return [...prev, data];
        });
      }
    });

    // 내가 보낸 메시지 확인
    const unsubSent = subscribe('message_sent', (data) => {
      if (data.discussion_id === id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.id)) return prev;
          return [...prev, data];
        });
      }
    });

    return () => {
      leaveDiscussion(id);
      unsubReceived();
      unsubSent();
    };
  }, [discussionId]);

  // 새 메시지 시 자동 스크롤
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchDiscussion = async () => {
    try {
      const data = await discussionService.getDiscussion(discussionId);
      setDiscussion(data);
    } catch (error) {
      console.error('Failed to fetch discussion:', error);
    }
  };

  const fetchMessages = async () => {
    try {
      const data = await discussionService.getMessages(discussionId, { limit: 200 });
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const text = messageInput.trim();
    if (!text || sending) return;

    setSending(true);
    try {
      // WebSocket으로 실시간 전송
      wsSendMessage(parseInt(discussionId), text);
      setMessageInput('');
    } catch {
      // REST API 폴백
      try {
        await discussionService.sendMessage(discussionId, text);
        setMessageInput('');
        fetchMessages();
      } catch (err) {
        console.error('Failed to send message:', err);
      }
    } finally {
      setSending(false);
    }
  };

  const handleNavigateToFull = () => {
    navigate(`/discussions/${discussionId}`);
    onClose();
  };

  const isClosed = discussion?.status === 'closed';
  const showInput = !isClosed && canWrite();

  // --- 렌더링 ---

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <header
        className={`
          flex items-center gap-2 px-4 py-3 shrink-0
          border-b
          ${isCurrentThemeDark ? 'border-white/10' : 'border-gray-200'}
        `}
      >
        {/* 제목 & 상태 */}
        <div className="flex-1 min-w-0">
          <h3
            className={`
              text-sm font-semibold truncate
              ${isCurrentThemeDark ? 'text-gray-100' : 'text-gray-900'}
            `}
            title={discussion?.title}
          >
            {discussion?.title || '토론'}
          </h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className={`
                inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded
                ${isClosed
                  ? isCurrentThemeDark
                    ? 'bg-gray-700 text-gray-400'
                    : 'bg-gray-100 text-gray-500'
                  : isCurrentThemeDark
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-emerald-50 text-emerald-600'
                }
              `}
            >
              {isClosed ? '종료됨' : '진행중'}
            </span>
          </div>
        </div>

        {/* 전체보기 버튼 */}
        <button
          onClick={handleNavigateToFull}
          className={`
            px-2 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap
            ${isCurrentThemeDark
              ? 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }
          `}
          title="전체 토론 페이지로 이동"
        >
          전체보기
        </button>

        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          className={`
            p-1.5 rounded-lg transition-colors
            ${isCurrentThemeDark
              ? 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }
          `}
          title="닫기"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </header>

      {/* 메시지 목록 */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <span className={`text-sm ${isCurrentThemeDark ? 'text-gray-500' : 'text-gray-400'}`}>
              로딩중...
            </span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span className={`text-sm ${isCurrentThemeDark ? 'text-gray-500' : 'text-gray-400'}`}>
              아직 메시지가 없습니다
            </span>
          </div>
        ) : (
          messages.map((message) => {
            const isSystem = message.message_type === 'system';
            const isOwn = message.user?.id === user?.id;

            // 시스템 메시지
            if (isSystem) {
              return (
                <div
                  key={message.id}
                  className={`
                    text-center text-xs py-1.5
                    ${isCurrentThemeDark ? 'text-gray-500' : 'text-gray-400'}
                  `}
                >
                  {message.content}
                </div>
              );
            }

            // 사용자 메시지
            return (
              <div
                key={message.id}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] ${isOwn ? 'order-1' : ''}`}>
                  {/* 이름 & 시간 */}
                  <div
                    className={`
                      text-[10px] mb-0.5 flex items-center gap-1.5
                      ${isOwn ? 'justify-end' : 'justify-start'}
                      ${isCurrentThemeDark ? 'text-gray-500' : 'text-gray-400'}
                    `}
                  >
                    <span>{message.user?.full_name || '알 수 없음'}</span>
                    <span>{formatDate(message.created_at, 'HH:mm')}</span>
                  </div>
                  {/* 말풍선 */}
                  <div
                    className={`
                      px-3 py-2 rounded-lg text-sm whitespace-pre-wrap break-words
                      ${isOwn
                        ? 'bg-primary-600 text-white'
                        : isCurrentThemeDark
                          ? 'bg-gray-700 text-gray-100'
                          : 'bg-gray-100 text-gray-900'
                      }
                    `}
                  >
                    {message.content}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 입력 영역 */}
      {showInput && (
        <form
          onSubmit={handleSendMessage}
          className={`
            flex items-center gap-2 px-4 py-3 shrink-0
            border-t
            ${isCurrentThemeDark ? 'border-white/10' : 'border-gray-200'}
          `}
        >
          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            placeholder="메시지 입력..."
            className={`
              flex-1 px-3 py-2 text-sm rounded-lg outline-none transition-colors
              ${isCurrentThemeDark
                ? 'bg-white/5 text-gray-100 placeholder-gray-500 border border-white/10 focus:border-primary-500'
                : 'bg-gray-50 text-gray-900 placeholder-gray-400 border border-gray-200 focus:border-primary-500'
              }
            `}
          />
          <button
            type="submit"
            disabled={!messageInput.trim() || sending}
            className={`
              px-3 py-2 text-sm font-medium rounded-lg transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed
              bg-primary-600 text-white hover:bg-primary-700
            `}
          >
            전송
          </button>
        </form>
      )}

      {/* 종료된 토론 안내 */}
      {isClosed && (
        <div
          className={`
            px-4 py-2.5 text-center text-xs shrink-0
            border-t
            ${isCurrentThemeDark
              ? 'border-white/10 text-gray-500 bg-white/[0.02]'
              : 'border-gray-200 text-gray-400 bg-gray-50'
            }
          `}
        >
          이 토론은 종료되었습니다
        </div>
      )}
    </div>
  );
}
