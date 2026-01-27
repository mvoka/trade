'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { OperatorSidebar } from '@/components/layout/operator-sidebar';
import { OperatorHeader } from '@/components/layout/operator-header';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useQueueStore } from '@/lib/stores/queue-store';
import { useAlertsStore } from '@/lib/stores/alerts-store';

export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const { fetchQueue } = useQueueStore();
  const { fetchAlerts } = useAlertsStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // Poll for updates
  useEffect(() => {
    if (!isAuthenticated) return;

    // Initial fetch
    fetchQueue();
    fetchAlerts();

    // Poll every 10 seconds
    const interval = setInterval(() => {
      fetchQueue();
      fetchAlerts();
    }, 10000);

    return () => clearInterval(interval);
  }, [isAuthenticated, fetchQueue, fetchAlerts]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <OperatorSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <OperatorHeader />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
