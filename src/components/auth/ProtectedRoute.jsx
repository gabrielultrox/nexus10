import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';

function ProtectedRoute({ requiredRoles = [], children }) {
  const location = useLocation();
  const { loading, isAuthenticated, hasRole } = useAuth();

  if (loading) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <p className="text-overline">Auth</p>
          <h1 className="text-page-title">Validando sessao</h1>
          <p className="text-body">Aguarde enquanto a autenticacao e verificada.</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!hasRole(requiredRoles)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (children) {
    return children;
  }

  return <Outlet />;
}

export default ProtectedRoute;
