import { create } from 'zustand';
import { adminApi } from '../api';

export type PolicyScope = 'GLOBAL' | 'REGION' | 'ORG' | 'CATEGORY';

export type PolicyValueType = 'boolean' | 'number' | 'string' | 'json' | 'array';

export interface Policy {
  id: string;
  key: string;
  name: string;
  description?: string;
  category: string;
  valueType: PolicyValueType;
  defaultValue: unknown;
  currentValue: unknown;
  overrides: PolicyOverride[];
  constraints?: {
    min?: number;
    max?: number;
    options?: string[];
    pattern?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PolicyOverride {
  id: string;
  scope: PolicyScope;
  scopeId?: string;
  scopeName?: string;
  value: unknown;
  createdAt: string;
  createdBy: string;
}

interface PoliciesState {
  policies: Policy[];
  selectedPolicy: Policy | null;
  categories: string[];
  isLoading: boolean;
  error: string | null;
  filters: {
    scope?: PolicyScope;
    scopeId?: string;
    category?: string;
    search?: string;
  };

  // Actions
  fetchPolicies: (params?: { scope?: string; scopeId?: string; category?: string }) => Promise<void>;
  fetchPolicy: (key: string) => Promise<void>;
  updatePolicy: (key: string, data: { value: unknown; scope: PolicyScope; scopeId?: string }) => Promise<void>;
  resetPolicy: (key: string, scope: PolicyScope, scopeId?: string) => Promise<void>;
  setFilters: (filters: Partial<PoliciesState['filters']>) => void;
  clearError: () => void;
}

export const usePoliciesStore = create<PoliciesState>((set, get) => ({
  policies: [],
  selectedPolicy: null,
  categories: [],
  isLoading: false,
  error: null,
  filters: {},

  fetchPolicies: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const response = await adminApi.getPolicies(params);
      const policies = response.data;

      // Extract unique categories
      const categories = [...new Set(policies.map((p: Policy) => p.category))] as string[];

      set({ policies, categories, isLoading: false });
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to fetch policies';
      set({ error: message, isLoading: false });
    }
  },

  fetchPolicy: async (key: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await adminApi.getPolicy(key);
      set({ selectedPolicy: response.data, isLoading: false });
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to fetch policy';
      set({ error: message, isLoading: false });
    }
  },

  updatePolicy: async (key, data) => {
    set({ isLoading: true, error: null });
    try {
      await adminApi.updatePolicy(key, data);
      await get().fetchPolicies(get().filters);
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to update policy';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  resetPolicy: async (key, scope, scopeId) => {
    set({ isLoading: true, error: null });
    try {
      await adminApi.resetPolicy(key, scope, scopeId);
      await get().fetchPolicies(get().filters);
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to reset policy';
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
