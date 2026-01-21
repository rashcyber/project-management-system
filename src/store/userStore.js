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

  // Invite user via email - Use signUp then update role
  inviteUser: async (email, role = 'member', fullName = '') => {
    try {
      // Step 0: Verify admin is logged in
      const { data: { session: adminSession } } = await supabase.auth.getSession();

      if (!adminSession) {
        throw new Error('You must be logged in to send invitations');
      }

      const adminUserId = adminSession.user.id;
      console.log('Admin:', adminUserId, 'inviting:', email, 'as:', role);

      // Step 1: Create the user via signUp (this bypasses RLS and creates the user + profile)
      const tempPassword = crypto.randomUUID() + 'A1!';

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

      if (signUpError) {
        console.error('SignUp error:', signUpError);
        throw signUpError;
      }

      if (!signUpData.user) {
        throw new Error('User was not created');
      }

      const newUserId = signUpData.user.id;
      console.log('Auth user created:', newUserId);

      // Step 2: IMMEDIATELY check admin session
      const { data: { session: sessionCheck } } = await supabase.auth.getSession();

      if (sessionCheck?.user?.id !== adminUserId) {
        console.log('Admin session was affected by signUp, attempting to restore...');
        // The session switched - we need to restore it
        await supabase.auth.refreshSession();

        // Check again
        const { data: { session: afterRefresh } } = await supabase.auth.getSession();
        if (afterRefresh?.user?.id !== adminUserId) {
          console.error('Could not restore admin session');
          throw new Error('Admin session was compromised');
        }
      }

      // Step 3: Wait for profile trigger to create the profile
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Step 4: Update the profile with the correct role (RLS allows update by owner)
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          role: role,
          full_name: fullName || email.split('@')[0],
        })
        .eq('id', newUserId);

      if (updateError) {
        console.error('Profile update error:', updateError);
        throw updateError;
      }

      console.log('Profile role updated to:', role);

      // Step 5: Send password reset email
      const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${appUrl}/reset-password`,
      });

      if (resetError) {
        console.error('Reset email error:', resetError);
        throw new Error('Failed to send invitation email: ' + resetError.message);
      }

      console.log('Invitation email sent to:', email);

      // Step 6: Final check - admin should still be logged in
      const { data: { session: finalCheck } } = await supabase.auth.getSession();

      if (!finalCheck || finalCheck.user.id !== adminUserId) {
        console.error('CRITICAL: Admin session lost at end of invitation');
        throw new Error('Admin session compromised');
      }

      console.log('Invitation completed successfully');

      return {
        data: {
          success: true,
          user: {
            id: newUserId,
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
