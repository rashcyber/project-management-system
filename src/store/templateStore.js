import { create } from 'zustand';
import { supabase } from '../lib/supabase';

const useTemplateStore = create((set, get) => ({
  templates: [],
  publicTemplates: [],
  currentTemplate: null,
  loading: false,
  error: null,

  // Fetch all templates for current user
  fetchTemplates: async () => {
    set({ loading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('task_templates')
        .select(`
          *,
          creator:profiles!created_by(id, full_name, email, avatar_url)
        `)
        .eq('created_by', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      set({ templates: data || [], loading: false });
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching templates:', error);
      set({ error: error.message, loading: false });
      return { data: null, error };
    }
  },

  // Fetch public templates for current workspace
  fetchPublicTemplates: async () => {
    set({ loading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get user's workspace
      const { data: profile } = await supabase
        .from('profiles')
        .select('workspace_id')
        .eq('id', user.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      const { data, error } = await supabase
        .from('task_templates')
        .select(`
          *,
          creator:profiles!created_by(id, full_name, email, avatar_url)
        `)
        .eq('workspace_id', profile.workspace_id)
        .eq('is_public', true)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      set({ publicTemplates: data || [], loading: false });
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching public templates:', error);
      set({ error: error.message, loading: false });
      return { data: null, error };
    }
  },

  // Create a new template
  createTemplate: async (templateData) => {
    set({ loading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('workspace_id')
        .eq('id', user.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      const { data, error } = await supabase
        .from('task_templates')
        .insert({
          ...templateData,
          created_by: user.id,
          workspace_id: profile.workspace_id,
        })
        .select()
        .single();

      if (error) throw error;

      set((state) => ({
        templates: [data, ...state.templates],
        loading: false,
      }));

      console.log('✅ Template created:', data.name);
      return { data, error: null };
    } catch (error) {
      console.error('Error creating template:', error);
      set({ error: error.message, loading: false });
      return { data: null, error };
    }
  },

  // Update a template
  updateTemplate: async (templateId, updates) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('task_templates')
        .update(updates)
        .eq('id', templateId)
        .select()
        .single();

      if (error) throw error;

      set((state) => ({
        templates: state.templates.map((t) =>
          t.id === templateId ? data : t
        ),
        currentTemplate: state.currentTemplate?.id === templateId ? data : state.currentTemplate,
        loading: false,
      }));

      console.log('✅ Template updated:', templateId);
      return { data, error: null };
    } catch (error) {
      console.error('Error updating template:', error);
      set({ error: error.message, loading: false });
      return { data: null, error };
    }
  },

  // Delete a template
  deleteTemplate: async (templateId) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('task_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      set((state) => ({
        templates: state.templates.filter((t) => t.id !== templateId),
        loading: false,
      }));

      console.log('✅ Template deleted:', templateId);
      return { error: null };
    } catch (error) {
      console.error('Error deleting template:', error);
      set({ error: error.message, loading: false });
      return { data: null, error };
    }
  },

  // Get a single template
  getTemplate: async (templateId) => {
    try {
      const { data, error } = await supabase
        .from('task_templates')
        .select(`
          *,
          creator:profiles!created_by(id, full_name, email, avatar_url)
        `)
        .eq('id', templateId)
        .single();

      if (error) throw error;

      set({ currentTemplate: data });
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching template:', error);
      return { data: null, error };
    }
  },

  // Increment use count (called when template is used to create a task)
  incrementUseCount: async (templateId) => {
    try {
      const template = get().templates.find((t) => t.id === templateId);
      if (!template) return;

      const { error } = await supabase
        .from('task_templates')
        .update({ use_count: (template.use_count || 0) + 1 })
        .eq('id', templateId);

      if (error) throw error;

      set((state) => ({
        templates: state.templates.map((t) =>
          t.id === templateId
            ? { ...t, use_count: (t.use_count || 0) + 1 }
            : t
        ),
      }));
    } catch (error) {
      console.error('Error incrementing use count:', error);
    }
  },

  // Create a task from template
  createTaskFromTemplate: async (templateId, projectId, overrides = {}) => {
    try {
      const template = get().templates.find((t) => t.id === templateId) ||
                      (await get().getTemplate(templateId)).data;

      if (!template) throw new Error('Template not found');

      // Build task from template
      const taskData = {
        title: overrides.title || template.title_template || 'Untitled Task',
        description: overrides.description || template.description_template,
        priority: overrides.priority || template.priority || 'medium',
        status: 'not_started',
        project_id: projectId,
        assignee_ids: overrides.assignee_ids || template.assignee_ids || [],
        subtasks: template.subtasks || [],
        labels: template.labels || [],
      };

      if (template.estimated_hours) {
        taskData.estimated_hours = template.estimated_hours;
      }

      // Increment use count
      await get().incrementUseCount(templateId);

      console.log('✅ Task created from template:', template.name);
      return { data: taskData, error: null };
    } catch (error) {
      console.error('Error creating task from template:', error);
      return { data: null, error };
    }
  },

  // Save current task as template
  saveTaskAsTemplate: async (task, templateName, isPublic = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('workspace_id')
        .eq('id', user.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      const templateData = {
        name: templateName,
        description: `Template created from task: ${task.title}`,
        title_template: task.title,
        description_template: task.description,
        priority: task.priority,
        status: task.status,
        due_date: task.due_date,
        estimated_hours: task.estimated_hours,
        subtasks: task.subtasks?.map((s) => ({
          title: s.title,
          estimated_hours: s.estimated_hours,
        })) || [],
        labels: task.task_labels?.map((tl) => tl.label.id) || [],
        assignee_ids: task.assignees?.map((a) => a.id) || [],
        is_public: isPublic,
        project_id: task.project_id,
        created_by: user.id,
        workspace_id: profile.workspace_id,
      };

      const { data, error } = await supabase
        .from('task_templates')
        .insert(templateData)
        .select()
        .single();

      if (error) throw error;

      set((state) => ({
        templates: [data, ...state.templates],
      }));

      console.log('✅ Task saved as template:', templateName);
      return { data, error: null };
    } catch (error) {
      console.error('Error saving task as template:', error);
      return { data: null, error };
    }
  },

  // Set current template for viewing/editing
  setCurrentTemplate: (template) => set({ currentTemplate: template }),

  // Clear templates
  clearTemplates: () => set({ templates: [], publicTemplates: [], currentTemplate: null }),
}));

export default useTemplateStore;
