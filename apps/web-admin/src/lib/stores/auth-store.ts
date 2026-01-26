import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { adminApi } from '../api';

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'SUPER_ADMIN';
  permissions: string[];
  avatarUrl?: string;
  createdAt: string;
  lastLoginAt?: string;
}

interface AuthState {
  user: AdminUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchCurrentUser: () => Promise<void>;
  clearError: () => void;
  hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await adminApi.login(email, password);
          // API returns { success, data: { user, tokens } }
          const apiData = (response as any).data || response;
          const user = apiData.user;
          const tokens = apiData.tokens;
          const token = tokens?.accessToken;

          // Verify admin role
          if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
            throw new Error('Access denied. Admin privileges required.');
          }

          localStorage.setItem('admin_token', token);
          localStorage.setItem('admin_user', JSON.stringify(user));

          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error: any) {
          const message = error.response?.data?.message || error.message || 'Login failed';
          set({
            error: message,
            isLoading: false,
            isAuthenticated: false,
          });
          throw error;
        }
      },

      logout: async () => {
        try {
          await adminApi.logout();
        } catch (error) {
          // Continue with local logout even if API call fails
          console.error('Logout API error:', error);
        } finally {
          localStorage.removeItem('admin_token');
          localStorage.removeItem('admin_user');
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            error: null,
          });
        }
      },

      fetchCurrentUser: async () => {
        const token = localStorage.getItem('admin_token');
        if (!token) {
          set({ isAuthenticated: false, user: null });
          return;
        }

        set({ isLoading: true });
        try {
          const response = await adminApi.me();
          const user = response.data;

          if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
            throw new Error('Access denied');
          }

          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          localStorage.removeItem('admin_token');
          localStorage.removeItem('admin_user');
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },

      clearError: () => set({ error: null }),

      hasPermission: (permission: string) => {
        const { user } = get();
        if (!user) return false;
        if (user.role === 'SUPER_ADMIN') return true;
        return user.permissions.includes(permission);
      },
    }),
    {
      name: 'admin-auth-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
