import { Navigate, Outlet } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';

function PublicOnlyRoute() {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <p className="text-overline">Auth</p>
          <h1 className="text-page-title">Carregando autenticacao</h1>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

export default PublicOnlyRoute;
