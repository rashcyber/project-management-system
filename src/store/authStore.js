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
