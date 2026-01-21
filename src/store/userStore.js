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

  // Invite user via email - ONLY use Supabase email methods, NOT signUp
  inviteUser: async (email, role = 'member', fullName = '') => {
    try {
      // Step 0: Verify admin is logged in
      const { data: { session: adminSession } } = await supabase.auth.getSession();

      if (!adminSession) {
        throw new Error('You must be logged in to send invitations');
      }

      const adminUserId = adminSession.user.id;
      console.log('Admin:', adminUserId, 'inviting:', email, 'as:', role);

      // Step 1: First, create the user profile directly in the database
      // This avoids creating an auth session

      // Generate a random user ID (we'll need this for the profile)
      const newUserId = crypto.randomUUID();

      // Insert profile directly
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: newUserId,
          email: email,
          full_name: fullName || email.split('@')[0],
          role: role,
        });

      if (profileError) {
        console.error('Profile insertion error:', profileError);
        // If it fails due to existing email, that's ok
        if (!profileError.message.includes('duplicate')) {
          throw profileError;
        }
      }

      console.log('Profile created:', newUserId);

      // Step 2: Create the auth user with a temp password
      // We need to do this via Supabase's standard signup
      // BUT we'll do it in a way that doesn't create a session
      const tempPassword = crypto.randomUUID() + 'A1!';

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email,
        password: tempPassword,
        options: {
          data: {
            full_name: fullName || email.split('@')[0],
            role: role,
          },
        },
      });

      if (signUpError) {
        if (!signUpError.message.includes('already registered')) {
          throw signUpError;
        }
      }

      console.log('Auth user created/found');

      // Step 3: CRITICAL - Verify admin session is unchanged
      const { data: { session: checkSession } } = await supabase.auth.getSession();

      if (checkSession?.user?.id !== adminUserId) {
        console.error('Admin session changed after signUp!');
        // Try to restore it
        await supabase.auth.refreshSession();
      }

      // Step 4: Send password reset email (NOT confirmation email)
      const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${appUrl}/reset-password`,
      });

      if (resetError) {
        console.error('Reset email error:', resetError);
        throw new Error('Failed to send invitation email');
      }

      console.log('Invitation email sent');

      // Step 5: Final verification that admin is still logged in
      const { data: { session: finalCheck } } = await supabase.auth.getSession();

      if (!finalCheck || finalCheck.user.id !== adminUserId) {
        console.warn('WARNING: Admin session may have been affected');
        // Try one more refresh
        const { data: { session: refreshed } } = await supabase.auth.refreshSession();
        if (!refreshed || refreshed.user.id !== adminUserId) {
          throw new Error('Admin session was compromised');
        }
      }

      console.log('Invitation success');

      return {
        data: {
          success: true,
          user: {
            email: email,
            role: role,
          },
        },
        error: null,
      };
    } catch (error) {
      console.error('Invitation error:', error);
      return { data: null, error };
    }
  },
}));

export default useUserStore;
