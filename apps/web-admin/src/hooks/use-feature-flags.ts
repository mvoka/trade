'use client';

import { useCallback, useEffect } from 'react';
import { useFlagsStore, FlagScope, FeatureFlag } from '@/lib/stores/flags-store';

interface UseFeatureFlagsOptions {
  autoFetch?: boolean;
  scope?: FlagScope;
  scopeId?: string;
}

export function useFeatureFlags(options: UseFeatureFlagsOptions = {}) {
  const { autoFetch = true, scope, scopeId } = options;

  const {
    flags,
    selectedFlag,
    isLoading,
    error,
    filters,
    fetchFlags,
    fetchFlag,
    createFlag,
    updateFlag,
    deleteFlag,
    setFilters,
    clearError,
  } = useFlagsStore();

  useEffect(() => {
    if (autoFetch) {
      fetchFlags({ scope, scopeId });
    }
  }, [autoFetch, scope, scopeId, fetchFlags]);

  const toggleFlag = useCallback(
    async (key: string, enabled: boolean, flagScope?: FlagScope, flagScopeId?: string) => {
      await updateFlag(key, {
        enabled,
        scope: flagScope,
        scopeId: flagScopeId,
      });
    },
    [updateFlag]
  );

  const addOverride = useCallback(
    async (key: string, overrideScope: FlagScope, overrideScopeId: string, enabled: boolean) => {
      await updateFlag(key, {
        enabled,
        scope: overrideScope,
        scopeId: overrideScopeId,
      });
    },
    [updateFlag]
  );

  const removeOverride = useCallback(
    async (key: string, overrideScope: FlagScope, overrideScopeId?: string) => {
      // Reset to default by removing override
      await updateFlag(key, {
        enabled: undefined,
        scope: overrideScope,
        scopeId: overrideScopeId,
      });
    },
    [updateFlag]
  );

  const getFlagValue = useCallback(
    (key: string, checkScope?: FlagScope, checkScopeId?: string): boolean => {
      const flag = flags.find((f) => f.key === key);
      if (!flag) return false;

      // Check for scope-specific override
      if (checkScope && checkScopeId) {
        const override = flag.overrides.find(
          (o) => o.scope === checkScope && o.scopeId === checkScopeId
        );
        if (override) return override.enabled;
      }

      // Check for scope-level override (no specific ID)
      if (checkScope) {
        const override = flag.overrides.find((o) => o.scope === checkScope && !o.scopeId);
        if (override) return override.enabled;
      }

      // Return global value
      const globalOverride = flag.overrides.find((o) => o.scope === 'GLOBAL');
      if (globalOverride) return globalOverride.enabled;

      return flag.defaultValue;
    },
    [flags]
  );

  const getFilteredFlags = useCallback(
    (searchTerm?: string): FeatureFlag[] => {
      let result = flags;

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        result = result.filter(
          (f) =>
            f.key.toLowerCase().includes(term) ||
            f.name.toLowerCase().includes(term) ||
            f.description?.toLowerCase().includes(term)
        );
      }

      return result;
    },
    [flags]
  );

  return {
    flags,
    selectedFlag,
    isLoading,
    error,
    filters,
    fetchFlags,
    fetchFlag,
    createFlag,
    updateFlag,
    deleteFlag,
    toggleFlag,
    addOverride,
    removeOverride,
    getFlagValue,
    getFilteredFlags,
    setFilters,
    clearError,
  };
}

export default useFeatureFlags;
