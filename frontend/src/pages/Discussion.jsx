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
  const [showExportModal, setShowExportModal] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [selectedSessions, setSelectedSessions] = useState(new Set());
  const [exportLoading, setExportLoading] = useState(false);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchDiscussion();
    fetchMessages();

    // Join discussion room
    joinDiscussion(parseInt(id));

    // Subscribe to new messages from others
    const unsubscribeReceived = subscribe('message_received', (data) => {
      if (data.discussion_id === parseInt(id)) {
        setMessages(prev => {
          // Avoid duplicates
          if (prev.some(m => m.id === data.id)) return prev;
          return [...prev, data];
        });
      }
    });

    // Subscribe to confirmation of own sent messages
    const unsubscribeSent = subscribe('message_sent', (data) => {
      if (data.discussion_id === parseInt(id)) {
        setMessages(prev => {
          // Avoid duplicates
          if (prev.some(m => m.id === data.id)) return prev;
          return [...prev, data];
        });
      }
    });

    return () => {
      leaveDiscussion(parseInt(id));
      unsubscribeReceived();
      unsubscribeSent();
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

  const handleOpenExportModal = async () => {
    try {
      const data = await discussionService.getSessions(id);
      setSessions(data.sessions || []);
      setSelectedSessions(new Set((data.sessions || []).map(s => s.session_number)));
      setShowExportModal(true);
    } catch (error) {
      alert('세션 정보를 불러오는데 실패했습니다.');
    }
  };

  const toggleSession = (num) => {
    setSelectedSessions(prev => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  };

  const handleExportTxt = async () => {
    if (selectedSessions.size === 0) {
      alert('최소 하나의 세션을 선택해주세요.');
      return;
    }
    setExportLoading(true);
    try {
      const data = await discussionService.exportTxt(id, Array.from(selectedSessions));
      const files = data.files || [];
      for (const file of files) {
        const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.filename;
        a.click();
        URL.revokeObjectURL(url);
      }
      setShowExportModal(false);
    } catch (error) {
      alert('다운로드에 실패했습니다.');
    } finally {
      setExportLoading(false);
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
          <Button variant="secondary" size="sm" onClick={handleOpenExportModal}>
            내보내기
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

      {/* Export Modal */}
      <Modal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="토론 내보내기"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">내보낼 세션을 선택하세요. 각 세션은 개별 텍스트 파일로 다운로드됩니다.</p>

          {sessions.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">세션 정보가 없습니다</p>
          ) : (
            <div className="space-y-2">
              {sessions.map(session => (
                <label
                  key={session.session_number}
                  className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedSessions.has(session.session_number)}
                    onChange={() => toggleSession(session.session_number)}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      세션 {session.session_number}
                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${session.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                        {session.status === 'open' ? '진행중' : '종료'}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500">
                      {session.started_at ? new Date(session.started_at).toLocaleString('ko-KR') : '?'}
                      {' ~ '}
                      {session.closed_at ? new Date(session.closed_at).toLocaleString('ko-KR') : '진행중'}
                      {' · '}메시지 {session.message_count}개
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}

          <div className="flex justify-between items-center pt-4 border-t">
            <button
              onClick={() => {
                if (selectedSessions.size === sessions.length) {
                  setSelectedSessions(new Set());
                } else {
                  setSelectedSessions(new Set(sessions.map(s => s.session_number)));
                }
              }}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              {selectedSessions.size === sessions.length ? '전체 해제' : '전체 선택'}
            </button>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowExportModal(false)}>취소</Button>
              <Button size="sm" onClick={handleExportTxt} loading={exportLoading} disabled={selectedSessions.size === 0}>
                다운로드 ({selectedSessions.size}개)
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
