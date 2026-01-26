'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (isLoading || !isAuthenticated || !user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">Operator Console</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {user.email} ({user.role})
            </span>
            <button
              onClick={handleLogout}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold mb-2">Pending Dispatch</h3>
            <p className="text-3xl font-bold">0</p>
            <p className="text-sm text-muted-foreground">Jobs awaiting acceptance</p>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold mb-2">Active Jobs</h3>
            <p className="text-3xl font-bold">0</p>
            <p className="text-sm text-muted-foreground">In progress</p>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold mb-2">Escalations</h3>
            <p className="text-3xl font-bold text-orange-500">0</p>
            <p className="text-sm text-muted-foreground">Require attention</p>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold mb-2">SLA Breaches</h3>
            <p className="text-3xl font-bold text-destructive">0</p>
            <p className="text-sm text-muted-foreground">Today</p>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Job Queue</h2>
          <div className="rounded-lg border bg-card p-8 text-center">
            <p className="text-muted-foreground">No jobs in queue</p>
            <p className="text-sm text-muted-foreground mt-2">
              New jobs will appear here when dispatched
            </p>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <a
              href="/queue"
              className="rounded-lg border bg-card p-4 hover:bg-accent transition-colors"
            >
              <h3 className="font-medium">Job Queue</h3>
              <p className="text-sm text-muted-foreground">View and manage pending jobs</p>
            </a>
            <a
              href="/manual-dispatch"
              className="rounded-lg border bg-card p-4 hover:bg-accent transition-colors"
            >
              <h3 className="font-medium">Manual Dispatch</h3>
              <p className="text-sm text-muted-foreground">Dispatch jobs to specific pros</p>
            </a>
            <a
              href="/escalations"
              className="rounded-lg border bg-card p-4 hover:bg-accent transition-colors"
            >
              <h3 className="font-medium">Escalations</h3>
              <p className="text-sm text-muted-foreground">Handle escalated jobs</p>
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
