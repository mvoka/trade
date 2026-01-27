'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/auth-store';
import { proApi, JobDetails, JobStatus, JobPhoto } from '@/lib/api';

const statusColors: Record<string, { bg: string; text: string }> = {
  ACCEPTED: { bg: 'bg-blue-100', text: 'text-blue-700' },
  SCHEDULED: { bg: 'bg-purple-100', text: 'text-purple-700' },
  EN_ROUTE: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  ON_SITE: { bg: 'bg-orange-100', text: 'text-orange-700' },
  IN_PROGRESS: { bg: 'bg-orange-100', text: 'text-orange-700' },
  COMPLETED: { bg: 'bg-green-100', text: 'text-green-700' },
  CANCELLED: { bg: 'bg-red-100', text: 'text-red-700' },
};

const nextStatus: Record<string, JobStatus | null> = {
  ACCEPTED: 'SCHEDULED',
  SCHEDULED: 'EN_ROUTE',
  EN_ROUTE: 'ON_SITE',
  ON_SITE: 'IN_PROGRESS',
  IN_PROGRESS: null, // Complete flow
  COMPLETED: null,
  CANCELLED: null,
};

const statusActions: Record<string, string> = {
  ACCEPTED: 'Schedule',
  SCHEDULED: 'En Route',
  EN_ROUTE: 'Arrived',
  ON_SITE: 'Start Work',
  IN_PROGRESS: 'Complete Job',
};

