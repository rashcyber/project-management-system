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
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { Avatar } from '../common';
import './Sidebar.css';

const Sidebar = ({ isOpen, onToggle, isMobile, onClose }) => {
  const { profile, signOut, isAdmin } = useAuthStore();
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
    { path: '/admin/users', icon: Users, label: 'User Management' },
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

          {isAdmin() && (
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
                    {isOpen && <span>{item.label}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <div className="sidebar-footer">
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
      </aside>
    </>
  );
};

export default Sidebar;
