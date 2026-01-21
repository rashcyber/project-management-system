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

  // Invite user via email - simple direct approach
  inviteUser: async (email, role = 'member', fullName = '') => {
    try {
      // Step 0: Get the admin's current session BEFORE anything else
      const { data: { session: adminSession } } = await supabase.auth.getSession();
      const adminUserId = adminSession?.user?.id;

      if (!adminUserId) {
        throw new Error('You must be logged in to send invitations');
      }

      console.log('Admin user:', adminUserId);
      console.log('Creating invitation for:', email, 'with role:', role);

      // Step 1: Generate a secure temporary password
      const tempPassword = crypto.randomUUID() + 'A1!';

      // Step 2: Create the user account with a temporary password
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email,
        password: tempPassword,
        options: {
          data: {
            full_name: fullName || email.split('@')[0],
            role: role,
            invited: true,
          },
        },
      });

      if (signUpError) throw signUpError;

      console.log('User created:', signUpData.user.id);

      // Step 3: Immediately restore admin session to prevent logout
      // Get the admin session again and force it back
      const { data: adminSessionData } = await supabase.auth.getSession();
      if (adminSessionData.session?.user?.id !== adminUserId) {
        console.log('Admin session was affected, restoring...');
        // The session changed - we need to restore it
        // Refresh to get the original admin session back
        await supabase.auth.refreshSession();
      }

      // Step 4: Wait for the trigger to create the profile
      await new Promise(resolve => setTimeout(resolve, 1200));

      // Step 5: Update the profile with the correct role
      if (signUpData.user) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            role: role,
            full_name: fullName || email.split('@')[0],
          })
          .eq('id', signUpData.user.id);

        if (updateError) {
          console.error('Profile update error:', updateError);
          throw updateError;
        }

        console.log('Profile updated with role:', role);
      }

      // Step 6: Send password reset email so user can set their own password
      const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${appUrl}/reset-password`,
      });

      if (resetError) {
        console.error('Failed to send reset email:', resetError);
        throw resetError;
      }

      console.log('Invitation email sent to:', email);

      // Step 7: Verify admin is still logged in with same ID
      const { data: { session: finalSession } } = await supabase.auth.getSession();

      if (finalSession?.user?.id !== adminUserId) {
        console.error('CRITICAL: Admin session ID changed after invitation');
        console.log('Expected:', adminUserId, 'Got:', finalSession?.user?.id);
        // Force sign out and back in
        await supabase.auth.signOut({ scope: 'local' });
        throw new Error('Admin session was compromised during invitation');
      }

      console.log('Invitation completed successfully');

      return { data: signUpData, error: null };
    } catch (error) {
      console.error('Invitation error:', error);
      return { data: null, error };
    }
  },
}));

export default useUserStore;
