import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCircle,
  UserPlus,
  MessageSquare,
  Clock,
  Trash2,
  CheckCheck,
  FolderKanban,
} from 'lucide-react';
import { Button, Avatar } from '../components/common';
import useNotificationStore from '../store/notificationStore';
import { format, formatDistanceToNow } from 'date-fns';
import './Notifications.css';

const NOTIFICATION_ICONS = {
  task_assigned: UserPlus,
  task_updated: CheckCircle,
  task_comment: MessageSquare,
  due_reminder: Clock,
  project_invite: FolderKanban,
  mention: MessageSquare,
};

const Notifications = () => {
  const navigate = useNavigate();
  const {
    notifications,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  } = useNotificationStore();

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // Navigate based on notification type
    if (notification.task_id) {
      navigate(`/projects/${notification.project_id}/board`);
    } else if (notification.project_id) {
      navigate(`/projects/${notification.project_id}/board`);
    }
  };

  const getTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return formatDistanceToNow(date, { addSuffix: true });
    }
    return format(date, 'MMM d, yyyy');
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="notifications-page">
      {/* Header */}
      <div className="notifications-header">
        <div>
          <h1>Notifications</h1>
          <p>Stay updated on your tasks and projects</p>
        </div>
        <div className="header-actions">
          {unreadCount > 0 && (
            <Button variant="secondary" size="small" onClick={markAllAsRead}>
              <CheckCheck size={16} />
              Mark all as read
            </Button>
          )}
          {notifications.length > 0 && (
            <Button variant="ghost" size="small" onClick={clearAll}>
              <Trash2 size={16} />
              Clear all
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="notifications-stats">
        <div className="stat-item">
          <span className="stat-value">{notifications.length}</span>
          <span className="stat-label">Total</span>
        </div>
        <div className="stat-item unread">
          <span className="stat-value">{unreadCount}</span>
          <span className="stat-label">Unread</span>
        </div>
      </div>

      {/* Notifications List */}
      <div className="notifications-container">
        {loading ? (
          <div className="loading-state">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="empty-state">
            <Bell size={64} />
            <h2>No notifications</h2>
            <p>You're all caught up! We'll notify you when something new happens.</p>
          </div>
        ) : (
          <div className="notifications-list">
            {notifications.map((notification) => {
              const Icon = NOTIFICATION_ICONS[notification.type] || Bell;

              return (
                <div
                  key={notification.id}
                  className={`notification-item ${!notification.read ? 'unread' : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-item-left">
                    <div className={`notification-icon ${notification.type}`}>
                      <Icon size={20} />
                    </div>
                    {notification.actor && (
                      <div className="notification-actor">
                        <Avatar
                          src={notification.actor.avatar_url}
                          name={notification.actor.full_name}
                          size="medium"
                        />
                      </div>
                    )}
                  </div>

                  <div className="notification-content">
                    <h3 className="notification-title">{notification.title}</h3>
                    <p className="notification-message">{notification.message}</p>
                    <span className="notification-time">
                      {getTimeAgo(notification.created_at)}
                    </span>
                  </div>

                  <div className="notification-actions">
                    {!notification.read && (
                      <button
                        className="mark-read-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notification.id);
                        }}
                        title="Mark as read"
                      >
                        <CheckCircle size={16} />
                      </button>
                    )}
                    <button
                      className="delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                      }}
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
