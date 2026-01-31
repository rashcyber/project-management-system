import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import useOfflineStore from './offlineStore';
import { getCachedData, cacheData, CACHE_KEYS } from '../lib/offlineCache';

// Helper function to log activity
const logActivity = async (action, details, projectId, taskId) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('activity_log').insert({
      user_id: user.id,
      project_id: projectId,
      task_id: taskId,
      action,
      details,
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};

// Helper function to determine if a date should generate a recurring instance
const shouldGenerateInstance = (date, pattern, startDate) => {
  const dayOfWeek = date.getDay();
  const dayOfMonth = date.getDate();

  if (pattern.frequency === 'daily') return true;

  if (pattern.frequency === 'weekly') {
    return pattern.days?.includes(dayOfWeek) || true;
  }

  if (pattern.frequency === 'monthly') {
    return dayOfMonth === (pattern.day_of_month || 1);
  }

  if (pattern.frequency === 'yearly') {
    const month = date.getMonth();
    const day = date.getDate();
    return month === pattern.month && day === pattern.day;
  }

  return false;
};

// Helper function to get the next date based on recurrence pattern
const getNextDate = (currentDate, pattern) => {
  const nextDate = new Date(currentDate);

  if (pattern.frequency === 'daily') {
    nextDate.setDate(nextDate.getDate() + (pattern.interval || 1));
  } else if (pattern.frequency === 'weekly') {
    nextDate.setDate(nextDate.getDate() + 7);
  } else if (pattern.frequency === 'monthly') {
    nextDate.setMonth(nextDate.getMonth() + 1);
  } else if (pattern.frequency === 'yearly') {
    nextDate.setFullYear(nextDate.getFullYear() + 1);
  }

  return nextDate;
};

// Simple in-memory profile cache to reduce database queries
const profileCache = new Map();
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

const getCachedProfile = async (userId) => {
  const now = Date.now();
  const cached = profileCache.get(userId);

  if (cached && now - cached.timestamp < CACHE_EXPIRY) {
    console.log('💬 [CACHE] Using cached profile for:', userId);
    return cached.data;
  }

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('id', userId)
    .single();

  if (data) {
    profileCache.set(userId, { data, timestamp: now });
  }

  return data;
};

const getAllProfilesCache = async () => {
  const cacheKey = 'ALL_PROFILES';
  const now = Date.now();
  const cached = profileCache.get(cacheKey);

  if (cached && now - cached.timestamp < CACHE_EXPIRY) {
    console.log('💬 [CACHE] Using cached all profiles');
    return cached.data;
  }

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name');

  if (data) {
    profileCache.set(cacheKey, { data, timestamp: now });
  }

  return data || [];
};

const useTaskStore = create((set, get) => ({
  tasks: [],
  currentTask: null,
  loading: false,
  error: null,

  setTasks: (tasks) => set({ tasks }),
  setCurrentTask: (task) => set({ currentTask: task }),

  // Fetch tasks for a project
  fetchTasks: async (projectId) => {
    set({ loading: true, error: null });
    try {
      const isOnline = useOfflineStore.getState().isOnline;

      // Check cache first if offline
      if (!isOnline) {
        const cachedTasks = getCachedData(CACHE_KEYS.TASKS);
        if (cachedTasks?.projectId === projectId && cachedTasks?.data) {
          console.log('[OFFLINE] Using cached tasks');
          set({ tasks: cachedTasks.data || [], loading: false });
          return { data: cachedTasks.data, error: null, fromCache: true };
        }
      }

      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          creator:profiles!tasks_created_by_fkey(id, full_name, email, avatar_url),
          subtasks(id, title, completed, position, assigned_to, assignee:profiles!subtasks_assigned_to_fkey(id, full_name, email, avatar_url)),
          comments(id, content, created_at, parent_id, user:profiles(id, full_name, avatar_url)),
          task_labels(label:labels(id, name, color)),
          task_assignees(user_id, user:profiles(id, full_name, email, avatar_url))
        `)
        .eq('project_id', projectId)
        .order('position', { ascending: true });

      if (error) throw error;

      // Transform task_assignees to array format
      const transformedData = data?.map(task => ({
        ...task,
        assignees: task.task_assignees?.map(ta => ta.user) || [],
        assignee_id: task.task_assignees?.[0]?.user_id || null, // Keep for compatibility
        assignee: task.task_assignees?.[0]?.user || null
      })) || [];

      // Cache the tasks
      if (transformedData) {
        cacheData(CACHE_KEYS.TASKS, { data: transformedData, projectId });
      }

      set({ tasks: transformedData, loading: false });
      return { data: transformedData, error: null };
    } catch (error) {
      set({ error: error.message, loading: false });
      return { data: null, error };
    }
  },

  // Create new task
  createTask: async (taskData) => {
    set({ loading: true, error: null });
    try {
      console.log('📝 createTask called:', taskData);
      const { data: { user } } = await supabase.auth.getUser();
      const isOnline = useOfflineStore.getState().isOnline;

      // Extract assignee_ids and reminders from taskData
      const assignee_ids = taskData.assignee_ids || [];
      const reminders = taskData.reminders || null;
      delete taskData.assignee_ids;
      delete taskData.reminders;

      console.log('📝 Task assignee IDs:', assignee_ids);
      console.log('📝 Task reminders:', reminders);

      // If offline, queue the action
      if (!isOnline) {
        console.log('[OFFLINE] Queueing task creation');
        const actionId = useOfflineStore.getState().queueAction('createTask', {
          taskData: { ...taskData, created_by: user.id },
          assignee_ids,
        });

        // Create optimistic task for immediate UI update
        const optimisticTask = {
          ...taskData,
          id: actionId,
          created_by: user.id,
          creator: { id: user.id, full_name: 'You', email: '', avatar_url: null },
          assignees: [],
          subtasks: [],
          comments: [],
          task_labels: [],
          files: [],
          offline: true,
          position: 0,
        };

        const state = get();
        set({
          tasks: [...state.tasks, optimisticTask],
          loading: false,
        });

        return {
          data: optimisticTask,
          error: null,
          queued: true,
          actionId,
        };
      }

      // Get max position for the status column
      const { data: maxPosData } = await supabase
        .from('tasks')
        .select('position')
        .eq('project_id', taskData.project_id)
        .eq('status', taskData.status || 'not_started')
        .order('position', { ascending: false })
        .limit(1);

      const maxPosition = maxPosData?.[0]?.position ?? -1;

      const insertData = {
        ...taskData,
        created_by: user.id,
        position: maxPosition + 1,
      };

      // Only include reminders if they exist and are not empty
      if (reminders && reminders.length > 0) {
        insertData.reminders = reminders;
      }

      const { data, error } = await supabase
        .from('tasks')
        .insert(insertData)
        .select(`
          *,
          creator:profiles!tasks_created_by_fkey(id, full_name, email, avatar_url)
        `)
        .single();

      if (error) throw error;

      console.log('📝 Task created:', data);

      // Add assignees to task_assignees junction table
      if (assignee_ids.length > 0) {
        const assigneeRecords = assignee_ids.map(userId => ({
          task_id: data.id,
          user_id: userId,
        }));

        console.log('📝 Inserting assignee records:', assigneeRecords);

        const { error: assigneeError } = await supabase
          .from('task_assignees')
          .insert(assigneeRecords);

        if (assigneeError) {
          console.error('📝 Error inserting assignees:', assigneeError);
          throw assigneeError;
        }

        console.log('📝 Assignees inserted successfully');

        // Get actor's name for notification
        const { data: actorProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();

        const actorName = actorProfile?.full_name || 'Someone';

        // Create notifications for all new assignees
        for (const assigneeId of assignee_ids) {
          if (assigneeId !== user.id) {
            await supabase.from('notifications').insert({
              user_id: assigneeId,
              type: 'task_assigned',
              title: 'New Task Assigned',
              message: `${actorName} assigned you to: ${taskData.title}`,
              task_id: data.id,
              project_id: taskData.project_id,
              actor_id: user.id,
            });
          }
        }
      }

      // Fetch the created task with assignees
      const { data: fullData } = await supabase
        .from('tasks')
        .select(`
          *,
          creator:profiles!tasks_created_by_fkey(id, full_name, email, avatar_url),
          task_assignees(user_id, user:profiles(id, full_name, email, avatar_url))
        `)
        .eq('id', data.id)
        .single();

      // Transform assignees
      const transformedTask = {
        ...fullData,
        assignees: fullData.task_assignees?.map(ta => ta.user) || [],
        subtasks: [],
        comments: [],
        task_labels: [],
        files: []
      };

      console.log('📝 Transformed task with assignees:', transformedTask);

      set((state) => ({
        tasks: [...state.tasks, transformedTask],
        loading: false,
      }));

      console.log('📝 Task created and added to store successfully');

      // Log activity
      await logActivity('task_created', { task_title: taskData.title }, taskData.project_id, data.id);

      return { data: transformedTask, error: null };
    } catch (error) {
      console.error('📝 Error creating task:', error);
      set({ error: error.message, loading: false });
      return { data: null, error };
    }
  },

  // Update task
  updateTask: async (taskId, updates) => {
    set({ loading: true, error: null });
    try {
      console.log('📝 updateTask called:', { taskId, updates });
      const isOnline = useOfflineStore.getState().isOnline;
      const oldTask = get().tasks.find(t => t.id === taskId);
      const oldAssigneeIds = oldTask?.assignees?.map(a => a.id) || [];

      console.log('📝 Old assignees:', oldAssigneeIds);

      // If offline, queue the action and update optimistically
      if (!isOnline) {
        console.log('[OFFLINE] Queueing task update');
        const actionId = useOfflineStore.getState().queueAction('updateTask', {
          taskId,
          updates: { ...updates },
        });

        // Update optimistically
        set((state) => ({
          tasks: state.tasks.map(t =>
            t.id === taskId ? { ...t, ...updates } : t
          ),
          loading: false,
        }));

        return { data: { id: taskId, ...updates }, error: null, queued: true, actionId };
      }

      // Handle assignee_ids and reminders update
      let newAssigneeIds = [];
      if (updates.assignee_ids) {
        newAssigneeIds = updates.assignee_ids;
        delete updates.assignee_ids;

        console.log('📝 New assignees to set:', newAssigneeIds);
      }

      // Only include reminders if they exist and are not empty
      if (updates.reminders && !Array.isArray(updates.reminders) || (Array.isArray(updates.reminders) && updates.reminders.length === 0)) {
        delete updates.reminders;
      }

        // Delete old assignees
        const { error: deleteError } = await supabase.from('task_assignees').delete().eq('task_id', taskId);
        if (deleteError) {
          console.error('📝 Error deleting old assignees:', deleteError);
          throw deleteError;
        }
        console.log('📝 Old assignees deleted');

        // Add new assignees
        if (newAssigneeIds.length > 0) {
          const assigneeRecords = newAssigneeIds.map(userId => ({
            task_id: taskId,
            user_id: userId,
          }));
          console.log('📝 Inserting new assignee records:', assigneeRecords);

          // Verify auth status before insert
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          console.log('📝 Current authenticated user:', currentUser?.id);

          // Try the insert with explicit error details
          const { data: insertData, error: insertError } = await supabase
            .from('task_assignees')
            .insert(assigneeRecords)
            .select();

          if (insertError) {
            console.error('📝 Error inserting new assignees:', insertError);
            console.error('📝 Error code:', insertError.code);
            console.error('📝 Error message:', insertError.message);
            console.error('📝 Error details:', insertError.details);
            console.error('📝 Task ID:', taskId);
            console.error('📝 Assignee records:', assigneeRecords);
            throw insertError;
          }

          console.log('📝 New assignees inserted successfully');
          console.log('📝 Insert response:', insertData);
        }
      }

      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId)
        .select(`
          *,
          creator:profiles!tasks_created_by_fkey(id, full_name, email, avatar_url)
        `)
        .single();

      if (error) {
        console.error('📝 Error updating task:', error);
        throw error;
      }

      console.log('📝 Task updated in database:', data);

      // Fetch updated assignees
      const { data: fullData, error: fetchError } = await supabase
        .from('tasks')
        .select(`
          *,
          task_assignees(user_id, user:profiles(id, full_name, email, avatar_url))
        `)
        .eq('id', taskId)
        .single();

      if (fetchError) {
        console.error('📝 Error fetching updated task with assignees:', fetchError);
        throw fetchError;
      }

      console.log('📝 Full task data with assignees:', fullData);

      const transformedData = {
        ...fullData,
        assignees: fullData.task_assignees?.map(ta => ta.user) || []
      };

      console.log('📝 Transformed assignees:', transformedData.assignees);

      const { data: { user } } = await supabase.auth.getUser();

      // Get actor's name for notification
      const { data: actorProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      const actorName = actorProfile?.full_name || 'Someone';

      // Notify new assignees who weren't previously assigned
      if (newAssigneeIds.length > 0) {
        const newAssignees = newAssigneeIds.filter(
          id => !oldAssigneeIds.includes(id) && id !== user.id
        );
        console.log('📝 New assignees to notify:', newAssignees);

        for (const assigneeId of newAssignees) {
          const { error: notifError } = await supabase.from('notifications').insert({
            user_id: assigneeId,
            type: 'task_assigned',
            title: 'Task Assigned',
            message: `${actorName} assigned you to: ${data.title}`,
            task_id: taskId,
            project_id: data.project_id,
            actor_id: user.id,
          });
          if (notifError) {
            console.error('📝 Error creating notification:', notifError);
          } else {
            console.log('📝 Notification sent to:', assigneeId);
          }
        }
      }

      // Notify assignees if status changed
      if (updates.status && updates.status !== oldTask?.status) {
        console.log('📝 Status changed, notifying assignees');

        // Get fresh assignees from the updated task
        const newAssignees = transformedData.assignees || [];
        console.log('📝 New assignees to notify:', newAssignees.map(a => a.id));

        for (const assignee of newAssignees) {
          if (assignee.id !== user.id) {
            const { error: notifError } = await supabase.from('notifications').insert({
              user_id: assignee.id,
              type: 'task_updated',
              title: 'Task Status Updated',
              message: `${actorName} moved "${data.title}" to ${updates.status.replace('_', ' ')}`,
              task_id: taskId,
              project_id: data.project_id,
              actor_id: user.id,
            });
            if (notifError) {
              console.error('📝 Error sending status notification:', notifError);
            } else {
              console.log('📝 Status update notification sent to:', assignee.id);
            }
          }
        }
      }

      set((state) => {
        console.log('📝 Updating store with transformed data:', transformedData);
        return {
          tasks: state.tasks.map((t) =>
            t.id === taskId ? { ...t, ...transformedData } : t
          ),
          currentTask:
            state.currentTask?.id === taskId
              ? { ...state.currentTask, ...transformedData }
              : state.currentTask,
          loading: false,
        };
      });

      console.log('📝 Store updated successfully');

      // Log activity for status changes
      if (updates.status && updates.status !== oldTask?.status) {
        await logActivity('status_changed', {
          task_title: data.title,
          from_status: oldTask?.status,
          to_status: updates.status,
        }, data.project_id, taskId);

        if (updates.status === 'completed') {
          await logActivity('task_completed', { task_title: data.title }, data.project_id, taskId);
        }
      } else {
        await logActivity('task_updated', { task_title: data.title }, data.project_id, taskId);
      }

      return { data: transformedData, error: null };
    } catch (error) {
      set({ error: error.message, loading: false });
      return { data: null, error };
    }
  },

  // Update task position (for drag and drop)
  updateTaskPosition: async (taskId, newStatus, newPosition) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus, position: newPosition })
        .eq('id', taskId);

      if (error) throw error;

      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  // Reorder tasks in a column
  reorderTasks: async (projectId, status, orderedTaskIds) => {
    try {
      const updates = orderedTaskIds.map((id, index) => ({
        id,
        position: index,
        status,
      }));

      for (const update of updates) {
        await supabase
          .from('tasks')
          .update({ position: update.position, status: update.status })
          .eq('id', update.id);
      }

      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  // Delete task
  deleteTask: async (taskId) => {
    set({ loading: true, error: null });
    try {
      // Get task info before deleting
      const task = get().tasks.find(t => t.id === taskId);

      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      // Log activity before state update
      if (task) {
        await logActivity('task_deleted', { task_title: task.title }, task.project_id, null);
      }

      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== taskId),
        currentTask:
          state.currentTask?.id === taskId ? null : state.currentTask,
        loading: false,
      }));

      return { error: null };
    } catch (error) {
      set({ error: error.message, loading: false });
      return { error };
    }
  },

  // Add subtask
  addSubtask: async (taskId, title, assignedTo = null) => {
    try {
      const isOnline = useOfflineStore.getState().isOnline;

      if (!isOnline) {
        // When offline, queue the action
        const { data: { user } } = await supabase.auth.getUser();
        useOfflineStore.getState().queueAction({
          type: 'addSubtask',
          payload: { taskId, title, assignedTo },
          timestamp: Date.now(),
        });

        // Create optimistic subtask for UI
        const optimisticSubtask = {
          id: `offline_${Date.now()}`,
          task_id: taskId,
          title,
          assigned_to: assignedTo,
          position: (get().tasks.find(t => t.id === taskId)?.subtasks?.length || 0),
          completed: false,
          assignee: null,
          synced: false,
        };

        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? { ...t, subtasks: [...(t.subtasks || []), optimisticSubtask] }
              : t
          ),
        }));

        return { data: optimisticSubtask, error: null, offline: true };
      }

      const { data: maxPosData } = await supabase
        .from('subtasks')
        .select('position')
        .eq('task_id', taskId)
        .order('position', { ascending: false })
        .limit(1);

      const maxPosition = maxPosData?.[0]?.position ?? -1;

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

      // Get the task for activity logging
      const task = get().tasks.find(t => t.id === taskId);

      // Create notification if subtask is assigned to someone
      if (assignedTo && task) {
        const { data: { user } } = await supabase.auth.getUser();
        if (assignedTo !== user.id) {
          const { data: actorProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single();

          const actorName = actorProfile?.full_name || 'Someone';

          await supabase.from('notifications').insert({
            user_id: assignedTo,
            type: 'task_assigned',
            title: 'Subtask Assigned',
            message: `${actorName} assigned you to a subtask: "${title}"`,
            task_id: taskId,
            project_id: task.project_id,
            actor_id: user.id,
          });
        }
      }

      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === taskId
            ? { ...t, subtasks: [...(t.subtasks || []), data] }
            : t
        ),
      }));

      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Toggle subtask completion
  toggleSubtask: async (subtaskId, completed) => {
    try {
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

      set((state) => ({
        tasks: state.tasks.map((t) => ({
          ...t,
          subtasks: t.subtasks?.map((s) =>
            s.id === subtaskId ? data : s
          ),
        })),
      }));

      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Update subtask assignment
  updateSubtaskAssignment: async (taskId, subtaskId, assignedTo) => {
    try {
      const { data, error } = await supabase
        .from('subtasks')
        .update({ assigned_to: assignedTo })
        .eq('id', subtaskId)
        .select(`
          *,
          assignee:profiles!subtasks_assigned_to_fkey(id, full_name, email, avatar_url)
        `)
        .single();

      if (error) throw error;

      // Get the task for notification
      const task = get().tasks.find(t => t.id === taskId);

      // Notify the newly assigned user
      if (assignedTo && task) {
        const subtask = task.subtasks?.find(s => s.id === subtaskId);
        const { data: { user } } = await supabase.auth.getUser();
        if (assignedTo !== user.id) {
          await supabase.from('notifications').insert({
            user_id: assignedTo,
            type: 'task_assigned',
            title: 'Subtask Assigned',
            message: `You have been assigned to: "${subtask?.title || 'a subtask'}"`,
            task_id: taskId,
            project_id: task.project_id,
          });
        }
      }

      set((state) => ({
        tasks: state.tasks.map((t) => ({
          ...t,
          subtasks: t.subtasks?.map((s) =>
            s.id === subtaskId ? data : s
          ),
        })),
      }));

      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Delete subtask
  deleteSubtask: async (taskId, subtaskId) => {
    try {
      const { error } = await supabase
        .from('subtasks')
        .delete()
        .eq('id', subtaskId);

      if (error) throw error;

      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === taskId
            ? { ...t, subtasks: t.subtasks?.filter((s) => s.id !== subtaskId) }
            : t
        ),
      }));

      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  // Add comment (with optional parent_id for replies)
  addComment: async (taskId, content, parentId = null) => {
    try {
      console.log('💬 [CRITICAL] addComment START:', { taskId, content, parentId });
      const { data: { user } } = await supabase.auth.getUser();
      console.log('💬 [CRITICAL] User:', user.id);

      const { data, error } = await supabase
        .from('comments')
        .insert({
          task_id: taskId,
          user_id: user.id,
          content,
          parent_id: parentId,
        })
        .select(`
          *,
          user:profiles(id, full_name, avatar_url)
        `)
        .single();

      if (error) {
        console.error('💬 [CRITICAL] Error inserting comment:', error);
        throw error;
      }

      console.log('💬 [CRITICAL] Comment inserted:', data);

      // Get task to notify assignee
      const task = get().tasks.find(t => t.id === taskId);
      console.log('💬 [CRITICAL] Task found:', task ? { id: task.id, assignee_id: task.assignee_id, assignees: task.assignees?.map(a => a.id) } : 'NOT FOUND');

      // Fetch actor profile once (reuse for all notifications) - use cache
      const actorProfile = await getCachedProfile(user.id);
      const actorName = actorProfile?.full_name || 'Someone';
      console.log('💬 [CRITICAL] Actor name:', actorName);

      // Collect all notification payloads to batch insert
      const notificationPayloads = [];

      // Add notifications for single assignee
      if (task?.assignee_id && task.assignee_id !== user.id) {
        console.log('💬 [CRITICAL] Queueing single assignee notification:', task.assignee_id);
        notificationPayloads.push({
          user_id: task.assignee_id,
          type: 'task_comment',
          title: 'New Comment',
          message: `${actorName} commented on "${task.title}"`,
          task_id: taskId,
          project_id: task.project_id,
          actor_id: user.id,
          comment_id: data.id,
        });
      }

      // Add notifications for multiple assignees
      if (task?.assignees && Array.isArray(task.assignees) && task.assignees.length > 0) {
        console.log('💬 [CRITICAL] Found', task.assignees.length, 'assignees');

        for (const assignee of task.assignees) {
          if (assignee.id !== user.id) {
            console.log('💬 [CRITICAL] Queueing assignee notification:', assignee.id);
            notificationPayloads.push({
              user_id: assignee.id,
              type: 'task_comment',
              title: 'New Comment',
              message: `${actorName} commented on "${task.title}"`,
              task_id: taskId,
              project_id: task.project_id,
              actor_id: user.id,
              comment_id: data.id,
            });
          }
        }
      }

      // Extract and queue notifications for mentioned users
      console.log('💬 [CRITICAL] Checking for mentions in content');
      const mentionRegex = /@(\w+(?:\s+\w+)?)/g;
      const mentions = content.match(mentionRegex);
      console.log('💬 [CRITICAL] Mentions found:', mentions);

      if (mentions && task) {
        // Get all profiles to match mentions - use cache
        const profiles = await getAllProfilesCache();

        console.log('💬 [CRITICAL] Total profiles:', profiles?.length);

        if (profiles) {
          const mentionedNames = mentions.map(m => m.substring(1).toLowerCase());
          console.log('💬 [CRITICAL] Mentioned names (lowercase):', mentionedNames);

          const mentionedUsers = profiles.filter(p =>
            mentionedNames.some(name =>
              p.full_name?.toLowerCase().includes(name)
            )
          );

          console.log('💬 [CRITICAL] Matched users:', mentionedUsers.map(u => ({ id: u.id, name: u.full_name })));

          // Queue notifications for mentioned users (except the comment author)
          for (const mentionedUser of mentionedUsers) {
            if (mentionedUser.id !== user.id) {
              console.log('💬 [CRITICAL] Queueing mention notification for:', mentionedUser.id);
              notificationPayloads.push({
                user_id: mentionedUser.id,
                type: 'mention',
                title: 'You were mentioned',
                message: `${actorName} mentioned you in "${task.title}"`,
                task_id: taskId,
                project_id: task.project_id,
                actor_id: user.id,
                comment_id: data.id,
              });
            }
          }
        }
      }

      // Batch insert all notifications at once
      if (notificationPayloads.length > 0) {
        console.log('💬 [CRITICAL] Batch inserting', notificationPayloads.length, 'notifications');
        const { error: batchError } = await supabase
          .from('notifications')
          .insert(notificationPayloads);

        if (batchError) {
          console.error('💬 [CRITICAL] Error batch creating notifications:', batchError);
        } else {
          console.log('💬 [CRITICAL] Batch notifications created successfully');
        }
      }

      console.log('💬 [CRITICAL] addComment END - SUCCESS');

      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === taskId
            ? { ...t, comments: [...(t.comments || []), data] }
            : t
        ),
      }));

      // Log activity
      if (task) {
        await logActivity('comment_added', { task_title: task.title }, task.project_id, taskId);
      }

      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Edit comment
  editComment: async (taskId, commentId, content) => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .update({ content, updated_at: new Date().toISOString() })
        .eq('id', commentId)
        .select(`
          *,
          user:profiles(id, full_name, avatar_url)
        `)
        .single();

      if (error) throw error;

      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                comments: t.comments?.map((c) =>
                  c.id === commentId ? { ...c, ...data } : c
                ),
              }
            : t
        ),
      }));

      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Delete comment
  deleteComment: async (taskId, commentId) => {
    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === taskId
            ? { ...t, comments: t.comments?.filter((c) => c.id !== commentId) }
            : t
        ),
      }));

      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  // Fetch task files
  fetchTaskFiles: async (taskId) => {
    try {
      const { data, error } = await supabase
        .from('task_files')
        .select(`
          *,
          uploader:profiles(id, full_name, avatar_url)
        `)
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return { data: data || [], error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Upload file to task
  uploadFile: async (taskId, file) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${file.name}`;

      // Upload to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('task-files')
        .upload(`${taskId}/${fileName}`, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('task-files')
        .getPublicUrl(`${taskId}/${fileName}`);

      // Insert file record
      const { data, error } = await supabase
        .from('task_files')
        .insert({
          task_id: taskId,
          name: file.name,
          file_path: `${taskId}/${fileName}`,
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

      // Note: We don't update task state here since files are fetched separately in TaskDetail
      // The component will refresh files list after successful upload

      // Log activity
      const task = get().tasks.find(t => t.id === taskId);
      if (task) {
        await logActivity('file_uploaded', {
          file_name: file.name,
          task_title: task.title
        }, task.project_id, taskId);
      }

      return { data, error: null };
    } catch (error) {
      console.error('Upload error details:', error);
      return { data: null, error: error.message || error };
    }
  },

  // Delete file
  deleteFile: async (taskId, fileId) => {
    try {
      // Get file info before deleting
      const { data: fileData } = await supabase
        .from('task_files')
        .select('file_path, name')
        .eq('id', fileId)
        .single();

      if (fileData?.file_path) {
        // Delete from storage
        const { error: storageError } = await supabase.storage
          .from('task-files')
          .remove([fileData.file_path]);

        if (storageError) throw storageError;
      }

      // Delete from database
      const { error } = await supabase
        .from('task_files')
        .delete()
        .eq('id', fileId);

      if (error) throw error;

      // Note: We don't update task state here since files are fetched separately in TaskDetail
      // The component will refresh files list after successful deletion

      // Log activity
      const task = get().tasks.find(t => t.id === taskId);
      if (task) {
        await logActivity('file_deleted', {
          file_name: fileData?.name,
          task_title: task.title
        }, task.project_id, taskId);
      }

      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  // ============ TIME TRACKING FUNCTIONS ============

  // Log time entry
  logTimeEntry: async (taskId, durationMinutes, description) => {
    set({ loading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('time_entries')
        .insert({
          task_id: taskId,
          user_id: user.id,
          duration_minutes: durationMinutes,
          description,
          logged_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Update task's actual_hours
      const currentTask = get().tasks.find(t => t.id === taskId);
      const newActualHours = (currentTask?.actual_hours || 0) + (durationMinutes / 60);

      const { data: updatedTask, error: updateError } = await supabase
        .from('tasks')
        .update({ actual_hours: newActualHours })
        .eq('id', taskId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Update state
      set((state) => ({
        tasks: state.tasks.map(t => t.id === taskId ? updatedTask : t),
        loading: false,
      }));

      await logActivity('time_logged', {
        task_title: currentTask?.title,
        duration_minutes: durationMinutes,
      }, currentTask?.project_id, taskId);

      return { data, error: null };
    } catch (error) {
      set({ error: error.message, loading: false });
      return { data: null, error };
    }
  },

  // Fetch time entries for a task
  fetchTimeEntries: async (taskId) => {
    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select(`
          *,
          user:profiles(id, full_name, avatar_url)
        `)
        .eq('task_id', taskId)
        .order('logged_at', { ascending: false });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Delete time entry
  deleteTimeEntry: async (taskId, entryId, durationMinutes) => {
    try {
      const { error } = await supabase
        .from('time_entries')
        .delete()
        .eq('id', entryId);

      if (error) throw error;

      // Update task's actual_hours by subtracting the deleted entry's duration
      const currentTask = get().tasks.find(t => t.id === taskId);
      const newActualHours = Math.max(0, (currentTask?.actual_hours || 0) - (durationMinutes / 60));

      const { data: updatedTask, error: updateError } = await supabase
        .from('tasks')
        .update({ actual_hours: newActualHours })
        .eq('id', taskId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Update state
      set((state) => ({
        tasks: state.tasks.map(t => t.id === taskId ? updatedTask : t),
      }));

      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  // Update time estimate
  updateTimeEstimate: async (taskId, estimatedHours) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update({ estimated_hours: estimatedHours })
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;

      set((state) => ({
        tasks: state.tasks.map(t => t.id === taskId ? data : t),
      }));

      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // ============ RECURRING TASKS FUNCTIONS ============

  // Create recurring task
  createRecurringTask: async (taskData, recurrencePattern) => {
    set({ loading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: maxPosData } = await supabase
        .from('tasks')
        .select('position')
        .eq('project_id', taskData.project_id)
        .eq('status', taskData.status || 'not_started')
        .order('position', { ascending: false })
        .limit(1);

      const maxPosition = maxPosData?.[0]?.position ?? -1;

      const assignee_ids = taskData.assignee_ids || [];
      delete taskData.assignee_ids;

      // Create the main recurring task
      const { data: mainTask, error: mainError } = await supabase
        .from('tasks')
        .insert({
          ...taskData,
          created_by: user.id,
          position: maxPosition + 1,
          recurrence_pattern: recurrencePattern,
          is_recurring_instance: false,
        })
        .select()
        .single();

      if (mainError) throw mainError;

      // Add assignees
      if (assignee_ids.length > 0) {
        const assigneeRecords = assignee_ids.map(userId => ({
          task_id: mainTask.id,
          user_id: userId,
        }));
        const { error: assigneeError } = await supabase
          .from('task_assignees')
          .insert(assigneeRecords);
        if (assigneeError) throw assigneeError;
      }

      // Generate initial instances based on recurrence pattern
      await get().generateRecurringInstances(mainTask.id, recurrencePattern);

      set((state) => ({
        tasks: [...state.tasks, mainTask],
        loading: false,
      }));

      await logActivity('recurring_task_created', {
        task_title: taskData.title,
        frequency: recurrencePattern.frequency,
      }, taskData.project_id, mainTask.id);

      return { data: mainTask, error: null };
    } catch (error) {
      set({ error: error.message, loading: false });
      return { data: null, error };
    }
  },

  // Generate recurring task instances
  generateRecurringInstances: async (originalTaskId, recurrencePattern, upToDate = null) => {
    try {
      const { data: originalTask, error: fetchError } = await supabase
        .from('tasks')
        .select()
        .eq('id', originalTaskId)
        .single();

      if (fetchError) throw fetchError;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const endDate = upToDate ||
        (recurrencePattern.end_date ? new Date(recurrencePattern.end_date) :
          new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000)); // Default 90 days

      const instances = [];
      let currentDate = new Date(originalTask.due_date || today);
      currentDate.setHours(0, 0, 0, 0);

      while (currentDate <= endDate) {
        if (shouldGenerateInstance(currentDate, recurrencePattern, today)) {
          instances.push({
            ...originalTask,
            id: undefined,
            original_task_id: originalTaskId,
            is_recurring_instance: true,
            due_date: currentDate.toISOString().split('T')[0],
            recurrence_pattern: null,
            created_at: new Date().toISOString(),
          });
        }

        currentDate = getNextDate(currentDate, recurrencePattern);
      }

      // Batch insert instances
      if (instances.length > 0) {
        const { data: createdInstances, error: insertError } = await supabase
          .from('tasks')
          .insert(instances)
          .select();

        if (insertError) throw insertError;

        // Log instances in recurring_task_instances table
        const instanceRecords = createdInstances.map(instance => ({
          original_task_id: originalTaskId,
          generated_task_id: instance.id,
          due_date: instance.due_date,
        }));

        await supabase.from('recurring_task_instances').insert(instanceRecords);

        set((state) => ({
          tasks: [...state.tasks, ...createdInstances],
        }));
      }

      return { data: instances, error: null };
    } catch (error) {
      console.error('Error generating recurring instances:', error);
      return { data: null, error };
    }
  },

  // Update recurrence pattern
  updateRecurrencePattern: async (taskId, newPattern) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update({ recurrence_pattern: newPattern })
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;

      set((state) => ({
        tasks: state.tasks.map(t => t.id === taskId ? data : t),
      }));

      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Stop recurring task (prevents new instances)
  stopRecurringTask: async (taskId) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update({
          recurrence_pattern: null,
          recurrence_end_date: new Date().toISOString().split('T')[0],
        })
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;

      set((state) => ({
        tasks: state.tasks.map(t => t.id === taskId ? data : t),
      }));

      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Listen for user deletions and refresh tasks to remove deleted users
  setupUserDeletionListener: () => {
    window.addEventListener('userDeleted', (event) => {
      const { userId } = event.detail;
      console.log('User deleted, refreshing tasks to remove user', userId);

      // Trigger a refresh of current tasks to remove deleted user from assignees
      // The next time tasks are fetched, they won't include the deleted user
    });
  },
}));

// Initialize user deletion listener
useTaskStore.getState().setupUserDeletionListener();

export default useTaskStore;
