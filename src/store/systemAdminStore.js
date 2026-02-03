import { create } from 'zustand';
import { supabase } from '../lib/supabase';

const useSystemAdminStore = create((set, get) => ({
  workspaces: [],
  auditLog: [],
  stats: {
    totalWorkspaces: 0,
    totalUsers: 0,
    totalProjects: 0,
    totalTasks: 0,
  },
  loading: false,
  error: null,

  // Fetch all workspaces
  fetchAllWorkspaces: async () => {
    set({ loading: true, error: null });
    try {
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

      set({ workspaces: data || [], loading: false });
      return { data, error: null };
    } catch (error) {
      set({ error: error.message, loading: false });
      return { data: null, error };
    }
  },

  // Fetch audit log
  fetchAuditLog: async () => {
    try {
      const { data, error } = await supabase
        .from('workspace_audit_log')
        .select(`
          id,
          admin_id,
          workspace_id,
          workspace_name,
          action,
          details,
          created_at,
          admin:profiles!workspace_audit_log_admin_id_fkey(id, full_name, email, avatar_url)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      set({ auditLog: data || [] });
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Fetch system-wide statistics
  fetchStats: async () => {
    try {
      const [workspacesRes, usersRes, projectsRes, tasksRes] = await Promise.all([
        supabase.from('workspaces').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('projects').select('id', { count: 'exact', head: true }),
        supabase.from('tasks').select('id', { count: 'exact', head: true }),
      ]);

      const newStats = {
        totalWorkspaces: workspacesRes.count || 0,
        totalUsers: usersRes.count || 0,
        totalProjects: projectsRes.count || 0,
        totalTasks: tasksRes.count || 0,
      };

      set({ stats: newStats });
      return { data: newStats, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Delete a workspace
  deleteWorkspace: async (workspaceId, workspaceName) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('workspaces')
        .delete()
        .eq('id', workspaceId);

      if (error) throw error;

      // Refresh workspaces list
      const state = get();
      state.fetchAllWorkspaces();
      state.fetchAuditLog();
      state.fetchStats();

      set({ loading: false });
      return { error: null };
    } catch (error) {
      set({ error: error.message, loading: false });
      return { error };
    }
  },

  // Promote user to system admin
  promoteUserToSystemAdmin: async (userId) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_system_admin: true })
        .eq('id', userId);

      if (error) throw error;

      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  // Demote system admin
  demoteSystemAdmin: async (userId) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_system_admin: false })
        .eq('id', userId);

      if (error) throw error;

      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  // Get workspace details with full information
  getWorkspaceDetails: async (workspaceId) => {
    try {
      const { data, error } = await supabase
        .from('workspaces')
        .select(`
          id,
          name,
          owner_id,
          created_at,
          updated_at,
          owner:profiles!workspaces_owner_id_fkey(id, full_name, email, avatar_url),
          profiles(id, full_name, email, role),
          projects(id, name, created_at, tasks(id))
        `)
        .eq('id', workspaceId)
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Export workspace analytics
  exportWorkspaceAnalytics: async (workspaceId) => {
    try {
      // Get comprehensive workspace data
      const workspace = await get().getWorkspaceDetails(workspaceId);

      if (workspace.error) throw workspace.error;

      // Calculate analytics
      const analytics = {
        workspace: workspace.data,
        summary: {
          totalMembers: workspace.data.profiles?.length || 0,
          totalProjects: workspace.data.projects?.length || 0,
          totalTasks: workspace.data.projects?.reduce((sum, p) => sum + (p.tasks?.length || 0), 0) || 0,
          createdAt: workspace.data.created_at,
          lastUpdated: workspace.data.updated_at,
        },
      };

      return { data: analytics, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
}));

export default useSystemAdminStore;
