import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { useTheme } from '../context/ThemeContext';
import { authService } from '../services/authService';

export function Signup() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    passwordConfirm: '',
    full_name: ''
  });

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

    setLoading(true);

    try {
      await authService.signup({
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name
      });

      setSuccess(true);
      // 3초 후 로그인 페이지로 이동
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
      {/* 다크모드 토글 (우상단) */}
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 p-3 rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        title={theme === 'dark' ? '라이트 모드' : '다크 모드'}
        aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
      >
        {theme === 'dark' ? (
          <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        )}
      </button>

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
