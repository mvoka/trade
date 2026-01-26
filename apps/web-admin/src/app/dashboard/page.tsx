'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout, fetchCurrentUser } = useAuthStore();

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

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
          <h1 className="text-xl font-bold">Admin Dashboard</h1>
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
            <h3 className="font-semibold mb-2">Pending Verifications</h3>
            <p className="text-3xl font-bold">0</p>
            <p className="text-sm text-muted-foreground">Awaiting review</p>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold mb-2">Active Pros</h3>
            <p className="text-3xl font-bold">0</p>
            <p className="text-sm text-muted-foreground">Approved contractors</p>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold mb-2">Total Jobs</h3>
            <p className="text-3xl font-bold">0</p>
            <p className="text-sm text-muted-foreground">All time</p>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold mb-2">SLA Breaches</h3>
            <p className="text-3xl font-bold text-destructive">0</p>
            <p className="text-sm text-muted-foreground">Today</p>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <a
              href="/verifications"
              className="rounded-lg border bg-card p-4 hover:bg-accent transition-colors"
            >
              <h3 className="font-medium">Pro Verifications</h3>
              <p className="text-sm text-muted-foreground">Review and approve contractors</p>
            </a>
            <a
              href="/feature-flags"
              className="rounded-lg border bg-card p-4 hover:bg-accent transition-colors"
            >
              <h3 className="font-medium">Feature Flags</h3>
              <p className="text-sm text-muted-foreground">Manage platform features</p>
            </a>
            <a
              href="/policies"
              className="rounded-lg border bg-card p-4 hover:bg-accent transition-colors"
            >
              <h3 className="font-medium">Policies</h3>
              <p className="text-sm text-muted-foreground">Configure SLAs and rules</p>
            </a>
            <a
              href="/audit-logs"
              className="rounded-lg border bg-card p-4 hover:bg-accent transition-colors"
            >
              <h3 className="font-medium">Audit Logs</h3>
              <p className="text-sm text-muted-foreground">View system activity</p>
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
