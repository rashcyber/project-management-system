import { create } from 'zustand';
import { supabase } from '../lib/supabase';

const useActivityStore = create((set, get) => ({
  activities: [],
  loading: false,
  error: null,

  // Fetch activities for a project
  fetchProjectActivities: async (projectId, limit = 50) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('activity_log')
        .select(`
          *,
          user:profiles!activity_log_user_id_fkey(id, full_name, email, avatar_url),
          task:tasks(id, title)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      set({ activities: data || [], loading: false });
      return { data, error: null };
    } catch (error) {
      set({ error: error.message, loading: false });
      return { data: null, error };
    }
  },

  // Fetch all activities for current user's projects
  fetchAllActivities: async (limit = 100) => {
    set({ loading: true, error: null });
    try {
      const { data: { user } = {} } = await supabase.auth.getUser();
      if (!user) return { error: 'Not authenticated' };

      // Get user profile for role check
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const isAdmin = profile?.role === 'super_admin' || profile?.role === 'admin';

      let query = supabase
        .from('activity_log')
        .select(`
          *,
          user:profiles!activity_log_user_id_fkey(id, full_name, email, avatar_url),
          task:tasks(id, title),
          project:projects(id, name, color)
        `);

      // If not admin, only show activities for projects the user is a member of
      if (!isAdmin) {
        const { data: memberships } = await supabase
          .from('project_members')
          .select('project_id')
          .eq('user_id', user.id);

        const projectIds = memberships?.map(m => m.project_id) || [];

        if (projectIds.length > 0) {
          query = query.in('project_id', projectIds);
        } else {
          // If not in any projects, return empty
          set({ activities: [], loading: false });
          return { data: [], error: null };
        }
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      set({ activities: data || [], loading: false });
      return { data, error: null };
    } catch (error) {
      set({ error: error.message, loading: false });
      return { data: null, error };
    }
  },

  // Log an activity
  logActivity: async (action, details = {}, projectId = null, taskId = null) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { error: 'Not authenticated' };

      const { data, error } = await supabase
        .from('activity_log')
        .insert({
          user_id: user.id,
          project_id: projectId,
          task_id: taskId,
          action,
          details,
        })
        .select(`
          *,
          user:profiles!activity_log_user_id_fkey(id, full_name, email, avatar_url)
        `)
        .single();

      if (error) throw error;

      // Add to local state
      set((state) => ({
        activities: [data, ...state.activities],
      }));

      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Subscribe to real-time activity updates for a project
  subscribeToProjectActivities: (projectId) => {
    const channel = supabase
      .channel(`activities-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_log',
          filter: `project_id=eq.${projectId}`,
        },
        async (payload) => {
          // Fetch the full activity with user data
          const { data } = await supabase
            .from('activity_log')
            .select(`
              *,
              user:profiles!activity_log_user_id_fkey(id, full_name, email, avatar_url),
              task:tasks(id, title)
            `)
            .eq('id', payload.new.id)
            .single();

          if (data) {
            set((state) => ({
              activities: [data, ...state.activities],
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  // Clear activities
  clearActivities: () => set({ activities: [] }),
}));

export default useActivityStore;
