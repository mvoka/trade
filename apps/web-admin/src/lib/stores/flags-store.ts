import { create } from 'zustand';
import { adminApi } from '../api';

export type FlagScope = 'GLOBAL' | 'REGION' | 'ORG' | 'CATEGORY';

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description?: string;
  defaultValue: boolean;
  overrides: FlagOverride[];
  createdAt: string;
  updatedAt: string;
}

export interface FlagOverride {
  id: string;
  scope: FlagScope;
  scopeId?: string;
  enabled: boolean;
  createdAt: string;
}

interface FlagsState {
  flags: FeatureFlag[];
  selectedFlag: FeatureFlag | null;
  isLoading: boolean;
  error: string | null;
  filters: {
    scope?: FlagScope;
    scopeId?: string;
    search?: string;
  };

  // Actions
  fetchFlags: (params?: { scope?: string; scopeId?: string }) => Promise<void>;
  fetchFlag: (key: string) => Promise<void>;
  createFlag: (data: {
    key: string;
    name: string;
    description?: string;
    defaultValue: boolean;
    scope: FlagScope;
  }) => Promise<void>;
  updateFlag: (key: string, data: { enabled?: boolean; scope?: FlagScope; scopeId?: string }) => Promise<void>;
  deleteFlag: (key: string) => Promise<void>;
  setFilters: (filters: Partial<FlagsState['filters']>) => void;
  clearError: () => void;
}

export const useFlagsStore = create<FlagsState>((set, get) => ({
  flags: [],
  selectedFlag: null,
  isLoading: false,
  error: null,
  filters: {},

  fetchFlags: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const response = await adminApi.getFeatureFlags(params);
      set({ flags: response.data, isLoading: false });
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to fetch feature flags';
      set({ error: message, isLoading: false });
    }
  },

  fetchFlag: async (key: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await adminApi.getFeatureFlag(key);
      set({ selectedFlag: response.data, isLoading: false });
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to fetch feature flag';
      set({ error: message, isLoading: false });
    }
  },

  createFlag: async (data) => {
    set({ isLoading: true, error: null });
    try {
      await adminApi.createFeatureFlag(data);
      await get().fetchFlags();
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to create feature flag';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  updateFlag: async (key, data) => {
    set({ isLoading: true, error: null });
    try {
      await adminApi.updateFeatureFlag(key, data);
      await get().fetchFlags();
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to update feature flag';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  deleteFlag: async (key) => {
    set({ isLoading: true, error: null });
    try {
      await adminApi.deleteFeatureFlag(key);
      set((state) => ({
        flags: state.flags.filter((f) => f.key !== key),
        isLoading: false,
      }));
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to delete feature flag';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  setFilters: (filters) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
    }));
  },

  clearError: () => set({ error: null }),
}));
