import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

/**
 * Hook to redirect System Admins away from regular user pages
 * System Admins should only access the System Admin Dashboard
 */
export const useSystemAdminGuard = () => {
  const navigate = useNavigate();
  const { isSystemAdmin } = useAuthStore();

  useEffect(() => {
    if (isSystemAdmin()) {
      navigate('/admin/dashboard');
    }
  }, [isSystemAdmin, navigate]);
};

export default useSystemAdminGuard;
