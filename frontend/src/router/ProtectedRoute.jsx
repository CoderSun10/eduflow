/**
 * 受保护路由：未登录则重定向到登录页
 */
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import { RoutePaths } from '../constants/routes.js';

const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((s) => Boolean(s.accessToken));
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to={RoutePaths.LOGIN} replace state={{ from: location }} />;
  }
  return children;
};

export default ProtectedRoute;
