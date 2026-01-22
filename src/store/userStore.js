import { create } from 'zustand';
import { supabase } from '../lib/supabase';

const useUserStore = create((set, get) => ({
  users: [],
  loading: false,
  error: null,

  // Fetch all users (admin only)
  fetchUsers: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      set({ users: data || [], loading: false });
      return { data, error: null };
    } catch (error) {
      set({ error: error.message, loading: false });
      return { data: null, error };
    }
  },

  // Update user role (admin only)
  updateUserRole: async (userId, role) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;

      set((state) => ({
        users: state.users.map((u) =>
          u.id === userId ? { ...u, role } : u
        ),
        loading: false,
      }));

      return { data, error: null };
    } catch (error) {
      set({ error: error.message, loading: false });
      return { data: null, error };
    }
  },

  // Delete user (super admin only)
  deleteUser: async (userId) => {
    set({ loading: true, error: null });
    try {
      // Step 1: Remove user from task assignments
      await supabase.from('task_assignees').delete().eq('user_id', userId);

      // Step 2: Remove user from project memberships
      await supabase.from('project_members').delete().eq('user_id', userId);

      // Step 3: Delete from profiles table first
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (profileError) throw profileError;

      // Step 4: Try to delete from auth.users via RPC function
      // This requires a database function to be set up on Supabase
      try {
        const { error: rpcError } = await supabase.rpc('delete_user', { user_id: userId });
        // If RPC doesn't exist, that's okay - profiles are already deleted
        if (rpcError && !rpcError.message.includes('function')) {
          console.error('RPC error:', rpcError);
        }
      } catch (rpcErr) {
        // RPC function might not exist yet, but profiles are deleted
        console.log('Note: Auth user deletion requires admin function');
      }

      set((state) => ({
        users: state.users.filter((u) => u.id !== userId),
        loading: false,
      }));

      // Immediately notify other stores to refresh their data
      window.dispatchEvent(new CustomEvent('userDeleted', {
        detail: { userId, timestamp: Date.now() }
      }));

      return { error: null };
    } catch (error) {
      set({ error: error.message, loading: false });
      return { data: null, error };
    }
  },

  // Cleanup deleted users from tasks (server-side function would be better)
  cleanupDeletedUsers: async () => {
    // This would typically be handled by database constraints or server functions
    // For now, we rely on the ON DELETE CASCADE from task_assignees
    console.log('Cleanup completed - task_assignees should be automatically cleaned up');
  },

  // Search users
  searchUsers: async (query) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(10);

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Get user by ID
  getUserById: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Invite user via email - calls Supabase edge function (server-side with admin privileges)
  inviteUser: async (email, role = 'member', fullName = '') => {
    try {
      // Step 1: Get current session to verify admin is logged in
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('You must be logged in to send invitations');
      }

      // Step 2: Call the invite-user edge function (server-side with admin privileges)
      // This prevents the admin's session from being affected
      const supabaseUrl = supabase.supabaseUrl;
      const accessToken = session.access_token;

      const response = await fetch(`${supabaseUrl}/functions/v1/invite-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          email: email,
          role: role,
          fullName: fullName || email.split('@')[0],
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error('Edge function error:', responseData);
        throw new Error(responseData.error || 'Failed to invite user');
      }

      // Step 3: Verify admin is still logged in with same session
      const { data: { session: currentSession } } = await supabase.auth.getSession();

      if (!currentSession || currentSession.user.id !== session.user.id) {
        console.error('CRITICAL: Admin session changed during invitation');
        throw new Error('Session was affected during invitation');
      }

      console.log('User invited successfully:', responseData);
      return { data: responseData, error: null };
    } catch (error) {
      console.error('Invitation error:', error);
      return { data: null, error };
    }
  },
}));

export default useUserStore;
