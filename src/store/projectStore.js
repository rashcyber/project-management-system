import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import useAuthStore from './authStore';

const useProjectStore = create((set, get) => ({
  projects: [],
  currentProject: null,
  members: [],
  loading: false,
  error: null,

  setCurrentProject: (project) => set({ currentProject: project }),

  // Fetch all projects for current user with role-based filtering
  fetchProjects: async () => {
    set({ loading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { profile } = useAuthStore.getState();

      let query = supabase
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

      // SECURITY: Apply role-based project filtering for multi-team isolation
      if (profile?.role === 'super_admin') {
        // Super Admin: See ALL projects (for system oversight)
      } else if (profile?.role === 'admin') {
        // Admin: Projects they own OR are members of
        query = query.or(`owner_id.eq.${user.id},project_members.user_id.eq.${user.id}`);
      } else {
        // Member/Manager: ONLY projects they're members of
        query = query.filter('project_members.user_id', 'eq', user.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      set({ projects: data || [], loading: false });
      return { data, error: null };
    } catch (error) {
      set({ error: error.message, loading: false });
      return { data: null, error };
    }
  },

  // Fetch single project by ID with access control
  fetchProject: async (projectId) => {
    set({ loading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { profile } = useAuthStore.getState();

      let query = supabase
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
        .eq('id', projectId);

      // SECURITY: Apply role-based access control for single project
      if (profile?.role !== 'super_admin') {
        if (profile?.role === 'admin') {
          // Admin: Can access projects they own OR are members of
          query = query.or(`owner_id.eq.${user.id},project_members.user_id.eq.${user.id}`);
        } else {
          // Member/Manager: Can only access projects they're members of
          query = query.filter('project_members.user_id', 'eq', user.id);
        }
      }

      const { data, error } = await query.single();

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

      // Get actor's name for notification
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const { data: actorProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', authUser.id)
        .single();

      const actorName = actorProfile?.full_name || 'Someone';

      // Create notification for the added user
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'project_invite',
        title: 'Added to Project',
        message: `${actorName} added you to a project`,
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

  // Fetch project files
  fetchProjectFiles: async (projectId) => {
    try {
      const { data, error } = await supabase
        .from('project_files')
        .select(`
          *,
          uploader:profiles(id, full_name, avatar_url)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Upload project file
  uploadProjectFile: async (projectId, file) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Generate unique file path
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const filePath = `${projectId}/${fileName}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('project-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get file metadata
      const fileMetadata = {
        name: file.name,
        size: file.size,
        type: file.type,
      };

      // Insert file record in database
      const { data, error } = await supabase
        .from('project_files')
        .insert({
          project_id: projectId,
          name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
          uploaded_by: user.id,
        })
        .select(`
          *,
          uploader:profiles(id, full_name, avatar_url)
        `)
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Delete project file
  deleteProjectFile: async (projectId, fileId) => {
    try {
      // Get file info first
      const { data: fileData } = await supabase
        .from('project_files')
        .select('file_path')
        .eq('id', fileId)
        .single();

      if (!fileData) {
        throw new Error('File not found');
      }

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('project-files')
        .remove([fileData.file_path]);

      if (storageError) {
        console.error('Storage error:', storageError);
      }

      // Delete from database
      const { error } = await supabase
        .from('project_files')
        .delete()
        .eq('id', fileId);

      if (error) throw error;

      return { error: null };
    } catch (error) {
      return { error };
    }
  },
}));

export default useProjectStore;
