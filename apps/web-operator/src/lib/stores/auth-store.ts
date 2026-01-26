import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, operatorApi, OperatorUser } from '../api';
import { socketManager } from '../socket';

interface AuthState {
  user: OperatorUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
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
          const response = await operatorApi.login(email, password);
          // API returns { success, data: { user, tokens } }
          const apiData = (response as any).data || response;
          const user = apiData.user;
          const token = apiData.tokens?.accessToken;

          // Verify the user has OPERATOR role
          if (!['OPERATOR', 'OPERATOR_LEAD'].includes(user.role)) {
            throw new Error('Access denied. Operator role required.');
          }

          // Store token
          api.setToken(token);

          // Connect to socket (ignore errors for now)
          try {
            await socketManager.connect(token);
          } catch (e) {
            console.warn('Socket connection failed:', e);
          }

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

      logout: async () => {
        try {
          await operatorApi.logout();
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          // Disconnect socket
          socketManager.disconnect();

          // Clear storage
          if (typeof window !== 'undefined') {
            localStorage.removeItem('operator_token');
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
          const user = await operatorApi.getProfile();

          // Verify the user has OPERATOR role
          if (!['OPERATOR', 'OPERATOR_LEAD'].includes(user.role)) {
            throw new Error('Access denied. Operator role required.');
          }

          // Connect to socket
          await socketManager.connect(token);

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
            localStorage.removeItem('operator_token');
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

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'operator-auth',
      partialize: (state) => ({
        token: state.token,
      }),
    }
  )
);
