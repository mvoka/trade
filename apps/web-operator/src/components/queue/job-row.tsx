'use client';

import Link from 'next/link';
import { Job } from '@/lib/api';
import { SlaBadgeCompact, SlaStatusDot } from './sla-badge';
import { formatDistanceToNow } from '@/lib/utils';

interface JobRowProps {
  job: Job;
  onSelect?: (job: Job) => void;
  isSelected?: boolean;
}

export function JobRow({ job, onSelect, isSelected }: JobRowProps) {
  const statusColors: Record<string, string> = {
    PENDING: 'bg-gray-100 text-gray-800',
    DISPATCHING: 'bg-blue-100 text-blue-800',
    ASSIGNED: 'bg-indigo-100 text-indigo-800',
    ACCEPTED: 'bg-purple-100 text-purple-800',
    EN_ROUTE: 'bg-cyan-100 text-cyan-800',
    ON_SITE: 'bg-teal-100 text-teal-800',
    COMPLETED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-gray-100 text-gray-500',
    ESCALATED: 'bg-red-100 text-red-800',
  };

  const urgencyColors: Record<string, string> = {
    LOW: 'text-gray-500',
    MEDIUM: 'text-yellow-600',
    HIGH: 'text-orange-600',
    EMERGENCY: 'text-red-600',
  };

  const urgencyIcons: Record<string, string> = {
    LOW: '',
    MEDIUM: '!',
    HIGH: '!!',
    EMERGENCY: '!!!',
  };

  return (
    <tr
      className={`hover:bg-gray-50 cursor-pointer transition-colors ${
        isSelected ? 'bg-primary-50' : ''
      } ${job.slaPercentage >= 80 ? 'bg-red-50 hover:bg-red-100' : ''}`}
      onClick={() => onSelect?.(job)}
    >
      {/* SLA Status */}
      <td className="px-4 py-3 whitespace-nowrap">
        <SlaStatusDot percentage={job.slaPercentage} />
      </td>

      {/* Reference & SMB */}
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <Link
            href={`/jobs/${job.id}`}
            className="text-sm font-medium text-primary-600 hover:text-primary-800 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {job.referenceNumber}
          </Link>
          <span className="text-sm text-gray-500">{job.smbName}</span>
        </div>
      </td>

      {/* Trade */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="text-sm text-gray-900">{job.trade}</span>
      </td>

      {/* Status */}
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center space-x-2">
          <span
            className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
              statusColors[job.status] || 'bg-gray-100 text-gray-800'
            }`}
          >
            {job.status.replace('_', ' ')}
          </span>
          {job.escalated && (
            <span className="inline-flex px-1.5 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-800">
              ESC
            </span>
          )}
        </div>
      </td>

      {/* Urgency */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={`text-sm font-medium ${urgencyColors[job.urgency]}`}>
          {job.urgency}
          {urgencyIcons[job.urgency] && (
            <span className="ml-0.5">{urgencyIcons[job.urgency]}</span>
          )}
        </span>
      </td>

      {/* SLA Progress */}
      <td className="px-4 py-3 whitespace-nowrap">
        <SlaBadgeCompact percentage={job.slaPercentage} />
      </td>

      {/* Assigned Pro */}
      <td className="px-4 py-3 whitespace-nowrap">
        {job.assignedProName ? (
          <span className="text-sm text-gray-900">{job.assignedProName}</span>
        ) : (
          <span className="text-sm text-gray-400 italic">Unassigned</span>
        )}
      </td>

      {/* Location */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="text-sm text-gray-500">
          {job.location.city}, {job.location.state}
        </span>
      </td>

      {/* Created */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="text-sm text-gray-500">
          {formatDistanceToNow(new Date(job.createdAt))}
        </span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3 whitespace-nowrap text-right">
        <div className="flex items-center justify-end space-x-2">
          <Link
            href={`/jobs/${job.id}`}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            onClick={(e) => e.stopPropagation()}
            title="View details"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
          </Link>
          <Link
            href={`/jobs/${job.id}/dispatch`}
            className="p-1 text-gray-400 hover:text-primary-600 transition-colors"
            onClick={(e) => e.stopPropagation()}
            title="Manual dispatch"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </Link>
        </div>
      </td>
    </tr>
  );
}

// Compact job card for mobile / list views
export function JobCard({ job, onClick }: { job: Job; onClick?: () => void }) {
  return (
    <div
      className={`bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer ${
        job.slaPercentage >= 80 ? 'border-red-300 bg-red-50' : 'border-gray-200'
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <Link
            href={`/jobs/${job.id}`}
            className="text-sm font-medium text-primary-600 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {job.referenceNumber}
          </Link>
          <p className="text-sm text-gray-900">{job.smbName}</p>
        </div>
        <SlaStatusDot percentage={job.slaPercentage} />
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-800">
          {job.trade}
        </span>
        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
          job.status === 'ESCALATED' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
        }`}>
          {job.status.replace('_', ' ')}
        </span>
        {job.escalated && (
          <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-800">
            Escalated
          </span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <SlaBadgeCompact percentage={job.slaPercentage} />
        <span className="text-xs text-gray-500">
          {formatDistanceToNow(new Date(job.createdAt))}
        </span>
      </div>
    </div>
  );
}
