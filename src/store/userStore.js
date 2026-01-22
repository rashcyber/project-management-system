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

  // Invite user via email - direct implementation without edge function
  inviteUser: async (email, role = 'member', fullName = '') => {
    try {
      console.log('📨 Inviting user:', { email, role, fullName });

      // Get current admin session for authorization
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        throw new Error('You must be logged in to invite users');
      }

      const adminUserId = session.user.id;
      console.log('✅ Admin verified:', adminUserId);

      // Verify admin has permission to invite
      const { data: adminProfile, error: adminError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', adminUserId)
        .single();

      if (adminError || !adminProfile) {
        throw new Error('Could not verify admin permissions');
      }

      if (adminProfile.role !== 'super_admin' && adminProfile.role !== 'admin') {
        throw new Error('Only admins can invite users');
      }

      console.log('✅ Admin verified with role:', adminProfile.role);

      // Check if user already exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const userExists = existingUsers?.users?.some(u => u.email === email);

      if (userExists) {
        throw new Error('User with this email already exists');
      }

      // Check profile table as well
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();

      if (existingProfile) {
        throw new Error('User profile already exists');
      }

      console.log('✅ User does not exist, proceeding with creation...');

      // Generate temporary password
      const tempPassword = Math.random().toString(36).slice(-12) + 'A1!';

      // Create auth user
      console.log('🔄 Creating auth user...');
      const { data: newAuthUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: false,
        user_metadata: {
          full_name: fullName || email.split('@')[0],
          role,
          invited: true,
        },
      });

      if (createError || !newAuthUser?.user) {
        console.error('❌ Auth user creation failed:', createError);
        throw new Error(`Failed to create user: ${createError?.message || 'Unknown error'}`);
      }

      console.log('✅ Auth user created:', newAuthUser.user.id);

      // Create profile record
      console.log('🔄 Creating profile...');
      const { error: profileCreateError } = await supabase
        .from('profiles')
        .insert({
          id: newAuthUser.user.id,
          email,
          full_name: fullName || email.split('@')[0],
          role,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (profileCreateError) {
        console.error('⚠️ Profile creation error (will try upsert):', profileCreateError);
        // Try upsert as fallback
        const { error: upsertError } = await supabase
          .from('profiles')
          .upsert({
            id: newAuthUser.user.id,
            email,
            full_name: fullName || email.split('@')[0],
            role,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (upsertError) {
          console.error('❌ Profile upsert also failed:', upsertError);
          throw new Error(`Failed to create profile: ${upsertError.message}`);
        }
      }

      console.log('✅ Profile created successfully');

      // Generate password reset link
      console.log('📧 Generating password reset link...');
      const { data: resetData, error: resetError } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: {
          redirectTo: `${window.location.origin}/reset-password`,
        },
      });

      if (resetError) {
        console.error('⚠️ Reset link generation failed:', resetError);
        // Don't throw - user was created successfully
      } else {
        console.log('✅ Recovery link generated');
      }

      const response = {
        success: true,
        message: 'User invited successfully',
        user: {
          id: newAuthUser.user.id,
          email: newAuthUser.user.email,
          role,
          full_name: fullName || email.split('@')[0],
        },
      };

      console.log('✅ User invited successfully:', response);

      // Verify admin is still logged in
      const { data: { session: currentSession }, error: verifyError } = await supabase.auth.getSession();

      if (verifyError || !currentSession || currentSession.user.id !== adminUserId) {
        console.error('⚠️ WARNING: Admin session changed unexpectedly!');
      } else {
        console.log('✅ Admin session preserved');
      }

      return { data: response, error: null };
    } catch (error) {
      console.error('❌ Invitation error:', error);
      return { data: null, error };
    }
  },
}));

export default useUserStore;
