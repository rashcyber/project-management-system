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
import useSystemAdminStore from '../store/systemAdminStore';
import { supabase } from '../lib/supabase';
import { toast } from '../store/toastStore';
import { supabase } from '../lib/supabase';
import { format, formatDistanceToNow } from 'date-fns';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { profile, signOut } = useAuthStore();
  const { promoteUserToSystemAdmin, demoteSystemAdmin, logSystemAdminPromotion, logSystemAdminDemotion, fetchSystemAdmins, searchUsers } = useSystemAdminStore();

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

  // System admin management state
  const [systemAdmins, setSystemAdmins] = useState([]);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [showDemoteModal, setShowDemoteModal] = useState(false);
  const [userToDemote, setUserToDemote] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQueryUsers, setSearchQueryUsers] = useState('');
  const [promoteLoading, setPromoteLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

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
      const loadAllData = async () => {
        setLoading(true);
        try {
          await Promise.all([
            loadWorkspaces(),
            loadAuditLog(),
            loadStats(),
            loadSystemAdmins(),
          ]);
        } catch (error) {
          console.error('Error loading admin dashboard data:', error);
        } finally {
          setLoading(false);
        }
      };
      loadAllData();
    }
  }, [profile?.is_system_admin]);

  const loadSystemAdmins = async () => {
    try {
      const { data, error } = await fetchSystemAdmins();
      if (error) {
        console.error('Failed to load system admins:', error);
        setSystemAdmins([]);
      } else {
        setSystemAdmins(data || []);
      }
    } catch (error) {
      console.error('Failed to load system admins:', error);
      setSystemAdmins([]);
    }
  };

  const loadWorkspaces = async () => {
    try {
      // Use simpler query to avoid RLS issues
      const { data, error } = await supabase
        .from('workspaces')
        .select('id, name, owner_id, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch owner and member counts separately
      const enrichedData = await Promise.all(
        (data || []).map(async (workspace) => {
          const { data: ownerData } = await supabase
            .from('profiles')
            .select('id, full_name, email, avatar_url')
            .eq('id', workspace.owner_id)
            .single();

          const { data: members } = await supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .eq('workspace_id', workspace.id);

          const { data: projects } = await supabase
            .from('projects')
            .select('id', { count: 'exact', head: true })
            .eq('workspace_id', workspace.id);

          return {
            ...workspace,
            owner: ownerData,
            profiles: members || [],
            projects: projects || [],
          };
        })
      );

      setWorkspaces(enrichedData || []);
    } catch (error) {
      toast.error('Failed to load workspaces');
      console.error('Load workspaces error:', error);
      setWorkspaces([]);
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

  // Search users for promotion
  const handleSearchUsers = async (query) => {
    setSearchQueryUsers(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const { data, error } = await searchUsers(query);
      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  // Promote user to system admin
  const handlePromoteUser = async (user) => {
    if (user.id === profile?.id) {
      toast.warning('You are already a system admin');
      return;
    }

    setPromoteLoading(true);
    try {
      const { error } = await promoteUserToSystemAdmin(user.id);
      if (error) throw error;

      // Log the action
      await logSystemAdminPromotion(user.id, user.full_name, user.email);

      toast.success(`${user.full_name} promoted to system admin`);
      setShowPromoteModal(false);
      setSearchQueryUsers('');
      setSearchResults([]);
      setSelectedUser(null);

      // Reload system admins list
      loadSystemAdmins();
      loadAuditLog();
    } catch (error) {
      toast.error('Failed to promote user');
      console.error(error);
    } finally {
      setPromoteLoading(false);
    }
  };

  // Demote system admin
  const handleDemoteConfirm = async () => {
    if (!userToDemote) return;

    if (userToDemote.id === profile?.id) {
      toast.error('You cannot demote yourself');
      setShowDemoteModal(false);
      return;
    }

    if (systemAdmins.length === 1) {
      toast.error('Cannot demote the only system admin. Promote another user first.');
      setShowDemoteModal(false);
      return;
    }

    setPromoteLoading(true);
    try {
      const { error } = await demoteSystemAdmin(userToDemote.id);
      if (error) throw error;

      // Log the action
      await logSystemAdminDemotion(userToDemote.id, userToDemote.full_name, userToDemote.email);

      toast.success(`${userToDemote.full_name} demoted from system admin`);
      setShowDemoteModal(false);
      setUserToDemote(null);

      // Reload system admins list
      loadSystemAdmins();
      loadAuditLog();
    } catch (error) {
      toast.error('Failed to demote user');
      console.error(error);
    } finally {
      setPromoteLoading(false);
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
        {/* System Admins Section */}
        <div className="admin-section">
          <div className="section-header">
            <h2>System Admins</h2>
            <Button
              variant="primary"
              size="small"
              icon={<Plus size={16} />}
              onClick={() => setShowPromoteModal(true)}
            >
              Add System Admin
            </Button>
          </div>

          {systemAdmins.length === 0 ? (
            <div className="empty-state">
              <Shield size={32} />
              <p>No system admins yet</p>
            </div>
          ) : (
            <div className="admins-table">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {systemAdmins.map((admin) => (
                    <tr key={admin.id}>
                      <td className="admin-name">{admin.full_name}</td>
                      <td className="admin-email">{admin.email}</td>
                      <td className="admin-created">
                        {format(new Date(admin.created_at), 'MMM d, yyyy')}
                      </td>
                      <td className="admin-actions">
                        {admin.id === profile?.id ? (
                          <span className="admin-self-badge">Current</span>
                        ) : (
                          <Button
                            variant="danger"
                            size="small"
                            onClick={() => {
                              setUserToDemote(admin);
                              setShowDemoteModal(true);
                            }}
                          >
                            Demote
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

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

      {/* Promote User to System Admin Modal */}
      <Modal
        isOpen={showPromoteModal}
        onClose={() => {
          setShowPromoteModal(false);
          setSearchQueryUsers('');
          setSearchResults([]);
          setSelectedUser(null);
        }}
        title="Add System Admin"
        size="medium"
      >
        <div className="promote-modal-content">
          <p className="modal-description">
            Search for a user to promote them to system admin with platform-wide access.
          </p>

          <Input
            label="Search User"
            placeholder="Search by name or email..."
            value={searchQueryUsers}
            onChange={(e) => handleSearchUsers(e.target.value)}
            icon={<Search size={16} />}
          />

          {searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  className={`result-item ${selectedUser?.id === user.id ? 'selected' : ''}`}
                  onClick={() => setSelectedUser(user)}
                >
                  <div className="result-info">
                    <span className="result-name">{user.full_name}</span>
                    <span className="result-email">{user.email}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {searchQueryUsers && searchResults.length === 0 && (
            <div className="empty-search">
              <p>No users found</p>
            </div>
          )}

          <div className="modal-actions">
            <Button
              variant="secondary"
              onClick={() => {
                setShowPromoteModal(false);
                setSearchQueryUsers('');
                setSearchResults([]);
                setSelectedUser(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!selectedUser || promoteLoading}
              loading={promoteLoading}
              onClick={() => selectedUser && handlePromoteUser(selectedUser)}
            >
              Promote to System Admin
            </Button>
          </div>
        </div>
      </Modal>

      {/* Demote System Admin Modal */}
      <DeleteConfirmModal
        isOpen={showDemoteModal}
        onClose={() => setShowDemoteModal(false)}
        onConfirm={handleDemoteConfirm}
        title="Demote System Admin"
        message={`Are you sure you want to demote ${userToDemote?.full_name} from system admin? They will lose platform-wide access.`}
        confirmText="Demote"
        variant="warning"
        isLoading={promoteLoading}
      />

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
