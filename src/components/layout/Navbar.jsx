import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu,
  Bell,
  Sun,
  Moon,
  Plus,
  Clock,
  Calendar,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import useNotificationStore from '../../store/notificationStore';
import { Avatar } from '../common';
import './Navbar.css';
import { format } from 'date-fns';

const Navbar = ({ onMenuClick, isDarkMode, onThemeToggle }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const { profile, signOut } = useAuthStore();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationStore();
  const navigate = useNavigate();

  const notificationRef = useRef(null);
  const userMenuRef = useRef(null);

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    if (notification.task_id && notification.project_id) {
      navigate(`/projects/${notification.project_id}/board?task=${notification.task_id}`);
    } else if (notification.task_id) {
      const { data: task } = await supabase
        .from('tasks')
        .select('project_id')
        .eq('id', notification.task_id)
        .single();

      if (task?.project_id) {
        navigate(`/projects/${task.project_id}/board?task=${notification.task_id}`);
      } else {
        navigate('/projects');
      }
    } else if (notification.project_id) {
      navigate(`/projects/${notification.project_id}/board`);
    }

    setShowNotifications(false);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <header className="navbar">
      <div className="navbar-left">
        <button className="menu-btn" onClick={onMenuClick}>
          <Menu size={24} />
        </button>

        {/* Date/Time Display */}
        <div className="navbar-datetime">
          <span className="datetime-item">
            <Clock size={16} />
            <span>{format(currentTime, 'h:mm a')}</span>
          </span>
          <span className="datetime-divider"></span>
          <span className="datetime-item">
            <Calendar size={16} />
            <span>{format(currentTime, 'EEEE, MMM d')}</span>
          </span>
        </div>
      </div>

      <div className="navbar-right">
        <button
          className="navbar-btn"
          onClick={onThemeToggle}
          title={isDarkMode ? 'Light mode' : 'Dark mode'}
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <div className="notification-wrapper" ref={notificationRef}>
          <button
            className="navbar-btn notification-btn"
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </button>

          {showNotifications && (
            <div className="notification-dropdown">
              <div className="notification-header">
                <h3>Notifications</h3>
                {unreadCount > 0 && (
                  <button className="mark-all-read" onClick={markAllAsRead}>
                    Mark all read
                  </button>
                )}
              </div>

              <div className="notification-list">
                {notifications.length === 0 ? (
                  <div className="notification-empty">
                    <Bell size={32} />
                    <p>No notifications yet</p>
                  </div>
                ) : (
                  notifications.slice(0, 5).map((notification) => (
                    <div
                      key={notification.id}
                      className={`notification-item ${!notification.read ? 'unread' : ''}`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="notification-content">
                        <p className="notification-title">{notification.title}</p>
                        <p className="notification-message">{notification.message}</p>
                        <span className="notification-time">
                          {formatTimeAgo(notification.created_at)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {notifications.length > 0 && (
                <div className="notification-footer">
                  <button onClick={() => {
                    navigate('/notifications');
                    setShowNotifications(false);
                  }}>
                    View all notifications
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          className="navbar-btn create-btn"
          onClick={() => navigate('/projects/new')}
          title="Create new project"
        >
          <Plus size={20} />
        </button>

        <div className="user-menu-wrapper" ref={userMenuRef}>
          <button
            className="user-menu-btn"
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            <Avatar
              src={profile?.avatar_url}
              name={profile?.full_name}
              size="small"
            />
          </button>

          {showUserMenu && (
            <div className="user-dropdown">
              <div className="user-dropdown-header">
                <Avatar
                  src={profile?.avatar_url}
                  name={profile?.full_name}
                  size="large"
                />
                <div className="user-dropdown-info">
                  <span className="user-dropdown-name">{profile?.full_name}</span>
                  <span className="user-dropdown-email">{profile?.email}</span>
                </div>
              </div>

              <div className="user-dropdown-menu">
                <button onClick={() => { navigate('/settings'); setShowUserMenu(false); }}>
                  Settings
                </button>
                <button onClick={handleLogout} className="logout">
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
