import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { BlockEditor } from '../components/editor/BlockEditor';
import { columnService } from '../services/columnService';
import { useAuth } from '../hooks/useAuth';

export function ColumnEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEditing = !!id;

  const [title, setTitle] = useState('');
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isEditing) {
      fetchColumn();
    }
  }, [id]);

  const fetchColumn = async () => {
    setLoading(true);
    try {
      const data = await columnService.getColumn(id);
      setTitle(data.title);
      // blocks가 있으면 사용, 없으면 content를 paragraph 블록으로 변환
      if (data.blocks && data.blocks.length > 0) {
        setBlocks(data.blocks);
      } else if (data.content) {
        // 레거시 콘텐츠를 블록으로 변환
        const paragraphs = data.content.split('\n').filter(p => p.trim());
        setBlocks(paragraphs.map((text, i) => ({
          id: `legacy_${i}`,
          type: 'paragraph',
          data: { text }
        })));
      }
    } catch (err) {
      setError('칼럼을 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('제목을 입력해주세요.');
      return;
    }

    // 내용이 있는지 확인
    const hasContent = blocks.some(b =>
      (b.type === 'paragraph' && b.data.text?.trim()) ||
      (b.type === 'heading' && b.data.text?.trim()) ||
      (b.type === 'quote' && b.data.text?.trim()) ||
      (b.type === 'image' && b.data.url) ||
      b.type === 'divider'
    );

    if (!hasContent) {
      setError('내용을 입력해주세요.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const data = {
        title: title.trim(),
        blocks,
        content: null, // 레거시 필드는 비움
      };

      if (isEditing) {
        await columnService.updateColumn(id, data);
      } else {
        await columnService.createColumn(data);
      }

      navigate('/reports');
    } catch (err) {
      setError(err.response?.data?.detail || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500 dark:text-gray-400">로딩중...</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('/reports')}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          <span>돌아가기</span>
        </button>

        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => navigate('/reports')}>
            취소
          </Button>
          <Button onClick={handleSave} loading={saving}>
            {isEditing ? '수정' : '발행'}
          </Button>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* 에디터 영역 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-8">
        {/* 제목 */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목을 입력하세요..."
          className="w-full text-3xl font-bold bg-transparent border-0 outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 mb-8"
        />

        {/* 블록 에디터 */}
        <BlockEditor
          initialBlocks={blocks}
          onChange={setBlocks}
        />
      </div>

      {/* 하단 안내 */}
      <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>빈 줄에서 <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">/</kbd> 입력으로 블록 타입을 선택하세요</p>
      </div>
    </div>
  );
}
