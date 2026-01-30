import { supabase } from './supabase';
import { sendTaskReminderEmail } from './sendgridService';

/**
 * Reminder Service
 * Handles checking and creating notifications for task due date reminders
 */

// Cache for tracking which reminders have already been sent
const sentReminders = new Set();

/**
 * Check and create reminders for tasks
 * This should be called periodically (e.g., every 5-10 minutes)
 */
export const checkAndCreateReminders = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get current time
    const now = new Date();
    const currentHourUTC = now.getHours();

    // Fetch tasks for the current user with reminders and upcoming due dates
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select(`
        id,
        title,
        project_id,
        due_date,
        assignee_id,
        assignees:task_assignees(
          user_id,
          user:profiles(id, full_name)
        ),
        reminders
      `)
      .not('due_date', 'is', null)
      .not('reminders', 'is', null);

    if (tasksError) {
      console.error('Error fetching tasks for reminders:', tasksError);
      return;
    }

    if (!tasks || tasks.length === 0) return;

    const notificationsToCreate = [];

    for (const task of tasks) {
      if (!task.reminders || task.reminders.length === 0) continue;

      const dueDate = new Date(task.due_date);
      const timeDiffMs = dueDate.getTime() - now.getTime();
      const timeDiffHours = timeDiffMs / (1000 * 60 * 60);

      // Check each reminder for this task
      for (const reminder of task.reminders) {
        // Create unique reminder key to track if already sent
        const reminderKey = `${task.id}_${reminder.type}_${dueDate.toISOString().split('T')[0]}`;

        // Skip if reminder already sent today
        if (sentReminders.has(reminderKey)) {
          continue;
        }

        // Check if it's time to send this reminder
        const targetHours = reminder.hours;
        const tolerance = 0.5; // 30 minutes tolerance

        if (Math.abs(timeDiffHours - targetHours) <= tolerance) {
          // Get users to notify
          const usersToNotify = new Set();

          // Add assignee_id
          if (task.assignee_id && task.assignee_id !== user.id) {
            usersToNotify.add(task.assignee_id);
          }

          // Add all assignees
          if (task.assignees && Array.isArray(task.assignees)) {
            task.assignees.forEach(assignee => {
              if (assignee.user_id && assignee.user_id !== user.id) {
                usersToNotify.add(assignee.user_id);
              }
            });
          }

          // Create notifications for each user and send emails
          for (const userId of usersToNotify) {
            const reminderLabel = getReminderLabel(reminder);
            notificationsToCreate.push({
              user_id: userId,
              type: 'task_reminder',
              title: 'Task Reminder',
              message: `"${task.title}" is due ${reminderLabel}`,
              task_id: task.id,
              project_id: task.project_id,
              actor_id: user.id,
            });

            // Send email notification asynchronously (don't block)
            (async () => {
              try {
                const { data: userProfile } = await supabase
                  .from('profiles')
                  .select('email, full_name')
                  .eq('id', userId)
                  .single();

                if (userProfile?.email) {
                  await sendTaskReminderEmail(
                    userProfile.email,
                    userProfile.full_name || 'User',
                    task.title,
                    reminder.type
                  );
                }
              } catch (error) {
                console.error('Failed to send reminder email:', error);
              }
            })();
          }

          // Mark reminder as sent
          sentReminders.add(reminderKey);
        }
      }
    }

    // Batch create all notifications
    if (notificationsToCreate.length > 0) {
      console.log(`📨 Creating ${notificationsToCreate.length} reminder notifications`);
      const { error: notifError } = await supabase
        .from('notifications')
        .insert(notificationsToCreate);

      if (notifError) {
        console.error('Error creating reminder notifications:', notifError);
      } else {
        console.log('✅ Reminder notifications created successfully');
      }
    }
  } catch (error) {
    console.error('Error in checkAndCreateReminders:', error);
  }
};

/**
 * Save reminders for a task
 */
export const saveReminders = async (taskId, reminders) => {
  try {
    const { error } = await supabase
      .from('tasks')
      .update({ reminders })
      .eq('id', taskId);

    if (error) throw error;

    console.log('✅ Reminders saved for task:', taskId);
    return { error: null };
  } catch (error) {
    console.error('Error saving reminders:', error);
    return { error };
  }
};

/**
 * Get reminders for a task
 */
export const getTaskReminders = async (taskId) => {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('reminders')
      .eq('id', taskId)
      .single();

    if (error) throw error;

    return { data: data?.reminders || [], error: null };
  } catch (error) {
    console.error('Error fetching reminders:', error);
    return { data: [], error };
  }
};

/**
 * Delete reminders for a task
 */
export const deleteTaskReminders = async (taskId) => {
  try {
    const { error } = await supabase
      .from('tasks')
      .update({ reminders: null })
      .eq('id', taskId);

    if (error) throw error;

    return { error: null };
  } catch (error) {
    console.error('Error deleting reminders:', error);
    return { error };
  }
};

/**
 * Clear sent reminders cache
 * Call this periodically or when needed
 */
export const clearSentRemindersCache = () => {
  sentReminders.clear();
  console.log('🧹 Sent reminders cache cleared');
};

/**
 * Get human-readable label for a reminder
 */
export const getReminderLabel = (reminder) => {
  const hours = reminder.hours;

  if (hours === 0) return 'now';
  if (hours === -0.25) return 'in 15 minutes';
  if (hours === -1) return 'in 1 hour';
  if (hours === -24) return 'tomorrow';
  if (hours === -48) return 'in 2 days';

  if (hours < 0) {
    const absHours = Math.abs(hours);
    if (absHours < 1) {
      const mins = Math.round(absHours * 60);
      return `in ${mins} minutes`;
    }
    if (absHours === Math.floor(absHours)) {
      return `in ${Math.floor(absHours)} hour${absHours === 1 ? '' : 's'}`;
    }
    return `in ${absHours} hours`;
  }

  if (hours > 0) {
    if (hours < 1) {
      const mins = Math.round(hours * 60);
      return `${mins} minutes after`;
    }
    if (hours === Math.floor(hours)) {
      return `${Math.floor(hours)} hour${hours === 1 ? '' : 's'} after`;
    }
    return `${hours} hours after`;
  }

  return 'at due time';
};

/**
 * Start periodic reminder checker
 * Should be called once on app initialization
 */
let reminderCheckInterval = null;

export const startReminderChecker = (intervalMs = 5 * 60 * 1000) => {
  if (reminderCheckInterval) {
    console.warn('Reminder checker already running');
    return;
  }

  console.log('🔔 Starting reminder checker (interval:', intervalMs / 1000 / 60, 'minutes)');

  // Check immediately on start
  checkAndCreateReminders();

  // Set up periodic checks
  reminderCheckInterval = setInterval(() => {
    checkAndCreateReminders();
  }, intervalMs);

  return () => stopReminderChecker();
};

/**
 * Stop periodic reminder checker
 */
export const stopReminderChecker = () => {
  if (reminderCheckInterval) {
    clearInterval(reminderCheckInterval);
    reminderCheckInterval = null;
    console.log('🔔 Reminder checker stopped');
  }
};

export default {
  checkAndCreateReminders,
  saveReminders,
  getTaskReminders,
  deleteTaskReminders,
  clearSentRemindersCache,
  getReminderLabel,
  startReminderChecker,
  stopReminderChecker,
};
