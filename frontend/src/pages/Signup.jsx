import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { authService } from '../services/authService';

export function Signup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    passwordConfirm: '',
    full_name: ''
  });

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');

    // 유효성 검사
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
      const result = await authService.signup({
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name
      });

      alert(result.message || '회원가입이 완료되었습니다. 팀장 승인 후 로그인할 수 있습니다.');
      navigate('/login');
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            회원가입
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            펀드팀 메신저에 가입하세요
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
            {error}
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
            required
          />

          <Input
            label="이름"
            type="text"
            name="full_name"
            value={formData.full_name}
            onChange={handleChange}
            placeholder="예: 홍길동"
            required
          />

          <Input
            label="비밀번호"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="8자 이상"
            minLength={8}
            required
          />

          <Input
            label="비밀번호 확인"
            type="password"
            name="passwordConfirm"
            value={formData.passwordConfirm}
            onChange={handleChange}
            placeholder="비밀번호를 다시 입력하세요"
            required
          />

          <Button type="submit" className="w-full" loading={loading}>
            가입하기
          </Button>

          <p className="text-center text-xs text-gray-500">
            * 팀장 승인 후 로그인할 수 있습니다
          </p>

          <p className="text-center text-sm text-gray-600">
            이미 계정이 있으신가요?{' '}
            <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500">
              로그인
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
