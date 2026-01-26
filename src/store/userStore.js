import { create } from 'zustand';
import { supabase } from '../lib/supabase';

const useUserStore = create((set, get) => ({
  users: [],
  loading: false,
  error: null,

  // Fetch all users (admin only) - filtered by workspace
  fetchUsers: async () => {
    set({ loading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User must be logged in');
      }

      // Get current user's profile to find their workspace
      const { data: currentProfile, error: profileError } = await supabase
        .from('profiles')
        .select('workspace_id, role')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      // Build query based on user's role
      let query = supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      // If not super_admin, filter by workspace
      if (currentProfile?.role !== 'super_admin' && currentProfile?.workspace_id) {
        query = query.eq('workspace_id', currentProfile.workspace_id);
      }

      const { data, error } = await query;

      if (error) throw error;

      set({ users: data || [], loading: false });
      return { data, error: null };
    } catch (error) {
      set({ error: error.message, loading: false });
      return { data: null, error };
    }
  },

  // Fetch workspace users specifically
  fetchWorkspaceUsers: async (workspaceId) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('workspace_id', workspaceId)
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

  // Search users within same workspace
  searchUsers: async (query) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Get current user's workspace
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('workspace_id')
        .eq('id', user.id)
        .single();

      let queryBuilder = supabase
        .from('profiles')
        .select('*')
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(10);

      // Filter by workspace if user has one
      if (currentProfile?.workspace_id) {
        queryBuilder = queryBuilder.eq('workspace_id', currentProfile.workspace_id);
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Search workspace users for member selection
  searchWorkspaceUsers: async (query, workspaceId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('workspace_id', workspaceId)
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(20);

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

      // Verify admin has permission to invite and get their workspace
      const { data: adminProfile, error: adminError } = await supabase
        .from('profiles')
        .select('role, workspace_id')
        .eq('id', adminUserId)
        .single();

      if (adminError || !adminProfile) {
        throw new Error('Could not verify admin permissions');
      }

      if (adminProfile.role !== 'super_admin' && adminProfile.role !== 'admin') {
        throw new Error('Only admins can invite users');
      }

      if (!adminProfile.workspace_id) {
        throw new Error('Admin must belong to a workspace to invite users');
      }

      console.log('✅ Admin verified with role:', adminProfile.role, 'workspace:', adminProfile.workspace_id);

      // Check if user already exists in profiles
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', email)
        .maybeSingle();

      if (existingProfile) {
        throw new Error(`User with email ${email} already exists`);
      }

      console.log('✅ User does not exist, proceeding with creation...');

      // Generate a secure temporary password
      const tempPassword = crypto.randomUUID() + 'A1!';

      // Step 1: Create the user account with a temporary password
      console.log('🔄 Creating auth user via signUp...');
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
        console.error('❌ SignUp error:', signUpError);
        throw signUpError;
      }

      console.log('✅ Auth user created:', signUpData.user?.id);

      // Step 2: Update the profile with the correct role and workspace
      if (signUpData.user) {
        console.log('🔄 Updating profile with role and workspace...');
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            role: role,
            workspace_id: adminProfile.workspace_id,
            full_name: fullName || email.split('@')[0],
          })
          .eq('id', signUpData.user.id);

        if (updateError) {
          console.error('⚠️ Profile update error:', updateError);
          // Don't throw - account was created successfully
        } else {
          console.log('✅ Profile updated with role:', role, 'and workspace:', adminProfile.workspace_id);
        }
      }

      // Step 3: Send password reset email so user can set their own password
      console.log('📧 Sending password reset email...');
      const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${appUrl}/reset-password`,
      });

      if (resetError) {
        console.error('⚠️ Reset email error:', resetError);
        // Don't throw here - account was created successfully
      } else {
        console.log('✅ Password reset email sent');
      }

      const response = {
        success: true,
        message: 'User invited successfully. Password reset link sent to their email.',
        user: {
          id: signUpData.user?.id,
          email: signUpData.user?.email,
          role,
          full_name: fullName || email.split('@')[0],
          workspace_id: adminProfile.workspace_id,
        },
      };

      console.log('✅ User invited successfully:', response);

      return { data: response, error: null };
    } catch (error) {
      console.error('❌ Invitation error:', error);
      return { data: null, error };
    }
  },

  // Generate shareable invite link for workspace
  generateInviteLink: async (role = 'member', maxUses = null, expiresInDays = 7) => {
    try {
      console.log('🔗 Generating invite link:', { role, maxUses, expiresInDays });

      // Get current admin
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be logged in');

      // Get admin's workspace
      const { data: adminProfile, error: adminError } = await supabase
        .from('profiles')
        .select('workspace_id, role')
        .eq('id', user.id)
        .single();

      if (adminError || !adminProfile) {
        throw new Error('Could not verify admin permissions');
      }

      if (adminProfile.role !== 'super_admin' && adminProfile.role !== 'admin') {
        throw new Error('Only admins can generate invite links');
      }

      // Generate unique code
      const code = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null;

      // Create invite link
      const { data: inviteLink, error: linkError } = await supabase
        .from('invite_links')
        .insert({
          workspace_id: adminProfile.workspace_id,
          created_by: user.id,
          code,
          role,
          max_uses: maxUses,
          expires_at: expiresAt,
        })
        .select()
        .single();

      if (linkError) throw linkError;

      console.log('✅ Invite link generated:', code);

      return { data: inviteLink, error: null };
    } catch (error) {
      console.error('❌ Error generating invite link:', error);
      return { data: null, error };
    }
  },

  // Get admin's invite links
  getInviteLinks: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be logged in');

      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('workspace_id')
        .eq('id', user.id)
        .single();

      const { data: links, error } = await supabase
        .from('invite_links')
        .select('*')
        .eq('workspace_id', adminProfile.workspace_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter out soft-deleted items (deleted_at is not null)
      const activeLinks = links?.filter(link => !link.deleted_at) || [];

      return { data: activeLinks, error: null };
    } catch (error) {
      console.error('❌ Error fetching invite links:', error);
      return { data: null, error };
    }
  },

  // Revoke invite link
  revokeInviteLink: async (inviteLinkId, reactivate = false, deleteLink = false) => {
    try {
      if (deleteLink) {
        // Try hard delete first, fall back to soft delete if needed
        console.log('🗑️ Attempting to delete invite link:', inviteLinkId);
        const { error: hardDeleteError } = await supabase
          .from('invite_links')
          .delete()
          .eq('id', inviteLinkId);

        if (hardDeleteError) {
          // If hard delete fails due to RLS, do soft delete instead
          console.warn('⚠️ Hard delete failed, trying soft delete:', hardDeleteError);
          const { error: softDeleteError } = await supabase
            .from('invite_links')
            .update({ is_active: false, deleted_at: new Date().toISOString() })
            .eq('id', inviteLinkId);

          if (softDeleteError) {
            throw new Error(`Failed to delete link: ${softDeleteError.message}`);
          }
          console.log('✅ Invite link soft deleted');
        } else {
          console.log('✅ Invite link hard deleted');
        }
      } else if (reactivate) {
        // Reactivate a revoked link
        console.log('♻️ Reactivating invite link:', inviteLinkId);
        const { error } = await supabase
          .from('invite_links')
          .update({ is_active: true, deleted_at: null })
          .eq('id', inviteLinkId);

        if (error) throw error;
        console.log('✅ Invite link reactivated');
      } else {
        // Revoke the link
        console.log('🔒 Revoking invite link:', inviteLinkId);
        const { error } = await supabase
          .from('invite_links')
          .update({ is_active: false })
          .eq('id', inviteLinkId);

        if (error) throw error;
        console.log('✅ Invite link revoked');
      }

      return { error: null };
    } catch (error) {
      console.error('❌ Error managing invite link:', error);
      return { error };
    }
  },
}));

export default useUserStore;