export default function JobDetailPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.id as string;

  const { isAuthenticated, checkAuth } = useAuthStore();
  const [job, setJob] = useState<JobDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completionData, setCompletionData] = useState({
    summary: '',
    workPerformed: '',
    materialsUsed: '',
    finalAmount: '',
  });

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    fetchJob();
  }, [isAuthenticated, router, jobId]);

  const fetchJob = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await proApi.getJob(jobId);
      setJob(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load job');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!job) return;

    const next = nextStatus[job.status];
    if (!next && job.status === 'IN_PROGRESS') {
      setShowCompleteModal(true);
      return;
    }

    if (!next) return;

    try {
      setIsUpdating(true);
      await proApi.updateJobStatus(jobId, next);
      await fetchJob();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleComplete = async () => {
    if (!completionData.summary || !completionData.workPerformed) {
      setError('Please fill in required fields');
      return;
    }

    try {
      setIsUpdating(true);
      await proApi.completeJob(jobId, {
        summary: completionData.summary,
        workPerformed: completionData.workPerformed,
        materialsUsed: completionData.materialsUsed || undefined,
        finalAmount: completionData.finalAmount ? parseFloat(completionData.finalAmount) : undefined,
      });
      setShowCompleteModal(false);
      await fetchJob();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete job');
    } finally {
      setIsUpdating(false);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b">
          <div className="container mx-auto px-4 py-4">
            <Link href="/jobs" className="text-gray-500 hover:text-gray-700">
              Back to Jobs
            </Link>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <p className="text-gray-500">Job not found</p>
        </main>
      </div>
    );
  }

  const colors = statusColors[job.status] || { bg: 'bg-gray-100', text: 'text-gray-700' };
  const canUpdateStatus = !['COMPLETED', 'CANCELLED'].includes(job.status);
  const actionLabel = statusActions[job.status];

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/jobs" className="text-gray-500 hover:text-gray-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-lg font-bold">{job.trade}</h1>
              <p className="text-sm text-gray-500">#{job.referenceNumber}</p>
            </div>
          </div>
          <span className={`px-3 py-1 text-sm font-medium rounded-full ${colors.bg} ${colors.text}`}>
            {job.status.replace('_', ' ')}
          </span>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-3xl">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Customer & Location */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-4">
          <h3 className="font-medium text-gray-900 mb-4">Customer</h3>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-gray-500">Contact</dt>
              <dd className="font-medium text-gray-900">{job.smbContactName}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Business</dt>
              <dd className="font-medium text-gray-900">{job.smbName}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Phone</dt>
              <dd className="font-medium text-gray-900">
                <a href={`tel:${job.smbPhone}`} className="text-primary-600 hover:text-primary-700">
                  {job.smbPhone}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Location</dt>
              <dd className="font-medium text-gray-900">{job.location.city}, {job.location.state}</dd>
            </div>
          </dl>
          <div className="mt-4 pt-4 border-t">
            <dt className="text-sm text-gray-500 mb-1">Address</dt>
            <dd className="font-medium text-gray-900">{job.address}</dd>
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(job.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center text-sm text-primary-600 hover:text-primary-700"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Open in Maps
            </a>
          </div>
        </div>

        {/* Schedule */}
        {(job.scheduledDate || job.scheduledTimeSlot) && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-4">
            <h3 className="font-medium text-gray-900 mb-3">Schedule</h3>
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <div>
                {job.scheduledDate && (
                  <p className="font-medium text-gray-900">
                    {new Date(job.scheduledDate).toLocaleDateString('en-CA', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                )}
                {job.scheduledTimeSlot && (
                  <p className="text-gray-500">{job.scheduledTimeSlot}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Job Description */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-4">
          <h3 className="font-medium text-gray-900 mb-3">Job Details</h3>
          <p className="text-gray-700 whitespace-pre-wrap">{job.description}</p>
          {job.notes && (
            <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
              <p className="text-sm font-medium text-yellow-800">Notes</p>
              <p className="text-sm text-yellow-700 mt-1">{job.notes}</p>
            </div>
          )}
        </div>

        {/* Photos */}
        {job.photos && job.photos.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-4">
            <h3 className="font-medium text-gray-900 mb-3">Photos</h3>

            <div className="space-y-4">
              {/* Before Photos */}
              {job.photos.filter(p => p.type === 'before').length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Before</p>
                  <div className="grid grid-cols-3 gap-2">
                    {job.photos.filter(p => p.type === 'before').map((photo) => (
                      <div key={photo.id} className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                        <img src={photo.url} alt="Before" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* After Photos */}
              {job.photos.filter(p => p.type === 'after').length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">After</p>
                  <div className="grid grid-cols-3 gap-2">
                    {job.photos.filter(p => p.type === 'after').map((photo) => (
                      <div key={photo.id} className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                        <img src={photo.url} alt="After" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pricing */}
        {(job.estimatedAmount || job.finalAmount) && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-4">
            <h3 className="font-medium text-gray-900 mb-3">Pricing</h3>
            <div className="grid grid-cols-2 gap-4">
              {job.estimatedAmount && (
                <div>
                  <dt className="text-sm text-gray-500">Estimated</dt>
                  <dd className="text-xl font-bold text-gray-900">${job.estimatedAmount.toFixed(2)}</dd>
                </div>
              )}
              {job.finalAmount && (
                <div>
                  <dt className="text-sm text-gray-500">Final</dt>
                  <dd className="text-xl font-bold text-green-600">${job.finalAmount.toFixed(2)}</dd>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-4">
          <h3 className="font-medium text-gray-900 mb-3">Timeline</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span className="text-gray-500">Accepted</span>
              <span className="ml-auto text-gray-700">
                {job.acceptedAt ? new Date(job.acceptedAt).toLocaleString() : 'N/A'}
              </span>
            </div>
            {job.scheduledDate && (
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                <span className="text-gray-500">Scheduled</span>
                <span className="ml-auto text-gray-700">
                  {new Date(job.scheduledDate).toLocaleDateString()}
                </span>
              </div>
            )}
            {job.completedAt && (
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-gray-500">Completed</span>
                <span className="ml-auto text-gray-700">
                  {new Date(job.completedAt).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Action Button */}
      {canUpdateStatus && actionLabel && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
          <div className="container mx-auto max-w-3xl">
            <button
              onClick={handleStatusUpdate}
              disabled={isUpdating}
              className="w-full py-3 px-4 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isUpdating && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {actionLabel}
            </button>
          </div>
        </div>
      )}

      {/* Complete Job Modal */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
          <div className="bg-white rounded-t-xl sm:rounded-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Complete Job</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Summary *</label>
                <textarea
                  value={completionData.summary}
                  onChange={(e) => setCompletionData({ ...completionData, summary: e.target.value })}
                  placeholder="Brief summary of work completed"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Work Performed *</label>
                <textarea
                  value={completionData.workPerformed}
                  onChange={(e) => setCompletionData({ ...completionData, workPerformed: e.target.value })}
                  placeholder="Detailed description of work performed"
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Materials Used</label>
                <textarea
                  value={completionData.materialsUsed}
                  onChange={(e) => setCompletionData({ ...completionData, materialsUsed: e.target.value })}
                  placeholder="List of materials used (optional)"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Final Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={completionData.finalAmount}
                  onChange={(e) => setCompletionData({ ...completionData, finalAmount: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCompleteModal(false)}
                disabled={isUpdating}
                className="flex-1 py-2 px-4 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleComplete}
                disabled={isUpdating || !completionData.summary || !completionData.workPerformed}
                className="flex-1 py-2 px-4 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdating ? 'Completing...' : 'Complete Job'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
