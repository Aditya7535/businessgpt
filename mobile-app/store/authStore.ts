import { create } from 'zustand';
import { User, Store } from '../types';
import Storage from '../utils/storage';
import authService, { LoginCredentials } from '../services/auth.service';

interface AuthState {
  user: User | null;
  store: Store | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  initialize: () => Promise<void>;
  login: (credentials: LoginCredentials) => Promise<boolean>;
  logout: () => Promise<void>;
  updateStore: (store: Store) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  store: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  initialize: async () => {
    try {
      set({ isLoading: true, error: null });
      const token = await Storage.getItem('auth_token');
      const userStr = await Storage.getItem('auth_user');
      const storeStr = await Storage.getItem('auth_store');

      if (token && userStr) {
        const user = JSON.parse(userStr);
        const store = storeStr ? JSON.parse(storeStr) : null;
        set({
          token,
          user,
          store,
          isAuthenticated: true,
          isLoading: false,
        });

        // Optionally refresh profile in background
        try {
          const freshData = await authService.getMe();
          if (freshData.user) {
            set({ user: freshData.user, store: freshData.store || store });
            await Storage.setItem('auth_user', JSON.stringify(freshData.user));
            if (freshData.store) {
              await Storage.setItem('auth_store', JSON.stringify(freshData.store));
            }
          }
        } catch {
          // Keep cached credentials if offline
        }
      } else {
        set({ isAuthenticated: false, isLoading: false, user: null, store: null, token: null });
      }
    } catch (err: any) {
      set({ isAuthenticated: false, isLoading: false, error: err.message });
    }
  },

  login: async (credentials: LoginCredentials) => {
    try {
      set({ isLoading: true, error: null });
      const res = await authService.login(credentials);
      set({
        token: res.access_token,
        user: res.user,
        store: res.store || null,
        isAuthenticated: true,
        isLoading: false,
      });
      return true;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      return false;
    }
  },

  logout: async () => {
    try {
      await authService.logout();
    } finally {
      set({
        user: null,
        store: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  },

  updateStore: (store: Store) => {
    set({ store });
    Storage.setItem('auth_store', JSON.stringify(store));
  },

  clearError: () => set({ error: null }),
}));

export default useAuthStore;
