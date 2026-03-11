import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useStore } from '../../contexts/StoreContext';

function ProtectedRoute({ requiredRoles = [], children }) {
  const location = useLocation();
  const { loading, isAuthenticated, hasRole } = useAuth();
  const { loading: storeLoading } = useStore();

  if (loading || (isAuthenticated && storeLoading)) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <p className="text-overline">Auth</p>
          <h1 className="text-page-title">Preparando ambiente</h1>
          <p className="text-body">Aguarde enquanto a autenticacao e a loja ativa sao verificadas.</p>
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
