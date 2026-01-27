'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useJobsStore } from '@/lib/stores/jobs-store';
import { apiClient } from '@/lib/api';

interface TimeSlot {
  start: string;
  end: string;
  available: boolean;
}

interface BookableDay {
  date: string;
  slots: TimeSlot[];
}

export default function BookingPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.id as string;

  const { isAuthenticated, checkAuth } = useAuthStore();
  const { currentJob, isLoading: jobLoading, fetchJob } = useJobsStore();

  const [bookableDays, setBookableDays] = useState<BookableDay[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated && jobId) {
      fetchJob(jobId);
      fetchBookableSlots();
    }
  }, [isAuthenticated, jobId]);

  const fetchBookableSlots = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<{ data: BookableDay[] }>(`/bookings/slots/${jobId}`);
      if (response.data) {
        setBookableDays(response.data);
        // Auto-select first available date
        const firstAvailable = response.data.find(day => day.slots.some(s => s.available));
        if (firstAvailable) {
          setSelectedDate(firstAvailable.date);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load available slots');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBookSlot = async () => {
    if (!selectedSlot) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await apiClient.post('/bookings', {
        jobId,
        mode: 'EXACT',
        slotStart: selectedSlot.start,
        slotEnd: selectedSlot.end,
      });

      // Redirect to job detail
      router.push(`/jobs/${jobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to book appointment');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthenticated || jobLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!currentJob) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b">
          <div className="container mx-auto px-4 py-4">
            <Link href="/jobs" className="text-gray-500 hover:text-gray-700">
              Back to Jobs
            </Link>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <p className="text-gray-500">Job not found</p>
        </main>
      </div>
    );
  }

  const selectedDaySlots = bookableDays.find(d => d.date === selectedDate)?.slots || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link href={`/jobs/${jobId}`} className="text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold">Book Appointment</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="md:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Select a Date</h2>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : bookableDays.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No available slots found. Please contact support.
              </p>
            ) : (
              <>
                {/* Date Selector */}
                <div className="grid grid-cols-4 md:grid-cols-7 gap-2 mb-6">
                  {bookableDays.slice(0, 14).map((day) => {
                    const date = new Date(day.date);
                    const hasAvailable = day.slots.some(s => s.available);
                    const isSelected = selectedDate === day.date;

                    return (
                      <button
                        key={day.date}
                        onClick={() => {
                          setSelectedDate(day.date);
                          setSelectedSlot(null);
                        }}
                        disabled={!hasAvailable}
                        className={`p-2 rounded-lg text-center transition-colors ${
                          isSelected
                            ? 'bg-primary-600 text-white'
                            : hasAvailable
                            ? 'bg-white border border-gray-200 hover:border-primary-500'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        <div className="text-xs">
                          {date.toLocaleDateString('en-CA', { weekday: 'short' })}
                        </div>
                        <div className="text-lg font-medium">{date.getDate()}</div>
                        <div className="text-xs">
                          {date.toLocaleDateString('en-CA', { month: 'short' })}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Time Slots */}
                {selectedDate && (
                  <>
                    <h3 className="text-sm font-medium text-gray-700 mb-3">
                      Available Times for {new Date(selectedDate).toLocaleDateString('en-CA', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </h3>
                    <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                      {selectedDaySlots.map((slot, idx) => {
                        const startTime = new Date(slot.start).toLocaleTimeString('en-CA', {
                          hour: 'numeric',
                          minute: '2-digit',
                        });
                        const isSelected = selectedSlot?.start === slot.start;

                        return (
                          <button
                            key={idx}
                            onClick={() => setSelectedSlot(slot)}
                            disabled={!slot.available}
                            className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                              isSelected
                                ? 'bg-primary-600 text-white'
                                : slot.available
                                ? 'bg-white border border-gray-200 hover:border-primary-500'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed line-through'
                            }`}
                          >
                            {startTime}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* Summary */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 h-fit">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Booking Summary</h2>

            <div className="space-y-3 mb-6">
              <div>
                <p className="text-sm text-gray-500">Service</p>
                <p className="font-medium">{currentJob.serviceCategory?.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Professional</p>
                <p className="font-medium">
                  {currentJob.assignedPro?.businessName ||
                    `${currentJob.assignedPro?.firstName} ${currentJob.assignedPro?.lastName}`}
                </p>
              </div>
              {selectedSlot && (
                <div>
                  <p className="text-sm text-gray-500">Appointment</p>
                  <p className="font-medium">
                    {new Date(selectedSlot.start).toLocaleDateString('en-CA', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                    {' at '}
                    {new Date(selectedSlot.start).toLocaleTimeString('en-CA', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={handleBookSlot}
              disabled={!selectedSlot || isSubmitting}
              className="w-full py-3 px-4 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {isSubmitting ? 'Booking...' : 'Confirm Booking'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
