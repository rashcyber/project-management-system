import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  ListTodo,
  Users,
  Settings,
  Bell,
  Calendar,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Activity,
  ShieldCheck,
  Building2,
  Sun,
  Moon,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import useNotificationStore from '../../store/notificationStore';
import { Avatar } from '../common';
import './Sidebar.css';

const Sidebar = ({ isOpen, onToggle, isMobile, onClose, isDarkMode, onThemeToggle }) => {
  const { profile, signOut, isAdmin, isSystemAdmin } = useAuthStore();
  const { unreadCount } = useNotificationStore();
  const location = useLocation();

  const mainNavItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/projects', icon: FolderKanban, label: 'Projects' },
    { path: '/tasks', icon: CheckSquare, label: 'My Tasks' },
    { path: '/my-subtasks', icon: ListTodo, label: 'My Subtasks' },
    { path: '/activity', icon: Activity, label: 'Activity' },
    { path: '/calendar', icon: Calendar, label: 'Calendar' },
    { path: '/analytics', icon: BarChart3, label: 'Analytics' },
  ];

  const adminNavItems = [
    { path: '/admin/panel', icon: Users, label: 'Workspace Admin' },
    { path: '/admin/users', icon: Users, label: 'User Management' },
  ];

  const systemAdminNavItems = [
    { path: '/admin/dashboard', icon: ShieldCheck, label: 'Dashboard' },
    { path: '/admin/users', icon: Users, label: 'All Users' },
  ];

  const bottomNavItems = [
    { path: '/notifications', icon: Bell, label: 'Notifications' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  const handleNavClick = () => {
    if (isMobile) {
      onClose();
    }
  };

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <>
      {isMobile && isOpen && (
        <div className="sidebar-overlay" onClick={onClose} />
      )}

      <aside className={`sidebar ${isOpen ? 'open' : 'closed'} ${isMobile ? 'mobile' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="logo-icon">
              <CheckSquare size={24} />
            </div>
            {isOpen && <span className="logo-text">ProjectFlow</span>}
          </div>
          {!isMobile && (
            <button className="sidebar-toggle" onClick={onToggle}>
              {isOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          {/* Only show main menu to non-system-admin users */}
          {!isSystemAdmin() && (
            <div className="nav-section">
              {isOpen && <span className="nav-section-title">Main Menu</span>}
              <ul className="nav-list">
                {mainNavItems.map((item) => (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      className={({ isActive }) =>
                        `nav-link ${isActive ? 'active' : ''}`
                      }
                      onClick={handleNavClick}
                      title={!isOpen ? item.label : undefined}
                    >
                      <item.icon size={20} />
                      {isOpen && <span>{item.label}</span>}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isSystemAdmin() && (
            <div className="nav-section">
              {isOpen && <span className="nav-section-title">Platform</span>}
              <ul className="nav-list">
                {systemAdminNavItems.map((item) => (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      className={({ isActive }) =>
                        `nav-link ${isActive ? 'active' : ''}`
                      }
                      onClick={handleNavClick}
                      title={!isOpen ? item.label : undefined}
                    >
                      <item.icon size={20} />
                      {isOpen && <span>{item.label}</span>}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isAdmin() && !isSystemAdmin() && (
            <div className="nav-section">
              {isOpen && <span className="nav-section-title">Admin</span>}
              <ul className="nav-list">
                {adminNavItems.map((item) => (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      className={({ isActive }) =>
                        `nav-link ${isActive ? 'active' : ''}`
                      }
                      onClick={handleNavClick}
                      title={!isOpen ? item.label : undefined}
                    >
                      <item.icon size={20} />
                      {isOpen && <span>{item.label}</span>}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="nav-section">
            {isOpen && <span className="nav-section-title">Other</span>}
            <ul className="nav-list">
              {bottomNavItems.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    className={({ isActive }) =>
                      `nav-link ${isActive ? 'active' : ''}`
                    }
                    onClick={handleNavClick}
                    title={!isOpen ? item.label : undefined}
                  >
                    <item.icon size={20} />
                    {item.path === '/notifications' && unreadCount > 0 && (
                      <span className="notification-badge">{unreadCount}</span>
                    )}
                    {isOpen && <span>{item.label}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="footer-top">
            <div className="user-info">
              <Avatar
                src={profile?.avatar_url}
                name={profile?.full_name}
                size="small"
              />
              {isOpen && (
                <div className="user-details">
                  <span className="user-name">{profile?.full_name || 'User'}</span>
                  <span className="user-role">{profile?.role || 'Member'}</span>
                </div>
              )}
            </div>
            <button
              className="logout-btn"
              onClick={handleLogout}
              title="Sign out"
            >
              <LogOut size={18} />
              {isOpen && <span>Sign Out</span>}
            </button>
          </div>
          <div className="footer-divider"></div>
          <button
            className="theme-toggle-btn"
            onClick={onThemeToggle}
            title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            {isOpen && <span>{isDarkMode ? 'Light' : 'Dark'}</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
