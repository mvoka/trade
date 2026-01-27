'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useDispatchStore, calculateTimeRemaining } from '@/lib/stores/dispatch-store';
import { DECLINE_REASONS } from '@/lib/api';

export default function DispatchDetailPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.id as string;

  const { isAuthenticated, checkAuth } = useAuthStore();
  const { currentDispatch, isLoading, error, fetchDispatch, acceptDispatch, declineDispatch, clearError } = useDispatchStore();

  const [timeRemaining, setTimeRemaining] = useState({ minutes: 0, seconds: 0, percentage: 100, isExpired: false, isUrgent: false });
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [declineNotes, setDeclineNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    fetchDispatch(jobId);
  }, [isAuthenticated, router, jobId, fetchDispatch]);

  useEffect(() => {
    if (!currentDispatch) return;

    const updateTimer = () => {
      setTimeRemaining(calculateTimeRemaining(currentDispatch.expiresAt));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [currentDispatch]);

  const handleAccept = async () => {
    try {
      setIsProcessing(true);
      clearError();
      await acceptDispatch(jobId);
      router.push('/jobs');
    } catch (err) {
      console.error('Failed to accept:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!declineReason) return;

    try {
      setIsProcessing(true);
      clearError();
      await declineDispatch(jobId, declineReason, declineNotes || undefined);
      router.push('/dispatches');
    } catch (err) {
      console.error('Failed to decline:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  if (isLoading || !currentDispatch) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const dispatch = currentDispatch;
  const urgencyColors = {
    LOW: 'bg-gray-100 text-gray-700',
    MEDIUM: 'bg-blue-100 text-blue-700',
    HIGH: 'bg-orange-100 text-orange-700',
    EMERGENCY: 'bg-red-100 text-red-700',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dispatches" className="text-gray-500 hover:text-gray-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-lg font-bold">Dispatch Request</h1>
          </div>

          {/* Timer */}
          <div className={`text-center ${timeRemaining.isUrgent ? 'text-red-600' : 'text-gray-700'}`}>
            {timeRemaining.isExpired ? (
              <span className="text-red-600 font-medium">Expired</span>
            ) : (
              <>
                <div className="text-2xl font-mono font-bold">
                  {String(timeRemaining.minutes).padStart(2, '0')}:{String(timeRemaining.seconds).padStart(2, '0')}
                </div>
                <div className="text-xs">to respond</div>
              </>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-gray-200">
          <div
            className={`h-full transition-all ${timeRemaining.isUrgent ? 'bg-red-500' : 'bg-green-500'}`}
            style={{ width: `${timeRemaining.percentage}%` }}
          />
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-3xl pb-32">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Job Summary */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <span className={`px-2 py-0.5 text-xs font-medium rounded ${urgencyColors[dispatch.urgency]}`}>
                {dispatch.urgency}
              </span>
              <h2 className="text-xl font-semibold text-gray-900 mt-2">{dispatch.trade}</h2>
              <p className="text-sm text-gray-500">Reference: #{dispatch.referenceNumber}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary-600">{dispatch.location.distance} km</p>
              <p className="text-sm text-gray-500">away</p>
            </div>
          </div>

          <p className="text-gray-700 mb-4">{dispatch.description}</p>

          {dispatch.additionalNotes && (
            <div className="p-3 bg-yellow-50 rounded-lg text-sm text-yellow-800">
              <strong>Note:</strong> {dispatch.additionalNotes}
            </div>
          )}
        </div>

        {/* Location */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-4">
          <h3 className="font-medium text-gray-900 mb-3">Location</h3>
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <div>
              <p className="text-gray-900">{dispatch.address}</p>
              <p className="text-sm text-gray-500">{dispatch.location.city}, {dispatch.location.state}</p>
            </div>
          </div>
        </div>

        {/* Customer Info */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-4">
          <h3 className="font-medium text-gray-900 mb-3">Customer</h3>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-gray-500">Name</dt>
              <dd className="font-medium text-gray-900">{dispatch.smbContactName}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Business</dt>
              <dd className="font-medium text-gray-900">{dispatch.smbName}</dd>
            </div>
          </dl>
          <p className="mt-3 text-sm text-gray-500 italic">
            Contact details will be revealed after accepting
          </p>
        </div>

        {/* Photos */}
        {dispatch.photos && dispatch.photos.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-4">
            <h3 className="font-medium text-gray-900 mb-3">Photos</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {dispatch.photos.map((photo, idx) => (
                <div key={idx} className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                  <img src={photo} alt={`Job photo ${idx + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Schedule */}
        {(dispatch.scheduledDate || dispatch.scheduledTimeSlot) && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-4">
            <h3 className="font-medium text-gray-900 mb-3">Preferred Schedule</h3>
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <div>
                {dispatch.scheduledDate && (
                  <p className="text-gray-900">
                    {new Date(dispatch.scheduledDate).toLocaleDateString('en-CA', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                )}
                {dispatch.scheduledTimeSlot && (
                  <p className="text-sm text-gray-500">{dispatch.scheduledTimeSlot}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
        <div className="container mx-auto max-w-3xl flex gap-4">
          <button
            onClick={() => setShowDeclineModal(true)}
            disabled={isProcessing || timeRemaining.isExpired}
            className="flex-1 py-3 px-4 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            disabled={isProcessing || timeRemaining.isExpired}
            className="flex-1 py-3 px-4 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProcessing && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            Accept Job
          </button>
        </div>
      </div>

      {/* Decline Modal */}
      {showDeclineModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
          <div className="bg-white rounded-t-xl sm:rounded-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Decline Job</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Reason *</label>
              <div className="space-y-2">
                {DECLINE_REASONS.map((reason) => (
                  <label key={reason.value} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      name="declineReason"
                      value={reason.value}
                      checked={declineReason === reason.value}
                      onChange={(e) => setDeclineReason(e.target.value)}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-gray-700">{reason.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {declineReason === 'other' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional notes</label>
                <textarea
                  value={declineNotes}
                  onChange={(e) => setDeclineNotes(e.target.value)}
                  placeholder="Please explain..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowDeclineModal(false)}
                disabled={isProcessing}
                className="flex-1 py-2 px-4 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDecline}
                disabled={!declineReason || isProcessing}
                className="flex-1 py-2 px-4 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'Declining...' : 'Confirm Decline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
