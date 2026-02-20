import { useState, useEffect, useRef } from 'react';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Modal } from '../components/common/Modal';
import { universityService } from '../services/universityService';
import { useToast } from '../context/ToastContext';
import api from '../services/api';

export function AdminUniversities() {
  const toast = useToast();
  const [universities, setUniversities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    logoUrl: '',
  });

  useEffect(() => {
    loadUniversities();
  }, []);

  const loadUniversities = async () => {
    setLoading(true);
    try {
      const data = await universityService.getAllUniversities();
      setUniversities(data);
    } catch (error) {
      toast.error('대학교 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingId(null);
    setFormData({ name: '', code: '', logoUrl: '' });
    setModalOpen(true);
  };

  const openEditModal = (university) => {
    setEditingId(university.id);
    setFormData({
      name: university.name,
      code: university.code,
      logoUrl: university.logo_url || university.logoUrl || '',
    });
    setModalOpen(true);
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 이미지 파일 검증
    if (!file.type.startsWith('image/')) {
      toast.error('이미지 파일만 업로드 가능합니다.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('파일 크기는 5MB 이하여야 합니다.');
      return;
    }

    setUploadingLogo(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      const response = await api.post('/uploads/image', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const uploadedUrl = response.data.data.url;
      setFormData((prev) => ({ ...prev, logoUrl: uploadedUrl }));
      toast.success('로고가 업로드되었습니다.');
    } catch (error) {
      toast.error('로고 업로드에 실패했습니다.');
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) {
      toast.error('대학교명과 학교코드를 입력해주세요.');
      return;
    }

    setActionLoading(true);
    try {
      if (editingId) {
        await universityService.updateUniversity(editingId, formData);
        toast.success('대학교 정보가 수정되었습니다.');
      } else {
        await universityService.createUniversity(formData);
        toast.success('대학교가 등록되었습니다.');
      }
      setModalOpen(false);
      await loadUniversities();
    } catch (error) {
      toast.error(error.response?.data?.detail || '저장에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`"${name}" 대학교를 비활성화하시겠습니까?`)) return;

    try {
      await universityService.deleteUniversity(id);
      toast.success('대학교가 비활성화되었습니다.');
      await loadUniversities();
    } catch (error) {
      toast.error('비활성화에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">대학교 관리</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            등록된 대학교를 관리합니다. 사용자는 회원가입 시 등록된 대학교 중 하나를 선택합니다.
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          대학교 추가
        </Button>
      </div>

      {/* University List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {universities.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">등록된 대학교가 없습니다</h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              대학교를 추가하면 사용자가 회원가입 시 선택할 수 있습니다.
            </p>
            <Button onClick={openCreateModal} className="mt-4">
              첫 대학교 추가하기
            </Button>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">로고</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">대학교명</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">학교코드</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">상태</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">관리</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {universities.map((uni) => {
                const logoUrl = uni.logo_url || uni.logoUrl;
                return (
                  <tr key={uni.id} className={!uni.is_active && !uni.isActive ? 'opacity-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt={uni.name}
                          className="h-10 w-10 rounded-lg object-contain bg-gray-100 dark:bg-gray-700 p-1"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                          <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{uni.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-sm font-mono text-gray-700 dark:text-gray-300">
                        {uni.code}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {(uni.is_active ?? uni.isActive) ? (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          활성
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                          비활성
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => openEditModal(uni)}>
                          수정
                        </Button>
                        {(uni.is_active ?? uni.isActive) && (
                          <Button size="sm" variant="danger" onClick={() => handleDelete(uni.id, uni.name)}>
                            비활성화
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? '대학교 수정' : '대학교 추가'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="대학교명"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="예: 서울대학교"
            required
          />

          <Input
            label="학교코드"
            type="text"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            placeholder="예: SNU"
            required
          />

          {/* Logo Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              대학교 로고
            </label>
            <div className="flex items-center gap-4">
              {formData.logoUrl ? (
                <div className="relative">
                  <img
                    src={formData.logoUrl}
                    alt="로고 미리보기"
                    className="h-16 w-16 rounded-lg object-contain bg-gray-100 dark:bg-gray-700 p-1"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, logoUrl: '' })}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="h-16 w-16 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  loading={uploadingLogo}
                >
                  {uploadingLogo ? '업로드 중...' : '이미지 선택'}
                </Button>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  PNG, JPG, WEBP (최대 5MB)
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              취소
            </Button>
            <Button type="submit" loading={actionLoading}>
              {editingId ? '수정' : '추가'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
