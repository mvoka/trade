import { create } from 'zustand';
import { apiClient } from '../api';
import type { JobStatus, ApiResponse, CreateJobInput } from '@trades/shared/types';

export interface Attachment {
  id: string;
  type: 'BEFORE_PHOTO' | 'AFTER_PHOTO' | 'DOCUMENT' | 'OTHER';
  url: string;
  filename: string;
  mimeType: string;
  createdAt: string;
}

export interface Job {
  id: string;
  orgId: string;
  serviceCategoryId: string;
  serviceCategory: {
    id: string;
    name: string;
    slug: string;
  };
  contactName: string;
  contactEmail?: string;
  contactPhone: string;
  businessName?: string;
  serviceAddressLine1: string;
  serviceAddressLine2?: string;
  serviceCity: string;
  serviceProvince: string;
  servicePostalCode: string;
  serviceCountry: string;
  title?: string;
  description: string;
  status: JobStatus;
  urgency: 'LOW' | 'NORMAL' | 'HIGH' | 'EMERGENCY';
  preferredDateStart?: string;
  preferredDateEnd?: string;
  assignedProId?: string;
  assignedPro?: {
    id: string;
    businessName?: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    rating?: number;
  };
  attachments: Attachment[];
  booking?: {
    id: string;
    slotStart?: string;
    slotEnd?: string;
    windowStart?: string;
    windowEnd?: string;
    status: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

interface JobsState {
  jobs: Job[];
  currentJob: Job | null;
  serviceCategories: ServiceCategory[];
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };

  // Actions
  fetchJobs: (params?: { page?: number; status?: JobStatus }) => Promise<void>;
  fetchJob: (id: string) => Promise<void>;
  createJob: (data: CreateJobInput, photos: File[]) => Promise<Job>;
  cancelJob: (id: string) => Promise<void>;
  fetchServiceCategories: () => Promise<void>;
  clearCurrentJob: () => void;
  clearError: () => void;
}

export const useJobsStore = create<JobsState>()((set, get) => ({
  jobs: [],
  currentJob: null,
  serviceCategories: [],
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  },

  fetchJobs: async (params = {}) => {
    set({ isLoading: true, error: null });
    try {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.set('page', params.page.toString());
      if (params.status) queryParams.set('status', params.status);

      const response = await apiClient.get<ApiResponse<Job[]>>(
        `/jobs?${queryParams.toString()}`
      );

      if (response.data) {
        set({
          jobs: response.data,
          pagination: response.meta
            ? {
                page: response.meta.page || 1,
                pageSize: response.meta.pageSize || 10,
                total: response.meta.total || 0,
                totalPages: response.meta.totalPages || 0,
              }
            : get().pagination,
          isLoading: false,
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch jobs';
      set({ error: message, isLoading: false });
    }
  },

  fetchJob: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.get<ApiResponse<Job>>(`/jobs/${id}`);
      if (response.data) {
        set({ currentJob: response.data, isLoading: false });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch job';
      set({ error: message, isLoading: false });
    }
  },

  createJob: async (data: CreateJobInput, photos: File[]) => {
    set({ isLoading: true, error: null });
    try {
      // First create the job
      const response = await apiClient.post<ApiResponse<Job>>('/jobs', data);

      if (response.data) {
        const job = response.data;

        // Upload photos if any
        if (photos.length > 0) {
          const formData = new FormData();
          photos.forEach((photo) => {
            formData.append('files', photo);
          });
          formData.append('type', 'BEFORE_PHOTO');

          await apiClient.post(`/jobs/${job.id}/attachments`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });

          // Refresh job to get attachments
          const updatedJob = await apiClient.get<ApiResponse<Job>>(`/jobs/${job.id}`);
          if (updatedJob.data) {
            set({ isLoading: false });
            return updatedJob.data;
          }
        }

        set({ isLoading: false });
        return job;
      }
      throw new Error('Failed to create job');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create job';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  cancelJob: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await apiClient.post(`/jobs/${id}/cancel`);

      // Update the job in the list
      set((state) => ({
        jobs: state.jobs.map((job) =>
          job.id === id ? { ...job, status: 'CANCELLED' as JobStatus } : job
        ),
        currentJob:
          state.currentJob?.id === id
            ? { ...state.currentJob, status: 'CANCELLED' as JobStatus }
            : state.currentJob,
        isLoading: false,
      }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to cancel job';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  fetchServiceCategories: async () => {
    try {
      const response = await apiClient.get<ApiResponse<ServiceCategory[]>>('/service-categories');
      if (response.data) {
        set({ serviceCategories: response.data });
      }
    } catch (error) {
      console.error('Failed to fetch service categories:', error);
    }
  },

  clearCurrentJob: () => set({ currentJob: null }),
  clearError: () => set({ error: null }),
}));
