'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';

interface DeclineReason {
  id: string;
  code: string;
  label: string;
  category: string;
  requiresNote: boolean;
  active: boolean;
  usageCount: number;
  createdAt: string;
}

const CATEGORIES = [
  { value: 'AVAILABILITY', label: 'Availability' },
  { value: 'LOCATION', label: 'Location' },
  { value: 'WORKLOAD', label: 'Workload' },
  { value: 'QUALIFICATION', label: 'Qualification' },
  { value: 'OTHER', label: 'Other' },
];

export default function DeclineReasonsPage() {
  const [reasons, setReasons] = useState<DeclineReason[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingReason, setEditingReason] = useState<DeclineReason | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    label: '',
    category: 'OTHER',
    requiresNote: false,
  });
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadReasons();
  }, []);

  const loadReasons = async () => {
    setIsLoading(true);
    try {
      const response = await adminApi.getDeclineReasons();
      setReasons(response.data.data || response.data || []);
    } catch (error) {
      console.error('Failed to load decline reasons:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.code || !formData.label) return;
    setIsProcessing(true);
    try {
      if (editingReason) {
        await adminApi.updateDeclineReason(editingReason.id, formData);
      } else {
        await adminApi.createDeclineReason(formData);
      }
      setShowModal(false);
      setEditingReason(null);
      resetForm();
      loadReasons();
    } catch (error) {
      console.error('Failed to save decline reason:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleActive = async (reason: DeclineReason) => {
    try {
      await adminApi.updateDeclineReason(reason.id, { active: !reason.active });
      setReasons(reasons.map(r => r.id === reason.id ? { ...r, active: !r.active } : r));
    } catch (error) {
      console.error('Failed to toggle status:', error);
    }
  };

  const handleDelete = async (reason: DeclineReason) => {
    if (reason.usageCount > 0) {
      alert('Cannot delete a reason that has been used. Deactivate it instead.');
      return;
    }
    if (!confirm(`Delete reason "${reason.label}"?`)) return;
    try {
      await adminApi.deleteDeclineReason(reason.id);
      loadReasons();
    } catch (error) {
      console.error('Failed to delete reason:', error);
    }
  };

  const resetForm = () => {
    setFormData({ code: '', label: '', category: 'OTHER', requiresNote: false });
  };

  const openEditModal = (reason: DeclineReason) => {
    setEditingReason(reason);
    setFormData({
      code: reason.code,
      label: reason.label,
      category: reason.category,
      requiresNote: reason.requiresNote,
    });
    setShowModal(true);
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Decline Reasons</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage reasons pros can use when declining dispatches.
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingReason(null);
            setShowModal(true);
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-admin-600 hover:bg-admin-700"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Reason
        </button>
      </div>

      {/* Reasons Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">Loading reasons...</p>
          </div>
        ) : reasons.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No decline reasons found. Add one to get started.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reason
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usage
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reasons.map((reason) => (
                <tr key={reason.id} className={!reason.active ? 'bg-gray-50' : ''}>
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{reason.label}</div>
                      <div className="text-xs text-gray-500">
                        <code>{reason.code}</code>
                        {reason.requiresNote && (
                          <span className="ml-2 text-orange-600">(requires note)</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-700">
                      {reason.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {reason.usageCount} times
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleToggleActive(reason)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                        reason.active ? 'bg-green-500' : 'bg-gray-200'
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                        reason.active ? 'translate-x-4' : 'translate-x-0'
                      }`} />
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => openEditModal(reason)}
                      className="text-admin-600 hover:text-admin-900 mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(reason)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingReason ? 'Edit Decline Reason' : 'Add Decline Reason'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                  placeholder="too_far"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Label *</label>
                <input
                  type="text"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                  placeholder="Location too far"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="requiresNote"
                  checked={formData.requiresNote}
                  onChange={(e) => setFormData({ ...formData, requiresNote: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-admin-600 focus:ring-admin-500"
                />
                <label htmlFor="requiresNote" className="text-sm text-gray-700">
                  Require additional note
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingReason(null);
                  resetForm();
                }}
                disabled={isProcessing}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isProcessing || !formData.code || !formData.label}
                className="flex-1 py-2 px-4 bg-admin-600 text-white rounded-lg hover:bg-admin-700 disabled:opacity-50"
              >
                {isProcessing ? 'Saving...' : editingReason ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
