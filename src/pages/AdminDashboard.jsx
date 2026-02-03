import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Building2,
  Users,
  Trash2,
  MoreVertical,
  AlertTriangle,
  Search,
  Plus,
  Shield,
  Activity,
  TrendingUp,
  Calendar,
  Lock,
  LogOut,
} from 'lucide-react';
import { Button, Modal, Loading, Input, DeleteConfirmModal } from '../components/common';
import useAuthStore from '../store/authStore';
import { toast } from '../store/toastStore';
import { supabase } from '../lib/supabase';
import { format, formatDistanceToNow } from 'date-fns';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { profile, signOut } = useAuthStore();

  // State
  const [workspaces, setWorkspaces] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState(null);
  const [stats, setStats] = useState({
    totalWorkspaces: 0,
    totalUsers: 0,
    totalProjects: 0,
    totalTasks: 0,
  });
  const [activeMenu, setActiveMenu] = useState(null);

  // Check if user is system admin
  useEffect(() => {
    if (!profile?.is_system_admin) {
      toast.error('Access denied: System admin only');
      navigate('/dashboard');
    }
  }, [profile, navigate]);

  // Load data
  useEffect(() => {
    if (profile?.is_system_admin) {
      loadWorkspaces();
      loadAuditLog();
      loadStats();
    }
  }, [profile]);

  const loadWorkspaces = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('workspaces')
        .select(`
          id,
          name,
          owner_id,
          created_at,
          updated_at,
          owner:profiles!workspaces_owner_id_fkey(id, full_name, email, avatar_url),
          profiles(id),
          projects(id)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setWorkspaces(data || []);
    } catch (error) {
      toast.error('Failed to load workspaces');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLog = async () => {
    try {
      const { data, error } = await supabase
        .from('workspace_audit_log')
        .select(`
          id,
          admin_id,
          workspace_name,
          action,
          created_at,
          admin:profiles!workspace_audit_log_admin_id_fkey(id, full_name, email, avatar_url)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      setAuditLog(data || []);
    } catch (error) {
      console.error('Failed to load audit log:', error);
    }
  };

  const loadStats = async () => {
    try {
      const [workspacesRes, usersRes, projectsRes, tasksRes] = await Promise.all([
        supabase.from('workspaces').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('projects').select('id', { count: 'exact', head: true }),
        supabase.from('tasks').select('id', { count: 'exact', head: true }),
      ]);

      setStats({
        totalWorkspaces: workspacesRes.count || 0,
        totalUsers: usersRes.count || 0,
        totalProjects: projectsRes.count || 0,
        totalTasks: tasksRes.count || 0,
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleDeleteClick = (workspace) => {
    setWorkspaceToDelete(workspace);
    setShowDeleteModal(true);
    setActiveMenu(null);
  };

  const handleConfirmDelete = async () => {
    if (!workspaceToDelete) return;

    try {
      setLoading(true);

      // Delete workspace (cascades to all related data)
      const { error } = await supabase
        .from('workspaces')
        .delete()
        .eq('id', workspaceToDelete.id);

      if (error) throw error;

      toast.success(`Workspace "${workspaceToDelete.name}" deleted successfully`);
      setShowDeleteModal(false);
      setWorkspaceToDelete(null);

      // Reload data
      loadWorkspaces();
      loadAuditLog();
      loadStats();
    } catch (error) {
      toast.error('Failed to delete workspace');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handlePromoteToAdmin = async (userId) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_system_admin: true })
        .eq('id', userId);

      if (error) throw error;

      toast.success('User promoted to system admin');
      // Refresh data
      loadWorkspaces();
    } catch (error) {
      toast.error('Failed to promote user');
      console.error(error);
    }
  };

  const filteredWorkspaces = workspaces.filter((ws) =>
    ws.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ws.owner?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActiveMenu(null);
    if (activeMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [activeMenu]);

  if (loading && workspaces.length === 0) {
    return <Loading />;
  }

  return (
    <div className="admin-dashboard">
      {/* Header */}
      <div className="admin-header">
        <div>
          <div className="admin-title-section">
            <Shield size={32} className="admin-icon" />
            <div>
              <h1>System Admin Dashboard</h1>
              <p>Manage all workspaces and platform settings</p>
            </div>
          </div>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            signOut();
            navigate('/login');
          }}
        >
          <LogOut size={18} />
          Sign Out
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="admin-stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: '#3b82f620' }}>
            <Building2 size={24} color="#3b82f6" />
          </div>
          <div className="stat-content">
            <span className="stat-label">Total Workspaces</span>
            <span className="stat-value">{stats.totalWorkspaces}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: '#22c55e20' }}>
            <Users size={24} color="#22c55e" />
          </div>
          <div className="stat-content">
            <span className="stat-label">Total Users</span>
            <span className="stat-value">{stats.totalUsers}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: '#f59e0b20' }}>
            <BarChart3 size={24} color="#f59e0b" />
          </div>
          <div className="stat-content">
            <span className="stat-label">Total Projects</span>
            <span className="stat-value">{stats.totalProjects}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: '#ef444420' }}>
            <Activity size={24} color="#ef4444" />
          </div>
          <div className="stat-content">
            <span className="stat-label">Total Tasks</span>
            <span className="stat-value">{stats.totalTasks}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="admin-content">
        {/* Workspaces Section */}
        <div className="admin-section">
          <div className="section-header">
            <h2>All Workspaces</h2>
            <div className="section-controls">
              <div className="search-wrapper">
                <Search size={18} />
                <input
                  type="text"
                  placeholder="Search workspaces..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
              </div>
              <span className="workspace-count">
                {filteredWorkspaces.length} workspace{filteredWorkspaces.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {filteredWorkspaces.length === 0 ? (
            <div className="empty-state">
              <Building2 size={48} />
              <h3>No workspaces found</h3>
              <p>No workspaces match your search</p>
            </div>
          ) : (
            <div className="workspaces-table">
              <table>
                <thead>
                  <tr>
                    <th>Workspace Name</th>
                    <th>Owner</th>
                    <th>Members</th>
                    <th>Projects</th>
                    <th>Created</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWorkspaces.map((workspace) => (
                    <tr key={workspace.id} className="workspace-row">
                      <td className="workspace-name">{workspace.name}</td>
                      <td className="workspace-owner">
                        {workspace.owner?.full_name || 'Unknown'}
                      </td>
                      <td className="workspace-members">
                        {workspace.profiles?.length || 0}
                      </td>
                      <td className="workspace-projects">
                        {workspace.projects?.length || 0}
                      </td>
                      <td className="workspace-created">
                        {format(new Date(workspace.created_at), 'MMM d, yyyy')}
                      </td>
                      <td className="workspace-status">
                        <span className="status-badge active">Active</span>
                      </td>
                      <td className="workspace-actions">
                        <div className="action-menu-wrapper">
                          <button
                            className="action-menu-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenu(activeMenu === workspace.id ? null : workspace.id);
                            }}
                          >
                            <MoreVertical size={18} />
                          </button>

                          {activeMenu === workspace.id && (
                            <div className="action-menu" onClick={(e) => e.stopPropagation()}>
                              <button
                                className="delete-option"
                                onClick={() => handleDeleteClick(workspace)}
                              >
                                <Trash2 size={16} />
                                Delete Workspace
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Audit Log Section */}
        <div className="admin-section audit-section">
          <div className="section-header">
            <h2>Recent Actions</h2>
            <span className="log-count">{auditLog.length} recent actions</span>
          </div>

          {auditLog.length === 0 ? (
            <div className="empty-state">
              <Activity size={48} />
              <h3>No audit log yet</h3>
              <p>Administrative actions will appear here</p>
            </div>
          ) : (
            <div className="audit-log">
              {auditLog.map((log) => (
                <div key={log.id} className="audit-entry">
                  <div className="audit-icon">
                    {log.action === 'WORKSPACE_DELETED' && (
                      <Trash2 size={18} color="#ef4444" />
                    )}
                    {log.action === 'WORKSPACE_CREATED' && (
                      <Plus size={18} color="#22c55e" />
                    )}
                    {log.action === 'ADMIN_PROMOTED' && (
                      <Shield size={18} color="#3b82f6" />
                    )}
                  </div>
                  <div className="audit-content">
                    <span className="audit-action">{log.action.replace(/_/g, ' ')}</span>
                    <span className="audit-workspace">{log.workspace_name}</span>
                    {log.admin && (
                      <span className="audit-admin">by {log.admin.full_name}</span>
                    )}
                  </div>
                  <span className="audit-time">
                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Workspace Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Workspace"
        size="small"
      >
        <div className="delete-modal-content">
          <div className="delete-warning">
            <AlertTriangle size={32} color="#ef4444" />
          </div>
          <p>
            Are you sure you want to delete <strong>{workspaceToDelete?.name}</strong>?
          </p>
          <p className="delete-warning-text">
            This will permanently delete the workspace and ALL associated data including:
          </p>
          <ul className="delete-warning-list">
            <li>{workspaceToDelete?.profiles?.length || 0} members</li>
            <li>{workspaceToDelete?.projects?.length || 0} projects</li>
            <li>All tasks and data within projects</li>
            <li>All comments and activity history</li>
          </ul>
          <p className="delete-danger-text">
            ⚠️ This action CANNOT be undone. Please proceed with caution.
          </p>
          <div className="delete-modal-actions">
            <Button
              variant="secondary"
              onClick={() => setShowDeleteModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmDelete}
              loading={loading}
            >
              Delete Workspace
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminDashboard;
