'use client';

import { useEffect, useCallback } from 'react';
import { useJobsStore, Job } from '@/lib/stores/jobs-store';
import type { JobStatus, CreateJobInput } from '@trades/shared/types';

export function useJobs(options: { autoFetch?: boolean; status?: JobStatus } = {}) {
  const { autoFetch = true, status } = options;
  const {
    jobs,
    isLoading,
    error,
    pagination,
    fetchJobs,
    fetchServiceCategories,
    serviceCategories,
    clearError,
  } = useJobsStore();

  useEffect(() => {
    if (autoFetch) {
      fetchJobs({ status });
      fetchServiceCategories();
    }
  }, [autoFetch, status, fetchJobs, fetchServiceCategories]);

  const loadMore = useCallback(() => {
    if (pagination.page < pagination.totalPages) {
      fetchJobs({ page: pagination.page + 1, status });
    }
  }, [pagination, status, fetchJobs]);

  const refresh = useCallback(() => {
    fetchJobs({ status });
  }, [status, fetchJobs]);

  return {
    jobs,
    isLoading,
    error,
    pagination,
    serviceCategories,
    loadMore,
    refresh,
    clearError,
  };
}

export function useJob(jobId: string | null) {
  const { currentJob, isLoading, error, fetchJob, clearCurrentJob, clearError, cancelJob } =
    useJobsStore();

  useEffect(() => {
    if (jobId) {
      fetchJob(jobId);
    }
    return () => {
      clearCurrentJob();
    };
  }, [jobId, fetchJob, clearCurrentJob]);

  const refresh = useCallback(() => {
    if (jobId) {
      fetchJob(jobId);
    }
  }, [jobId, fetchJob]);

  const cancel = useCallback(async () => {
    if (jobId) {
      await cancelJob(jobId);
    }
  }, [jobId, cancelJob]);

  return {
    job: currentJob,
    isLoading,
    error,
    refresh,
    cancel,
    clearError,
  };
}

export function useCreateJob() {
  const { createJob, isLoading, error, serviceCategories, fetchServiceCategories, clearError } =
    useJobsStore();

  useEffect(() => {
    fetchServiceCategories();
  }, [fetchServiceCategories]);

  const submit = useCallback(
    async (data: CreateJobInput, photos: File[]): Promise<Job> => {
      return createJob(data, photos);
    },
    [createJob]
  );

  return {
    createJob: submit,
    isLoading,
    error,
    serviceCategories,
    clearError,
  };
}
