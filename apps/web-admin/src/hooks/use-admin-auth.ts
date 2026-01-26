'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';

interface UseAdminAuthOptions {
  required?: boolean;
  requiredPermissions?: string[];
  redirectTo?: string;
}

export function useAdminAuth(options: UseAdminAuthOptions = {}) {
  const {
    required = true,
    requiredPermissions = [],
    redirectTo = '/login',
  } = options;

  const router = useRouter();
  const pathname = usePathname();
  const {
    user,
    isAuthenticated,
    isLoading,
    error,
    fetchCurrentUser,
    logout,
    hasPermission,
  } = useAuthStore();

  useEffect(() => {
    // Check auth status on mount
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  useEffect(() => {
    if (isLoading) return;

    if (required && !isAuthenticated && pathname !== '/login') {
      router.push(`${redirectTo}?returnUrl=${encodeURIComponent(pathname)}`);
      return;
    }

    // Check required permissions
    if (isAuthenticated && requiredPermissions.length > 0) {
      const hasAllPermissions = requiredPermissions.every((p) => hasPermission(p));
      if (!hasAllPermissions) {
        router.push('/unauthorized');
      }
    }
  }, [
    required,
    isAuthenticated,
    isLoading,
    pathname,
    router,
    redirectTo,
    requiredPermissions,
    hasPermission,
  ]);

  const checkPermission = (permission: string): boolean => {
    return hasPermission(permission);
  };

  const checkPermissions = (permissions: string[]): boolean => {
    return permissions.every((p) => hasPermission(p));
  };

  const isSuperAdmin = (): boolean => {
    return user?.role === 'SUPER_ADMIN';
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    logout,
    checkPermission,
    checkPermissions,
    isSuperAdmin,
  };
}

export default useAdminAuth;
