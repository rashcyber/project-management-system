import { create } from 'zustand';
import { supabase } from '../lib/supabase';

const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  isClearing: false, // Flag to prevent re-fetching during clear operation

  // Fetch notifications for current user
  fetchNotifications: async () => {
    set({ loading: true });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('🔔 fetchNotifications: No user found');
        set({ loading: false });
        return;
      }

      console.log('🔔 Fetching notifications for user:', user.id);

      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          actor:profiles!notifications_actor_id_fkey(id, full_name, avatar_url)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('🔔 Error fetching notifications:', error);
        throw error;
      }

      const unreadCount = data?.filter(n => !n.read).length || 0;

      console.log(`🔔 Fetched ${data?.length || 0} notifications, ${unreadCount} unread`);
      set({ notifications: data || [], unreadCount, loading: false });
      return { data, error: null };
    } catch (error) {
      console.error('🔔 fetchNotifications error:', error);
      set({ loading: false });
      return { data: null, error };
    }
  },

  // Mark notification as read
  markAsRead: async (notificationId) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;

      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === notificationId ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));

      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  // Mark all notifications as read
  markAllAsRead: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) throw error;

      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0,
      }));

      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  // Delete notification
  deleteNotification: async (notificationId) => {
    try {
      const notification = get().notifications.find(n => n.id === notificationId);

      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;

      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== notificationId),
        unreadCount: notification && !notification.read
          ? Math.max(0, state.unreadCount - 1)
          : state.unreadCount,
      }));

      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  // Clear all notifications
  clearAll: async () => {
    try {
      set({ isClearing: true }); // Set flag to prevent re-fetching

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        set({ isClearing: false });
        return { error: null };
      }

      // Delete all notifications for the user
      const { error: deleteError } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      // Clear local state immediately and completely
      set({
        notifications: [],
        unreadCount: 0,
      });

      // Keep the isClearing flag true for 1 second to prevent real-time
      // DELETE events from interfering with the clear operation
      setTimeout(() => {
        set({ isClearing: false });
      }, 1000);

      return { error: null };
    } catch (error) {
      console.error('Error clearing notifications:', error);
      set({ isClearing: false }); // Clear flag on error
      return { error };
    }
  },

  // Subscribe to real-time notifications
  subscribeToNotifications: (userId) => {
    console.log('🔔 Setting up real-time notification subscription for user:', userId);

    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          console.log('🔔 Real-time INSERT event received:', payload);

          // Skip INSERT handler if we're in the middle of clearing all notifications
          const state = get();
          if (state.isClearing) {
            console.log('🔔 Skipping INSERT event - clear operation in progress');
            return;
          }

          console.log('🔔 Processing new notification:', payload.new);

          // Fetch the full notification with actor data
          const { data: fullNotification } = await supabase
            .from('notifications')
            .select(`
              *,
              actor:profiles!notifications_actor_id_fkey(id, full_name, avatar_url)
            `)
            .eq('id', payload.new.id)
            .single();

          console.log('🔔 Full notification with actor:', fullNotification);

          set((prevState) => ({
            notifications: [fullNotification || payload.new, ...prevState.notifications],
            unreadCount: prevState.unreadCount + 1,
          }));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('🔔 Real-time DELETE event received:', payload);

          // Skip DELETE handler if we're in the middle of clearing all notifications
          // to prevent interference with the clear operation
          const state = get();
          if (state.isClearing) {
            console.log('🔔 Skipping DELETE event - clear operation in progress');
            return;
          }

          console.log('🔔 Processing deleted notification:', payload.old.id);
          set((prevState) => {
            const notif = prevState.notifications.find(n => n.id === payload.old.id);
            return {
              notifications: prevState.notifications.filter(n => n.id !== payload.old.id),
              unreadCount: notif && !notif.read
                ? Math.max(0, prevState.unreadCount - 1)
                : prevState.unreadCount,
            };
          });
        }
      )
      .subscribe((status, err) => {
        console.log('🔔 Subscription status:', status, err);
        if (err) {
          console.error('🔔 Real-time subscription error:', err);
        }
      });

    return () => {
      console.log('🔔 Unsubscribing from real-time notifications');
      supabase.removeChannel(channel);
    };
  },

  // ============ EMAIL NOTIFICATION PREFERENCES ============

  // Fetch user's email notification preferences
  fetchEmailPreferences: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { data: null, error: 'No user' };

      const { data, error } = await supabase
        .from('profiles')
        .select('email_notifications_enabled, email_digest_frequency, email_notification_types')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      return {
        data: {
          email_notifications_enabled: data?.email_notifications_enabled ?? true,
          email_digest_frequency: data?.email_digest_frequency ?? 'daily',
          email_notification_types: data?.email_notification_types || {
            task_assigned: true,
            task_completed: true,
            task_mentioned: true,
            project_created: true,
            comment_mentioned: true,
          },
        },
        error: null
      };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Update email notification preferences
  updateEmailPreferences: async (preferences) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user');

      const { error } = await supabase
        .from('profiles')
        .update(preferences)
        .eq('id', user.id);

      if (error) throw error;

      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  // Toggle email notifications
  toggleEmailNotifications: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user');

      const { data: profile } = await supabase
        .from('profiles')
        .select('email_notifications_enabled')
        .eq('id', user.id)
        .single();

      const newState = !(profile?.email_notifications_enabled ?? true);

      const { error } = await supabase
        .from('profiles')
        .update({ email_notifications_enabled: newState })
        .eq('id', user.id);

      if (error) throw error;

      return { data: { email_notifications_enabled: newState }, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Update email digest frequency
  updateEmailDigestFrequency: async (frequency) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user');

      const { error } = await supabase
        .from('profiles')
        .update({ email_digest_frequency: frequency })
        .eq('id', user.id);

      if (error) throw error;

      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  // Update which notification types trigger emails
  updateEmailNotificationTypes: async (notificationTypes) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user');

      const { error } = await supabase
        .from('profiles')
        .update({ email_notification_types: notificationTypes })
        .eq('id', user.id);

      if (error) throw error;

      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  // Fetch email logs
  fetchEmailLogs: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { data: null, error: 'No user' };

      const { data, error } = await supabase
        .from('email_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
}));

export default useNotificationStore;
