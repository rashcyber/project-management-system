import { create } from 'zustand';
import { supabase } from '../lib/supabase';

const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  // Fetch notifications for current user
  fetchNotifications: async () => {
    set({ loading: true });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          actor:profiles!notifications_actor_id_fkey(id, full_name, avatar_url)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const unreadCount = data?.filter(n => !n.read).length || 0;

      set({ notifications: data || [], unreadCount, loading: false });
      return { data, error: null };
    } catch (error) {
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { error: null };

      // First, delete all notifications for the user
      const { error: deleteError } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      // Clear local state immediately
      set({ notifications: [], unreadCount: 0 });

      // Verify deletion by refetching (ensures consistency)
      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id);

      if (fetchError) throw fetchError;

      // If any notifications are still there (shouldn't happen), update state
      if (data && data.length > 0) {
        set({ notifications: data, unreadCount: data.filter(n => !n.read).length });
        return { error: 'Some notifications could not be deleted' };
      }

      return { error: null };
    } catch (error) {
      console.error('Error clearing notifications:', error);
      return { error };
    }
  },

  // Subscribe to real-time notifications
  subscribeToNotifications: (userId) => {
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
        (payload) => {
          set((state) => ({
            notifications: [payload.new, ...state.notifications],
            unreadCount: state.unreadCount + 1,
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
          set((state) => {
            const notif = state.notifications.find(n => n.id === payload.old.id);
            return {
              notifications: state.notifications.filter(n => n.id !== payload.old.id),
              unreadCount: notif && !notif.read
                ? Math.max(0, state.unreadCount - 1)
                : state.unreadCount,
            };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
}));

export default useNotificationStore;
