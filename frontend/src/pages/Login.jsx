import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || '로그인에 실패했습니다.');
      setPassword(''); // 보안: 로그인 실패 시 비밀번호 초기화
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 transition-colors duration-200">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-600 dark:text-primary-400">Fund Messenger</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">펀드팀 매매 의사결정 관리 시스템</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 transition-colors duration-200">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm border border-red-200 dark:border-red-800">
                {error}
              </div>
            )}

            <Input
              label="이메일"
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />

            <Input
              label="비밀번호"
              type="password"
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />

            <Button
              type="submit"
              className="w-full"
              loading={loading}
            >
              로그인
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-4">
          계정이 없으신가요?{' '}
          <Link to="/signup" className="font-medium text-primary-600 dark:text-primary-400 hover:text-primary-500">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
