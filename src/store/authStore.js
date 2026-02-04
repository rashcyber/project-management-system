import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      profile: null,
      session: null,
      loading: true,
      initialized: false,

      setUser: (user) => set({ user }),
      setProfile: (profile) => set({ profile }),
      setSession: (session) => set({ session }),
      setLoading: (loading) => set({ loading }),

      // Initialize auth state
      initialize: async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();

          if (session?.user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();

            set({
              user: session.user,
              session,
              profile,
              loading: false,
              initialized: true,
            });
          } else {
            set({ loading: false, initialized: true });
          }
        } catch (error) {
          console.error('Error initializing auth:', error);
          set({ loading: false, initialized: true });
        }
      },

      // Sign up
      signUp: async (email, password, fullName) => {
        set({ loading: true });
        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: fullName,
              },
            },
          });

          if (error) throw error;

          // Wait a moment for the trigger to create the profile
          await new Promise(resolve => setTimeout(resolve, 1000));

          if (data.user) {
            // Ensure new user is created as super_admin with no workspace
            const { error: updateError } = await supabase
              .from('profiles')
              .update({
                role: 'super_admin',
                workspace_id: null,
              })
              .eq('id', data.user.id);

            if (updateError) {
              console.error('Error updating profile role:', updateError);
            }

            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', data.user.id)
              .single();

            set({
              user: data.user,
              session: data.session,
              profile,
              loading: false,
            });

            // Send welcome email asynchronously (don't block signup)
            try {
              await supabase.functions.invoke('send-email', {
                body: {
                  type: 'welcome',
                  recipientEmail: email,
                  recipientName: fullName,
                },
              });
            } catch (emailError) {
              console.warn('Failed to send welcome email:', emailError);
              // Don't throw error, signup is already successful
            }
          }

          return { data, error: null };
        } catch (error) {
          set({ loading: false });
          return { data: null, error };
        }
      },

      // Sign in
      signIn: async (email, password) => {
        set({ loading: true });
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) throw error;

          if (data.user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', data.user.id)
              .single();

            set({
              user: data.user,
              session: data.session,
              profile,
              loading: false,
            });
          }

          return { data, error: null };
        } catch (error) {
          set({ loading: false });
          return { data: null, error };
        }
      },

      // Sign out
      signOut: async () => {
        try {
          await supabase.auth.signOut();
          set({
            user: null,
            session: null,
            profile: null,
          });
        } catch (error) {
          console.error('Error signing out:', error);
        }
      },

      // Update profile
      updateProfile: async (updates) => {
        const { user } = get();
        if (!user) return { error: 'Not authenticated' };

        try {
          const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', user.id)
            .select()
            .single();

          if (error) throw error;

          set({ profile: data });
          return { data, error: null };
        } catch (error) {
          return { data: null, error };
        }
      },

      // Check if user has specific role
      hasRole: (roles) => {
        const { profile } = get();
        if (!profile) return false;
        if (typeof roles === 'string') {
          return profile.role === roles;
        }
        return roles.includes(profile.role);
      },

      // Check if user is admin or super admin
      isAdmin: () => {
        const { profile } = get();
        return profile?.role === 'super_admin' || profile?.role === 'admin';
      },

      // Check if user is super admin
      isSuperAdmin: () => {
        const { profile } = get();
        return profile?.role === 'super_admin';
      },

      // Check if user can manage users
      canManageUsers: () => {
        const { profile } = get();
        return profile?.role === 'super_admin' || profile?.role === 'admin';
      },

      // Check if user can create projects
      canCreateProjects: () => {
        const { profile } = get();
        return ['super_admin', 'admin', 'manager'].includes(profile?.role);
      },

      // Create a new workspace
      createWorkspace: async (workspaceData) => {
        const { user } = get();
        if (!user) return { data: null, error: { message: 'Not authenticated' } };

        try {
          const { data, error } = await supabase
            .from('workspaces')
            .insert({
              name: workspaceData.name,
              description: workspaceData.description || null,
              owner_id: user.id,
            })
            .select()
            .single();

          if (error) throw error;

          // Update user profile with new workspace_id
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ workspace_id: data.id })
            .eq('id', user.id);

          if (updateError) throw updateError;

          // Update local state
          const { data: updatedProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          set({ profile: updatedProfile });

          return { data, error: null };
        } catch (error) {
          return { data: null, error };
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        // Only persist essential data
      }),
    }
  )
);

export default useAuthStore;
