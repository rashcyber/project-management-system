import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Building2,
  Users,
  Trash2,
  AlertTriangle,
  Search,
  Plus,
  Shield,
  Activity,
  TrendingUp,
  Calendar,
  Lock,
  LogOut,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button, Modal, Loading, Input, DeleteConfirmModal } from '../components/common';
import useAuthStore from '../store/authStore';
import useSystemAdminStore from '../store/systemAdminStore';
import useNotificationStore from '../store/notificationStore';
import { supabase } from '../lib/supabase';
import { toast } from '../store/toastStore';
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
  const [workspaceHealth, setWorkspaceHealth] = useState({
    emptyWorkspaces: 0,
    activeWorkspaces: 0,
    inactiveWorkspaces: 0,
  });

  // System admin management state
  const [systemAdmins, setSystemAdmins] = useState([]);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [showDemoteModal, setShowDemoteModal] = useState(false);
  const [userToDemote, setUserToDemote] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQueryUsers, setSearchQueryUsers] = useState('');
  const [promoteLoading, setPromoteLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Pagination and sorting state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15);
  const [sortField, setSortField] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');

  // Audit log pagination state
  const [auditLogPage, setAuditLogPage] = useState(1);
  const [auditLogsPerPage] = useState(10);
  const [auditLogFilter, setAuditLogFilter] = useState('all');

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

          const membersRes = await supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .eq('workspace_id', workspace.id);

          const projectsRes = await supabase
            .from('projects')
            .select('id', { count: 'exact', head: true })
            .eq('workspace_id', workspace.id);

          return {
            ...workspace,
            owner: ownerData,
            memberCount: membersRes.count || 0,
            projectCount: projectsRes.count || 0,
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
        .limit(50);

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
        totalWorkspaces: workspacesRes.count !== null ? workspacesRes.count : 0,
        totalUsers: usersRes.count !== null ? usersRes.count : 0,
        totalProjects: projectsRes.count !== null ? projectsRes.count : 0,
        totalTasks: tasksRes.count !== null ? tasksRes.count : 0,
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
      setStats({
        totalWorkspaces: 0,
        totalUsers: 0,
        totalProjects: 0,
        totalTasks: 0,
      });
    }
  };

  const handleDeleteClick = (workspace) => {
    setWorkspaceToDelete(workspace);
    setShowDeleteModal(true);
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

      // Send notification to workspace owner
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (workspaceToDelete.owner_id) {
          await useNotificationStore.getState().createNotification({
            userId: workspaceToDelete.owner_id,
            type: 'workspace_deleted',
            title: 'Workspace deleted',
            message: `Your workspace "${workspaceToDelete.name}" has been deleted by a system administrator`,
            actorId: currentUser?.id,
          });
        }
      } catch (notifError) {
        console.error('Error sending workspace deletion notification:', notifError);
        // Don't fail the deletion if notification fails
      }

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

  // Memoized filtering, sorting, and pagination
  const { filtered, sorted, paginated, totalPages } = useMemo(() => {
    // Filter
    const filtered = workspaces.filter((ws) =>
      ws.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ws.owner?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let aVal, bVal;

      switch (sortField) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'owner':
          aVal = a.owner?.full_name?.toLowerCase() || '';
          bVal = b.owner?.full_name?.toLowerCase() || '';
          break;
        case 'memberCount':
          aVal = a.memberCount || 0;
          bVal = b.memberCount || 0;
          break;
        case 'projectCount':
          aVal = a.projectCount || 0;
          bVal = b.projectCount || 0;
          break;
        case 'created_at':
        default:
          aVal = new Date(a.created_at).getTime();
          bVal = new Date(b.created_at).getTime();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    // Pagination
    const totalPages = Math.ceil(sorted.length / itemsPerPage);
    const startIdx = (currentPage - 1) * itemsPerPage;
    const paginated = sorted.slice(startIdx, startIdx + itemsPerPage);

    return { filtered, sorted, paginated, totalPages };
  }, [workspaces, searchQuery, sortField, sortDirection, currentPage, itemsPerPage]);

  // Debounced search handler
  const handleSearchChange = useCallback((query) => {
    setSearchQuery(query);
    setCurrentPage(1); // Reset to first page on search
  }, []);

  // Sort handler
  const handleSort = useCallback((field) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to ascending
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset to first page
  }, [sortField, sortDirection]);

  // Memoized audit log filtering and pagination
  const { filtered: filteredAuditLog, paginated: paginatedAuditLog, totalAuditPages } = useMemo(() => {
    const filtered = auditLogFilter === 'all'
      ? auditLog
      : auditLog.filter(log => log.action === auditLogFilter);

    const totalPages = Math.ceil(filtered.length / auditLogsPerPage);
    const startIdx = (auditLogPage - 1) * auditLogsPerPage;
    const paginated = filtered.slice(startIdx, startIdx + auditLogsPerPage);

    return { filtered, paginated, totalAuditPages: totalPages };
  }, [auditLog, auditLogFilter, auditLogPage, auditLogsPerPage]);

  // Get unique audit log actions for filter dropdown
  const auditActions = useMemo(() => {
    const actions = [...new Set(auditLog.map(log => log.action))];
    return actions.sort();
  }, [auditLog]);

  // Calculate workspace health metrics
  const calculatedHealth = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const emptyWorkspaces = workspaces.filter(ws => !ws.projectCount || ws.projectCount === 0).length;
    const activeWorkspaces = workspaces.filter(ws => {
      const updatedAt = new Date(ws.updated_at);
      return updatedAt > thirtyDaysAgo;
    }).length;
    const inactiveWorkspaces = workspaces.filter(ws => {
      const updatedAt = new Date(ws.updated_at);
      return updatedAt <= thirtyDaysAgo;
    }).length;

    return { emptyWorkspaces, activeWorkspaces, inactiveWorkspaces };
  }, [workspaces]);

  // Update health state when calculated health changes
  useEffect(() => {
    setWorkspaceHealth(calculatedHealth);
  }, [calculatedHealth]);

  // Helper function to get workspace status
  const getWorkspaceStatus = (workspace) => {
    if (!workspace.projectCount || workspace.projectCount === 0) {
      return { label: 'Empty', class: 'empty' };
    }
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const updatedAt = new Date(workspace.updated_at);
    if (updatedAt < thirtyDaysAgo) {
      return { label: 'Inactive', class: 'inactive' };
    }
    return { label: 'Active', class: 'active' };
  };

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

      {/* Workspace Health Indicators */}
      <div className="workspace-health">
        <h3>Workspace Health</h3>
        <div className="health-grid">
          <div className="health-card active">
            <div className="health-icon">
              <TrendingUp size={20} />
            </div>
            <div className="health-info">
              <span className="health-label">Active Workspaces</span>
              <span className="health-value">{workspaceHealth.activeWorkspaces}</span>
              <span className="health-subtext">Updated in last 30 days</span>
            </div>
          </div>

          <div className="health-card inactive">
            <div className="health-icon">
              <Calendar size={20} />
            </div>
            <div className="health-info">
              <span className="health-label">Inactive Workspaces</span>
              <span className="health-value">{workspaceHealth.inactiveWorkspaces}</span>
              <span className="health-subtext">No updates in 30 days</span>
            </div>
          </div>

          <div className="health-card empty">
            <div className="health-icon">
              <AlertTriangle size={20} />
            </div>
            <div className="health-info">
              <span className="health-label">Empty Workspaces</span>
              <span className="health-value">{workspaceHealth.emptyWorkspaces}</span>
              <span className="health-subtext">No projects created</span>
            </div>
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
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="search-input"
                />
              </div>
              <span className="workspace-count">
                {filtered.length} workspace{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {filtered.length === 0 ? (
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
                    <th
                      className="sortable-header"
                      onClick={() => handleSort('name')}
                      title="Click to sort"
                    >
                      Workspace Name
                      {sortField === 'name' && (
                        sortDirection === 'asc' ?
                          <ChevronUp size={16} className="sort-icon" /> :
                          <ChevronDown size={16} className="sort-icon" />
                      )}
                    </th>
                    <th
                      className="sortable-header"
                      onClick={() => handleSort('owner')}
                      title="Click to sort"
                    >
                      Owner
                      {sortField === 'owner' && (
                        sortDirection === 'asc' ?
                          <ChevronUp size={16} className="sort-icon" /> :
                          <ChevronDown size={16} className="sort-icon" />
                      )}
                    </th>
                    <th
                      className="sortable-header"
                      onClick={() => handleSort('memberCount')}
                      title="Click to sort"
                    >
                      Members
                      {sortField === 'memberCount' && (
                        sortDirection === 'asc' ?
                          <ChevronUp size={16} className="sort-icon" /> :
                          <ChevronDown size={16} className="sort-icon" />
                      )}
                    </th>
                    <th
                      className="sortable-header"
                      onClick={() => handleSort('projectCount')}
                      title="Click to sort"
                    >
                      Projects
                      {sortField === 'projectCount' && (
                        sortDirection === 'asc' ?
                          <ChevronUp size={16} className="sort-icon" /> :
                          <ChevronDown size={16} className="sort-icon" />
                      )}
                    </th>
                    <th
                      className="sortable-header"
                      onClick={() => handleSort('created_at')}
                      title="Click to sort"
                    >
                      Created
                      {sortField === 'created_at' && (
                        sortDirection === 'asc' ?
                          <ChevronUp size={16} className="sort-icon" /> :
                          <ChevronDown size={16} className="sort-icon" />
                      )}
                    </th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((workspace) => (
                    <tr key={workspace.id} className="workspace-row">
                      <td className="workspace-name">{workspace.name}</td>
                      <td className="workspace-owner">
                        {workspace.owner?.full_name || 'Unknown'}
                      </td>
                      <td className="workspace-members">
                        {workspace.memberCount || 0}
                      </td>
                      <td className="workspace-projects">
                        {workspace.projectCount || 0}
                      </td>
                      <td className="workspace-created">
                        {format(new Date(workspace.created_at), 'MMM d, yyyy')}
                      </td>
                      <td className="workspace-status">
                        {(() => {
                          const status = getWorkspaceStatus(workspace);
                          return <span className={`status-badge ${status.class}`}>{status.label}</span>;
                        })()}
                      </td>
                      <td className="workspace-actions">
                        <button
                          className="delete-workspace-btn"
                          onClick={() => handleDeleteClick(workspace)}
                          title="Delete workspace"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="pagination-controls">
                  <div className="pagination-info">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} workspaces
                  </div>
                  <div className="pagination-buttons">
                    <Button
                      variant="secondary"
                      size="small"
                      icon={<ChevronLeft size={16} />}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>

                    <div className="page-numbers">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          className={`page-number ${currentPage === page ? 'active' : ''}`}
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </button>
                      ))}
                    </div>

                    <Button
                      variant="secondary"
                      size="small"
                      icon={<ChevronRight size={16} />}
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Audit Log Section */}
        <div className="admin-section audit-section">
          <div className="section-header">
            <h2>Recent Actions</h2>
            <div className="audit-controls">
              <select
                value={auditLogFilter}
                onChange={(e) => {
                  setAuditLogFilter(e.target.value);
                  setAuditLogPage(1);
                }}
                className="audit-filter"
              >
                <option value="all">All Actions</option>
                {auditActions.map(action => (
                  <option key={action} value={action}>
                    {action.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
              <span className="log-count">{filteredAuditLog.length} actions</span>
            </div>
          </div>

          {filteredAuditLog.length === 0 ? (
            <div className="empty-state">
              <Activity size={48} />
              <h3>No actions found</h3>
              <p>No administrative actions match your filter</p>
            </div>
          ) : (
            <>
              <div className="audit-log">
                {paginatedAuditLog.map((log) => (
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

              {/* Audit Log Pagination */}
              {totalAuditPages > 1 && (
                <div className="audit-pagination">
                  <div className="pagination-info">
                    Showing {(auditLogPage - 1) * auditLogsPerPage + 1} to {Math.min(auditLogPage * auditLogsPerPage, filteredAuditLog.length)} of {filteredAuditLog.length} actions
                  </div>
                  <div className="pagination-buttons">
                    <Button
                      variant="secondary"
                      size="small"
                      icon={<ChevronLeft size={16} />}
                      onClick={() => setAuditLogPage(p => Math.max(1, p - 1))}
                      disabled={auditLogPage === 1}
                    >
                      Previous
                    </Button>

                    <div className="page-numbers">
                      {Array.from({ length: totalAuditPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          className={`page-number ${auditLogPage === page ? 'active' : ''}`}
                          onClick={() => setAuditLogPage(page)}
                        >
                          {page}
                        </button>
                      ))}
                    </div>

                    <Button
                      variant="secondary"
                      size="small"
                      icon={<ChevronRight size={16} />}
                      onClick={() => setAuditLogPage(p => Math.min(totalAuditPages, p + 1))}
                      disabled={auditLogPage === totalAuditPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
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
            <li>{workspaceToDelete?.memberCount || 0} members</li>
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
