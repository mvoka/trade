import { create } from 'zustand';
import { operatorApi, Job, JobDetails, JobQueueParams, PaginatedResponse, DispatchAttempt, InternalNote } from '../api';

interface QueueFilters {
  status?: string | string[];
  escalated?: boolean;
  slaBreached?: boolean;
  trade?: string;
  search?: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

interface QueueState {
  // Job queue
  jobs: Job[];
  totalJobs: number;
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;

  // Filters
  filters: QueueFilters;

  // Selected job
  selectedJob: JobDetails | null;
  selectedJobLoading: boolean;

  // Dispatch history for selected job
  dispatchHistory: DispatchAttempt[];
  dispatchHistoryLoading: boolean;

  // Notes for selected job
  notes: InternalNote[];
  notesLoading: boolean;

  // Actions
  fetchJobs: (page?: number) => Promise<void>;
  setFilters: (filters: Partial<QueueFilters>) => void;
  resetFilters: () => void;

  fetchJobDetails: (id: string) => Promise<void>;
  clearSelectedJob: () => void;

  fetchDispatchHistory: (jobId: string) => Promise<void>;

  fetchNotes: (jobId: string) => Promise<void>;
  addNote: (jobId: string, content: string) => Promise<void>;

  // Real-time updates
  updateJob: (job: Partial<Job> & { id: string }) => void;
  addJob: (job: Job) => void;
  removeJob: (jobId: string) => void;
  refreshQueue: () => Promise<void>;
}

const defaultFilters: QueueFilters = {
  sortBy: 'slaDeadline',
  sortOrder: 'asc',
};

export const useQueueStore = create<QueueState>((set, get) => ({
  // Initial state
  jobs: [],
  totalJobs: 0,
  currentPage: 1,
  totalPages: 1,
  isLoading: false,
  error: null,

  filters: defaultFilters,

  selectedJob: null,
  selectedJobLoading: false,

  dispatchHistory: [],
  dispatchHistoryLoading: false,

  notes: [],
  notesLoading: false,

  // Actions
  fetchJobs: async (page = 1) => {
    const { filters } = get();
    set({ isLoading: true, error: null });

    try {
      const params: JobQueueParams = {
        page,
        limit: 20,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      };

      if (filters.status) {
        params.status = filters.status as any;
      }
      if (filters.escalated !== undefined) {
        params.escalated = filters.escalated;
      }
      if (filters.slaBreached !== undefined) {
        params.slaBreached = filters.slaBreached;
      }
      if (filters.trade) {
        params.trade = filters.trade;
      }
      if (filters.search) {
        params.search = filters.search;
      }

      const response = await operatorApi.getJobQueue(params);

      set({
        jobs: response.data,
        totalJobs: response.total,
        currentPage: response.page,
        totalPages: response.totalPages,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to fetch jobs',
        isLoading: false,
      });
    }
  },

  setFilters: (newFilters: Partial<QueueFilters>) => {
    const { filters, fetchJobs } = get();
    set({ filters: { ...filters, ...newFilters } });
    // Reset to page 1 when filters change
    fetchJobs(1);
  },

  resetFilters: () => {
    set({ filters: defaultFilters });
    get().fetchJobs(1);
  },

  fetchJobDetails: async (id: string) => {
    set({ selectedJobLoading: true });

    try {
      const job = await operatorApi.getJob(id);
      set({ selectedJob: job, selectedJobLoading: false });
    } catch (error: any) {
      console.error('Failed to fetch job details:', error);
      set({ selectedJobLoading: false });
    }
  },

  clearSelectedJob: () => {
    set({
      selectedJob: null,
      dispatchHistory: [],
      notes: [],
    });
  },

  fetchDispatchHistory: async (jobId: string) => {
    set({ dispatchHistoryLoading: true });

    try {
      const history = await operatorApi.getDispatchHistory(jobId);
      set({ dispatchHistory: history, dispatchHistoryLoading: false });
    } catch (error: any) {
      console.error('Failed to fetch dispatch history:', error);
      set({ dispatchHistoryLoading: false });
    }
  },

  fetchNotes: async (jobId: string) => {
    set({ notesLoading: true });

    try {
      const notes = await operatorApi.getJobNotes(jobId);
      set({ notes, notesLoading: false });
    } catch (error: any) {
      console.error('Failed to fetch notes:', error);
      set({ notesLoading: false });
    }
  },

  addNote: async (jobId: string, content: string) => {
    try {
      const newNote = await operatorApi.addJobNote(jobId, content);
      set((state) => ({
        notes: [newNote, ...state.notes],
      }));
    } catch (error: any) {
      console.error('Failed to add note:', error);
      throw error;
    }
  },

  // Real-time updates
  updateJob: (updatedJob: Partial<Job> & { id: string }) => {
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === updatedJob.id ? { ...job, ...updatedJob } : job
      ),
      selectedJob:
        state.selectedJob?.id === updatedJob.id
          ? { ...state.selectedJob, ...updatedJob }
          : state.selectedJob,
    }));
  },

  addJob: (job: Job) => {
    set((state) => ({
      jobs: [job, ...state.jobs].slice(0, 20), // Keep only first 20
      totalJobs: state.totalJobs + 1,
    }));
  },

  removeJob: (jobId: string) => {
    set((state) => ({
      jobs: state.jobs.filter((job) => job.id !== jobId),
      totalJobs: Math.max(0, state.totalJobs - 1),
    }));
  },

  refreshQueue: async () => {
    const { currentPage, fetchJobs } = get();
    await fetchJobs(currentPage);
  },
}));
