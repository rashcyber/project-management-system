import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Users,
  FolderKanban,
  CheckSquare,
  Settings,
  Shield,
  AlertTriangle,
  UserPlus,
} from 'lucide-react';
import { Button, Loading, Avatar } from '../components/common';
import useAuthStore from '../store/authStore';
import useProjectStore from '../store/projectStore';
import useUserStore from '../store/userStore';
import { toast } from '../store/toastStore';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import './AdminPanel.css';

const AdminPanel = () => {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const { projects, fetchProjects } = useProjectStore();
  const { users, fetchUsers } = useUserStore();

  const [stats, setStats] = useState({
    workspaceMembers: 0,
    workspaceProjects: 0,
    workspaceTasks: 0,
    adminsInWorkspace: 0,
  });
  const [members, setMembers] = useState([]);
  const [workspaceOwner, setWorkspaceOwner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Verify user is admin
  useEffect(() => {
    if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
      toast.error('Access denied: Admin only');
      navigate('/projects');
    }
  }, [profile, navigate]);

  // Load workspace data
  useEffect(() => {
    if (profile?.workspace_id) {
      loadWorkspaceData();
    }
  }, [profile?.workspace_id]);

  const loadWorkspaceData = async () => {
    try {
      setLoading(true);

      // Fetch workspace to get owner info
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('owner:profiles!workspaces_owner_id_fkey(id, full_name, email, avatar_url)')
        .eq('id', profile.workspace_id)
        .single();

      if (workspace?.owner) {
        setWorkspaceOwner(workspace.owner);
      }

      // Fetch all members in workspace (exclude system admins)
      const { data: workspaceMembers } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, avatar_url, created_at, is_system_admin')
        .eq('workspace_id', profile.workspace_id);

      // Filter out system admins from the members list (they're platform-level, not workspace members)
      const workspaceOnlyMembers = (workspaceMembers || []).filter(m => !m.is_system_admin);
      setMembers(workspaceOnlyMembers);

      // Calculate stats
      const { count: projectCount } = await supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', profile.workspace_id);

      const { count: taskCount } = await supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .in(
          'project_id',
          (await supabase
            .from('projects')
            .select('id')
            .eq('workspace_id', profile.workspace_id)).data?.map((p) => p.id) || []
        );

      const admins = (workspaceMembers || []).filter(
        (m) => m.role === 'admin' || m.role === 'super_admin'
      ).length;

      setStats({
        workspaceMembers: workspaceMembers?.length || 0,
        workspaceProjects: projectCount || 0,
        workspaceTasks: taskCount || 0,
        adminsInWorkspace: admins,
      });
    } catch (error) {
      console.error('Failed to load workspace data:', error);
      toast.error('Failed to load workspace data');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeRole = async (member, newRole) => {
    try {
      // Prevent demoting yourself
      if (member.id === profile.id && newRole !== profile.role) {
        if (
          !window.confirm(
            'You are changing your own role. This might restrict your access. Continue?'
          )
        ) {
          return;
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', member.id)
        .eq('workspace_id', profile.workspace_id);

      if (error) throw error;

      toast.success(`${member.full_name}'s role updated to ${newRole}`);
      loadWorkspaceData();
    } catch (error) {
      toast.error('Failed to update member role');
      console.error(error);
    }
  };

  const getRoleColor = (role) => {
    const colors = {
      super_admin: '#ef4444',
      admin: '#f59e0b',
      manager: '#3b82f6',
      member: '#22c55e',
    };
    return colors[role] || '#6b7280';
  };

  const canChangeRole = (member) => {
    // Super admin can change anyone
    if (profile?.role === 'super_admin') return true;
    // Admin can only change members and managers
    if (profile?.role === 'admin') {
      return member.role !== 'super_admin' && member.role !== 'admin';
    }
    return false;
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="admin-panel">
      {/* Header */}
      <div className="admin-panel-header">
        <div className="header-info">
          <h1>Workspace Administration</h1>
          <div className="admin-role-badge">
            <Shield size={20} />
            <div className="badge-content">
              <div className="badge-label">{profile?.role === 'super_admin' ? 'Workspace Owner' : 'Workspace Admin'}</div>
              <div className="badge-name">{workspaceOwner?.full_name || 'Loading...'}</div>
            </div>
          </div>
        </div>
        <Button
          variant="primary"
          size="medium"
          icon={<UserPlus size={18} />}
          onClick={() => setShowInviteModal(true)}
        >
          Invite User
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="admin-stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <Users size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Total Members</span>
            <span className="stat-value">{stats.workspaceMembers}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Shield size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Workspace Admins</span>
            <span className="stat-value">{stats.adminsInWorkspace}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <FolderKanban size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Projects</span>
            <span className="stat-value">{stats.workspaceProjects}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <CheckSquare size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Total Tasks</span>
            <span className="stat-value">{stats.workspaceTasks}</span>
          </div>
        </div>
      </div>

      {/* Team Members Section */}
      <div className="admin-section">
        <div className="section-header">
          <h2>Team Members</h2>
          <span className="member-count">{members.length} members</span>
        </div>

        {members.length === 0 ? (
          <div className="empty-state">
            <Users size={48} />
            <h3>No team members yet</h3>
            <p>Invite members to start collaborating</p>
          </div>
        ) : (
          <div className="members-list">
            {members.map((member) => (
              <div key={member.id} className="member-card">
                <div className="member-info">
                  <Avatar
                    src={member.avatar_url}
                    name={member.full_name}
                    size="medium"
                  />
                  <div className="member-details">
                    <span className="member-name">
                      {member.full_name}
                      {member.id === profile.id && <span className="you-badge">(You)</span>}
                    </span>
                    <span className="member-email">{member.email}</span>
                    <span className="member-joined">
                      Joined {format(new Date(member.created_at), 'MMM d, yyyy')}
                    </span>
                  </div>
                </div>

                <div className="member-role">
                  {canChangeRole(member) ? (
                    <select
                      value={member.role}
                      onChange={(e) => handleChangeRole(member, e.target.value)}
                      className="role-select"
                    >
                      <option value="member">Member</option>
                      <option value="manager">Manager</option>
                      {profile?.role === 'super_admin' && (
                        <option value="admin">Admin</option>
                      )}
                    </select>
                  ) : (
                    <span
                      className="role-badge"
                      style={{
                        backgroundColor: `${getRoleColor(member.role)}20`,
                        color: getRoleColor(member.role),
                      }}
                    >
                      {member.role}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Admin Info */}
      <div className="admin-info">
        <AlertTriangle size={20} />
        <div>
          <p>
            <strong>Admin Permissions:</strong>{' '}
            {profile?.role === 'super_admin'
              ? 'You have full control over this workspace. You can invite members, change roles, create and delete projects.'
              : 'You can manage workspace projects and assign roles to members and managers.'}
          </p>
        </div>
      </div>

      {/* Invite User Modal - Opens within AdminPanel */}
      {showInviteModal && (
        <div className="invite-modal-overlay" onClick={() => setShowInviteModal(false)}>
          <div className="invite-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Invite User to Workspace</h3>
            <p className="modal-description">
              Enter the email of the person you want to invite to this workspace
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const email = e.target.email.value;
                const role = e.target.role.value;
                // TODO: Implement actual invite functionality
                toast.success(`Invitation sent to ${email} as ${role}`);
                setShowInviteModal(false);
              }}
            >
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  name="email"
                  placeholder="user@example.com"
                  required
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select name="role" className="form-input" required>
                  <option value="member">Member</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="modal-actions">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowInviteModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Send Invite
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
