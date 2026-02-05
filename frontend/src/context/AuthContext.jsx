import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adminMode, setAdminMode] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    if (authService.isAuthenticated()) {
      try {
        const userData = await authService.getCurrentUser();
        setUser(userData);
      } catch (error) {
        authService.logout();
      }
    }
    setLoading(false);
  };

  const login = async (email, password) => {
    const userData = await authService.login(email, password);
    setUser(userData);
    return userData;
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  const isManagerOrAdmin = () => {
    return user?.role === 'manager' || user?.role === 'admin';
  };

  const isManager = () => {
    return user?.role === 'manager';
  };

  const toggleAdminMode = () => {
    if (isManagerOrAdmin()) {
      setAdminMode(!adminMode);
    }
  };

  // 로그아웃 시 관리자 모드 해제
  const handleLogout = () => {
    authService.logout();
    setUser(null);
    setAdminMode(false);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout: handleLogout,
      isManagerOrAdmin,
      isManager,
      isAuthenticated: !!user,
      adminMode,
      toggleAdminMode
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
