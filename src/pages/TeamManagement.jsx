import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Users,
  UserPlus,
  Search,
  MoreVertical,
  Shield,
  ShieldCheck,
  User,
  Trash2,
  ArrowLeft,
  Mail,
  Calendar,
  Crown,
} from 'lucide-react';
import { Button, Avatar, Modal, Input, Loading } from '../components/common';
import useProjectStore from '../store/projectStore';
import useUserStore from '../store/userStore';
import useAuthStore from '../store/authStore';
import useActivityStore from '../store/activityStore';
import { toast } from '../store/toastStore';
import { format } from 'date-fns';
import './TeamManagement.css';

const roleConfig = {
  admin: { label: 'Admin', icon: ShieldCheck, color: 'primary' },
  manager: { label: 'Manager', icon: Shield, color: 'info' },
  member: { label: 'Member', icon: User, color: 'default' },
};

const TeamManagement = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { currentProject, fetchProject, addMember, removeMember, updateMemberRole, loading: projectLoading } = useProjectStore();
  const { users, fetchUsers } = useUserStore();
  const { profile, isAdmin } = useAuthStore();
  const { logActivity } = useActivityStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenu, setActiveMenu] = useState(null);

  useEffect(() => {
    if (projectId) {
      fetchProject(projectId);
    }
  }, [projectId, fetchProject]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    const handleClickOutside = () => setActiveMenu(null);
    if (activeMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [activeMenu]);

  // Get available users (not already members)
  const getAvailableUsers = () => {
    const memberIds = currentProject?.project_members?.map((m) => m.user_id) || [];
    return users.filter((user) => !memberIds.includes(user.id));
  };

  // Filter available users based on search query
  const getFilteredUsers = () => {
    const availableUsers = getAvailableUsers();
    if (!searchQuery.trim()) {
      return availableUsers;
    }
    const query = searchQuery.toLowerCase();
    return availableUsers.filter(
      (user) =>
        user.full_name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query)
    );
  };

  const handleAddMember = async (userId, userName) => {
    const { error } = await addMember(projectId, userId, 'member');
    if (error) {
      toast.error('Failed to add member');
    } else {
      toast.success(`${userName} added to the project`);
      await logActivity('member_added', { member_name: userName }, projectId);
      setSearchQuery('');
      setSearchResults([]);
      setShowAddModal(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;

    const { error } = await removeMember(projectId, memberToRemove.user_id);
    if (error) {
      toast.error('Failed to remove member');
    } else {
      toast.success(`${memberToRemove.user?.full_name || 'Member'} removed from the project`);
      await logActivity('member_removed', { member_name: memberToRemove.user?.full_name }, projectId);
    }
    setShowRemoveModal(false);
    setMemberToRemove(null);
  };

  const handleRoleChange = async (member, newRole) => {
    const { error } = await updateMemberRole(projectId, member.user_id, newRole);
    if (error) {
      toast.error('Failed to update role');
    } else {
      toast.success(`Role updated to ${newRole}`);
    }
    setActiveMenu(null);
  };

  const openRemoveModal = (member) => {
    setMemberToRemove(member);
    setShowRemoveModal(true);
    setActiveMenu(null);
  };

  const canManageMembers = () => {
    if (isAdmin()) return true;
    if (currentProject?.owner_id === profile?.id) return true;
    const myMembership = currentProject?.project_members?.find((m) => m.user_id === profile?.id);
    return myMembership?.role === 'admin';
  };

  if (projectLoading && !currentProject) {
    return (
      <div className="team-loading">
        <Loading />
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="team-error">
        <h2>Project not found</h2>
        <Button variant="secondary" onClick={() => navigate('/projects')}>
          Back to Projects
        </Button>
      </div>
    );
  }

  const members = currentProject.project_members || [];

  return (
    <div className="team-management">
      <div className="team-header">
        <button className="back-btn" onClick={() => navigate(`/projects/${projectId}/board`)} title="Back to Board">
          <ArrowLeft size={18} />
        </button>

        <div className="header-content">
          <div
            className="project-indicator"
            style={{ backgroundColor: currentProject.color || '#3b82f6' }}
          />
          <div>
            <h1>Team Members</h1>
            <p>{currentProject.name}</p>
          </div>
        </div>

        {canManageMembers() && (
          <Button
            variant="primary"
            icon={<UserPlus size={18} />}
            onClick={() => setShowAddModal(true)}
          >
            Add Member
          </Button>
        )}
      </div>

      <div className="team-stats">
        <div className="stat-item">
          <span className="stat-value">{members.length}</span>
          <span className="stat-label">Total Members</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{members.filter((m) => m.role === 'admin').length}</span>
          <span className="stat-label">Admins</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{members.filter((m) => m.role === 'manager').length}</span>
          <span className="stat-label">Managers</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{members.filter((m) => m.role === 'member').length}</span>
          <span className="stat-label">Members</span>
        </div>
      </div>

      <div className="members-list">
        <div className="list-header">
          <h2>
            <Users size={20} />
            All Members
          </h2>
        </div>

        <div className="members-grid">
          {members.map((member) => {
            const role = roleConfig[member.role] || roleConfig.member;
            const RoleIcon = role.icon;
            const isOwner = currentProject.owner_id === member.user_id;
            const isCurrentUser = member.user_id === profile?.id;

            return (
              <div key={member.user_id} className="member-card">
                <div className="member-avatar-section">
                  <Avatar
                    src={member.user?.avatar_url}
                    name={member.user?.full_name}
                    size="large"
                  />
                  {isOwner && (
                    <div className="owner-badge" title="Project Owner">
                      <Crown size={12} />
                    </div>
                  )}
                </div>

                <div className="member-info">
                  <h3 className="member-name">
                    {member.user?.full_name || 'Unknown User'}
                    {isCurrentUser && <span className="you-badge">You</span>}
                  </h3>
                  <p className="member-email">
                    <Mail size={12} />
                    {member.user?.email}
                  </p>
                  <p className="member-joined">
                    <Calendar size={12} />
                    Joined {format(new Date(member.joined_at), 'MMM d, yyyy')}
                  </p>
                </div>

                <div className="member-role">
                  <span className={`role-badge role-${role.color}`}>
                    <RoleIcon size={12} />
                    {role.label}
                  </span>
                </div>

                {canManageMembers() && !isOwner && !isCurrentUser && (
                  <div className="member-actions">
                    <button
                      className="menu-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenu(activeMenu === member.user_id ? null : member.user_id);
                      }}
                    >
                      <MoreVertical size={18} />
                    </button>

                    {activeMenu === member.user_id && (
                      <div className="member-menu" onClick={(e) => e.stopPropagation()}>
                        <span className="menu-label">Change Role</span>
                        <button
                          type="button"
                          className={`role-option ${member.role === 'admin' ? 'active' : ''}`}
                          onClick={() => handleRoleChange(member, 'admin')}
                        >
                          <ShieldCheck size={14} />
                          Admin
                        </button>
                        <button
                          type="button"
                          className={`role-option ${member.role === 'manager' ? 'active' : ''}`}
                          onClick={() => handleRoleChange(member, 'manager')}
                        >
                          <Shield size={14} />
                          Manager
                        </button>
                        <button
                          type="button"
                          className={`role-option ${member.role === 'member' ? 'active' : ''}`}
                          onClick={() => handleRoleChange(member, 'member')}
                        >
                          <User size={14} />
                          Member
                        </button>
                        <div className="menu-divider" />
                        <button
                          type="button"
                          className="danger-btn"
                          onClick={() => openRemoveModal(member)}
                        >
                          <Trash2 size={14} />
                          Remove from Project
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Member Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setSearchQuery('');
        }}
        title="Add Team Member"
        size="medium"
      >
        <div className="add-member-modal">
          <div className="search-section">
            <div className="search-wrapper">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Filter by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
          </div>

          <div className="available-users-list">
            {getFilteredUsers().length > 0 ? (
              getFilteredUsers().map((user) => (
                <div key={user.id} className="user-result">
                  <Avatar
                    src={user.avatar_url}
                    name={user.full_name}
                    size="medium"
                  />
                  <div className="user-info">
                    <span className="user-name">{user.full_name}</span>
                    <span className="user-email">{user.email}</span>
                  </div>
                  <Button
                    variant="primary"
                    size="small"
                    onClick={() => handleAddMember(user.id, user.full_name)}
                  >
                    Add
                  </Button>
                </div>
              ))
            ) : searchQuery ? (
              <div className="no-results">No users match your search</div>
            ) : (
              <div className="no-results">No available users to add</div>
            )}
          </div>
        </div>
      </Modal>

      {/* Remove Member Modal */}
      <Modal
        isOpen={showRemoveModal}
        onClose={() => {
          setShowRemoveModal(false);
          setMemberToRemove(null);
        }}
        title="Remove Team Member"
        size="small"
      >
        <div className="remove-modal-content">
          <p>
            Are you sure you want to remove{' '}
            <strong>{memberToRemove?.user?.full_name || 'this member'}</strong> from the project?
          </p>
          <p className="remove-warning">
            They will lose access to all project tasks and data.
          </p>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setShowRemoveModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleRemoveMember}>
              Remove Member
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default TeamManagement;
