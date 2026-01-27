'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useDispatchStore, calculateTimeRemaining } from '@/lib/stores/dispatch-store';
import type { Dispatch } from '@/lib/api';

function DispatchCard({ dispatch }: { dispatch: Dispatch }) {
  const [timeRemaining, setTimeRemaining] = useState(() => calculateTimeRemaining(dispatch.expiresAt));

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining(dispatch.expiresAt));
    }, 1000);

    return () => clearInterval(interval);
  }, [dispatch.expiresAt]);

  const urgencyColors = {
    LOW: 'bg-gray-100 text-gray-700',
    MEDIUM: 'bg-blue-100 text-blue-700',
    HIGH: 'bg-orange-100 text-orange-700',
    EMERGENCY: 'bg-red-100 text-red-700',
  };

  return (
    <Link
      href={`/dispatches/${dispatch.jobId}`}
      className="block bg-white rounded-lg border border-gray-200 hover:border-primary-500 hover:shadow-md transition-all"
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 text-xs font-medium rounded ${urgencyColors[dispatch.urgency]}`}>
                {dispatch.urgency}
              </span>
              <span className="text-sm text-gray-500">#{dispatch.referenceNumber}</span>
            </div>
            <h3 className="font-medium text-gray-900 mt-1">{dispatch.trade}</h3>
          </div>

          {/* Timer */}
          <div className={`text-right ${timeRemaining.isUrgent ? 'text-red-600' : 'text-gray-600'}`}>
            {timeRemaining.isExpired ? (
              <span className="text-red-600 font-medium">Expired</span>
            ) : (
              <>
                <div className="text-lg font-mono font-bold">
                  {String(timeRemaining.minutes).padStart(2, '0')}:{String(timeRemaining.seconds).padStart(2, '0')}
                </div>
                <div className="text-xs">remaining</div>
              </>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600 line-clamp-2 mb-3">{dispatch.description}</p>

        {/* Location & Distance */}
        <div className="flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {dispatch.location.city}, {dispatch.location.state}
          </div>
          <span className="font-medium text-primary-600">{dispatch.location.distance} km away</span>
        </div>

        {/* Time Progress Bar */}
        <div className="mt-3 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              timeRemaining.isUrgent ? 'bg-red-500' : 'bg-green-500'
            }`}
            style={{ width: `${timeRemaining.percentage}%` }}
          />
        </div>
      </div>
    </Link>
  );
}

export default function DispatchesPage() {
  const router = useRouter();
  const { isAuthenticated, checkAuth } = useAuthStore();
  const { dispatches, isLoading, error, fetchPendingDispatches } = useDispatchStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    fetchPendingDispatches();
  }, [isAuthenticated, router, fetchPendingDispatches]);

  // Poll for new dispatches every 30 seconds
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      fetchPendingDispatches();
    }, 30000);

    return () => clearInterval(interval);
  }, [isAuthenticated, fetchPendingDispatches]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-xl font-bold text-primary-600">
              Trades Pro
            </Link>
            <span className="text-gray-300">/</span>
            <h1 className="text-lg font-medium">Dispatch Inbox</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              {dispatches.length} pending
            </span>
            <button
              onClick={() => fetchPendingDispatches()}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              title="Refresh"
            >
              <svg className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-3xl">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {isLoading && dispatches.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : dispatches.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">All Caught Up!</h3>
            <p className="text-gray-500 mb-6">No pending dispatch requests at the moment.</p>
            <Link
              href="/jobs"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 h-10 px-6"
            >
              View Active Jobs
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Urgent dispatches first */}
            {dispatches
              .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime())
              .map((dispatch) => (
                <DispatchCard key={dispatch.id} dispatch={dispatch} />
              ))}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="font-medium text-blue-800">How dispatch works</h4>
              <ul className="mt-1 text-sm text-blue-700 space-y-1">
                <li>Review job details and respond before the timer expires</li>
                <li>Accept to add the job to your queue</li>
                <li>Decline if you're unavailable or the job isn't right for you</li>
                <li>Jobs not responded to will be reassigned automatically</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
