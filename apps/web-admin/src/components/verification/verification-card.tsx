'use client';

import React from 'react';
import { clsx } from 'clsx';
import { format } from 'date-fns';

export interface VerificationDocument {
  id: string;
  type: 'LICENSE' | 'INSURANCE' | 'CERTIFICATION' | 'BACKGROUND_CHECK' | 'IDENTITY' | 'OTHER';
  name: string;
  url: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  uploadedAt: string;
  expiresAt?: string;
  notes?: string;
}

export interface VerificationRequest {
  id: string;
  proId: string;
  proName: string;
  proEmail: string;
  proPhone?: string;
  profileImageUrl?: string;
  businessName?: string;
  category: string;
  submittedAt: string;
  status: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'MORE_INFO_NEEDED';
  documents: VerificationDocument[];
  notes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

interface VerificationCardProps {
  verification: VerificationRequest;
  onReview: (id: string) => void;
  onQuickApprove?: (id: string) => void;
  onQuickReject?: (id: string) => void;
  compact?: boolean;
}

const statusStyles = {
  PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' },
  IN_REVIEW: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'In Review' },
  APPROVED: { bg: 'bg-green-100', text: 'text-green-800', label: 'Approved' },
  REJECTED: { bg: 'bg-red-100', text: 'text-red-800', label: 'Rejected' },
  MORE_INFO_NEEDED: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'More Info Needed' },
};

const documentTypeLabels = {
  LICENSE: 'License',
  INSURANCE: 'Insurance',
  CERTIFICATION: 'Certification',
  BACKGROUND_CHECK: 'Background Check',
  IDENTITY: 'Identity',
  OTHER: 'Other',
};

export function VerificationCard({
  verification,
  onReview,
  onQuickApprove,
  onQuickReject,
  compact = false,
}: VerificationCardProps) {
  const status = statusStyles[verification.status];
  const pendingDocs = verification.documents.filter((d) => d.status === 'PENDING').length;
  const approvedDocs = verification.documents.filter((d) => d.status === 'APPROVED').length;
  const totalDocs = verification.documents.length;

  if (compact) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {verification.profileImageUrl ? (
              <img
                src={verification.profileImageUrl}
                alt={verification.proName}
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-admin-100 flex items-center justify-center">
                <span className="text-admin-600 font-medium">
                  {verification.proName.charAt(0)}
                </span>
              </div>
            )}
            <div>
              <p className="font-medium text-gray-900">{verification.proName}</p>
              <p className="text-sm text-gray-500">{verification.category}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span
              className={clsx(
                'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
                status.bg,
                status.text
              )}
            >
              {status.label}
            </span>
            <button
              onClick={() => onReview(verification.id)}
              className="text-admin-600 hover:text-admin-800 text-sm font-medium"
            >
              Review
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {verification.profileImageUrl ? (
              <img
                src={verification.profileImageUrl}
                alt={verification.proName}
                className="h-14 w-14 rounded-full object-cover ring-2 ring-white"
              />
            ) : (
              <div className="h-14 w-14 rounded-full bg-admin-100 flex items-center justify-center ring-2 ring-white">
                <span className="text-admin-600 font-bold text-lg">
                  {verification.proName.charAt(0)}
                </span>
              </div>
            )}
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{verification.proName}</h3>
              {verification.businessName && (
                <p className="text-sm text-gray-600">{verification.businessName}</p>
              )}
              <div className="flex items-center space-x-3 mt-1">
                <span className="text-sm text-gray-500">{verification.proEmail}</span>
                {verification.proPhone && (
                  <>
                    <span className="text-gray-300">|</span>
                    <span className="text-sm text-gray-500">{verification.proPhone}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <span
            className={clsx(
              'inline-flex items-center rounded-full px-3 py-1 text-sm font-medium',
              status.bg,
              status.text
            )}
          >
            {status.label}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="px-6 py-4">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-500">Category</p>
            <p className="font-medium text-gray-900">{verification.category}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Submitted</p>
            <p className="font-medium text-gray-900">
              {format(new Date(verification.submittedAt), 'MMM d, yyyy h:mm a')}
            </p>
          </div>
        </div>

        {/* Documents Summary */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">Documents</p>
            <span className="text-sm text-gray-500">
              {approvedDocs}/{totalDocs} approved
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {verification.documents.map((doc) => (
              <div
                key={doc.id}
                className={clsx(
                  'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium',
                  doc.status === 'APPROVED' && 'bg-green-100 text-green-700',
                  doc.status === 'REJECTED' && 'bg-red-100 text-red-700',
                  doc.status === 'PENDING' && 'bg-yellow-100 text-yellow-700'
                )}
              >
                {documentTypeLabels[doc.type]}
                {doc.status === 'APPROVED' && (
                  <svg className="ml-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                {doc.status === 'REJECTED' && (
                  <svg className="ml-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        {verification.notes && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">{verification.notes}</p>
          </div>
        )}

        {/* Progress bar */}
        <div className="mb-4">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${(approvedDocs / totalDocs) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {pendingDocs > 0 ? (
              <span className="text-yellow-600 font-medium">
                {pendingDocs} document{pendingDocs > 1 ? 's' : ''} pending review
              </span>
            ) : (
              <span className="text-green-600 font-medium">All documents reviewed</span>
            )}
          </div>
          <div className="flex items-center space-x-3">
            {onQuickReject && verification.status === 'PENDING' && (
              <button
                onClick={() => onQuickReject(verification.id)}
                className="px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
              >
                Reject
              </button>
            )}
            {onQuickApprove && verification.status === 'PENDING' && approvedDocs === totalDocs && (
              <button
                onClick={() => onQuickApprove(verification.id)}
                className="px-3 py-1.5 text-sm font-medium text-green-600 hover:text-green-800 hover:bg-green-50 rounded-md transition-colors"
              >
                Quick Approve
              </button>
            )}
            <button
              onClick={() => onReview(verification.id)}
              className="px-4 py-2 bg-admin-600 text-white text-sm font-medium rounded-lg hover:bg-admin-700 transition-colors"
            >
              Review Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VerificationCard;
