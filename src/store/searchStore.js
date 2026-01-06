import { create } from 'zustand';
import { supabase } from '../lib/supabase';

const useSearchStore = create((set, get) => ({
  query: '',
  results: {
    projects: [],
    tasks: [],
    files: [],
  },
  loading: false,
  isOpen: false,

  setQuery: (query) => set({ query }),
  setOpen: (isOpen) => set({ isOpen }),
  toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),

  search: async (searchQuery) => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      set({ results: { projects: [], tasks: [], files: [] }, query: searchQuery });
      return;
    }

    set({ loading: true, query: searchQuery });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        set({ loading: false, results: { projects: [], tasks: [], files: [] } });
        return;
      }

      // Get user's project IDs
      const { data: memberships } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', user.id);

      const projectIds = memberships?.map(m => m.project_id) || [];

      let results = { projects: [], tasks: [], files: [] };

      // Check if user is admin (can see all)
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const isAdmin = profile?.role === 'super_admin' || profile?.role === 'admin';

      // Search Projects
      const projectQuery = supabase
        .from('projects')
        .select('id, name, description, color, created_at')
        .ilike('name', `%${searchQuery}%`)
        .limit(5);

      if (!isAdmin && projectIds.length > 0) {
        projectQuery.in('id', projectIds);
      }

      const { data: projects } = await projectQuery;
      results.projects = projects || [];

      // Search Tasks
      const taskQuery = supabase
        .from('tasks')
        .select('id, title, status, priority, project_id, project:projects(id, name, color)')
        .ilike('title', `%${searchQuery}%`)
        .limit(10);

      if (!isAdmin && projectIds.length > 0) {
        taskQuery.in('project_id', projectIds);
      }

      const { data: tasks } = await taskQuery;
      results.tasks = tasks || [];

      // Search Files
      const fileQuery = supabase
        .from('project_files')
        .select('id, name, mime_type, project_id, project:projects(id, name)')
        .ilike('name', `%${searchQuery}%`)
        .limit(5);

      if (!isAdmin && projectIds.length > 0) {
        fileQuery.in('project_id', projectIds);
      }

      const { data: files } = await fileQuery;
      results.files = files || [];

      set({ results, loading: false });
    } catch (error) {
      console.error('Search error:', error);
      set({ loading: false, results: { projects: [], tasks: [], files: [] } });
    }
  },

  clearSearch: () => set({
    query: '',
    results: { projects: [], tasks: [], files: [] },
    loading: false,
  }),
}));

export default useSearchStore;
