import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export function Header({ onMenuClick }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="bg-white border-b h-16 flex items-center px-4 sticky top-0 z-40">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg hover:bg-gray-100 mr-2"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="flex items-center">
        <h1 className="text-xl font-bold text-primary-600">Fund Messenger</h1>
      </div>

      <div className="ml-auto flex items-center space-x-4">
        <span className="text-sm text-gray-600">
          {user?.full_name}
          <span className="ml-2 px-2 py-0.5 bg-gray-100 rounded text-xs">
            {user?.role === 'manager' ? '팀장' : user?.role === 'admin' ? '관리자' : '팀원'}
          </span>
        </span>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          로그아웃
        </button>
      </div>
    </header>
  );
}
