'use client';

import Link from 'next/link';
import { JobStatusBadge } from './job-status';
import { cn, formatDate, truncate } from '@/lib/utils';
import type { Job } from '@/lib/stores/jobs-store';

interface JobCardProps {
  job: Job;
  variant?: 'default' | 'compact';
}

export function JobCard({ job, variant = 'default' }: JobCardProps) {
  const isCompact = variant === 'compact';

  // Anonymize pro info if job is not yet accepted
  const showProInfo = job.status !== 'DISPATCHED' && job.assignedPro;

  return (
    <Link
      href={`/jobs/${job.id}`}
      className={cn(
        'block rounded-lg border bg-white hover:shadow-md transition-shadow',
        isCompact ? 'p-4' : 'p-6'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <JobStatusBadge status={job.status} size={isCompact ? 'sm' : 'md'} />
            {job.urgency !== 'NORMAL' && (
              <span
                className={cn(
                  'px-2 py-0.5 text-xs font-medium rounded-full',
                  job.urgency === 'EMERGENCY' && 'bg-red-100 text-red-700',
                  job.urgency === 'HIGH' && 'bg-orange-100 text-orange-700',
                  job.urgency === 'LOW' && 'bg-gray-100 text-gray-600'
                )}
              >
                {job.urgency}
              </span>
            )}
          </div>
          <h3 className={cn('font-semibold text-gray-900', isCompact ? 'text-sm' : 'text-lg')}>
            {job.title || job.serviceCategory?.name || 'Untitled Job'}
          </h3>
          <p className={cn('text-gray-500 mt-1', isCompact ? 'text-xs' : 'text-sm')}>
            {truncate(job.description, isCompact ? 60 : 100)}
          </p>
        </div>

        {!isCompact && job.attachments?.length > 0 && (
          <div className="flex-shrink-0">
            <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100">
              <img
                src={job.attachments[0].url}
                alt="Job photo"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        )}
      </div>

      <div className={cn('flex items-center gap-4 text-gray-500', isCompact ? 'mt-3' : 'mt-4')}>
        <div className="flex items-center gap-1">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <span className="text-xs">
            {job.serviceCity}, {job.serviceProvince}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span className="text-xs">{formatDate(job.createdAt)}</span>
        </div>
      </div>

      {showProInfo && !isCompact && (
        <div className="mt-4 pt-4 border-t flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
            {job.assignedPro?.avatarUrl ? (
              <img
                src={job.assignedPro.avatarUrl}
                alt={job.assignedPro.firstName}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span className="text-primary-700 font-medium text-sm">
                {job.assignedPro?.firstName?.[0]}
                {job.assignedPro?.lastName?.[0]}
              </span>
            )}
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-900 text-sm">
              {job.assignedPro?.businessName ||
                `${job.assignedPro?.firstName} ${job.assignedPro?.lastName}`}
            </p>
            {job.assignedPro?.rating && (
              <div className="flex items-center gap-1">
                <svg className="h-4 w-4 text-yellow-400 fill-current" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-sm text-gray-600">{job.assignedPro.rating.toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {job.status === 'DISPATCHED' && !isCompact && (
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center gap-2 text-yellow-700 bg-yellow-50 px-3 py-2 rounded-lg">
            <svg className="h-5 w-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <span className="text-sm font-medium">Finding available professionals...</span>
          </div>
        </div>
      )}

      {job.booking && !isCompact && (
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center gap-2 text-purple-700 bg-purple-50 px-3 py-2 rounded-lg">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="text-sm font-medium">
              Scheduled:{' '}
              {job.booking.slotStart
                ? formatDate(job.booking.slotStart)
                : job.booking.windowStart
                ? formatDate(job.booking.windowStart)
                : 'Pending'}
            </span>
          </div>
        </div>
      )}
    </Link>
  );
}

export function JobCardSkeleton({ variant = 'default' }: { variant?: 'default' | 'compact' }) {
  const isCompact = variant === 'compact';

  return (
    <div
      className={cn(
        'rounded-lg border bg-white animate-pulse',
        isCompact ? 'p-4' : 'p-6'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="h-6 w-24 bg-gray-200 rounded-full mb-2" />
          <div className={cn('bg-gray-200 rounded', isCompact ? 'h-4 w-48' : 'h-5 w-64')} />
          <div className={cn('bg-gray-200 rounded mt-2', isCompact ? 'h-3 w-32' : 'h-4 w-48')} />
        </div>
        {!isCompact && <div className="w-20 h-20 bg-gray-200 rounded-lg" />}
      </div>
      <div className="flex items-center gap-4 mt-4">
        <div className="h-4 w-24 bg-gray-200 rounded" />
        <div className="h-4 w-20 bg-gray-200 rounded" />
      </div>
    </div>
  );
}
