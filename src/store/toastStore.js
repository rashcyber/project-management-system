import { create } from 'zustand';

const useToastStore = create((set) => ({
  toasts: [],

  addToast: (toast) => {
    const id = Date.now().toString();
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));
    return id;
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clearToasts: () => {
    set({ toasts: [] });
  },
}));

// Helper functions for easy toast creation
export const toast = {
  success: (message, duration = 5000) => {
    return useToastStore.getState().addToast({ type: 'success', message, duration });
  },
  error: (message, duration = 7000) => {
    return useToastStore.getState().addToast({ type: 'error', message, duration });
  },
  warning: (message, duration = 5000) => {
    return useToastStore.getState().addToast({ type: 'warning', message, duration });
  },
  info: (message, duration = 5000) => {
    return useToastStore.getState().addToast({ type: 'info', message, duration });
  },
};

export default useToastStore;
