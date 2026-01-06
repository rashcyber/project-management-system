import { create } from 'zustand';
import { supabase } from '../lib/supabase';

const useDependencyStore = create((set, get) => ({
  dependencies: [],
  loading: false,
  error: null,

  // Fetch dependencies for a project
  fetchDependencies: async (projectId) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('task_dependencies')
        .select(`
          *,
          blocking_task:tasks!task_dependencies_blocking_task_id_fkey(id, title, status, priority),
          blocked_task:tasks!task_dependencies_blocked_task_id_fkey(id, title, status, priority)
        `)
        .eq('project_id', projectId);

      if (error) throw error;

      set({ dependencies: data || [], loading: false });
      return { data: data || [], error: null };
    } catch (error) {
      set({ error: error.message, loading: false });
      return { data: null, error };
    }
  },

  // Add a dependency (blockingTask blocks blockedTask)
  addDependency: async (blockingTaskId, blockedTaskId) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('task_dependencies')
        .insert({
          blocking_task_id: blockingTaskId,
          blocked_task_id: blockedTaskId,
        })
        .select(`
          *,
          blocking_task:tasks!task_dependencies_blocking_task_id_fkey(id, title, status, priority),
          blocked_task:tasks!task_dependencies_blocked_task_id_fkey(id, title, status, priority)
        `)
        .single();

      if (error) throw error;

      set((state) => ({
        dependencies: [...state.dependencies, data],
        loading: false,
      }));

      return { data, error: null };
    } catch (error) {
      set({ error: error.message, loading: false });
      return { data: null, error };
    }
  },

  // Remove a dependency
  removeDependency: async (dependencyId) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('task_dependencies')
        .delete()
        .eq('id', dependencyId);

      if (error) throw error;

      set((state) => ({
        dependencies: state.dependencies.filter((d) => d.id !== dependencyId),
        loading: false,
      }));

      return { error: null };
    } catch (error) {
      set({ error: error.message, loading: false });
      return { error };
    }
  },

  // Get tasks that are blocking a specific task
  getBlockingTasks: (taskId) => {
    return get().dependencies
      .filter((d) => d.blocked_task_id === taskId)
      .map((d) => d.blocking_task)
      .filter(Boolean);
  },

  // Get tasks that are blocked by a specific task
  getBlockedTasks: (taskId) => {
    return get().dependencies
      .filter((d) => d.blocking_task_id === taskId)
      .map((d) => d.blocked_task)
      .filter(Boolean);
  },

  // Check if a task has any blocking dependencies
  isTaskBlocked: (taskId) => {
    const blockingTasks = get().getBlockingTasks(taskId);
    return blockingTasks.some((task) => task.status !== 'completed');
  },

  // Clear all dependencies
  clearDependencies: () => {
    set({ dependencies: [], loading: false, error: null });
  },
}));

export default useDependencyStore;
