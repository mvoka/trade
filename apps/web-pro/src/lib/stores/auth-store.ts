import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, proApi, ProUser } from '../api';

interface AuthState {
  user: ProUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; name: string; phone: string; trade: string }) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateUser: (user: Partial<ProUser>) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await proApi.login(email, password);
          // API returns { success, data: { user, tokens } }
          const apiData = (response as any).data || response;
          const user = apiData.user;
          const token = apiData.tokens?.accessToken;

          // Store token
          api.setToken(token);

          set({
            user: { ...user, name: `${user.firstName} ${user.lastName}` },
            token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error: any) {
          const message = error.response?.data?.error?.message || error.response?.data?.message || error.message || 'Login failed';
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: message,
          });
          throw error;
        }
      },

      register: async (data) => {
        set({ isLoading: true, error: null });

        try {
          const response = await proApi.register(data);

          // Store token
          api.setToken(response.token);

          set({
            user: response.user,
            token: response.token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error: any) {
          const message = error.response?.data?.message || error.message || 'Registration failed';
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: message,
          });
          throw error;
        }
      },

      logout: async () => {
        try {
          await proApi.logout();
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          // Clear storage
          if (typeof window !== 'undefined') {
            localStorage.removeItem('pro_token');
          }

          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      },

      checkAuth: async () => {
        const { token } = get();

        if (!token) {
          set({ isLoading: false, isAuthenticated: false });
          return;
        }

        set({ isLoading: true });

        try {
          api.setToken(token);
          const user = await proApi.getProfile();

          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          console.error('Auth check failed:', error);

          // Clear invalid auth
          if (typeof window !== 'undefined') {
            localStorage.removeItem('pro_token');
          }

          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      },

      updateUser: (userData) => {
        const { user } = get();
        if (user) {
          set({ user: { ...user, ...userData } });
        }
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'pro-auth',
      partialize: (state) => ({
        token: state.token,
      }),
    }
  )
);
