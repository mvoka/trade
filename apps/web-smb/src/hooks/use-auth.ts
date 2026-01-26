'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';

export function useAuth(options: { requireAuth?: boolean; redirectTo?: string } = {}) {
  const { requireAuth = false, redirectTo = '/login' } = options;
  const router = useRouter();
  const { user, isAuthenticated, isLoading, error, checkAuth, login, logout, register, clearError } =
    useAuthStore();

  useEffect(() => {
    // Check authentication status on mount
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    // Redirect if auth is required but user is not authenticated
    if (requireAuth && !isLoading && !isAuthenticated) {
      router.push(redirectTo);
    }
  }, [requireAuth, isLoading, isAuthenticated, router, redirectTo]);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    register,
    clearError,
  };
}

export function useRequireAuth(redirectTo = '/login') {
  return useAuth({ requireAuth: true, redirectTo });
}

export function useGuestOnly(redirectTo = '/') {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push(redirectTo);
    }
  }, [isLoading, isAuthenticated, router, redirectTo]);

  return { isAuthenticated, isLoading };
}
