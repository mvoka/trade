'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQueueStore } from '@/lib/stores/queue-store';
import { operatorApi, Pro, JobStatus, EscalationAction } from '@/lib/api';

export function useJobQueue() {
  const {
    jobs,
    totalJobs,
    currentPage,
    totalPages,
    isLoading,
    error,
    filters,
    fetchJobs,
    setFilters,
    resetFilters,
  } = useQueueStore();

  useEffect(() => {
    fetchJobs(1);
  }, [fetchJobs]);

  const goToPage = useCallback(
    (page: number) => {
      fetchJobs(page);
    },
    [fetchJobs]
  );

  const filterByStatus = useCallback(
    (status: JobStatus | JobStatus[] | undefined) => {
      setFilters({ status });
    },
    [setFilters]
  );

  const filterByEscalated = useCallback(
    (escalated: boolean | undefined) => {
      setFilters({ escalated });
    },
    [setFilters]
  );

  const filterBySlaBreached = useCallback(
    (slaBreached: boolean | undefined) => {
      setFilters({ slaBreached });
    },
    [setFilters]
  );

  const searchJobs = useCallback(
    (search: string) => {
      setFilters({ search: search || undefined });
    },
    [setFilters]
  );

  const sortJobs = useCallback(
    (sortBy: string, sortOrder: 'asc' | 'desc') => {
      setFilters({ sortBy, sortOrder });
    },
    [setFilters]
  );

  return {
    jobs,
    totalJobs,
    currentPage,
    totalPages,
    isLoading,
    error,
    filters,
    goToPage,
    filterByStatus,
    filterByEscalated,
    filterBySlaBreached,
    searchJobs,
    sortJobs,
    resetFilters,
    refresh: () => fetchJobs(currentPage),
  };
}

export function useJobDetails(jobId: string) {
  const {
    selectedJob,
    selectedJobLoading,
    dispatchHistory,
    dispatchHistoryLoading,
    notes,
    notesLoading,
    fetchJobDetails,
    fetchDispatchHistory,
    fetchNotes,
    addNote,
    clearSelectedJob,
  } = useQueueStore();

  useEffect(() => {
    if (jobId) {
      fetchJobDetails(jobId);
      fetchDispatchHistory(jobId);
      fetchNotes(jobId);
    }

    return () => {
      clearSelectedJob();
    };
  }, [jobId, fetchJobDetails, fetchDispatchHistory, fetchNotes, clearSelectedJob]);

  return {
    job: selectedJob,
    isLoading: selectedJobLoading,
    dispatchHistory,
    dispatchHistoryLoading,
    notes,
    notesLoading,
    addNote: (content: string) => addNote(jobId, content),
    refresh: () => {
      fetchJobDetails(jobId);
      fetchDispatchHistory(jobId);
    },
  };
}

export function useManualDispatch(jobId: string) {
  const [pros, setPros] = useState<Pro[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAvailablePros = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const availablePros = await operatorApi.getAvailablePros(jobId);
      setPros(availablePros);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch available pros');
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  const searchPros = useCallback(async (query: string, trade?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const results = await operatorApi.searchPros({
        query,
        trade,
        available: true,
      });
      setPros(results);
    } catch (err: any) {
      setError(err.message || 'Failed to search pros');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const dispatch = useCallback(
    async (proId: string, note?: string) => {
      setIsDispatching(true);
      setError(null);

      try {
        await operatorApi.manualDispatch(jobId, proId, note);
        return true;
      } catch (err: any) {
        setError(err.message || 'Failed to dispatch job');
        return false;
      } finally {
        setIsDispatching(false);
      }
    },
    [jobId]
  );

  useEffect(() => {
    if (jobId) {
      fetchAvailablePros();
    }
  }, [jobId, fetchAvailablePros]);

  return {
    pros,
    isLoading,
    isDispatching,
    error,
    searchPros,
    dispatch,
    refresh: fetchAvailablePros,
  };
}

export function useEscalationOverride(jobId: string) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const override = useCallback(
    async (action: EscalationAction, note: string) => {
      setIsSubmitting(true);
      setError(null);

      try {
        await operatorApi.overrideEscalation(jobId, action, note);
        return true;
      } catch (err: any) {
        setError(err.message || 'Failed to override escalation');
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [jobId]
  );

  return {
    override,
    isSubmitting,
    error,
    clearError: () => setError(null),
  };
}

export function useContactRelay(jobId: string) {
  const [isInitiating, setIsInitiating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initiateContact = useCallback(
    async (
      contactType: 'CALL' | 'SMS' | 'EMAIL',
      targetType: 'smb' | 'pro'
    ) => {
      setIsInitiating(true);
      setError(null);

      try {
        await operatorApi.initiateContact(jobId, contactType, targetType);
        return true;
      } catch (err: any) {
        setError(err.message || 'Failed to initiate contact');
        return false;
      } finally {
        setIsInitiating(false);
      }
    },
    [jobId]
  );

  return {
    initiateContact,
    isInitiating,
    error,
    clearError: () => setError(null),
  };
}
