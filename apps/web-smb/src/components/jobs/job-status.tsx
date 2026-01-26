'use client';

import { cn } from '@/lib/utils';
import type { JobStatus } from '@trades/shared/types';

interface JobStatusBadgeProps {
  status: JobStatus;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig: Record<
  JobStatus,
  { label: string; bgColor: string; textColor: string; dotColor: string }
> = {
  DRAFT: {
    label: 'Draft',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-700',
    dotColor: 'bg-gray-500',
  },
  DISPATCHED: {
    label: 'Finding Pro',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-700',
    dotColor: 'bg-yellow-500',
  },
  ACCEPTED: {
    label: 'Pro Accepted',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    dotColor: 'bg-blue-500',
  },
  SCHEDULED: {
    label: 'Scheduled',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-700',
    dotColor: 'bg-purple-500',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-700',
    dotColor: 'bg-orange-500',
  },
  COMPLETED: {
    label: 'Completed',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
    dotColor: 'bg-green-500',
  },
  CANCELLED: {
    label: 'Cancelled',
    bgColor: 'bg-red-100',
    textColor: 'text-red-700',
    dotColor: 'bg-red-500',
  },
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-sm',
};

export function JobStatusBadge({ status, size = 'md' }: JobStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        config.bgColor,
        config.textColor,
        sizeClasses[size]
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dotColor)} />
      {config.label}
    </span>
  );
}

interface JobStatusTimelineProps {
  currentStatus: JobStatus;
}

const timelineSteps: Array<{ status: JobStatus; label: string }> = [
  { status: 'DRAFT', label: 'Created' },
  { status: 'DISPATCHED', label: 'Finding Pro' },
  { status: 'ACCEPTED', label: 'Accepted' },
  { status: 'SCHEDULED', label: 'Scheduled' },
  { status: 'IN_PROGRESS', label: 'In Progress' },
  { status: 'COMPLETED', label: 'Completed' },
];

const statusOrder: Record<JobStatus, number> = {
  DRAFT: 0,
  DISPATCHED: 1,
  ACCEPTED: 2,
  SCHEDULED: 3,
  IN_PROGRESS: 4,
  COMPLETED: 5,
  CANCELLED: -1,
};

export function JobStatusTimeline({ currentStatus }: JobStatusTimelineProps) {
  const currentIndex = statusOrder[currentStatus];

  if (currentStatus === 'CANCELLED') {
    return (
      <div className="flex items-center justify-center p-4 bg-red-50 rounded-lg">
        <span className="text-red-700 font-medium">This job has been cancelled</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex justify-between">
        {timelineSteps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isPending = index > currentIndex;

          return (
            <div key={step.status} className="flex flex-col items-center flex-1">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center border-2 z-10',
                  isCompleted && 'bg-green-500 border-green-500',
                  isCurrent && 'bg-primary-500 border-primary-500',
                  isPending && 'bg-white border-gray-300'
                )}
              >
                {isCompleted ? (
                  <svg
                    className="w-4 h-4 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : isCurrent ? (
                  <span className="w-2 h-2 bg-white rounded-full" />
                ) : (
                  <span className="w-2 h-2 bg-gray-300 rounded-full" />
                )}
              </div>
              <span
                className={cn(
                  'mt-2 text-xs text-center',
                  isCompleted && 'text-green-600 font-medium',
                  isCurrent && 'text-primary-600 font-medium',
                  isPending && 'text-gray-400'
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
      {/* Progress line */}
      <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200 -z-10">
        <div
          className="h-full bg-green-500 transition-all duration-500"
          style={{
            width: `${(currentIndex / (timelineSteps.length - 1)) * 100}%`,
          }}
        />
      </div>
    </div>
  );
}
