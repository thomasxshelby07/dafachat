import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const dashboardRoute = {
      customer: '/customer',
      agent: '/agent',
      manager: '/manager',
      super_admin: '/admin',
    };
    return <Navigate to={dashboardRoute[user.role] || '/login'} replace />;
  }

  return children;
};

export default ProtectedRoute;
