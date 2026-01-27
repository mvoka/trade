'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useJobsStore } from '@/lib/stores/jobs-store';
import { JobStatus } from '@/components/jobs/job-status';

export default function JobDetailPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.id as string;

  const { isAuthenticated, checkAuth } = useAuthStore();
  const { currentJob, isLoading, error, fetchJob, cancelJob, clearCurrentJob } = useJobsStore();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated && jobId) {
      fetchJob(jobId);
    }
    return () => clearCurrentJob();
  }, [isAuthenticated, jobId, fetchJob, clearCurrentJob]);

  const handleCancel = async () => {
    try {
      setIsCancelling(true);
      await cancelJob(jobId);
      setShowCancelConfirm(false);
    } catch (err) {
      console.error('Failed to cancel job:', err);
    } finally {
      setIsCancelling(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b">
          <div className="container mx-auto px-4 py-4 flex items-center gap-4">
            <Link href="/jobs" className="text-gray-500 hover:text-gray-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-xl font-bold">Job Details</h1>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
        </main>
      </div>
    );
  }

  if (!currentJob) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Job not found</p>
      </div>
    );
  }

  const job = currentJob;
  const canCancel = ['DRAFT', 'DISPATCHED'].includes(job.status);
  const canBook = job.status === 'ACCEPTED' && job.assignedPro && !job.booking;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/jobs" className="text-gray-500 hover:text-gray-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-xl font-bold">Job Details</h1>
          </div>
          <div className="flex items-center gap-2">
            {canBook && (
              <Link
                href={`/jobs/${job.id}/booking`}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-green-600 text-white hover:bg-green-700 h-9 px-4"
              >
                Book Appointment
              </Link>
            )}
            {canCancel && (
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-red-300 text-red-600 hover:bg-red-50 h-9 px-4"
              >
                Cancel Job
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="grid gap-6">
          {/* Status Card */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {job.title || `${job.serviceCategory?.name || 'Service'} Request`}
                </h2>
                <p className="text-sm text-gray-500">Job #{job.id.slice(0, 8)}</p>
              </div>
              <JobStatus status={job.status} size="large" />
            </div>

            {/* Progress Steps */}
            <div className="mt-6">
              <div className="flex items-center justify-between">
                {['DISPATCHED', 'ACCEPTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED'].map((step, idx) => {
                  const statuses = ['DISPATCHED', 'ACCEPTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED'];
                  const currentIdx = statuses.indexOf(job.status);
                  const isActive = idx <= currentIdx;
                  const isCurrent = step === job.status;

                  return (
                    <div key={step} className="flex-1 flex items-center">
                      <div className={`flex flex-col items-center ${idx > 0 ? 'w-full' : ''}`}>
                        {idx > 0 && (
                          <div className={`h-1 w-full ${isActive ? 'bg-green-500' : 'bg-gray-200'}`} />
                        )}
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                            isCurrent
                              ? 'bg-primary-600 text-white ring-4 ring-primary-100'
                              : isActive
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-200 text-gray-500'
                          }`}
                        >
                          {isActive && !isCurrent ? (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            idx + 1
                          )}
                        </div>
                        <span className="text-xs text-gray-500 mt-1 text-center">
                          {step.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Assigned Pro Card */}
          {job.assignedPro && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Assigned Professional</h3>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-xl font-medium text-gray-600">
                  {job.assignedPro.firstName?.[0] || 'P'}
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {job.assignedPro.businessName || `${job.assignedPro.firstName} ${job.assignedPro.lastName}`}
                  </p>
                  {job.assignedPro.rating && (
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      {job.assignedPro.rating.toFixed(1)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Booking Info */}
          {job.booking && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Appointment</h3>
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <div>
                  {job.booking.slotStart ? (
                    <>
                      <p className="font-medium text-gray-900">
                        {new Date(job.booking.slotStart).toLocaleDateString('en-CA', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(job.booking.slotStart).toLocaleTimeString('en-CA', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                        {job.booking.slotEnd && ` - ${new Date(job.booking.slotEnd).toLocaleTimeString('en-CA', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}`}
                      </p>
                    </>
                  ) : job.booking.windowStart ? (
                    <>
                      <p className="font-medium text-gray-900">Time Window</p>
                      <p className="text-sm text-gray-500">
                        {new Date(job.booking.windowStart).toLocaleDateString()} - {new Date(job.booking.windowEnd!).toLocaleDateString()}
                      </p>
                    </>
                  ) : null}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1 ${
                    job.booking.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
                    job.booking.status === 'PENDING_CONFIRMATION' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {job.booking.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Job Details */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Job Details</h3>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-gray-500">Service Category</dt>
                <dd className="font-medium text-gray-900">{job.serviceCategory?.name || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Urgency</dt>
                <dd className="font-medium text-gray-900 capitalize">{job.urgency.toLowerCase()}</dd>
              </div>
              <div className="md:col-span-2">
                <dt className="text-sm text-gray-500">Description</dt>
                <dd className="font-medium text-gray-900 whitespace-pre-wrap">{job.description}</dd>
              </div>
            </dl>
          </div>

          {/* Service Location */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Service Location</h3>
            <address className="not-italic text-gray-700">
              <p>{job.serviceAddressLine1}</p>
              {job.serviceAddressLine2 && <p>{job.serviceAddressLine2}</p>}
              <p>{job.serviceCity}, {job.serviceProvince} {job.servicePostalCode}</p>
            </address>
          </div>

          {/* Contact Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Contact Information</h3>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-gray-500">Name</dt>
                <dd className="font-medium text-gray-900">{job.contactName}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Phone</dt>
                <dd className="font-medium text-gray-900">{job.contactPhone}</dd>
              </div>
              {job.contactEmail && (
                <div>
                  <dt className="text-sm text-gray-500">Email</dt>
                  <dd className="font-medium text-gray-900">{job.contactEmail}</dd>
                </div>
              )}
              {job.businessName && (
                <div>
                  <dt className="text-sm text-gray-500">Business</dt>
                  <dd className="font-medium text-gray-900">{job.businessName}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Photos */}
          {job.attachments && job.attachments.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Photos</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {job.attachments.map((attachment) => (
                  <div key={attachment.id} className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                    <img
                      src={attachment.url}
                      alt={attachment.filename || 'Job photo'}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Cancel Job?</h3>
            <p className="text-gray-500 mb-6">
              Are you sure you want to cancel this job? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                disabled={isCancelling}
              >
                Keep Job
              </button>
              <button
                onClick={handleCancel}
                disabled={isCancelling}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
              >
                {isCancelling ? 'Cancelling...' : 'Cancel Job'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
