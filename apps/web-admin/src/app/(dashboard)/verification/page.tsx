'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';

interface Verification {
  id: string;
  proName: string;
  proEmail: string;
  businessName: string;
  trade: string;
  submittedAt: string;
  status: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'NEEDS_INFO';
  documents: {
    type: string;
    url: string;
    uploadedAt: string;
  }[];
}

const statusColors: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  IN_REVIEW: { bg: 'bg-blue-100', text: 'text-blue-800' },
  APPROVED: { bg: 'bg-green-100', text: 'text-green-800' },
  REJECTED: { bg: 'bg-red-100', text: 'text-red-800' },
  NEEDS_INFO: { bg: 'bg-orange-100', text: 'text-orange-800' },
};

export default function VerificationPage() {
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVerification, setSelectedVerification] = useState<Verification | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [filter, setFilter] = useState<string>('PENDING');

  useEffect(() => {
    loadVerifications();
  }, [filter]);

  const loadVerifications = async () => {
    setIsLoading(true);
    try {
      const response = await adminApi.getPendingVerifications({ status: filter });
      setVerifications(response.data.data || []);
    } catch (error) {
      console.error('Failed to load verifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedVerification) return;
    setIsProcessing(true);
    try {
      await adminApi.approveVerification(selectedVerification.id, { notes });
      setShowApproveModal(false);
      setSelectedVerification(null);
      setNotes('');
      loadVerifications();
    } catch (error) {
      console.error('Failed to approve:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedVerification || !rejectReason) return;
    setIsProcessing(true);
    try {
      await adminApi.rejectVerification(selectedVerification.id, { reason: rejectReason, notes });
      setShowRejectModal(false);
      setSelectedVerification(null);
      setRejectReason('');
      setNotes('');
      loadVerifications();
    } catch (error) {
      console.error('Failed to reject:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pro Verifications</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review and approve contractor applications.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {['PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${
                filter === status
                  ? 'border-admin-500 text-admin-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              {status.replace('_', ' ')}
            </button>
          ))}
        </nav>
      </div>

      {/* Verifications List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">Loading verifications...</p>
          </div>
        ) : verifications.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No verifications with status "{filter.replace('_', ' ')}"
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contractor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trade
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Documents
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Submitted
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {verifications.map((verification) => (
                <tr key={verification.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{verification.proName}</div>
                      <div className="text-sm text-gray-500">{verification.businessName}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {verification.trade}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex -space-x-1">
                      {verification.documents.slice(0, 3).map((doc, idx) => (
                        <div
                          key={idx}
                          className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600 border-2 border-white"
                          title={doc.type}
                        >
                          {doc.type.charAt(0).toUpperCase()}
                        </div>
                      ))}
                      {verification.documents.length > 3 && (
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-500 border-2 border-white">
                          +{verification.documents.length - 3}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(verification.submittedAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusColors[verification.status].bg} ${statusColors[verification.status].text}`}>
                      {verification.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {verification.status === 'PENDING' || verification.status === 'IN_REVIEW' ? (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => {
                            setSelectedVerification(verification);
                            setShowApproveModal(true);
                          }}
                          className="text-green-600 hover:text-green-900"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            setSelectedVerification(verification);
                            setShowRejectModal(true);
                          }}
                          className="text-red-600 hover:text-red-900"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <button className="text-gray-600 hover:text-gray-900">View</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Approve Modal */}
      {showApproveModal && selectedVerification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Approve Contractor</h3>
            <p className="text-sm text-gray-500 mb-4">
              You are about to approve <strong>{selectedVerification.proName}</strong> ({selectedVerification.businessName}).
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                placeholder="Add any notes..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowApproveModal(false);
                  setSelectedVerification(null);
                  setNotes('');
                }}
                disabled={isProcessing}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={isProcessing}
                className="flex-1 py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {isProcessing ? 'Approving...' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedVerification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Reject Contractor</h3>
            <p className="text-sm text-gray-500 mb-4">
              Please provide a reason for rejecting <strong>{selectedVerification.proName}</strong>.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
              <select
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
              >
                <option value="">Select a reason...</option>
                <option value="incomplete_documents">Incomplete documents</option>
                <option value="invalid_license">Invalid or expired license</option>
                <option value="insurance_issue">Insurance issues</option>
                <option value="failed_background">Failed background check</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                placeholder="Additional notes..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedVerification(null);
                  setRejectReason('');
                  setNotes('');
                }}
                disabled={isProcessing}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={isProcessing || !rejectReason}
                className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isProcessing ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
