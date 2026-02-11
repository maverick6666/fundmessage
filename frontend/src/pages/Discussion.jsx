import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Modal } from '../components/common/Modal';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { ChartShareModal } from '../components/charts/ChartShareModal';
import { MiniChart } from '../components/charts/MiniChart';
import { discussionService } from '../services/discussionService';
import { useAuth } from '../hooks/useAuth';
import { useWebSocket } from '../hooks/useWebSocket';
import { useToast } from '../context/ToastContext';
import { formatDate } from '../utils/formatters';

export function Discussion() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isManagerOrAdmin, adminMode, canWrite } = useAuth();
  const { joinDiscussion, leaveDiscussion, subscribe, sendMessage: wsSendMessage } = useWebSocket();
  const toast = useToast();

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
  const [showChartModal, setShowChartModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [requestReopenLoading, setRequestReopenLoading] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenAgenda, setReopenAgenda] = useState('');
  const [showEditTitleModal, setShowEditTitleModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [deleteSessionLoading, setDeleteSessionLoading] = useState(null);

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
      toast.error(error.response?.data?.detail || '토론 종료에 실패했습니다.');
    }
  };

  const handleReopen = async () => {
    if (!reopenAgenda.trim()) {
      toast.warning('의제를 입력해주세요.');
      return;
    }
    try {
      await discussionService.reopenDiscussion(id, reopenAgenda);
      setShowReopenModal(false);
      setReopenAgenda('');
      fetchDiscussion();
      fetchMessages();
      toast.success('토론이 재개되었습니다.');
    } catch (error) {
      toast.error(error.response?.data?.detail || '토론 재개에 실패했습니다.');
    }
  };

  const handleUpdateTitle = async () => {
    if (!editTitle.trim()) {
      toast.warning('제목을 입력해주세요.');
      return;
    }
    try {
      await discussionService.updateDiscussion(id, { title: editTitle });
      setShowEditTitleModal(false);
      fetchDiscussion();
      toast.success('제목이 수정되었습니다.');
    } catch (error) {
      toast.error(error.response?.data?.detail || '수정에 실패했습니다.');
    }
  };

  const handleDeleteSession = async (sessionNumber) => {
    setDeleteSessionLoading(sessionNumber);
    try {
      await discussionService.deleteSession(id, sessionNumber);
      toast.success(`세션 ${sessionNumber}이(가) 삭제되었습니다.`);
      // 세션 목록 새로고침
      const data = await discussionService.getSessions(id);
      setSessions(data.sessions || []);
      setSelectedSessions(new Set((data.sessions || []).map(s => s.session_number)));
      fetchMessages();
    } catch (error) {
      toast.error(error.response?.data?.detail || '삭제에 실패했습니다.');
    } finally {
      setDeleteSessionLoading(null);
    }
  };

  const handleOpenExportModal = async () => {
    try {
      const data = await discussionService.getSessions(id);
      setSessions(data.sessions || []);
      setSelectedSessions(new Set((data.sessions || []).map(s => s.session_number)));
      setShowExportModal(true);
    } catch (error) {
      toast.error('세션 정보를 불러오는데 실패했습니다.');
    }
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    try {
      await discussionService.deleteDiscussion(id);
      toast.success('토론이 삭제되었습니다.');
      setShowDeleteConfirm(false);
      navigate(-1);
    } catch (error) {
      toast.error(error.response?.data?.detail || '삭제에 실패했습니다.');
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

  const handleShareChart = (content, chartData) => {
    // Send chart message via WebSocket
    wsSendMessage(parseInt(id), content, 'chart', chartData);
    setShowChartModal(false);
  };

  const handleExportTxt = async () => {
    if (selectedSessions.size === 0) {
      toast.warning('최소 하나의 세션을 선택해주세요.');
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
      toast.error('다운로드에 실패했습니다.');
    } finally {
      setExportLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-500 dark:text-gray-400">로딩중...</div>;
  }

  if (!discussion) {
    return <div className="text-center py-12 text-gray-500 dark:text-gray-400">토론을 찾을 수 없습니다</div>;
  }

  const isClosed = discussion.status === 'closed';

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold dark:text-gray-100">{discussion.title}</h1>
              {isManagerOrAdmin() && (
                <button
                  onClick={() => {
                    setEditTitle(discussion.title);
                    setShowEditTitleModal(true);
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  title="제목 수정"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isClosed ? '종료됨' : '진행중'} · 세션 {discussion.session_count || 1}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {adminMode && (
            <Button variant="secondary" size="sm" className="text-red-600 hover:bg-red-50" onClick={handleDelete}>
              삭제
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={handleOpenExportModal}>
            내보내기
          </Button>
          {isClosed && isManagerOrAdmin() && (
            <Button variant="primary" size="sm" onClick={() => setShowReopenModal(true)}>
              토론 재개
            </Button>
          )}
          {isClosed && !isManagerOrAdmin() && (
            <Button
              variant="secondary"
              size="sm"
              disabled={requestReopenLoading}
              onClick={async () => {
                if (requestReopenLoading) return;
                setRequestReopenLoading(true);
                try {
                  await discussionService.requestReopen(id);
                  toast.success('토론 재개 요청이 매니저에게 전송되었습니다.');
                } catch (error) {
                  toast.error(error.response?.data?.detail || '요청에 실패했습니다.');
                } finally {
                  setRequestReopenLoading(false);
                }
              }}
            >
              {requestReopenLoading ? '요청중...' : '재개 요청'}
            </Button>
          )}
          {!isClosed && isManagerOrAdmin() && (
            <Button variant="danger" size="sm" onClick={() => setShowCloseModal(true)}>
              토론 종료
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => navigate(-1)}>
            나가기
          </Button>
        </div>
      </div>

      {/* Messages */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        {/* Current Agenda */}
        {discussion.current_agenda && !isClosed && (
          <div className="px-4 py-3 bg-primary-50 dark:bg-primary-900/20 border-b border-primary-100 dark:border-primary-800">
            <p className="text-sm font-medium text-primary-700 dark:text-primary-300">
              📌 의제: {discussion.current_agenda}
            </p>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.user.id === user?.id ? 'justify-end' : 'justify-start'}`}
            >
              {message.message_type === 'system' ? (
                <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-2 w-full">
                  {message.content}
                </div>
              ) : message.message_type === 'chart' && message.chart_data ? (
                <div className={`max-w-[85%] ${message.user.id === user?.id ? 'order-1' : ''}`}>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    {message.user.full_name}
                    <span className="ml-2">{formatDate(message.created_at, 'HH:mm')}</span>
                  </div>
                  <div className="w-[320px]">
                    <MiniChart chartData={message.chart_data} height={150} />
                  </div>
                </div>
              ) : (
                <div className={`max-w-[70%] ${message.user.id === user?.id ? 'order-1' : ''}`}>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    {message.user.full_name}
                    <span className="ml-2">{formatDate(message.created_at, 'HH:mm')}</span>
                  </div>
                  <div
                    className={`p-3 rounded-lg ${
                      message.user.id === user?.id
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 dark:text-gray-100'
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

        {/* Input - viewer는 메시지 전송 불가 */}
        {!isClosed && canWrite() && (
          <form onSubmit={handleSendMessage} className="border-t dark:border-gray-700 p-4 flex gap-2">
            <button
              type="button"
              onClick={() => setShowChartModal(true)}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              title="차트 공유"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            </button>
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

          <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
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
        title="세션 관리"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">내보낼 세션을 선택하거나 불필요한 세션을 삭제하세요.</p>

          {sessions.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">세션 정보가 없습니다</p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {sessions.map(session => (
                <div
                  key={session.session_number}
                  className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedSessions.has(session.session_number)}
                      onChange={() => toggleSession(session.session_number)}
                      className="w-4 h-4 text-primary-600 rounded mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          세션 {session.session_number}
                        </p>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          메시지 {session.message_count}개
                        </span>
                      </div>
                      {session.agenda && (
                        <p className="text-sm text-primary-600 dark:text-primary-400 mt-1">
                          📌 {session.agenda}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {session.started_at ? new Date(session.started_at).toLocaleString('ko-KR') : '?'}
                        {session.last_message_at && ` ~ ${new Date(session.last_message_at).toLocaleString('ko-KR')}`}
                      </p>
                      {session.last_message && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">
                          💬 {session.last_message}
                        </p>
                      )}
                    </div>
                    {isManagerOrAdmin() && sessions.length > 1 && (
                      <button
                        onClick={() => handleDeleteSession(session.session_number)}
                        disabled={deleteSessionLoading === session.session_number}
                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded disabled:opacity-50"
                        title="세션 삭제"
                      >
                        {deleteSessionLoading === session.session_number ? (
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between items-center pt-4 border-t dark:border-gray-700">
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
              <Button variant="secondary" size="sm" onClick={() => setShowExportModal(false)}>닫기</Button>
              <Button size="sm" onClick={handleExportTxt} loading={exportLoading} disabled={selectedSessions.size === 0}>
                내보내기 ({selectedSessions.size}개)
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Chart Share Modal */}
      <ChartShareModal
        isOpen={showChartModal}
        onClose={() => setShowChartModal(false)}
        onShare={handleShareChart}
      />

      {/* 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="토론 삭제"
        message={`토론 "${discussion?.title}"을(를) 정말 삭제하시겠습니까?\n\n모든 메시지가 함께 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.`}
        confirmText="삭제"
        confirmVariant="danger"
      />

      {/* 토론 재개 모달 */}
      <Modal
        isOpen={showReopenModal}
        onClose={() => setShowReopenModal(false)}
        title="토론 재개"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            새 세션을 시작합니다. 이 세션에서 논의할 의제를 입력해주세요.
          </p>
          <Input
            label="의제 (필수)"
            placeholder="이번 세션에서 논의할 내용..."
            value={reopenAgenda}
            onChange={(e) => setReopenAgenda(e.target.value)}
            required
          />
          <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
            <Button variant="secondary" onClick={() => setShowReopenModal(false)}>
              취소
            </Button>
            <Button onClick={handleReopen} disabled={!reopenAgenda.trim()}>
              재개
            </Button>
          </div>
        </div>
      </Modal>

      {/* 제목 수정 모달 */}
      <Modal
        isOpen={showEditTitleModal}
        onClose={() => setShowEditTitleModal(false)}
        title="토론 제목 수정"
      >
        <div className="space-y-4">
          <Input
            label="제목"
            placeholder="토론 제목..."
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            required
          />
          <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
            <Button variant="secondary" onClick={() => setShowEditTitleModal(false)}>
              취소
            </Button>
            <Button onClick={handleUpdateTitle} disabled={!editTitle.trim()}>
              저장
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
