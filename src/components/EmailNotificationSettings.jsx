import React, { useState, useEffect } from 'react';
import { Mail, Loader } from 'lucide-react';
import useNotificationStore from '../store/notificationStore';

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
      <div className="flex items-center justify-center p-8">
        <Loader className="animate-spin text-blue-600" size={24} />
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600">Failed to load email preferences</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-6">
        <Mail className="text-blue-600" size={24} />
        <h2 className="text-xl font-bold text-gray-800">Email Notifications</h2>
      </div>

      {saved && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-700 text-sm font-medium">Preferences saved successfully</p>
        </div>
      )}

      <div className="space-y-6">
        {/* Enable/Disable Email Notifications */}
        <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
          <div>
            <h3 className="font-semibold text-gray-800">Email Notifications</h3>
            <p className="text-sm text-gray-600">
              {preferences.email_notifications_enabled
                ? 'You are receiving email notifications'
                : 'Email notifications are disabled'}
            </p>
          </div>
          <button
            onClick={handleToggleEmailNotifications}
            disabled={loading}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              preferences.email_notifications_enabled
                ? 'bg-blue-600'
                : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                preferences.email_notifications_enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Digest Frequency */}
        {preferences.email_notifications_enabled && (
          <>
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Email Frequency</h3>
              <div className="space-y-2">
                {[
                  { value: 'real-time', label: 'Real-time', description: 'Get notified immediately' },
                  { value: 'daily', label: 'Daily Digest', description: 'One email per day' },
                  { value: 'weekly', label: 'Weekly Digest', description: 'One email per week' },
                  { value: 'never', label: 'Never', description: 'Only in-app notifications' },
                ].map((option) => (
                  <label key={option.value} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="frequency"
                      value={option.value}
                      checked={preferences.email_digest_frequency === option.value}
                      onChange={(e) => handleFrequencyChange(e.target.value)}
                      disabled={loading}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div>
                      <div className="font-medium text-gray-800">{option.label}</div>
                      <div className="text-sm text-gray-600">{option.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Notification Types */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Email Me When...</h3>
              <div className="space-y-2">
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
                  <label key={type.key} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={preferences.email_notification_types[type.key] ?? true}
                      onChange={() => handleNotificationTypeChange(type.key)}
                      disabled={loading}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <div>
                      <div className="font-medium text-gray-800">{type.label}</div>
                      <div className="text-sm text-gray-600">{type.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Info Box */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Note:</span> Your email preferences are synced across all your devices. You can change these settings at any time.
          </p>
        </div>
      </div>
    </div>
  );
}

export default EmailNotificationSettings;
