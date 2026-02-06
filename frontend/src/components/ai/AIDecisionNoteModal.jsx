import { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { aiService } from '../../services/aiService';
import { formatRelativeTime } from '../../utils/formatters';

export function AIDecisionNoteModal({
  isOpen,
  onClose,
  sessions = [],
  positionId,
  onGenerated
}) {
  const [selectedSessions, setSelectedSessions] = useState([]);
  const [aiStatus, setAiStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchAIStatus();
      setSelectedSessions([]);
      setGeneratedContent(null);
      setError(null);
    }
  }, [isOpen]);

  const fetchAIStatus = async () => {
    setLoading(true);
    try {
      const status = await aiService.getStatus();
      setAiStatus(status);
    } catch (err) {
      console.error('Failed to fetch AI status:', err);
      setAiStatus({ enabled: false, can_use: false });
    } finally {
      setLoading(false);
    }
  };

  const toggleSession = (sessionId) => {
    setSelectedSessions(prev =>
      prev.includes(sessionId)
        ? prev.filter(id => id !== sessionId)
        : [...prev, sessionId]
    );
  };

  const handleGenerate = async () => {
    if (selectedSessions.length === 0) {
      setError('최소 1개 이상의 세션을 선택해주세요');
      return;
    }

    setGenerating(true);
    setError(null);
    try {
      const result = await aiService.generateDecisionNote(selectedSessions, positionId);
      setGeneratedContent(result.data.content);
      setAiStatus(prev => ({
        ...prev,
        remaining_uses: result.data.remaining_uses
      }));
    } catch (err) {
      setError(err.response?.data?.detail || 'AI 생성에 실패했습니다');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = () => {
    if (generatedContent && onGenerated) {
      onGenerated(generatedContent);
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="AI 의사결정서 작성"
    >
      {loading ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          로딩중...
        </div>
      ) : !aiStatus?.enabled ? (
        <div className="text-center py-8">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-gray-600 dark:text-gray-400">AI 기능이 활성화되지 않았습니다</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">관리자에게 OpenAI API 키 설정을 요청하세요</p>
        </div>
      ) : generatedContent ? (
        // 생성 결과 표시
        <div className="space-y-4">
          <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg max-h-96 overflow-y-auto">
            <div className="prose dark:prose-invert max-w-none text-sm">
              {generatedContent.split('\n').map((line, i) => {
                if (line.startsWith('## ')) {
                  return <h3 key={i} className="text-lg font-semibold mt-4 mb-2 dark:text-gray-200">{line.slice(3)}</h3>;
                } else if (line.startsWith('# ')) {
                  return <h2 key={i} className="text-xl font-bold mt-4 mb-2 dark:text-gray-100">{line.slice(2)}</h2>;
                } else if (line.match(/^\d+\./)) {
                  return <p key={i} className="ml-4 mb-1 dark:text-gray-300">{line}</p>;
                } else if (line.startsWith('- ')) {
                  return <p key={i} className="ml-4 mb-1 dark:text-gray-300">• {line.slice(2)}</p>;
                } else {
                  return <p key={i} className="mb-2 dark:text-gray-300">{line || '\u00A0'}</p>;
                }
              })}
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t dark:border-gray-700">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              남은 사용 횟수: {aiStatus?.remaining_uses || 0}회
            </span>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setGeneratedContent(null)}>
                다시 생성
              </Button>
              <Button onClick={handleSave}>
                저장하기
              </Button>
            </div>
          </div>
        </div>
      ) : (
        // 세션 선택 UI
        <div className="space-y-4">
          {/* AI 상태 표시 */}
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${aiStatus?.can_use ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {aiStatus?.can_use ? 'AI 사용 가능' : '사용 불가'}
              </span>
            </div>
            <span className="text-sm font-medium dark:text-gray-300">
              남은 횟수: {aiStatus?.remaining_uses || 0}/{aiStatus?.daily_limit || 3}
            </span>
          </div>

          {/* 세션 목록 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              분석할 토론 세션 선택
            </label>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {sessions.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                  토론 세션이 없습니다
                </p>
              ) : (
                sessions.map((session) => (
                  <label
                    key={session.id}
                    className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedSessions.includes(session.id)
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSessions.includes(session.id)}
                      onChange={() => toggleSession(session.id)}
                      className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                    />
                    <div className="ml-3 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          세션 #{session.id}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {session.message_count || 0}개 메시지
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {formatRelativeTime(session.created_at)}
                        {session.opener && ` · ${session.opener.full_name}`}
                      </p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
            <Button variant="secondary" onClick={onClose}>
              취소
            </Button>
            <Button
              onClick={handleGenerate}
              loading={generating}
              disabled={!aiStatus?.can_use || selectedSessions.length === 0}
            >
              AI로 생성하기
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
