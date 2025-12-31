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
      // Note: In production, you'd want to use a server-side function
      // to delete from auth.users as well
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      set((state) => ({
        users: state.users.filter((u) => u.id !== userId),
        loading: false,
      }));

      return { error: null };
    } catch (error) {
      set({ error: error.message, loading: false });
      return { data: null, error };
    }
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

  // Invite user via email - creates account and sends password reset
  inviteUser: async (email, role = 'member', fullName = '') => {
    try {
      // Generate a secure temporary password
      const tempPassword = crypto.randomUUID() + 'A1!';

      // Step 1: Create the user account with a temporary password
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

      // Step 2: Update the profile with the correct role
      if (signUpData.user) {
        await supabase
          .from('profiles')
          .update({
            role: role,
            full_name: fullName || email.split('@')[0],
          })
          .eq('id', signUpData.user.id);
      }

      // Step 3: Send password reset email so user can set their own password
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        console.error('Failed to send reset email:', resetError);
        // Don't throw here - account was created successfully
      }

      return { data: signUpData, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
}));

export default useUserStore;
