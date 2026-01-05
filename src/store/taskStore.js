import { create } from 'zustand';
import { supabase } from '../lib/supabase';

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
      const { data: { user } } = await supabase.auth.getUser();

      // Get max position for the status column
      const { data: maxPosData } = await supabase
        .from('tasks')
        .select('position')
        .eq('project_id', taskData.project_id)
        .eq('status', taskData.status || 'not_started')
        .order('position', { ascending: false })
        .limit(1);

      const maxPosition = maxPosData?.[0]?.position ?? -1;

      // Extract assignee_ids from taskData (handle both single and array)
      const assignee_ids = taskData.assignee_ids || [];
      delete taskData.assignee_ids;

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          ...taskData,
          created_by: user.id,
          position: maxPosition + 1,
        })
        .select(`
          *,
          creator:profiles!tasks_created_by_fkey(id, full_name, email, avatar_url)
        `)
        .single();

      if (error) throw error;

      // Add assignees to task_assignees junction table
      if (assignee_ids.length > 0) {
        const assigneeRecords = assignee_ids.map(userId => ({
          task_id: data.id,
          user_id: userId,
        }));

        const { error: assigneeError } = await supabase
          .from('task_assignees')
          .insert(assigneeRecords);

        if (assigneeError) throw assigneeError;

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

      set((state) => ({
        tasks: [...state.tasks, transformedTask],
        loading: false,
      }));

      // Log activity
      await logActivity('task_created', { task_title: taskData.title }, taskData.project_id, data.id);

      return { data: transformedTask, error: null };
    } catch (error) {
      set({ error: error.message, loading: false });
      return { data: null, error };
    }
  },

  // Update task
  updateTask: async (taskId, updates) => {
    set({ loading: true, error: null });
    try {
      const oldTask = get().tasks.find(t => t.id === taskId);
      const oldAssigneeIds = oldTask?.assignees?.map(a => a.id) || [];

      // Handle assignee_ids update (multiple assignees)
      let newAssigneeIds = [];
      if (updates.assignee_ids) {
        newAssigneeIds = updates.assignee_ids;
        delete updates.assignee_ids;

        // Delete old assignees
        await supabase.from('task_assignees').delete().eq('task_id', taskId);

        // Add new assignees
        if (newAssigneeIds.length > 0) {
          const assigneeRecords = newAssigneeIds.map(userId => ({
            task_id: taskId,
            user_id: userId,
          }));
          await supabase.from('task_assignees').insert(assigneeRecords);
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

      if (error) throw error;

      // Fetch updated assignees
      const { data: fullData } = await supabase
        .from('tasks')
        .select(`
          *,
          task_assignees(user_id, user:profiles(id, full_name, email, avatar_url))
        `)
        .eq('id', taskId)
        .single();

      const transformedData = {
        ...fullData,
        assignees: fullData.task_assignees?.map(ta => ta.user) || []
      };

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
        for (const assigneeId of newAssignees) {
          await supabase.from('notifications').insert({
            user_id: assigneeId,
            type: 'task_assigned',
            title: 'Task Assigned',
            message: `${actorName} assigned you to: ${data.title}`,
            task_id: taskId,
            project_id: data.project_id,
            actor_id: user.id,
          });
        }
      }

      // Notify existing assignees if status changed
      if (updates.status && updates.status !== oldTask?.status) {
        const assigneeIdsToNotify = oldAssigneeIds.filter(
          id => id !== user.id
        );
        for (const assigneeId of assigneeIdsToNotify) {
          await supabase.from('notifications').insert({
            user_id: assigneeId,
            type: 'task_updated',
            title: 'Task Status Updated',
            message: `${actorName} moved "${data.title}" to ${updates.status.replace('_', ' ')}`,
            task_id: taskId,
            project_id: data.project_id,
            actor_id: user.id,
          });
        }
      }

      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === taskId ? { ...t, ...transformedData } : t
        ),
        currentTask:
          state.currentTask?.id === taskId
            ? { ...state.currentTask, ...transformedData }
            : state.currentTask,
        loading: false,
      }));

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
      const { data: { user } } = await supabase.auth.getUser();

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

      if (error) throw error;

      // Get task to notify assignee
      const task = get().tasks.find(t => t.id === taskId);
      if (task?.assignee_id && task.assignee_id !== user.id) {
        const { data: actorProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();

        const actorName = actorProfile?.full_name || 'Someone';

        await supabase.from('notifications').insert({
          user_id: task.assignee_id,
          type: 'task_comment',
          title: 'New Comment',
          message: `${actorName} commented on "${task.title}"`,
          task_id: taskId,
          project_id: task.project_id,
          actor_id: user.id,
        });
      }

      // Extract and notify mentioned users
      const mentionRegex = /@(\w+(?:\s+\w+)?)/g;
      const mentions = content.match(mentionRegex);
      if (mentions && task) {
        // Get all profiles to match mentions
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name');

        if (profiles) {
          const mentionedNames = mentions.map(m => m.substring(1).toLowerCase());
          const mentionedUsers = profiles.filter(p =>
            mentionedNames.some(name =>
              p.full_name?.toLowerCase().includes(name)
            )
          );

          // Create notifications for mentioned users (except the comment author)
          for (const mentionedUser of mentionedUsers) {
            if (mentionedUser.id !== user.id) {
              await supabase.from('notifications').insert({
                user_id: mentionedUser.id,
                type: 'mention',
                title: 'You were mentioned',
                message: `${data.user?.full_name || 'Someone'} mentioned you in "${task.title}"`,
                task_id: taskId,
                project_id: task.project_id,
                actor_id: user.id,
              });
            }
          }
        }
      }

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
}));

export default useTaskStore;
