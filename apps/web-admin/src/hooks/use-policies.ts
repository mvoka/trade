'use client';

import { useCallback, useEffect } from 'react';
import { usePoliciesStore, PolicyScope, Policy } from '@/lib/stores/policies-store';

interface UsePoliciesOptions {
  autoFetch?: boolean;
  scope?: PolicyScope;
  scopeId?: string;
  category?: string;
}

export function usePolicies(options: UsePoliciesOptions = {}) {
  const { autoFetch = true, scope, scopeId, category } = options;

  const {
    policies,
    selectedPolicy,
    categories,
    isLoading,
    error,
    filters,
    fetchPolicies,
    fetchPolicy,
    updatePolicy,
    resetPolicy,
    setFilters,
    clearError,
  } = usePoliciesStore();

  useEffect(() => {
    if (autoFetch) {
      fetchPolicies({ scope, scopeId, category });
    }
  }, [autoFetch, scope, scopeId, category, fetchPolicies]);

  const getPolicyValue = useCallback(
    <T = unknown>(key: string, checkScope?: PolicyScope, checkScopeId?: string): T | undefined => {
      const policy = policies.find((p) => p.key === key);
      if (!policy) return undefined;

      // Check for scope-specific override
      if (checkScope && checkScopeId) {
        const override = policy.overrides.find(
          (o) => o.scope === checkScope && o.scopeId === checkScopeId
        );
        if (override) return override.value as T;
      }

      // Check for scope-level override (no specific ID)
      if (checkScope) {
        const override = policy.overrides.find((o) => o.scope === checkScope && !o.scopeId);
        if (override) return override.value as T;
      }

      return policy.currentValue as T;
    },
    [policies]
  );

  const getEffectiveValue = useCallback(
    <T = unknown>(
      policy: Policy,
      checkScope?: PolicyScope,
      checkScopeId?: string
    ): { value: T; source: string } => {
      // Check hierarchy: specific scope -> scope level -> global -> default
      if (checkScope && checkScopeId) {
        const override = policy.overrides.find(
          (o) => o.scope === checkScope && o.scopeId === checkScopeId
        );
        if (override) {
          return {
            value: override.value as T,
            source: `${checkScope}:${override.scopeName || checkScopeId}`,
          };
        }
      }

      if (checkScope) {
        const override = policy.overrides.find((o) => o.scope === checkScope && !o.scopeId);
        if (override) {
          return { value: override.value as T, source: checkScope };
        }
      }

      const globalOverride = policy.overrides.find((o) => o.scope === 'GLOBAL');
      if (globalOverride) {
        return { value: globalOverride.value as T, source: 'GLOBAL' };
      }

      return { value: policy.defaultValue as T, source: 'DEFAULT' };
    },
    []
  );

  const getPoliciesByCategory = useCallback(
    (categoryName: string): Policy[] => {
      return policies.filter((p) => p.category === categoryName);
    },
    [policies]
  );

  const getFilteredPolicies = useCallback(
    (searchTerm?: string, categoryFilter?: string): Policy[] => {
      let result = policies;

      if (categoryFilter) {
        result = result.filter((p) => p.category === categoryFilter);
      }

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        result = result.filter(
          (p) =>
            p.key.toLowerCase().includes(term) ||
            p.name.toLowerCase().includes(term) ||
            p.description?.toLowerCase().includes(term)
        );
      }

      return result;
    },
    [policies]
  );

  const hasOverride = useCallback(
    (key: string, checkScope: PolicyScope, checkScopeId?: string): boolean => {
      const policy = policies.find((p) => p.key === key);
      if (!policy) return false;

      return policy.overrides.some(
        (o) => o.scope === checkScope && (checkScopeId ? o.scopeId === checkScopeId : !o.scopeId)
      );
    },
    [policies]
  );

  return {
    policies,
    selectedPolicy,
    categories,
    isLoading,
    error,
    filters,
    fetchPolicies,
    fetchPolicy,
    updatePolicy,
    resetPolicy,
    getPolicyValue,
    getEffectiveValue,
    getPoliciesByCategory,
    getFilteredPolicies,
    hasOverride,
    setFilters,
    clearError,
  };
}

export default usePolicies;
