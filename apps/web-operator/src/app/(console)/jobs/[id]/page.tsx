'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { operatorApi, JobDetails, Pro, InternalNote, DispatchAttempt, ContactType } from '@/lib/api';

export default function JobDetailPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.id as string;

  const [job, setJob] = useState<JobDetails | null>(null);
  const [availablePros, setAvailablePros] = useState<Pro[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [selectedPro, setSelectedPro] = useState<Pro | null>(null);
  const [dispatchNote, setDispatchNote] = useState('');
  const [newNote, setNewNote] = useState('');
  const [contactTarget, setContactTarget] = useState<'smb' | 'pro'>('smb');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadJob();
  }, [jobId]);

  const loadJob = async () => {
    setIsLoading(true);
    try {
      const [jobRes, prosRes] = await Promise.all([
        operatorApi.getJob(jobId),
        operatorApi.getAvailablePros(jobId),
      ]);
      setJob(jobRes);
      setAvailablePros(prosRes);
    } catch (error) {
      console.error('Failed to load job:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDispatch = async () => {
    if (!selectedPro) return;
    setIsProcessing(true);
    try {
      await operatorApi.manualDispatch(jobId, selectedPro.id, dispatchNote || undefined);
      setShowDispatchModal(false);
      setSelectedPro(null);
      setDispatchNote('');
      loadJob();
    } catch (error) {
      console.error('Failed to dispatch:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setIsProcessing(true);
    try {
      await operatorApi.addJobNote(jobId, newNote);
      setNewNote('');
      loadJob();
    } catch (error) {
      console.error('Failed to add note:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleContact = async (type: ContactType) => {
    setIsProcessing(true);
    try {
      await operatorApi.initiateContact(jobId, type, contactTarget);
      setShowContactModal(false);
    } catch (error) {
      console.error('Failed to initiate contact:', error);
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

  if (isLoading || !job) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">Job #{job.referenceNumber}</h1>
              <span className={`px-2 py-0.5 text-sm font-medium rounded ${getUrgencyColor(job.urgency)}`}>
                {job.urgency}
              </span>
              {job.escalated && (
                <span className="px-2 py-0.5 text-sm font-medium rounded bg-orange-100 text-orange-800">
                  ESCALATED
                </span>
              )}
            </div>
            <p className="text-gray-500">{job.trade} • {job.location.city}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowContactModal(true)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Contact
          </button>
          <button
            onClick={() => setShowDispatchModal(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
          >
            Manual Dispatch
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Job Info */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Job Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <p className="font-medium text-gray-900">{job.status.replace('_', ' ')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">SLA</p>
                <p className={`font-medium ${job.slaPercentage <= 20 ? 'text-red-600' : 'text-green-600'}`}>
                  {job.slaPercentage}% remaining
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">SMB</p>
                <p className="font-medium text-gray-900">{job.smbName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Contact</p>
                <p className="font-medium text-gray-900">{job.smbPhone}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-gray-500">Address</p>
                <p className="font-medium text-gray-900">{job.address}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-gray-500">Description</p>
                <p className="text-gray-700">{job.description}</p>
              </div>
            </div>
          </div>

          {/* Dispatch History */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Dispatch History</h2>
            {job.dispatchAttempts.length === 0 ? (
              <p className="text-gray-500">No dispatch attempts yet.</p>
            ) : (
              <div className="space-y-3">
                {job.dispatchAttempts.map((attempt, idx) => (
                  <div key={attempt.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{attempt.proName}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(attempt.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                        attempt.status === 'ACCEPTED' ? 'bg-green-100 text-green-800' :
                        attempt.status === 'DECLINED' ? 'bg-red-100 text-red-800' :
                        attempt.status === 'TIMEOUT' ? 'bg-orange-100 text-orange-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {attempt.status}
                      </span>
                      {attempt.declineReason && (
                        <p className="text-xs text-gray-500 mt-1">{attempt.declineReason}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Internal Notes */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Internal Notes</h2>
            <div className="space-y-3 mb-4">
              {job.notes.length === 0 ? (
                <p className="text-gray-500">No notes yet.</p>
              ) : (
                job.notes.map((note) => (
                  <div key={note.id} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-gray-700">{note.content}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      {note.authorName} • {new Date(note.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                onClick={handleAddNote}
                disabled={!newNote.trim() || isProcessing}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Assigned Pro */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Assigned Pro</h2>
            {job.assignedProId ? (
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-primary-600 font-medium">
                    {job.assignedProName?.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">{job.assignedProName}</p>
                  <p className="text-sm text-gray-500">Assigned</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-500 mb-3">No pro assigned</p>
                <button
                  onClick={() => setShowDispatchModal(true)}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
                >
                  Assign Pro
                </button>
              </div>
            )}
          </div>

          {/* Job History */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Activity</h2>
            <div className="space-y-3">
              {job.history.slice(0, 10).map((entry) => (
                <div key={entry.id} className="flex gap-3 text-sm">
                  <div className="w-2 h-2 mt-1.5 rounded-full bg-gray-400 flex-shrink-0" />
                  <div>
                    <p className="text-gray-700">{entry.action}</p>
                    <p className="text-xs text-gray-500">
                      {entry.actor} • {new Date(entry.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Manual Dispatch Modal */}
      {showDispatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Manual Dispatch</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Pro</label>
                {availablePros.length === 0 ? (
                  <p className="text-gray-500">No available pros for this job.</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {availablePros.map((pro) => (
                      <label
                        key={pro.id}
                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer ${
                          selectedPro?.id === pro.id
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="pro"
                            checked={selectedPro?.id === pro.id}
                            onChange={() => setSelectedPro(pro)}
                            className="text-primary-600 focus:ring-primary-500"
                          />
                          <div>
                            <p className="font-medium text-gray-900">{pro.name}</p>
                            <p className="text-sm text-gray-500">
                              {pro.distance?.toFixed(1)}km • {pro.completedJobs} jobs • {pro.rating}★
                            </p>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                          pro.available ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {pro.currentJobCount} active
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
                <textarea
                  value={dispatchNote}
                  onChange={(e) => setDispatchNote(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Add dispatch note..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowDispatchModal(false);
                  setSelectedPro(null);
                  setDispatchNote('');
                }}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDispatch}
                disabled={!selectedPro || isProcessing}
                className="flex-1 py-2 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {isProcessing ? 'Dispatching...' : 'Dispatch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Contact</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Contact Who?</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setContactTarget('smb')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium ${
                    contactTarget === 'smb'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  SMB ({job.smbName})
                </button>
                <button
                  onClick={() => setContactTarget('pro')}
                  disabled={!job.assignedProId}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium ${
                    contactTarget === 'pro'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } disabled:opacity-50`}
                >
                  Pro {job.assignedProName ? `(${job.assignedProName})` : '(None)'}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => handleContact('CALL')}
                disabled={isProcessing}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Call
              </button>
              <button
                onClick={() => handleContact('SMS')}
                disabled={isProcessing}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                SMS
              </button>
              <button
                onClick={() => handleContact('EMAIL')}
                disabled={isProcessing}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Email
              </button>
            </div>

            <button
              onClick={() => setShowContactModal(false)}
              className="w-full mt-4 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
