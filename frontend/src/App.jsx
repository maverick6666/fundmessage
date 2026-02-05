import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WebSocketProvider } from './context/WebSocketContext';
import { Layout } from './components/layout/Layout';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Dashboard } from './pages/Dashboard';
import { Positions } from './pages/Positions';
import { PositionDetail } from './pages/PositionDetail';
import { Requests } from './pages/Requests';
import { MyRequests } from './pages/MyRequests';
import { Discussion } from './pages/Discussion';
import { Discussions } from './pages/Discussions';
import { Stats } from './pages/Stats';
import { TeamManagement } from './pages/TeamManagement';
import { Notifications } from './pages/Notifications';
import StockSearch from './pages/StockSearch';

function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
}

function ManagerRoute({ children }) {
  const { isManagerOrAdmin } = useAuth();

  if (!isManagerOrAdmin()) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
      />

      <Route
        path="/signup"
        element={isAuthenticated ? <Navigate to="/" replace /> : <Signup />}
      />

      <Route
        path="/"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />

      <Route
        path="/stock-search"
        element={
          <PrivateRoute>
            <StockSearch />
          </PrivateRoute>
        }
      />

      <Route
        path="/positions"
        element={
          <PrivateRoute>
            <Positions />
          </PrivateRoute>
        }
      />

      <Route
        path="/positions/:id"
        element={
          <PrivateRoute>
            <PositionDetail />
          </PrivateRoute>
        }
      />

      <Route
        path="/requests"
        element={
          <PrivateRoute>
            <ManagerRoute>
              <Requests />
            </ManagerRoute>
          </PrivateRoute>
        }
      />

      <Route
        path="/my-requests"
        element={
          <PrivateRoute>
            <MyRequests />
          </PrivateRoute>
        }
      />

      <Route
        path="/discussions"
        element={
          <PrivateRoute>
            <Discussions />
          </PrivateRoute>
        }
      />

      <Route
        path="/discussions/:id"
        element={
          <PrivateRoute>
            <Discussion />
          </PrivateRoute>
        }
      />

      <Route
        path="/stats"
        element={
          <PrivateRoute>
            <Stats />
          </PrivateRoute>
        }
      />

      <Route
        path="/notifications"
        element={
          <PrivateRoute>
            <Notifications />
          </PrivateRoute>
        }
      />

      <Route
        path="/team"
        element={
          <PrivateRoute>
            <ManagerRoute>
              <TeamManagement />
            </ManagerRoute>
          </PrivateRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <WebSocketProvider>
        <AppRoutes />
      </WebSocketProvider>
    </AuthProvider>
  );
}

export default App;
