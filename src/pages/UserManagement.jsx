import React, { useEffect, useState } from 'react';
import {
  Users,
  Search,
  Shield,
  Edit3,
  Eye,
  Trash2,
  MoreVertical,
  UserPlus,
  Mail,
  Crown,
  Send,
  Link,
} from 'lucide-react';
import { Button, Modal, Avatar } from '../components/common';
import InviteLinksManager from '../components/InviteLinksManager';
import useUserStore from '../store/userStore';
import useAuthStore from '../store/authStore';
import { toast } from '../store/toastStore';
import { format } from 'date-fns';
import './UserManagement.css';

const ROLES = [
  { value: 'super_admin', label: 'Super Admin', icon: Crown, color: '#ef4444', description: 'Full system access' },
  { value: 'admin', label: 'Admin', icon: Shield, color: '#f59e0b', description: 'Manage users & projects' },
  { value: 'manager', label: 'Manager', icon: Edit3, color: '#3b82f6', description: 'Manage tasks & teams' },
  { value: 'member', label: 'Member', icon: Eye, color: '#22c55e', description: 'View & edit assigned tasks' },
];

const UserManagement = () => {
  const { users, loading, fetchUsers, updateUserRole, deleteUser, inviteUser } = useUserStore();
  const { profile, isSuperAdmin, isAdmin } = useAuthStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [activeMenu, setActiveMenu] = useState(null);
  const [newRole, setNewRole] = useState('');
  const [inviteData, setInviteData] = useState({ email: '', fullName: '', role: 'member' });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('users');

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = users.filter((user) =>
    user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRoleChange = async () => {
    if (!selectedUser || !newRole) return;

    const { error } = await updateUserRole(selectedUser.id, newRole);
    if (error) {
      toast.error('Failed to update user role');
    } else {
      toast.success(`${selectedUser.full_name}'s role updated to ${newRole}`);
    }
    setShowRoleModal(false);
    setSelectedUser(null);
    setNewRole('');
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    const { error } = await deleteUser(selectedUser.id);
    if (error) {
      toast.error('Failed to delete user');
    } else {
      toast.success(`${selectedUser.full_name} has been removed`);
    }
    setShowDeleteModal(false);
    setSelectedUser(null);
  };

  const handleInviteUser = async (e) => {
    e.preventDefault();
    if (!inviteData.email) return;

    setInviteLoading(true);
    const { error } = await inviteUser(inviteData.email, inviteData.role, inviteData.fullName);

    if (error) {
      toast.error(error.message || 'Failed to send invitation');
    } else {
      toast.success(`Invitation sent to ${inviteData.email}`);
      setShowInviteModal(false);
      setInviteData({ email: '', fullName: '', role: 'member' });
      // Refresh users list
      fetchUsers();
    }
    setInviteLoading(false);
  };

  const openRoleModal = (user) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setShowRoleModal(true);
    setActiveMenu(null);
  };

  const openDeleteModal = (user) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
    setActiveMenu(null);
  };

  const getRoleConfig = (role) => {
    return ROLES.find((r) => r.value === role) || ROLES[3];
  };

  const canModifyUser = (user) => {
    // Super admin can modify anyone except themselves
    if (isSuperAdmin() && user.id !== profile?.id) return true;
    // Admin can modify managers and members
    if (isAdmin() && ['manager', 'member'].includes(user.role)) return true;
    return false;
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActiveMenu(null);
    if (activeMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [activeMenu]);

  if (!isAdmin()) {
    return (
      <div className="access-denied">
        <Shield size={64} />
        <h1>Access Denied</h1>
        <p>You don't have permission to access this page.</p>
      </div>
    );
  }

  return (
    <div className="user-management">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>User Management</h1>
          <p>
            Manage users and their roles{profile?.workspace_id ? ` in your workspace` : ''}
          </p>
        </div>
        {activeTab === 'users' && (
          <Button variant="primary" onClick={() => setShowInviteModal(true)}>
            <UserPlus size={18} />
            Invite User
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="management-tabs">
        <button
          className={`management-tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <Users size={18} />
          <span>Users</span>
        </button>
        <button
          className={`management-tab ${activeTab === 'links' ? 'active' : ''}`}
          onClick={() => setActiveTab('links')}
        >
          <Link size={18} />
          <span>Invite Links</span>
        </button>
      </div>

      {activeTab === 'users' && (
      <>
      {/* Toolbar */}
      <div className="page-toolbar">
        <div className="search-wrapper">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="user-count">
          {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Role Legend */}
      <div className="role-legend">
        {ROLES.map((role) => (
          <div key={role.value} className="role-legend-item">
            <role.icon size={14} style={{ color: role.color }} />
            <span>{role.label}</span>
          </div>
        ))}
      </div>

      {/* Users Table */}
      <div className="users-table-container">
        {loading ? (
          <div className="loading-state">Loading users...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="empty-state">
            <Users size={48} />
            <h3>No users found</h3>
            <p>Try adjusting your search</p>
          </div>
        ) : (
          <table className="users-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const roleConfig = getRoleConfig(user.role);
                const isCurrentUser = user.id === profile?.id;

                return (
                  <tr key={user.id} className={isCurrentUser ? 'current-user' : ''}>
                    <td>
                      <div className="user-info">
                        <Avatar
                          src={user.avatar_url}
                          name={user.full_name}
                          size="small"
                        />
                        <div className="user-details">
                          <span className="user-name">
                            {user.full_name || 'Unknown'}
                            {isCurrentUser && <span className="you-badge">You</span>}
                          </span>
                          <span className="user-email">{user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div
                        className="role-badge"
                        style={{
                          backgroundColor: `${roleConfig.color}15`,
                          color: roleConfig.color,
                          borderColor: `${roleConfig.color}30`,
                        }}
                      >
                        <roleConfig.icon size={14} />
                        {roleConfig.label}
                      </div>
                    </td>
                    <td>
                      <span className="join-date">
                        {user.created_at
                          ? format(new Date(user.created_at), 'MMM d, yyyy')
                          : 'N/A'}
                      </span>
                    </td>
                    <td>
                      {canModifyUser(user) ? (
                        <div className="action-buttons">
                          <button
                            className="action-btn edit"
                            onClick={() => openRoleModal(user)}
                            title="Change Role"
                          >
                            <Shield size={16} />
                          </button>
                          {user.role !== 'super_admin' && (
                            <button
                              className="action-btn delete"
                              onClick={() => openDeleteModal(user)}
                              title="Remove User"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="no-actions">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      </>
      )}

      {activeTab === 'links' && (
        <InviteLinksManager />
      )}

      {/* Change Role Modal */}
      <Modal
        isOpen={showRoleModal}
        onClose={() => {
          setShowRoleModal(false);
          setSelectedUser(null);
        }}
        title="Change User Role"
        size="medium"
      >
        {selectedUser && (
          <div className="role-modal-content">
            <div className="selected-user-info">
              <Avatar
                src={selectedUser.avatar_url}
                name={selectedUser.full_name}
                size="large"
              />
              <div>
                <h3>{selectedUser.full_name}</h3>
                <p>{selectedUser.email}</p>
              </div>
            </div>

            <div className="role-options">
              {ROLES.filter((role) => {
                // Only super admin can assign super_admin or admin roles
                if (!isSuperAdmin() && ['super_admin', 'admin'].includes(role.value)) {
                  return false;
                }
                return true;
              }).map((role) => (
                <label
                  key={role.value}
                  className={`role-option ${newRole === role.value ? 'selected' : ''}`}
                  style={{
                    borderColor: newRole === role.value ? role.color : 'var(--border-color)',
                  }}
                >
                  <input
                    type="radio"
                    name="role"
                    value={role.value}
                    checked={newRole === role.value}
                    onChange={(e) => setNewRole(e.target.value)}
                  />
                  <div className="role-option-icon" style={{ backgroundColor: `${role.color}15` }}>
                    <role.icon size={20} style={{ color: role.color }} />
                  </div>
                  <div className="role-option-info">
                    <span className="role-option-label">{role.label}</span>
                    <span className="role-option-desc">{role.description}</span>
                  </div>
                </label>
              ))}
            </div>

            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setShowRoleModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleRoleChange}
                disabled={newRole === selectedUser.role}
              >
                Update Role
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete User Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedUser(null);
        }}
        title="Remove User"
        size="small"
      >
        {selectedUser && (
          <div className="delete-modal-content">
            <p>
              Are you sure you want to remove <strong>{selectedUser.full_name}</strong>?
            </p>
            <p className="delete-warning">
              This will remove them from all projects and delete their data. This action cannot be undone.
            </p>
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDeleteUser}>
                Remove User
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Invite User Modal */}
      <Modal
        isOpen={showInviteModal}
        onClose={() => {
          setShowInviteModal(false);
          setInviteData({ email: '', fullName: '', role: 'member' });
        }}
        title="Invite New User"
        size="medium"
      >
        <form onSubmit={handleInviteUser} className="invite-modal-content">
          <p className="invite-description">
            Send an invitation email to add a new user to the system. They will receive a link to set up their account.
          </p>

          <div className="invite-form-group">
            <label className="invite-label">Full Name</label>
            <div className="invite-input-wrapper">
              <UserPlus size={18} className="invite-input-icon" />
              <input
                type="text"
                value={inviteData.fullName}
                onChange={(e) => setInviteData({ ...inviteData, fullName: e.target.value })}
                placeholder="Enter full name"
                className="invite-input"
                required
              />
            </div>
          </div>

          <div className="invite-form-group">
            <label className="invite-label">Email Address</label>
            <div className="invite-input-wrapper">
              <Mail size={18} className="invite-input-icon" />
              <input
                type="email"
                value={inviteData.email}
                onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                placeholder="Enter email address"
                className="invite-input"
                required
              />
            </div>
          </div>

          <div className="invite-form-group">
            <label className="invite-label">Assign Role</label>
            <div className="invite-role-options">
              {ROLES.filter((role) => {
                // Only super admin can assign super_admin or admin roles
                if (!isSuperAdmin() && ['super_admin', 'admin'].includes(role.value)) {
                  return false;
                }
                return true;
              }).map((role) => (
                <label
                  key={role.value}
                  className={`invite-role-option ${inviteData.role === role.value ? 'selected' : ''}`}
                  style={{
                    borderColor: inviteData.role === role.value ? role.color : 'var(--border-color)',
                  }}
                >
                  <input
                    type="radio"
                    name="inviteRole"
                    value={role.value}
                    checked={inviteData.role === role.value}
                    onChange={(e) => setInviteData({ ...inviteData, role: e.target.value })}
                  />
                  <div className="invite-role-icon" style={{ backgroundColor: `${role.color}15` }}>
                    <role.icon size={18} style={{ color: role.color }} />
                  </div>
                  <div className="invite-role-info">
                    <span className="invite-role-label">{role.label}</span>
                    <span className="invite-role-desc">{role.description}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="modal-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowInviteModal(false);
                setInviteData({ email: '', fullName: '', role: 'member' });
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={inviteLoading}>
              <Send size={18} />
              Send Invitation
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default UserManagement;
