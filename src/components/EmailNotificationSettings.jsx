import React, { useState, useEffect } from 'react';
import { Mail, Loader } from 'lucide-react';
import useNotificationStore from '../store/notificationStore';
import './EmailNotificationSettings.css';

export function EmailNotificationSettings() {
  const [loading, setLoading] = useState(false);
  const [preferences, setPreferences] = useState(null);
  const [saved, setSaved] = useState(false);

  const {
    fetchEmailPreferences,
    updateEmailPreferences,
    toggleEmailNotifications,
    updateEmailDigestFrequency,
    updateEmailNotificationTypes,
  } = useNotificationStore();

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    setLoading(true);
    try {
      const result = await fetchEmailPreferences();
      if (result.error) throw result.error;
      setPreferences(result.data);
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEmailNotifications = async () => {
    setLoading(true);
    try {
      const result = await toggleEmailNotifications();
      if (result.error) throw result.error;
      setPreferences((prev) => ({
        ...prev,
        email_notifications_enabled: result.data.email_notifications_enabled,
      }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Error toggling notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFrequencyChange = async (frequency) => {
    setLoading(true);
    try {
      const result = await updateEmailDigestFrequency(frequency);
      if (result.error) throw result.error;
      setPreferences((prev) => ({
        ...prev,
        email_digest_frequency: frequency,
      }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Error updating frequency:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationTypeChange = async (type) => {
    const newTypes = {
      ...preferences.email_notification_types,
      [type]: !preferences.email_notification_types[type],
    };
    setPreferences((prev) => ({
      ...prev,
      email_notification_types: newTypes,
    }));

    setLoading(true);
    try {
      const result = await updateEmailNotificationTypes(newTypes);
      if (result.error) throw result.error;
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Error updating notification types:', error);
      // Revert on error
      setPreferences((prev) => ({
        ...prev,
        email_notification_types: preferences.email_notification_types,
      }));
    } finally {
      setLoading(false);
    }
  };

  if (loading && !preferences) {
    return (
      <div className="email-notification-settings">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <Loader className="animate-spin" size={24} style={{ color: '#3b82f6' }} />
        </div>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="email-notification-settings">
        <div style={{ padding: '1rem', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px' }}>
          <p style={{ color: '#991b1b', margin: 0 }}>Failed to load email preferences</p>
        </div>
      </div>
    );
  }

  return (
    <div className="email-notification-settings">
      <div className="header">
        <Mail size={24} />
        <h2>Email Notifications</h2>
      </div>

      {saved && (
        <div className="success-message">
          <p>Preferences saved successfully</p>
        </div>
      )}

      <div className="settings-content">
        {/* Enable/Disable Email Notifications */}
        <div className="toggle-section">
          <div className="toggle-info">
            <h3>Email Notifications</h3>
            <p>
              {preferences.email_notifications_enabled
                ? 'You are receiving email notifications'
                : 'Email notifications are disabled'}
            </p>
          </div>
          <button
            onClick={handleToggleEmailNotifications}
            disabled={loading}
            className={`toggle-switch ${preferences.email_notifications_enabled ? 'active' : ''}`}
          />
        </div>

        {/* Digest Frequency */}
        {preferences.email_notifications_enabled && (
          <>
            <div className="frequency-section">
              <h3>Email Frequency</h3>
              <div className="frequency-options">
                {[
                  { value: 'real-time', label: 'Real-time', description: 'Get notified immediately' },
                  { value: 'daily', label: 'Daily Digest', description: 'One email per day' },
                  { value: 'weekly', label: 'Weekly Digest', description: 'One email per week' },
                  { value: 'never', label: 'Never', description: 'Only in-app notifications' },
                ].map((option) => (
                  <label key={option.value} className="frequency-option">
                    <input
                      type="radio"
                      name="frequency"
                      value={option.value}
                      checked={preferences.email_digest_frequency === option.value}
                      onChange={(e) => handleFrequencyChange(e.target.value)}
                      disabled={loading}
                    />
                    <div className="frequency-option-label">
                      <span className="label-text">{option.label}</span>
                      <span className="label-desc">{option.description}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Notification Types */}
            <div className="notification-types-section">
              <h3>Email Me When...</h3>
              <div className="notification-types">
                {[
                  {
                    key: 'task_assigned',
                    label: 'Task Assigned',
                    description: 'Someone assigns a task to me',
                  },
                  {
                    key: 'task_completed',
                    label: 'Task Completed',
                    description: 'A task I\'m assigned to is completed',
                  },
                  {
                    key: 'task_mentioned',
                    label: 'Task Mentioned',
                    description: 'Someone mentions me in a task',
                  },
                  {
                    key: 'project_created',
                    label: 'Project Created',
                    description: 'A new project is created',
                  },
                  {
                    key: 'comment_mentioned',
                    label: 'Comment Mentioned',
                    description: 'Someone mentions me in a comment',
                  },
                ].map((type) => (
                  <label key={type.key} className="notification-type">
                    <input
                      type="checkbox"
                      checked={preferences.email_notification_types[type.key] ?? true}
                      onChange={() => handleNotificationTypeChange(type.key)}
                      disabled={loading}
                    />
                    <div className="notification-type-label">
                      <span className="label-text">{type.label}</span>
                      <span className="label-desc">{type.description}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Info Box */}
        <div className="info-box">
          <p>
            <span className="info-label">Note:</span> Your email preferences are synced across all your devices. You can change these settings at any time.
          </p>
        </div>
      </div>
    </div>
  );
}

export default EmailNotificationSettings;
