import useOfflineStore from '../store/offlineStore';
import { supabase } from './supabase';

/**
 * Offline Service
 * Handles network detection, action queueing, and sync when back online
 */

// Initialize network detection
export const initializeOfflineDetection = () => {
  const handleOnline = () => {
    console.log('App is online - syncing queued actions');
    useOfflineStore.getState().setOnline(true);
    // Attempt to sync pending actions
    syncPendingActions();
  };

  const handleOffline = () => {
    console.log('App is offline - actions will be queued');
    useOfflineStore.getState().setOnline(false);
  };

  // Add event listeners
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Check initial status
  if (!navigator.onLine) {
    useOfflineStore.getState().setOnline(false);
  }

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
};

/**
 * Queue an action for later sync
 * @param {string} type - Action type (e.g., 'create_task', 'update_task')
 * @param {object} payload - Action payload
 * @returns {string} Action ID
 */
export const queueAction = (type, payload) => {
  const offlineStore = useOfflineStore.getState();

  if (!offlineStore.isOnline) {
    console.log(`Queueing offline action: ${type}`);
    return offlineStore.queueAction(type, payload);
  }

  return null;
};

/**
 * Sync pending actions with server
 * This should be called when app comes back online
 * @returns {Promise<{succeeded: string[], failed: {actionId: string, error: Error}[]}>}
 */
export const syncPendingActions = async () => {
  const offlineStore = useOfflineStore.getState();
  const pendingActions = offlineStore.getPendingActions();

  if (pendingActions.length === 0) {
    return { succeeded: [], failed: [] };
  }

  if (offlineStore.syncInProgress) {
    console.log('Sync already in progress, skipping');
    return { succeeded: [], failed: [] };
  }

  offlineStore.setSyncInProgress(true);
  offlineStore.clearError();

  const succeeded = [];
  const failed = [];

  try {
    for (const action of pendingActions) {
      try {
        // Call the appropriate sync handler based on action type
        await processPendingAction(action);
        succeeded.push(action.id);
        offlineStore.removePendingAction(action.id);
        console.log(`Synced action: ${action.id}`);
      } catch (error) {
        console.error(`Failed to sync action ${action.id}:`, error);

        // Retry logic: only retry up to 3 times
        if (action.retries < 3) {
          offlineStore.incrementRetry(action.id);
          failed.push({ actionId: action.id, error });
        } else {
          // Max retries reached, remove action
          console.warn(`Max retries reached for action ${action.id}, removing from queue`);
          offlineStore.removePendingAction(action.id);
          failed.push({ actionId: action.id, error: new Error('Max retries exceeded') });
        }
      }
    }

    offlineStore.setLastSync(new Date().toISOString());
  } catch (error) {
    console.error('Sync process failed:', error);
    offlineStore.setError(error.message);
  } finally {
    offlineStore.setSyncInProgress(false);
  }

  return { succeeded, failed };
};

/**
 * Process a single pending action
 * This dispatches the action to the appropriate handler
 * @param {object} action - The pending action to process
 */
const processPendingAction = async (action) => {
  console.log(`Processing offline action: ${action.type}`, action.payload);

  switch (action.type) {
    case 'addSubtask': {
      const { taskId, title, assignedTo } = action.payload;

      // Get max position
      const { data: maxPosData } = await supabase
        .from('subtasks')
        .select('position')
        .eq('task_id', taskId)
        .order('position', { ascending: false })
        .limit(1);

      const maxPosition = maxPosData?.[0]?.position ?? -1;

      // Insert subtask
      const { data, error } = await supabase
        .from('subtasks')
        .insert({
          task_id: taskId,
          title,
          position: maxPosition + 1,
          assigned_to: assignedTo,
        })
        .select(`
          *,
          assignee:profiles!subtasks_assigned_to_fkey(id, full_name, email, avatar_url)
        `)
        .single();

      if (error) throw error;
      return { data };
    }

    case 'toggleSubtask': {
      const { subtaskId, completed } = action.payload;
      const { data, error } = await supabase
        .from('subtasks')
        .update({ completed })
        .eq('id', subtaskId)
        .select(`
          *,
          assignee:profiles!subtasks_assigned_to_fkey(id, full_name, email, avatar_url)
        `)
        .single();

      if (error) throw error;
      return { data };
    }

    case 'updateTask': {
      const { taskId, updates } = action.payload;
      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;
      return { data };
    }

    case 'deleteTask': {
      const { taskId } = action.payload;
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
      return {};
    }

    case 'create_project': {
      const { projectData, userId } = action.payload;

      // Create project
      const { data, error } = await supabase
        .from('projects')
        .insert(projectData)
        .select()
        .single();

      if (error) throw error;

      // Add owner as project admin
      const { error: memberError } = await supabase.from('project_members').insert({
        project_id: data.id,
        user_id: userId,
        role: 'admin',
      });

      if (memberError) {
        console.error('Failed to add owner as member:', memberError);
      }

      // Return the created project
      return { data };
    }

    case 'update_project': {
      const { projectId, updates } = action.payload;

      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', projectId)
        .select()
        .single();

      if (error) throw error;
      return { data };
    }

    case 'delete_project': {
      const { projectId } = action.payload;

      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;
      return {};
    }

    default:
      throw new Error(`Unknown action type: ${action.type}`);
  }
};

/**
 * Get offline status
 * @returns {boolean} Whether app is currently offline
 */
export const isOffline = () => {
  return !useOfflineStore.getState().isOnline;
};

/**
 * Get count of pending actions
 * @returns {number} Number of pending actions
 */
export const getPendingActionCount = () => {
  return useOfflineStore.getState().getPendingActions().length;
};

/**
 * Check if a specific action type has pending actions
 * @param {string} type - Action type to check
 * @returns {boolean} Whether there are pending actions of this type
 */
export const hasPendingActionType = (type) => {
  const pendingActions = useOfflineStore.getState().getPendingActions();
  return pendingActions.some((a) => a.type === type);
};

export default {
  initializeOfflineDetection,
  queueAction,
  syncPendingActions,
  isOffline,
  getPendingActionCount,
  hasPendingActionType,
};
