import React, { useState, useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { Loading } from '../common';
import ToastContainer from '../common/ToastContainer';
import GlobalSearch from '../common/GlobalSearch';
import useAuthStore from '../../store/authStore';
import useNotificationStore from '../../store/notificationStore';
import { supabase } from '../../lib/supabase';
import './Layout.css';

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark';
  });

  const { user, profile, loading, initialized, initialize } = useAuthStore();
  const { fetchNotifications, subscribeToNotifications } = useNotificationStore();

  // Initialize auth on mount
  useEffect(() => {
    if (!initialized) {
      initialize();
    }
  }, [initialized, initialize]);

  // SECURITY: Monitor for unauthorized session changes (session hijacking detection)
  useEffect(() => {
    if (!initialized || !user) return;

    const currentUserId = user.id;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Check if the session user has changed unexpectedly
        if (session?.user?.id && session.user.id !== currentUserId) {
          console.warn('SECURITY ALERT: Session user changed unexpectedly!', {
            previous: currentUserId,
            current: session.user.id,
            event,
          });

          // Sign out immediately to prevent unauthorized access
          await supabase.auth.signOut({ scope: 'global' });
          await useAuthStore.getState().signOut();
          window.location.href = '/login';
        }
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [initialized, user]);

  // Check for mobile screen
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Fetch notifications and subscribe to real-time updates
  useEffect(() => {
    if (user) {
      fetchNotifications();
      const unsubscribe = subscribeToNotifications(user.id);
      return unsubscribe;
    }
  }, [user, fetchNotifications, subscribeToNotifications]);

  const handleSidebarToggle = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleThemeToggle = () => {
    setIsDarkMode(!isDarkMode);
  };

  // Show loading while initializing
  if (!initialized || loading) {
    return <Loading fullscreen text="Loading..." />;
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-layout">
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={handleSidebarToggle}
        isMobile={isMobile}
        onClose={() => setSidebarOpen(false)}
      />

      <div
        className={`main-wrapper ${sidebarOpen && !isMobile ? 'sidebar-open' : 'sidebar-closed'}`}
      >
        <Navbar
          onMenuClick={handleSidebarToggle}
          isDarkMode={isDarkMode}
          onThemeToggle={handleThemeToggle}
        />

        <main className="main-content">
          <Outlet />
        </main>
      </div>

      <ToastContainer />
      <GlobalSearch />
    </div>
  );
};

export default Layout;
