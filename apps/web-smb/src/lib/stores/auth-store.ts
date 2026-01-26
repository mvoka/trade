import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '../api';
import { setTokens, clearTokens, getAccessToken, parseToken } from '../auth';
import type { AuthTokens, RegisterInput, LoginInput, ApiResponse } from '@trades/shared/types';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: string;
  createdAt: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (credentials: LoginInput) => Promise<void>;
  register: (data: RegisterInput) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  clearError: () => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (credentials: LoginInput) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiClient.post<ApiResponse<{ tokens: AuthTokens; user: User }>>(
            '/auth/login',
            credentials
          );

          if (response.data) {
            const { tokens, user } = response.data;
            setTokens(tokens.accessToken, tokens.refreshToken, tokens.expiresIn);
            set({ user, isAuthenticated: true, isLoading: false });
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Login failed';
          set({
            error: message,
            isLoading: false,
            isAuthenticated: false,
            user: null
          });
          throw error;
        }
      },

      register: async (data: RegisterInput) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiClient.post<ApiResponse<{ tokens: AuthTokens; user: User }>>(
            '/auth/register',
            { ...data, role: 'SMB_USER' }
          );

          if (response.data) {
            const { tokens, user } = response.data;
            setTokens(tokens.accessToken, tokens.refreshToken, tokens.expiresIn);
            set({ user, isAuthenticated: true, isLoading: false });
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Registration failed';
          set({
            error: message,
            isLoading: false
          });
          throw error;
        }
      },

      logout: () => {
        clearTokens();
        set({ user: null, isAuthenticated: false, error: null });
      },

      checkAuth: async () => {
        const token = getAccessToken();
        if (!token) {
          set({ isAuthenticated: false, user: null });
          return;
        }

        const payload = parseToken(token);
        if (!payload) {
          clearTokens();
          set({ isAuthenticated: false, user: null });
          return;
        }

        try {
          const response = await apiClient.get<ApiResponse<User>>('/users/me');
          if (response.data) {
            set({ user: response.data, isAuthenticated: true });
          }
        } catch {
          clearTokens();
          set({ isAuthenticated: false, user: null });
        }
      },

      clearError: () => set({ error: null }),

      updateProfile: async (data: Partial<User>) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiClient.patch<ApiResponse<User>>('/users/me', data);
          if (response.data) {
            set({ user: response.data, isLoading: false });
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Update failed';
          set({ error: message, isLoading: false });
          throw error;
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated
      }),
    }
  )
);
