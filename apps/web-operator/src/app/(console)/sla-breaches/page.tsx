'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { operatorApi, SlaBreachJob } from '@/lib/api';

export default function SlaBreachesPage() {
  const [jobs, setJobs] = useState<SlaBreachJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'warning' | 'breach'>('all');

  useEffect(() => {
    loadBreaches();
  }, [filter]);

  const loadBreaches = async () => {
    setIsLoading(true);
    try {
      const params = filter !== 'all' ? { severity: filter } : undefined;
      const response = await operatorApi.getSlaBreaches(params);
      setJobs(response.data);
    } catch (error) {
      console.error('Failed to load SLA breaches:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'EMERGENCY': return 'text-red-600 bg-red-100';
      case 'HIGH': return 'text-orange-600 bg-orange-100';
      case 'MEDIUM': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SLA Breaches</h1>
          <p className="text-gray-500">Jobs that have breached or are at risk of breaching SLA.</p>
        </div>
        <button
          onClick={loadBreaches}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex gap-2">
          {[
            { value: 'all', label: 'All' },
            { value: 'warning', label: 'Warnings' },
            { value: 'breach', label: 'Breached' },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === tab.value
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Breaches List */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">Loading SLA data...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No SLA Issues</h3>
            <p className="text-gray-500">All jobs are within SLA targets.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {jobs.map((job) => (
              <div
                key={job.id}
                className={`p-4 ${job.slaPercentage <= 0 ? 'bg-red-50' : 'bg-orange-50'}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {job.slaPercentage <= 0 ? (
                        <span className="px-2 py-0.5 text-xs font-medium rounded bg-red-600 text-white">
                          BREACHED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs font-medium rounded bg-orange-600 text-white">
                          WARNING
                        </span>
                      )}
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${getUrgencyColor(job.urgency)}`}>
                        {job.urgency}
                      </span>
                      <span className="font-medium text-gray-900">#{job.referenceNumber}</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      {job.trade} • {job.smbName} • {job.location.city}
                    </p>
                    <div className="flex items-center gap-4 text-sm">
                      {job.slaPercentage <= 0 ? (
                        <span className="text-red-600 font-medium">
                          <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Breached {formatDuration(job.breachDuration)} ago
                        </span>
                      ) : (
                        <span className="text-orange-600 font-medium">
                          <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {job.slaPercentage}% remaining
                        </span>
                      )}
                      <span className="text-gray-500">
                        Status: {job.status.replace('_', ' ')}
                      </span>
                      {job.assignedProName && (
                        <span className="text-gray-500">
                          Assigned: {job.assignedProName}
                        </span>
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/jobs/${job.id}`}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
                  >
                    Take Action
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
