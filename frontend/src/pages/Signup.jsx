import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { authService } from '../services/authService';
import { universityService } from '../services/universityService';

const POSITION_OPTIONS = [
  { value: '', label: '직책을 선택하세요' },
  { value: '대표', label: '대표' },
  { value: '부대표', label: '부대표' },
  { value: '운용역', label: '운용역' },
  { value: '리서치', label: '리서치' },
  { value: '리스크관리', label: '리스크관리' },
  { value: '컴플라이언스', label: '컴플라이언스' },
  { value: '회계', label: '회계' },
  { value: '일반부원', label: '일반부원' },
];

export function Signup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [universities, setUniversities] = useState([]);
  const [loadingUniversities, setLoadingUniversities] = useState(true);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    passwordConfirm: '',
    full_name: '',
    universityId: '',
    positionTitle: '',
  });

  useEffect(() => {
    loadUniversities();
  }, []);

  const loadUniversities = async () => {
    try {
      const data = await universityService.getActiveUniversities();
      setUniversities(data);
    } catch (err) {
      console.error('Failed to load universities:', err);
    } finally {
      setLoadingUniversities(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다');
      return;
    }

    if (formData.password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다');
      return;
    }

    if (formData.full_name.length < 2) {
      setError('이름은 2자 이상이어야 합니다');
      return;
    }

    if (!formData.universityId) {
      setError('소속 대학교를 선택해주세요');
      return;
    }

    if (!formData.positionTitle) {
      setError('직책을 선택해주세요');
      return;
    }

    setLoading(true);

    try {
      await authService.signup({
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name,
        university_id: Number(formData.universityId),
        position_title: formData.positionTitle,
      });

      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || '회원가입에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-gray-100">
            회원가입
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            펀드팀 메신저에 가입하세요
          </p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded-lg">
            <p className="font-medium">회원가입이 완료되었습니다!</p>
            <p className="text-sm mt-1">팀장 승인 후 로그인할 수 있습니다. 잠시 후 로그인 페이지로 이동합니다...</p>
          </div>
        )}

        <form onSubmit={handleSignup} className="mt-8 space-y-5">
          {/* 소속 대학교 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              소속 대학교
            </label>
            {loadingUniversities ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 py-2">
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-primary-600"></div>
                대학교 목록을 불러오는 중...
              </div>
            ) : universities.length === 0 ? (
              <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2 rounded-lg">
                등록된 대학교가 없습니다. 관리자에게 문의해주세요.
              </div>
            ) : (
              <div className="space-y-2">
                <select
                  name="universityId"
                  value={formData.universityId}
                  onChange={handleChange}
                  className="input"
                  required
                >
                  <option value="">대학교를 선택하세요</option>
                  {universities.map((uni) => (
                    <option key={uni.id} value={uni.id}>
                      {uni.name} ({uni.code})
                    </option>
                  ))}
                </select>
                {/* 선택한 대학교 로고 미리보기 */}
                {formData.universityId && (() => {
                  const selected = universities.find(u => String(u.id) === String(formData.universityId));
                  const logoUrl = selected?.logo_url || selected?.logoUrl;
                  if (!selected || !logoUrl) return null;
                  return (
                    <div className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                      <img
                        src={logoUrl}
                        alt={selected.name}
                        className="h-8 w-8 rounded object-contain"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                        {selected.name}
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          <Input
            label="이메일"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="example@email.com"
            autoComplete="email"
            required
          />

          <Input
            label="이름"
            type="text"
            name="full_name"
            value={formData.full_name}
            onChange={handleChange}
            placeholder="예: 홍길동"
            autoComplete="name"
            required
          />

          {/* 직책 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              직책
            </label>
            <select
              name="positionTitle"
              value={formData.positionTitle}
              onChange={handleChange}
              className="input"
              required
            >
              {POSITION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Input
              label="비밀번호"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="8자 이상 입력"
              autoComplete="new-password"
              minLength={8}
              required
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              비밀번호는 8자 이상이어야 합니다
            </p>
          </div>

          <Input
            label="비밀번호 확인"
            type="password"
            name="passwordConfirm"
            value={formData.passwordConfirm}
            onChange={handleChange}
            placeholder="비밀번호를 다시 입력하세요"
            autoComplete="new-password"
            required
          />

          <Button type="submit" className="w-full" loading={loading}>
            가입하기
          </Button>

          <p className="text-center text-xs text-gray-500 dark:text-gray-400">
            * 팀장 승인 후 로그인할 수 있습니다
          </p>

          <p className="text-center text-sm text-gray-600 dark:text-gray-400">
            이미 계정이 있으신가요?{' '}
            <Link to="/login" className="font-medium text-primary-600 dark:text-primary-400 hover:text-primary-500">
              로그인
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
