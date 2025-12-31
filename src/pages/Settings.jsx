import React, { useState } from 'react';
import {
  User,
  Mail,
  Lock,
  Bell,
  Eye,
  EyeOff,
  Save,
  Check,
} from 'lucide-react';
import { Button, Avatar } from '../components/common';
import useAuthStore from '../store/authStore';
import { toast } from '../store/toastStore';
import { supabase } from '../lib/supabase';
import './Settings.css';

const Settings = () => {
  const { profile, updateProfile } = useAuthStore();

  const [activeTab, setActiveTab] = useState('profile');
  const [isLoading, setIsLoading] = useState(false);

  // Profile form state
  const [profileData, setProfileData] = useState({
    full_name: profile?.full_name || '',
    email: profile?.email || '',
  });

  // Password form state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  // Notification preferences state
  const [notifications, setNotifications] = useState({
    taskAssignments: true,
    taskUpdates: true,
    comments: true,
    dueDateReminders: true,
    projectInvites: true,
  });

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileData((prev) => ({ ...prev, [name]: value }));
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await updateProfile({
      full_name: profileData.full_name,
    });

    if (error) {
      toast.error('Failed to update profile');
    } else {
      toast.success('Profile updated successfully');
    }
    setIsLoading(false);
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
  };

  const validatePassword = () => {
    // Check password requirements
    if (passwordData.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return false;
    }
    if (!/[A-Z]/.test(passwordData.newPassword)) {
      toast.error('Password must contain an uppercase letter');
      return false;
    }
    if (!/[a-z]/.test(passwordData.newPassword)) {
      toast.error('Password must contain a lowercase letter');
      return false;
    }
    if (!/[0-9]/.test(passwordData.newPassword)) {
      toast.error('Password must contain a number');
      return false;
    }

    // Check if passwords match
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Passwords do not match');
      return false;
    }

    return true;
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    if (!validatePassword()) return;

    setIsLoading(true);

    try {
      // First, verify current password by re-authenticating
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile?.email,
        password: passwordData.currentPassword,
      });

      if (signInError) {
        toast.error('Current password is incorrect');
        setIsLoading(false);
        return;
      }

      // If current password is correct, update to new password
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (error) throw error;

      toast.success('Password updated successfully');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      toast.error(error.message || 'Failed to update password');
    }

    setIsLoading(false);
  };

  const handleNotificationChange = (key) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleNotificationSubmit = () => {
    toast.success('Notification preferences saved');
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  return (
    <div className="settings-page">
      {/* Header */}
      <div className="page-header">
        <h1>Settings</h1>
        <p>Manage your account settings and preferences</p>
      </div>

      {/* Tab Navigation */}
      <div className="settings-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon size={18} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="settings-card">
          <div className="card-header">
            <h2>Profile Information</h2>
            <p>Update your personal information and profile details</p>
          </div>

          <div className="card-body">
            {/* Profile Preview */}
            <div className="profile-preview">
              <Avatar
                src={profile?.avatar_url}
                name={profile?.full_name}
                size="xlarge"
              />
              <div className="profile-preview-info">
                <h3>{profile?.full_name || 'Your Name'}</h3>
                <p>{profile?.email}</p>
                <span className="role-tag">{profile?.role || 'Member'}</span>
              </div>
            </div>

            {/* Profile Form */}
            <form onSubmit={handleProfileSubmit}>
              <div className="form-row">
                <label className="form-label">Full Name</label>
                <div className="input-wrapper">
                  <User size={18} className="input-icon" />
                  <input
                    type="text"
                    name="full_name"
                    value={profileData.full_name}
                    onChange={handleProfileChange}
                    placeholder="Enter your full name"
                    className="form-control"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <label className="form-label">Email Address</label>
                <div className="input-wrapper">
                  <Mail size={18} className="input-icon" />
                  <input
                    type="email"
                    name="email"
                    value={profileData.email}
                    disabled
                    className="form-control disabled"
                  />
                </div>
                <span className="form-help">Email address cannot be changed</span>
              </div>

              <div className="form-actions">
                <Button type="submit" variant="primary" loading={isLoading}>
                  <Save size={18} />
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="settings-card">
          <div className="card-header">
            <h2>Change Password</h2>
            <p>Update your password to keep your account secure</p>
          </div>

          <div className="card-body">
            <form onSubmit={handlePasswordSubmit}>
              <div className="form-row">
                <label className="form-label">Current Password</label>
                <div className="input-wrapper">
                  <Lock size={18} className="input-icon" />
                  <input
                    type={showPasswords.current ? 'text' : 'password'}
                    name="currentPassword"
                    value={passwordData.currentPassword}
                    onChange={handlePasswordChange}
                    placeholder="Enter current password"
                    className="form-control"
                    required
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPasswords((p) => ({ ...p, current: !p.current }))}
                  >
                    {showPasswords.current ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="form-row">
                <label className="form-label">New Password</label>
                <div className="input-wrapper">
                  <Lock size={18} className="input-icon" />
                  <input
                    type={showPasswords.new ? 'text' : 'password'}
                    name="newPassword"
                    value={passwordData.newPassword}
                    onChange={handlePasswordChange}
                    placeholder="Enter new password"
                    className="form-control"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPasswords((p) => ({ ...p, new: !p.new }))}
                  >
                    {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="form-row">
                <label className="form-label">Confirm New Password</label>
                <div className="input-wrapper">
                  <Lock size={18} className="input-icon" />
                  <input
                    type={showPasswords.confirm ? 'text' : 'password'}
                    name="confirmPassword"
                    value={passwordData.confirmPassword}
                    onChange={handlePasswordChange}
                    placeholder="Confirm new password"
                    className="form-control"
                    required
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPasswords((p) => ({ ...p, confirm: !p.confirm }))}
                  >
                    {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Password Requirements */}
              <div className="password-rules">
                <p>Password must contain:</p>
                <div className="rules-grid">
                  <div className={`rule ${passwordData.newPassword.length >= 8 ? 'valid' : ''}`}>
                    <Check size={14} />
                    <span>At least 8 characters</span>
                  </div>
                  <div className={`rule ${/[A-Z]/.test(passwordData.newPassword) ? 'valid' : ''}`}>
                    <Check size={14} />
                    <span>One uppercase letter</span>
                  </div>
                  <div className={`rule ${/[a-z]/.test(passwordData.newPassword) ? 'valid' : ''}`}>
                    <Check size={14} />
                    <span>One lowercase letter</span>
                  </div>
                  <div className={`rule ${/[0-9]/.test(passwordData.newPassword) ? 'valid' : ''}`}>
                    <Check size={14} />
                    <span>One number</span>
                  </div>
                </div>
              </div>

              <div className="form-actions">
                <Button type="submit" variant="primary" loading={isLoading}>
                  Update Password
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="settings-card">
          <div className="card-header">
            <h2>Notification Preferences</h2>
            <p>Choose what notifications you want to receive</p>
          </div>

          <div className="card-body">
            <div className="notification-list">
              <label className="notification-item">
                <div className="notification-info">
                  <h4>Task Assignments</h4>
                  <p>Get notified when you're assigned to a task</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.taskAssignments}
                  onChange={() => handleNotificationChange('taskAssignments')}
                />
              </label>

              <label className="notification-item">
                <div className="notification-info">
                  <h4>Task Updates</h4>
                  <p>Get notified when tasks you're involved with are updated</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.taskUpdates}
                  onChange={() => handleNotificationChange('taskUpdates')}
                />
              </label>

              <label className="notification-item">
                <div className="notification-info">
                  <h4>Comments</h4>
                  <p>Get notified when someone comments on your tasks</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.comments}
                  onChange={() => handleNotificationChange('comments')}
                />
              </label>

              <label className="notification-item">
                <div className="notification-info">
                  <h4>Due Date Reminders</h4>
                  <p>Get reminded before task deadlines</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.dueDateReminders}
                  onChange={() => handleNotificationChange('dueDateReminders')}
                />
              </label>

              <label className="notification-item">
                <div className="notification-info">
                  <h4>Project Invites</h4>
                  <p>Get notified when you're added to a project</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.projectInvites}
                  onChange={() => handleNotificationChange('projectInvites')}
                />
              </label>
            </div>

            <div className="form-actions">
              <Button variant="primary" onClick={handleNotificationSubmit}>
                <Save size={18} />
                Save Preferences
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
