import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Modal } from '../components/common/Modal';
import { discussionService } from '../services/discussionService';
import { useAuth } from '../hooks/useAuth';
import { useWebSocket } from '../hooks/useWebSocket';
import { formatDate } from '../utils/formatters';

export function Discussion() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isManagerOrAdmin } = useAuth();
  const { joinDiscussion, leaveDiscussion, subscribe, sendMessage: wsSendMessage } = useWebSocket();

  const [discussion, setDiscussion] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messageInput, setMessageInput] = useState('');
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [summary, setSummary] = useState('');

  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchDiscussion();
    fetchMessages();

    // Join discussion room
    joinDiscussion(parseInt(id));

    // Subscribe to new messages
    const unsubscribe = subscribe('message_received', (data) => {
      if (data.discussion_id === parseInt(id)) {
        setMessages(prev => [...prev, data]);
      }
    });

    return () => {
      leaveDiscussion(parseInt(id));
      unsubscribe();
    };
  }, [id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchDiscussion = async () => {
    try {
      const data = await discussionService.getDiscussion(id);
      setDiscussion(data);
    } catch (error) {
      console.error('Failed to fetch discussion:', error);
    }
  };

  const fetchMessages = async () => {
    try {
      const data = await discussionService.getMessages(id, { limit: 200 });
      setMessages(data.messages);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageInput.trim()) return;

    try {
      // Send via WebSocket for real-time
      wsSendMessage(parseInt(id), messageInput);
      setMessageInput('');
    } catch (error) {
      // Fallback to REST API
      try {
        await discussionService.sendMessage(id, messageInput);
        setMessageInput('');
        fetchMessages();
      } catch (err) {
        console.error('Failed to send message:', err);
      }
    }
  };

  const handleClose = async () => {
    try {
      await discussionService.closeDiscussion(id, summary || null);
      setShowCloseModal(false);
      fetchDiscussion();
    } catch (error) {
      alert(error.response?.data?.detail || '토론 종료에 실패했습니다.');
    }
  };

  const handleReopen = async () => {
    try {
      await discussionService.reopenDiscussion(id);
      fetchDiscussion();
    } catch (error) {
      alert(error.response?.data?.detail || '토론 재개에 실패했습니다.');
    }
  };

  const handleExport = async () => {
    try {
      const data = await discussionService.exportDiscussion(id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `discussion-${id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('다운로드에 실패했습니다.');
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-500">로딩중...</div>;
  }

  if (!discussion) {
    return <div className="text-center py-12 text-gray-500">토론을 찾을 수 없습니다</div>;
  }

  const isClosed = discussion.status === 'closed';

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold">{discussion.title}</h1>
            <p className="text-sm text-gray-500">
              {isClosed ? '종료됨' : '진행중'}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleExport}>
            JSON 다운로드
          </Button>
          {isClosed && isManagerOrAdmin() && (
            <Button variant="primary" size="sm" onClick={handleReopen}>
              토론 재개
            </Button>
          )}
          {!isClosed && isManagerOrAdmin() && (
            <Button variant="danger" size="sm" onClick={() => setShowCloseModal(true)}>
              토론 종료
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.user.id === user?.id ? 'justify-end' : 'justify-start'}`}
            >
              {message.message_type === 'system' ? (
                <div className="text-center text-sm text-gray-500 py-2 w-full">
                  {message.content}
                </div>
              ) : (
                <div className={`max-w-[70%] ${message.user.id === user?.id ? 'order-1' : ''}`}>
                  <div className="text-xs text-gray-500 mb-1">
                    {message.user.full_name}
                    <span className="ml-2">{formatDate(message.created_at, 'HH:mm')}</span>
                  </div>
                  <div
                    className={`p-3 rounded-lg ${
                      message.user.id === user?.id
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100'
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        {!isClosed && (
          <form onSubmit={handleSendMessage} className="border-t p-4 flex gap-2">
            <Input
              placeholder="메시지 입력..."
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              className="flex-1"
            />
            <Button type="submit">전송</Button>
          </form>
        )}
      </Card>

      {/* Close Modal */}
      <Modal
        isOpen={showCloseModal}
        onClose={() => setShowCloseModal(false)}
        title="토론 종료"
      >
        <div className="space-y-4">
          <Input
            label="요약 (선택)"
            placeholder="토론 결과 요약..."
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowCloseModal(false)}>
              취소
            </Button>
            <Button variant="danger" onClick={handleClose}>
              종료
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
