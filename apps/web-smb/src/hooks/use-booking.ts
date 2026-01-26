'use client';

import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import type { ApiResponse, CreateBookingInput, BookingMode } from '@trades/shared/types';

export interface AvailableSlot {
  start: string;
  end: string;
  available: boolean;
}

export interface TimeWindow {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

export interface BookingPolicy {
  mode: BookingMode;
  allowExactSlots: boolean;
  allowWindows: boolean;
  slotDurationMinutes: number;
  advanceBookingDays: number;
  windows: TimeWindow[];
}

export interface Booking {
  id: string;
  jobId: string;
  proProfileId: string;
  mode: BookingMode;
  slotStart?: string;
  slotEnd?: string;
  windowStart?: string;
  windowEnd?: string;
  status: string;
  confirmedAt?: string;
  createdAt: string;
}

export function useBooking(jobId: string | null, proProfileId: string | null) {
  const [policy, setPolicy] = useState<BookingPolicy | null>(null);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);

  // Fetch booking policy
  const fetchPolicy = useCallback(async () => {
    if (!proProfileId) return;

    try {
      const response = await apiClient.get<ApiResponse<BookingPolicy>>(
        `/booking/policy/${proProfileId}`
      );
      if (response.data) {
        setPolicy(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch booking policy:', err);
    }
  }, [proProfileId]);

  // Fetch available slots for a date
  const fetchAvailableSlots = useCallback(
    async (date: Date) => {
      if (!proProfileId) return;

      setIsLoading(true);
      try {
        const dateStr = date.toISOString().split('T')[0];
        const response = await apiClient.get<ApiResponse<AvailableSlot[]>>(
          `/booking/slots/${proProfileId}?date=${dateStr}`
        );
        if (response.data) {
          setAvailableSlots(response.data);
        }
      } catch (err) {
        console.error('Failed to fetch available slots:', err);
        setError('Failed to load available times');
      } finally {
        setIsLoading(false);
      }
    },
    [proProfileId]
  );

  // Create booking
  const createBooking = useCallback(
    async (data: Omit<CreateBookingInput, 'jobId' | 'proProfileId'>) => {
      if (!jobId || !proProfileId) {
        throw new Error('Job ID and Pro Profile ID are required');
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await apiClient.post<ApiResponse<Booking>>('/booking', {
          ...data,
          jobId,
          proProfileId,
        });

        if (response.data) {
          setBooking(response.data);
          return response.data;
        }
        throw new Error('Failed to create booking');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Booking failed';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [jobId, proProfileId]
  );

  // Update selected date and fetch slots
  const changeDate = useCallback(
    (date: Date) => {
      setSelectedDate(date);
      fetchAvailableSlots(date);
    },
    [fetchAvailableSlots]
  );

  // Initial fetch
  useEffect(() => {
    fetchPolicy();
    fetchAvailableSlots(selectedDate);
  }, [fetchPolicy, fetchAvailableSlots, selectedDate]);

  return {
    policy,
    availableSlots,
    selectedDate,
    isLoading,
    error,
    booking,
    changeDate,
    createBooking,
    clearError: () => setError(null),
  };
}

export function useExistingBooking(jobId: string | null) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const fetchBooking = async () => {
      setIsLoading(true);
      try {
        const response = await apiClient.get<ApiResponse<Booking>>(`/jobs/${jobId}/booking`);
        if (response.data) {
          setBooking(response.data);
        }
      } catch {
        // No booking exists, that's ok
      } finally {
        setIsLoading(false);
      }
    };

    fetchBooking();
  }, [jobId]);

  const cancelBooking = useCallback(async () => {
    if (!booking) return;

    setIsLoading(true);
    try {
      await apiClient.post(`/booking/${booking.id}/cancel`);
      setBooking(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to cancel booking';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [booking]);

  return {
    booking,
    isLoading,
    error,
    cancelBooking,
  };
}
