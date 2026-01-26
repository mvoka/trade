import { create } from 'zustand';
import { proApi, Dispatch, DispatchDetails } from '../api';

interface DispatchState {
  dispatches: Dispatch[];
  currentDispatch: DispatchDetails | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchPendingDispatches: () => Promise<void>;
  fetchDispatch: (jobId: string) => Promise<void>;
  acceptDispatch: (jobId: string) => Promise<void>;
  declineDispatch: (jobId: string, reason: string, additionalNotes?: string) => Promise<void>;
  removeDispatch: (jobId: string) => void;
  clearError: () => void;
}

export const useDispatchStore = create<DispatchState>()((set, get) => ({
  dispatches: [],
  currentDispatch: null,
  isLoading: false,
  error: null,

  fetchPendingDispatches: async () => {
    set({ isLoading: true, error: null });

    try {
      const dispatches = await proApi.getPendingDispatches();
      set({ dispatches, isLoading: false });
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Failed to fetch dispatches';
      set({ error: message, isLoading: false });
    }
  },

  fetchDispatch: async (jobId: string) => {
    set({ isLoading: true, error: null });

    try {
      const dispatch = await proApi.getDispatch(jobId);
      set({ currentDispatch: dispatch, isLoading: false });
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Failed to fetch dispatch details';
      set({ error: message, isLoading: false });
    }
  },

  acceptDispatch: async (jobId: string) => {
    set({ isLoading: true, error: null });

    try {
      await proApi.acceptDispatch(jobId);

      // Remove from pending dispatches
      const { dispatches } = get();
      set({
        dispatches: dispatches.filter(d => d.jobId !== jobId),
        currentDispatch: null,
        isLoading: false,
      });
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Failed to accept dispatch';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  declineDispatch: async (jobId: string, reason: string, additionalNotes?: string) => {
    set({ isLoading: true, error: null });

    try {
      await proApi.declineDispatch(jobId, reason, additionalNotes);

      // Remove from pending dispatches
      const { dispatches } = get();
      set({
        dispatches: dispatches.filter(d => d.jobId !== jobId),
        currentDispatch: null,
        isLoading: false,
      });
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Failed to decline dispatch';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  removeDispatch: (jobId: string) => {
    const { dispatches } = get();
    set({ dispatches: dispatches.filter(d => d.jobId !== jobId) });
  },

  clearError: () => {
    set({ error: null });
  },
}));

// Helper function to calculate time remaining
export function calculateTimeRemaining(expiresAt: string): {
  minutes: number;
  seconds: number;
  percentage: number;
  isExpired: boolean;
  isUrgent: boolean;
} {
  const now = new Date().getTime();
  const expiry = new Date(expiresAt).getTime();
  const total = 15 * 60 * 1000; // 15 minutes in milliseconds (standard SLA response time)
  const remaining = expiry - now;

  if (remaining <= 0) {
    return {
      minutes: 0,
      seconds: 0,
      percentage: 0,
      isExpired: true,
      isUrgent: true,
    };
  }

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const percentage = (remaining / total) * 100;

  return {
    minutes,
    seconds,
    percentage: Math.min(100, Math.max(0, percentage)),
    isExpired: false,
    isUrgent: remaining < 5 * 60 * 1000, // Less than 5 minutes
  };
}
