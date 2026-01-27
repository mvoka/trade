'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/auth-store';
import { proApi, Job, JobStatus } from '@/lib/api';

const STATUS_TABS = [
  { label: 'All', value: '' },
  { label: 'Accepted', value: 'ACCEPTED' },
  { label: 'Scheduled', value: 'SCHEDULED' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Completed', value: 'COMPLETED' },
];

const statusColors: Record<string, { bg: string; text: string }> = {
  ACCEPTED: { bg: 'bg-blue-100', text: 'text-blue-700' },
  SCHEDULED: { bg: 'bg-purple-100', text: 'text-purple-700' },
  EN_ROUTE: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  ON_SITE: { bg: 'bg-orange-100', text: 'text-orange-700' },
  IN_PROGRESS: { bg: 'bg-orange-100', text: 'text-orange-700' },
  COMPLETED: { bg: 'bg-green-100', text: 'text-green-700' },
  CANCELLED: { bg: 'bg-red-100', text: 'text-red-700' },
};

export default function JobsPage() {
  const router = useRouter();
  const { isAuthenticated, checkAuth } = useAuthStore();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    fetchJobs();
  }, [isAuthenticated, router, statusFilter, page]);

  const fetchJobs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: any = { page, limit: 20 };
      if (statusFilter) {
        params.status = statusFilter;
      }
      const response = await proApi.getJobs(params);
      setJobs(response.data);
      setTotalPages(response.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-xl font-bold text-primary-600">
              Trades Pro
            </Link>
            <span className="text-gray-300">/</span>
            <h1 className="text-lg font-medium">My Jobs</h1>
          </div>
          <Link
            href="/dispatches"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            Dispatch Inbox
          </Link>
        </div>

        {/* Status Tabs */}
        <div className="container mx-auto px-4 pb-3">
          <div className="flex gap-2 overflow-x-auto">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => {
                  setStatusFilter(tab.value);
                  setPage(1);
                }}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  statusFilter === tab.value
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs found</h3>
            <p className="text-gray-500 mb-6">
              {statusFilter ? `No jobs with status "${statusFilter.replace('_', ' ')}"` : 'Accept dispatches to start building your job list.'}
            </p>
            <Link
              href="/dispatches"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 h-10 px-6"
            >
              View Dispatches
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => {
              const colors = statusColors[job.status] || { bg: 'bg-gray-100', text: 'text-gray-700' };

              return (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="block bg-white rounded-lg border border-gray-200 p-4 hover:border-primary-500 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${colors.bg} ${colors.text}`}>
                          {job.status.replace('_', ' ')}
                        </span>
                        <span className="text-sm text-gray-500">#{job.referenceNumber}</span>
                      </div>
                      <h3 className="font-medium text-gray-900">{job.trade}</h3>
                      <p className="text-sm text-gray-600 line-clamp-2 mt-1">{job.description}</p>
                    </div>

                    <div className="ml-4 text-right">
                      {job.scheduledDate ? (
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {new Date(job.scheduledDate).toLocaleDateString('en-CA', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                          {job.scheduledTimeSlot && (
                            <p className="text-xs text-gray-500">{job.scheduledTimeSlot}</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">Not scheduled</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {job.location.city}, {job.location.state}
                    </div>
                    <span className="text-gray-400">
                      Accepted {new Date(job.acceptedAt || job.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
