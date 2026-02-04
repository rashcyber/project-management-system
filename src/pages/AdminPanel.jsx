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

      // Fetch all members in workspace
      const { data: workspaceMembers } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, avatar_url, created_at')
        .eq('workspace_id', profile.workspace_id);

      setMembers(workspaceMembers || []);

      // Find workspace owner (super_admin)
      const owner = (workspaceMembers || []).find((m) => m.role === 'super_admin');
      setWorkspaceOwner(owner);

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
        <div>
          <h1>Workspace Administration</h1>
          <p>
            Workspace Owner: <strong>{workspaceOwner?.full_name || 'Loading...'}</strong>
          </p>
        </div>
        <div className="admin-header-actions">
          <Button
            variant="primary"
            size="medium"
            icon={<UserPlus size={18} />}
            onClick={() => navigate('/user-management')}
          >
            Invite User
          </Button>
          <div className="admin-role-badge">
            <Shield size={20} />
            <span>{profile?.role === 'super_admin' ? 'Workspace Owner' : 'Workspace Admin'}</span>
          </div>
        </div>
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
    </div>
  );
};

export default AdminPanel;
