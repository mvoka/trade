'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { operatorApi, Job, EscalationAction } from '@/lib/api';

export default function EscalationsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [action, setAction] = useState<EscalationAction>('REASSIGN');
  const [note, setNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadEscalations();
  }, []);

  const loadEscalations = async () => {
    setIsLoading(true);
    try {
      const response = await operatorApi.getEscalatedJobs({ limit: 50 });
      setJobs(response.data);
    } catch (error) {
      console.error('Failed to load escalations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async () => {
    if (!selectedJob || !note) return;
    setIsProcessing(true);
    try {
      await operatorApi.overrideEscalation(selectedJob.id, action, note);
      setShowActionModal(false);
      setSelectedJob(null);
      setNote('');
      loadEscalations();
    } catch (error) {
      console.error('Failed to handle escalation:', error);
    } finally {
      setIsProcessing(false);
    }
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
          <h1 className="text-2xl font-bold text-gray-900">Escalations</h1>
          <p className="text-gray-500">Jobs requiring operator intervention.</p>
        </div>
        <button
          onClick={loadEscalations}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Escalations List */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">Loading escalations...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Escalations</h3>
            <p className="text-gray-500">All jobs are proceeding normally.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {jobs.map((job) => (
              <div key={job.id} className="p-4 hover:bg-orange-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${getUrgencyColor(job.urgency)}`}>
                        {job.urgency}
                      </span>
                      <span className="font-medium text-gray-900">#{job.referenceNumber}</span>
                      <span className="text-sm text-gray-500">{job.trade}</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{job.smbName} • {job.location.city}</p>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-orange-600">
                        <svg className="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Escalated
                      </span>
                      <span className="text-gray-500">
                        SLA: {Math.max(0, job.slaPercentage)}% remaining
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/jobs/${job.id}`}
                      className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      View Details
                    </Link>
                    <button
                      onClick={() => {
                        setSelectedJob(job);
                        setShowActionModal(true);
                      }}
                      className="px-3 py-1.5 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700"
                    >
                      Take Action
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Modal */}
      {showActionModal && selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Handle Escalation</h3>
            <p className="text-sm text-gray-500 mb-4">
              Job #{selectedJob.referenceNumber} - {selectedJob.smbName}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Action</label>
                <div className="space-y-2">
                  {[
                    { value: 'REASSIGN', label: 'Reassign to New Pro', desc: 'Find and dispatch to another available pro' },
                    { value: 'RESOLVE', label: 'Mark as Resolved', desc: 'Issue has been addressed manually' },
                    { value: 'ESCALATE_FURTHER', label: 'Escalate to Manager', desc: 'Requires management attention' },
                    { value: 'CANCEL', label: 'Cancel Job', desc: 'Job cannot be fulfilled' },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        action === opt.value ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="action"
                        value={opt.value}
                        checked={action === opt.value}
                        onChange={(e) => setAction(e.target.value as EscalationAction)}
                        className="mt-0.5 text-primary-600 focus:ring-primary-500"
                      />
                      <div>
                        <p className="font-medium text-gray-900">{opt.label}</p>
                        <p className="text-sm text-gray-500">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note *</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Explain the action taken..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowActionModal(false);
                  setSelectedJob(null);
                  setNote('');
                }}
                disabled={isProcessing}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAction}
                disabled={isProcessing || !note}
                className="flex-1 py-2 px-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
              >
                {isProcessing ? 'Processing...' : 'Confirm Action'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
