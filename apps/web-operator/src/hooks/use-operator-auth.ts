'use client';

import { useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';

const PUBLIC_PATHS = ['/login'];

export function useOperatorAuth() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, error, login, logout, checkAuth, clearError } =
    useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isLoading) return;

    const isPublicPath = PUBLIC_PATHS.includes(pathname);

    if (!isAuthenticated && !isPublicPath) {
      router.push('/login');
    } else if (isAuthenticated && isPublicPath) {
      router.push('/');
    }
  }, [isAuthenticated, isLoading, pathname, router]);

  const handleLogin = useCallback(
    async (email: string, password: string) => {
      try {
        await login(email, password);
        router.push('/');
      } catch (error) {
        // Error is already set in store
      }
    },
    [login, router]
  );

  const handleLogout = useCallback(async () => {
    await logout();
    router.push('/login');
  }, [logout, router]);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login: handleLogin,
    logout: handleLogout,
    clearError,
  };
}

// Hook to require operator auth on a page
export function useRequireOperatorAuth() {
  const { user, isAuthenticated, isLoading } = useOperatorAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  return {
    user,
    isAuthenticated,
    isLoading,
    isReady: !isLoading && isAuthenticated,
  };
}
