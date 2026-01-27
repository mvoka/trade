'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';

interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  scope: string;
  scopeId?: string;
  updatedAt: string;
}

const SCOPE_OPTIONS = [
  { value: 'GLOBAL', label: 'Global' },
  { value: 'REGION', label: 'Region' },
  { value: 'ORG', label: 'Organization' },
  { value: 'SERVICE_CATEGORY', label: 'Service Category' },
];

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);
  const [filter, setFilter] = useState({ scope: '' });
  const [formData, setFormData] = useState({
    key: '',
    name: '',
    description: '',
    defaultValue: true,
    scope: 'GLOBAL',
  });
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadFlags();
  }, [filter]);

  const loadFlags = async () => {
    setIsLoading(true);
    try {
      const response = await adminApi.getFeatureFlags(filter.scope ? { scope: filter.scope } : undefined);
      setFlags(response.data.data || response.data || []);
    } catch (error) {
      console.error('Failed to load flags:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (flag: FeatureFlag) => {
    try {
      await adminApi.updateFeatureFlag(flag.key, { enabled: !flag.enabled });
      setFlags(flags.map(f => f.id === flag.id ? { ...f, enabled: !f.enabled } : f));
    } catch (error) {
      console.error('Failed to toggle flag:', error);
    }
  };

  const handleCreate = async () => {
    if (!formData.key || !formData.name) return;
    setIsProcessing(true);
    try {
      await adminApi.createFeatureFlag(formData);
      setShowCreateModal(false);
      setFormData({ key: '', name: '', description: '', defaultValue: true, scope: 'GLOBAL' });
      loadFlags();
    } catch (error) {
      console.error('Failed to create flag:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (flag: FeatureFlag) => {
    if (!confirm(`Delete flag "${flag.name}"?`)) return;
    try {
      await adminApi.deleteFeatureFlag(flag.key);
      loadFlags();
    } catch (error) {
      console.error('Failed to delete flag:', error);
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Feature Flags</h1>
          <p className="mt-1 text-sm text-gray-500">
            Enable or disable platform features by scope.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-admin-600 hover:bg-admin-700"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Flag
        </button>
      </div>

      {/* Filter */}
      <div className="mb-6 flex gap-4">
        <select
          value={filter.scope}
          onChange={(e) => setFilter({ scope: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
        >
          <option value="">All Scopes</option>
          {SCOPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Flags Grid */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">Loading flags...</p>
          </div>
        ) : flags.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No feature flags found. Create one to get started.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {flags.map((flag) => (
              <div key={flag.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-medium text-gray-900">{flag.name}</h3>
                      <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">{flag.key}</code>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        flag.scope === 'GLOBAL' ? 'bg-purple-100 text-purple-800' :
                        flag.scope === 'REGION' ? 'bg-blue-100 text-blue-800' :
                        flag.scope === 'ORG' ? 'bg-green-100 text-green-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {flag.scope}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">{flag.description}</p>
                  </div>
                  <div className="flex items-center gap-4 ml-4">
                    <button
                      onClick={() => handleToggle(flag)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                        flag.enabled ? 'bg-admin-600' : 'bg-gray-200'
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                        flag.enabled ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                    <button
                      onClick={() => handleDelete(flag)}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Create Feature Flag</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Key *</label>
                <input
                  type="text"
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                  placeholder="FEATURE_NAME"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                  placeholder="Feature Name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                  placeholder="What does this flag control?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scope *</label>
                <select
                  value={formData.scope}
                  onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                >
                  {SCOPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="defaultValue"
                  checked={formData.defaultValue}
                  onChange={(e) => setFormData({ ...formData, defaultValue: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-admin-600 focus:ring-admin-500"
                />
                <label htmlFor="defaultValue" className="text-sm text-gray-700">
                  Enabled by default
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({ key: '', name: '', description: '', defaultValue: true, scope: 'GLOBAL' });
                }}
                disabled={isProcessing}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={isProcessing || !formData.key || !formData.name}
                className="flex-1 py-2 px-4 bg-admin-600 text-white rounded-lg hover:bg-admin-700 disabled:opacity-50"
              >
                {isProcessing ? 'Creating...' : 'Create Flag'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
