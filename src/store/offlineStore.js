import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useOfflineStore = create(
  persist(
    (set, get) => ({
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      pendingActions: [], // Array of {id, type, payload, timestamp, retries}
      lastSync: null,
      syncInProgress: false,
      error: null,

      // Set online/offline status
      setOnline: (isOnline) => set({ isOnline }),

      // Queue an action for later sync
      queueAction: (type, payload) => {
        const action = {
          id: `${Date.now()}-${Math.random()}`,
          type,
          payload,
          timestamp: new Date().toISOString(),
          retries: 0,
        };

        set((state) => ({
          pendingActions: [...state.pendingActions, action],
        }));

        return action.id;
      },

      // Get all pending actions
      getPendingActions: () => get().pendingActions,

      // Remove a pending action by ID
      removePendingAction: (actionId) => {
        set((state) => ({
          pendingActions: state.pendingActions.filter((a) => a.id !== actionId),
        }));
      },

      // Remove multiple pending actions by IDs
      removePendingActions: (actionIds) => {
        set((state) => ({
          pendingActions: state.pendingActions.filter((a) => !actionIds.includes(a.id)),
        }));
      },

      // Increment retry count for an action
      incrementRetry: (actionId) => {
        set((state) => ({
          pendingActions: state.pendingActions.map((a) =>
            a.id === actionId ? { ...a, retries: a.retries + 1 } : a
          ),
        }));
      },

      // Start sync process
      setSyncInProgress: (inProgress) => set({ syncInProgress: inProgress }),

      // Update last sync time
      setLastSync: (timestamp) => set({ lastSync: timestamp }),

      // Set error message
      setError: (error) => set({ error }),

      // Clear all pending actions
      clearPendingActions: () => set({ pendingActions: [] }),

      // Clear error
      clearError: () => set({ error: null }),
    }),
    {
      name: 'offline-storage', // localStorage key
      partialize: (state) => ({
        // Only persist these specific state properties
        pendingActions: state.pendingActions,
        lastSync: state.lastSync,
      }),
    }
  )
);

export default useOfflineStore;
