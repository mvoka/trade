'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';

interface Policy {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  value: unknown;
  defaultValue: unknown;
  scope: string;
  scopeId?: string;
  updatedAt: string;
}

const POLICY_CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'SLA', label: 'SLA & Timers' },
  { value: 'DISPATCH', label: 'Dispatch' },
  { value: 'BOOKING', label: 'Booking' },
  { value: 'PRIVACY', label: 'Privacy' },
  { value: 'PHOTOS', label: 'Photos' },
  { value: 'DATA', label: 'Data Retention' },
];

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
  const [editValue, setEditValue] = useState('');
  const [filter, setFilter] = useState({ category: '', scope: '' });
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadPolicies();
  }, [filter]);

  const loadPolicies = async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filter.category) params.category = filter.category;
      if (filter.scope) params.scope = filter.scope;
      const response = await adminApi.getPolicies(Object.keys(params).length > 0 ? params : undefined);
      setPolicies(response.data.data || response.data || []);
    } catch (error) {
      console.error('Failed to load policies:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingPolicy) return;
    setIsProcessing(true);
    try {
      let parsedValue: unknown = editValue;
      try {
        parsedValue = JSON.parse(editValue);
      } catch {
        // Keep as string if not valid JSON
      }
      await adminApi.updatePolicy(editingPolicy.key, {
        value: parsedValue,
        scope: editingPolicy.scope,
        scopeId: editingPolicy.scopeId,
      });
      setEditingPolicy(null);
      loadPolicies();
    } catch (error) {
      console.error('Failed to update policy:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = async (policy: Policy) => {
    if (!confirm(`Reset "${policy.name}" to default value?`)) return;
    try {
      await adminApi.resetPolicy(policy.key, policy.scope, policy.scopeId);
      loadPolicies();
    } catch (error) {
      console.error('Failed to reset policy:', error);
    }
  };

  const formatValue = (value: unknown): string => {
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Policy Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure platform policies and default values.
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-4">
        <select
          value={filter.category}
          onChange={(e) => setFilter({ ...filter, category: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
        >
          {POLICY_CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>
      </div>

      {/* Policies List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">Loading policies...</p>
          </div>
        ) : policies.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No policies found.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {policies.map((policy) => (
              <div key={policy.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-sm font-medium text-gray-900">{policy.name}</h3>
                      <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">{policy.key}</code>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        policy.category === 'SLA' ? 'bg-blue-100 text-blue-800' :
                        policy.category === 'DISPATCH' ? 'bg-purple-100 text-purple-800' :
                        policy.category === 'BOOKING' ? 'bg-green-100 text-green-800' :
                        policy.category === 'PRIVACY' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {policy.category}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mb-2">{policy.description}</p>
                    <div className="flex items-center gap-4">
                      <div>
                        <span className="text-xs text-gray-400">Current:</span>
                        <code className="ml-1 text-sm bg-admin-50 px-2 py-0.5 rounded text-admin-700">
                          {formatValue(policy.value)}
                        </code>
                      </div>
                      {JSON.stringify(policy.value) !== JSON.stringify(policy.defaultValue) && (
                        <div>
                          <span className="text-xs text-gray-400">Default:</span>
                          <code className="ml-1 text-sm text-gray-500">
                            {formatValue(policy.defaultValue)}
                          </code>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => {
                        setEditingPolicy(policy);
                        setEditValue(formatValue(policy.value));
                      }}
                      className="px-3 py-1.5 text-sm text-admin-600 hover:text-admin-800 hover:bg-admin-50 rounded-lg"
                    >
                      Edit
                    </button>
                    {JSON.stringify(policy.value) !== JSON.stringify(policy.defaultValue) && (
                      <button
                        onClick={() => handleReset(policy)}
                        className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingPolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Edit Policy</h3>
            <p className="text-sm text-gray-500 mb-4">{editingPolicy.description}</p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Value for {editingPolicy.key}
              </label>
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500 font-mono text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                Enter a JSON value or plain text/number.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setEditingPolicy(null)}
                disabled={isProcessing}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={isProcessing}
                className="flex-1 py-2 px-4 bg-admin-600 text-white rounded-lg hover:bg-admin-700 disabled:opacity-50"
              >
                {isProcessing ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
