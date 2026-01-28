'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import {
  authApi,
  tokenStorage,
  User,
  LoginCredentials,
  RegisterData,
  AuthResponse,
  ApiError,
} from '../lib/auth-client';

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface AuthContextValue extends AuthState {
  login: (credentials: LoginCredentials) => Promise<AuthResponse>;
  register: (data: RegisterData) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  clearError: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export interface AuthProviderProps {
  children: React.ReactNode;
  /** Optional callback when auth state changes */
  onAuthChange?: (isAuthenticated: boolean, user: User | null) => void;
  /** Optional redirect URL for unauthenticated users */
  loginRedirect?: string;
}

export function AuthProvider({ children, onAuthChange, loginRedirect }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  // Initialize auth state from storage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Check for existing token
        const token = tokenStorage.getAccessToken();
        if (token) {
          // Try to get user from storage first
          const storedUser = tokenStorage.getUser();
          if (storedUser) {
            setState({
              user: storedUser,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          }

          // Verify with server in background
          const user = await authApi.getCurrentUser();
          if (user) {
            setState({
              user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          } else {
            // Token invalid
            tokenStorage.clearTokens();
            setState({
              user: null,
              isAuthenticated: false,
              isLoading: false,
              error: null,
            });
          }
        } else {
          setState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        tokenStorage.clearTokens();
        setState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      }
    };

    initializeAuth();
  }, []);

  // Notify on auth state changes
  useEffect(() => {
    if (!state.isLoading && onAuthChange) {
      onAuthChange(state.isAuthenticated, state.user);
    }
  }, [state.isAuthenticated, state.user, state.isLoading, onAuthChange]);

  const login = useCallback(async (credentials: LoginCredentials): Promise<AuthResponse> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await authApi.login(credentials);

      if (response.success && response.data) {
        setState({
          user: response.data.user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      } else {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: response.error || 'Login failed',
        }));
      }

      return response;
    } catch (error) {
      const apiError = error as ApiError;
      const errorMessage = apiError.message || apiError.error || 'Login failed';

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));

      return {
        success: false,
        error: errorMessage,
      };
    }
  }, []);

  const register = useCallback(async (data: RegisterData): Promise<AuthResponse> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await authApi.register(data);

      if (response.success && response.data) {
        setState({
          user: response.data.user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      } else {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: response.error || 'Registration failed',
        }));
      }

      return response;
    } catch (error) {
      const apiError = error as ApiError;
      const errorMessage = apiError.message || apiError.error || 'Registration failed';

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));

      return {
        success: false,
        error: errorMessage,
      };
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      await authApi.logout();
    } finally {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });

      // Redirect to login if specified
      if (loginRedirect && typeof window !== 'undefined') {
        window.location.href = loginRedirect;
      }
    }
  }, [loginRedirect]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const user = await authApi.getCurrentUser();
      if (user) {
        setState((prev) => ({ ...prev, user }));
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      register,
      logout,
      clearError,
      refreshUser,
    }),
    [state, login, register, logout, clearError, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access auth context
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Hook to require authentication
 * Returns the auth context but throws if not authenticated
 */
export function useRequireAuth(): AuthContextValue & { user: User } {
  const auth = useAuth();

  if (!auth.isLoading && !auth.isAuthenticated) {
    throw new Error('User must be authenticated');
  }

  return auth as AuthContextValue & { user: User };
}

export default AuthProvider;
