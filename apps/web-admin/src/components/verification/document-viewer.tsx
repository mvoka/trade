'use client';

import React, { useState } from 'react';
import { clsx } from 'clsx';
import { format } from 'date-fns';

export interface Document {
  id: string;
  type: 'LICENSE' | 'INSURANCE' | 'CERTIFICATION' | 'BACKGROUND_CHECK' | 'IDENTITY' | 'OTHER';
  name: string;
  url: string;
  mimeType?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  uploadedAt: string;
  expiresAt?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

interface DocumentViewerProps {
  documents: Document[];
  onApprove: (docId: string, notes?: string) => void;
  onReject: (docId: string, reason: string) => void;
  onRequestReupload: (docId: string, message: string) => void;
  readOnly?: boolean;
}

const documentTypeLabels: Record<Document['type'], string> = {
  LICENSE: 'Professional License',
  INSURANCE: 'Insurance Certificate',
  CERTIFICATION: 'Certification',
  BACKGROUND_CHECK: 'Background Check',
  IDENTITY: 'Identity Document',
  OTHER: 'Other Document',
};

const statusConfig = {
  PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
  APPROVED: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
  REJECTED: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
};

export function DocumentViewer({
  documents,
  onApprove,
  onReject,
  onRequestReupload,
  readOnly = false,
}: DocumentViewerProps) {
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(documents[0] || null);
  const [rejectReason, setRejectReason] = useState('');
  const [reuploadMessage, setReuploadMessage] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showReuploadModal, setShowReuploadModal] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [zoom, setZoom] = useState(1);

  const handleApprove = () => {
    if (selectedDoc) {
      onApprove(selectedDoc.id, approvalNotes || undefined);
      setApprovalNotes('');
    }
  };

  const handleReject = () => {
    if (selectedDoc && rejectReason) {
      onReject(selectedDoc.id, rejectReason);
      setRejectReason('');
      setShowRejectModal(false);
    }
  };

  const handleRequestReupload = () => {
    if (selectedDoc && reuploadMessage) {
      onRequestReupload(selectedDoc.id, reuploadMessage);
      setReuploadMessage('');
      setShowReuploadModal(false);
    }
  };

  const isImage = (mimeType?: string) => {
    return mimeType?.startsWith('image/') || selectedDoc?.url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
  };

  const isPdf = (mimeType?: string) => {
    return mimeType === 'application/pdf' || selectedDoc?.url.endsWith('.pdf');
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      {/* Document List */}
      <div className="lg:w-72 flex-shrink-0">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Documents</h3>
        <div className="space-y-2">
          {documents.map((doc) => {
            const statusStyle = statusConfig[doc.status];
            return (
              <button
                key={doc.id}
                onClick={() => setSelectedDoc(doc)}
                className={clsx(
                  'w-full text-left p-3 rounded-lg border-2 transition-all',
                  selectedDoc?.id === doc.id
                    ? 'border-admin-500 bg-admin-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900">
                    {documentTypeLabels[doc.type]}
                  </span>
                  <span
                    className={clsx(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                      statusStyle.bg,
                      statusStyle.text
                    )}
                  >
                    {doc.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate">{doc.name}</p>
                {doc.expiresAt && (
                  <p className="text-xs text-gray-400 mt-1">
                    Expires: {format(new Date(doc.expiresAt), 'MMM d, yyyy')}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Document Preview */}
      <div className="flex-1 flex flex-col min-h-0">
        {selectedDoc ? (
          <>
            {/* Preview Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {documentTypeLabels[selectedDoc.type]}
                </h3>
                <p className="text-sm text-gray-500">{selectedDoc.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                  className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50"
                  title="Zoom out"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
                <span className="text-sm text-gray-600 min-w-[4rem] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                  className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50"
                  title="Zoom in"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                <a
                  href={selectedDoc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50"
                  title="Open in new tab"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              </div>
            </div>

            {/* Preview Area */}
            <div className="flex-1 bg-gray-100 rounded-lg overflow-auto min-h-[400px]">
              <div className="flex items-center justify-center min-h-full p-4">
                {isImage(selectedDoc.mimeType) ? (
                  <img
                    src={selectedDoc.url}
                    alt={selectedDoc.name}
                    className="max-w-full h-auto transition-transform duration-200"
                    style={{ transform: `scale(${zoom})` }}
                  />
                ) : isPdf(selectedDoc.mimeType) ? (
                  <iframe
                    src={`${selectedDoc.url}#zoom=${zoom * 100}`}
                    className="w-full h-full min-h-[600px]"
                    title={selectedDoc.name}
                  />
                ) : (
                  <div className="text-center">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <p className="mt-2 text-sm text-gray-500">Preview not available</p>
                    <a
                      href={selectedDoc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center text-sm text-admin-600 hover:text-admin-800"
                    >
                      Download to view
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Document Info */}
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Uploaded</p>
                  <p className="font-medium">
                    {format(new Date(selectedDoc.uploadedAt), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
                {selectedDoc.expiresAt && (
                  <div>
                    <p className="text-gray-500">Expires</p>
                    <p className="font-medium">
                      {format(new Date(selectedDoc.expiresAt), 'MMM d, yyyy')}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-gray-500">Status</p>
                  <p className={clsx('font-medium', statusConfig[selectedDoc.status].text)}>
                    {selectedDoc.status}
                  </p>
                </div>
                {selectedDoc.notes && (
                  <div className="col-span-2">
                    <p className="text-gray-500">Notes</p>
                    <p className="font-medium">{selectedDoc.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            {!readOnly && selectedDoc.status === 'PENDING' && (
              <div className="mt-4 flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Add approval notes (optional)"
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-admin-500 focus:border-admin-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowReuploadModal(true)}
                    className="px-4 py-2 text-sm font-medium text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
                  >
                    Request Reupload
                  </button>
                  <button
                    onClick={() => setShowRejectModal(true)}
                    className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    Reject
                  </button>
                  <button
                    onClick={handleApprove}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Approve
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50 rounded-lg">
            <p className="text-gray-500">Select a document to preview</p>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Reject Document</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reject Document
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reupload Modal */}
      {showReuploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Request Document Reupload</h3>
            <textarea
              value={reuploadMessage}
              onChange={(e) => setReuploadMessage(e.target.value)}
              placeholder="Describe what needs to be corrected..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowReuploadModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestReupload}
                disabled={!reuploadMessage}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DocumentViewer;
