import { create } from 'zustand';
import { supabase } from '../lib/supabase';

const useProjectStore = create((set, get) => ({
  projects: [],
  currentProject: null,
  members: [],
  loading: false,
  error: null,

  setCurrentProject: (project) => set({ currentProject: project }),

  // Fetch all projects for current user
  fetchProjects: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          owner:profiles!projects_owner_id_fkey(id, full_name, email, avatar_url),
          project_members(
            user_id,
            role,
            joined_at,
            user:profiles(id, full_name, email, avatar_url)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      set({ projects: data || [], loading: false });
      return { data, error: null };
    } catch (error) {
      set({ error: error.message, loading: false });
      return { data: null, error };
    }
  },

  // Fetch single project by ID
  fetchProject: async (projectId) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          owner:profiles!projects_owner_id_fkey(id, full_name, email, avatar_url),
          project_members(
            user_id,
            role,
            joined_at,
            user:profiles(id, full_name, email, avatar_url)
          )
        `)
        .eq('id', projectId)
        .single();

      if (error) throw error;

      set({ currentProject: data, loading: false });
      return { data, error: null };
    } catch (error) {
      set({ error: error.message, loading: false });
      return { data: null, error };
    }
  },

  // Create new project
  createProject: async (projectData) => {
    set({ loading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('projects')
        .insert({
          ...projectData,
          owner_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Add owner as project admin
      const { error: memberError } = await supabase.from('project_members').insert({
        project_id: data.id,
        user_id: user.id,
        role: 'admin',
      });

      if (memberError) {
        console.error('Failed to add owner as member:', memberError);
      }

      // Refetch the project to get it with members included
      const { data: projectWithMembers } = await supabase
        .from('projects')
        .select(`
          *,
          owner:profiles!projects_owner_id_fkey(id, full_name, email, avatar_url),
          project_members(
            user_id,
            role,
            joined_at,
            user:profiles(id, full_name, email, avatar_url)
          )
        `)
        .eq('id', data.id)
        .single();

      set((state) => ({
        projects: [projectWithMembers || data, ...state.projects],
        loading: false,
      }));

      return { data: projectWithMembers || data, error: null };
    } catch (error) {
      set({ error: error.message, loading: false });
      return { data: null, error };
    }
  },

  // Update project
  updateProject: async (projectId, updates) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', projectId)
        .select()
        .single();

      if (error) throw error;

      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === projectId ? { ...p, ...data } : p
        ),
        currentProject:
          state.currentProject?.id === projectId
            ? { ...state.currentProject, ...data }
            : state.currentProject,
        loading: false,
      }));

      return { data, error: null };
    } catch (error) {
      set({ error: error.message, loading: false });
      return { data: null, error };
    }
  },

  // Delete project
  deleteProject: async (projectId) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;

      set((state) => ({
        projects: state.projects.filter((p) => p.id !== projectId),
        currentProject:
          state.currentProject?.id === projectId ? null : state.currentProject,
        loading: false,
      }));

      return { error: null };
    } catch (error) {
      set({ error: error.message, loading: false });
      return { error };
    }
  },

  // Add member to project
  addMember: async (projectId, userId, role = 'member') => {
    try {
      const { data, error } = await supabase
        .from('project_members')
        .insert({
          project_id: projectId,
          user_id: userId,
          role,
        })
        .select(`
          *,
          user:profiles(id, full_name, email, avatar_url)
        `)
        .single();

      if (error) throw error;

      // Create notification for the added user
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'project_invite',
        title: 'Added to Project',
        message: `You have been added to a project`,
        project_id: projectId,
      });

      await get().fetchProject(projectId);
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Remove member from project
  removeMember: async (projectId, userId) => {
    try {
      const { error } = await supabase
        .from('project_members')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId);

      if (error) throw error;

      await get().fetchProject(projectId);
      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  // Update member role
  updateMemberRole: async (projectId, userId, role) => {
    try {
      const { data, error } = await supabase
        .from('project_members')
        .update({ role })
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      await get().fetchProject(projectId);
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
}));

export default useProjectStore;
