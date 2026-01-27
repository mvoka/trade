'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useJobsStore } from '@/lib/stores/jobs-store';
import { JobForm } from '@/components/jobs/job-form';
import type { CreateJobInput } from '@trades/shared/types';

export default function NewJobPage() {
  const router = useRouter();
  const { isAuthenticated, checkAuth } = useAuthStore();
  const { serviceCategories, isLoading, error, createJob, fetchServiceCategories, clearError } = useJobsStore();
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchServiceCategories();
    }
  }, [isAuthenticated, fetchServiceCategories]);

  const handleSubmit = async (data: CreateJobInput, photos: File[]) => {
    try {
      setSubmitError(null);
      clearError();
      const job = await createJob(data, photos);
      router.push(`/jobs/${job.id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create job');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/jobs" className="text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold">Create Job Request</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {(error || submitError) && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error || submitError}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Request a Trade Professional</h2>
            <p className="text-sm text-gray-500 mt-1">
              Fill out the form below to submit a job request. We'll match you with verified professionals in your area.
            </p>
          </div>

          {serviceCategories.length === 0 && !isLoading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading service categories...</p>
            </div>
          ) : (
            <JobForm
              serviceCategories={serviceCategories.map(cat => ({
                id: cat.id,
                name: cat.name,
                slug: cat.slug || cat.name.toLowerCase(),
              }))}
              onSubmit={handleSubmit}
              isLoading={isLoading}
            />
          )}
        </div>
      </main>
    </div>
  );
}
