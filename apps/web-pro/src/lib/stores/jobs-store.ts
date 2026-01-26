import { create } from 'zustand';
import { proApi, Job, JobDetails, JobStatus, JobListParams, JobCompletionData } from '../api';

interface JobsState {
  jobs: Job[];
  currentJob: JobDetails | null;
  totalJobs: number;
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchJobs: (params?: JobListParams) => Promise<void>;
  fetchJob: (id: string) => Promise<void>;
  updateJobStatus: (id: string, status: JobStatus) => Promise<void>;
  startJob: (id: string) => Promise<void>;
  completeJob: (id: string, data: JobCompletionData) => Promise<void>;
  uploadPhoto: (id: string, file: File, type: 'before' | 'after') => Promise<void>;
  clearCurrentJob: () => void;
  clearError: () => void;
}

export const useJobsStore = create<JobsState>()((set, get) => ({
  jobs: [],
  currentJob: null,
  totalJobs: 0,
  currentPage: 1,
  totalPages: 1,
  isLoading: false,
  error: null,

  fetchJobs: async (params?: JobListParams) => {
    set({ isLoading: true, error: null });

    try {
      const response = await proApi.getJobs(params);
      set({
        jobs: response.data,
        totalJobs: response.total,
        currentPage: response.page,
        totalPages: response.totalPages,
        isLoading: false,
      });
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Failed to fetch jobs';
      set({ error: message, isLoading: false });
    }
  },

  fetchJob: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      const job = await proApi.getJob(id);
      set({ currentJob: job, isLoading: false });
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Failed to fetch job details';
      set({ error: message, isLoading: false });
    }
  },

  updateJobStatus: async (id: string, status: JobStatus) => {
    set({ isLoading: true, error: null });

    try {
      const updatedJob = await proApi.updateJobStatus(id, status);

      // Update in jobs list
      const { jobs } = get();
      set({
        jobs: jobs.map(j => j.id === id ? { ...j, status: updatedJob.status } : j),
        currentJob: get().currentJob?.id === id
          ? { ...get().currentJob!, status: updatedJob.status }
          : get().currentJob,
        isLoading: false,
      });
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Failed to update job status';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  startJob: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      const updatedJob = await proApi.startJob(id);

      // Update in jobs list
      const { jobs } = get();
      set({
        jobs: jobs.map(j => j.id === id ? { ...j, status: updatedJob.status } : j),
        currentJob: get().currentJob?.id === id
          ? { ...get().currentJob!, status: updatedJob.status }
          : get().currentJob,
        isLoading: false,
      });
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Failed to start job';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  completeJob: async (id: string, data: JobCompletionData) => {
    set({ isLoading: true, error: null });

    try {
      const updatedJob = await proApi.completeJob(id, data);

      // Update in jobs list
      const { jobs } = get();
      set({
        jobs: jobs.map(j => j.id === id ? { ...j, status: updatedJob.status } : j),
        currentJob: get().currentJob?.id === id
          ? { ...get().currentJob!, status: updatedJob.status }
          : get().currentJob,
        isLoading: false,
      });
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Failed to complete job';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  uploadPhoto: async (id: string, file: File, type: 'before' | 'after') => {
    set({ isLoading: true, error: null });

    try {
      const formData = new FormData();
      formData.append('photo', file);

      const photo = await proApi.uploadJobPhoto(id, formData, type);

      // Update current job photos
      const { currentJob } = get();
      if (currentJob?.id === id) {
        set({
          currentJob: {
            ...currentJob,
            photos: [...currentJob.photos, photo],
          },
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Failed to upload photo';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  clearCurrentJob: () => {
    set({ currentJob: null });
  },

  clearError: () => {
    set({ error: null });
  },
}));

// Pipeline columns for CRM view
export const PIPELINE_COLUMNS: { status: JobStatus; label: string; color: string }[] = [
  { status: 'ACCEPTED', label: 'New', color: 'pipeline-new' },
  { status: 'SCHEDULED', label: 'Scheduled', color: 'pipeline-scheduled' },
  { status: 'EN_ROUTE', label: 'En Route', color: 'pipeline-inProgress' },
  { status: 'ON_SITE', label: 'On Site', color: 'pipeline-inProgress' },
  { status: 'IN_PROGRESS', label: 'In Progress', color: 'pipeline-inProgress' },
  { status: 'COMPLETED', label: 'Completed', color: 'pipeline-completed' },
];

export function getJobsByStatus(jobs: Job[]): Record<JobStatus, Job[]> {
  const grouped: Record<JobStatus, Job[]> = {
    ACCEPTED: [],
    SCHEDULED: [],
    EN_ROUTE: [],
    ON_SITE: [],
    IN_PROGRESS: [],
    COMPLETED: [],
    CANCELLED: [],
  };

  jobs.forEach(job => {
    if (grouped[job.status]) {
      grouped[job.status].push(job);
    }
  });

  return grouped;
}
