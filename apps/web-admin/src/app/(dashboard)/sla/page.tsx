'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';

interface SlaConfig {
  id: string;
  name: string;
  acceptMinutes: number;
  scheduleHours: number;
  escalationSteps: Array<{
    afterMinutes: number;
    action: string;
    notifyRoles: string[];
  }>;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

const ESCALATION_ACTIONS = [
  { value: 'NOTIFY', label: 'Send Notification' },
  { value: 'REASSIGN', label: 'Reassign to Next Pro' },
  { value: 'OPERATOR_ALERT', label: 'Alert Operator' },
  { value: 'MANAGER_ALERT', label: 'Alert Manager' },
];

const ROLES = ['OPERATOR', 'MANAGER', 'ADMIN'];

export default function SlaConfigPage() {
  const [configs, setConfigs] = useState<SlaConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SlaConfig | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    acceptMinutes: 5,
    scheduleHours: 24,
    escalationSteps: [{ afterMinutes: 5, action: 'REASSIGN', notifyRoles: ['OPERATOR'] }],
  });
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    setIsLoading(true);
    try {
      const response = await adminApi.getSlaConfigs();
      setConfigs(response.data.data || response.data || []);
    } catch (error) {
      console.error('Failed to load SLA configs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name) return;
    setIsProcessing(true);
    try {
      if (editingConfig) {
        await adminApi.updateSlaConfig(editingConfig.id, formData);
      } else {
        await adminApi.createSlaConfig(formData);
      }
      setShowModal(false);
      setEditingConfig(null);
      resetForm();
      loadConfigs();
    } catch (error) {
      console.error('Failed to save SLA config:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (config: SlaConfig) => {
    if (config.isDefault) {
      alert('Cannot delete the default SLA configuration.');
      return;
    }
    if (!confirm(`Delete SLA configuration "${config.name}"?`)) return;
    try {
      await adminApi.deleteSlaConfig(config.id);
      loadConfigs();
    } catch (error) {
      console.error('Failed to delete SLA config:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      acceptMinutes: 5,
      scheduleHours: 24,
      escalationSteps: [{ afterMinutes: 5, action: 'REASSIGN', notifyRoles: ['OPERATOR'] }],
    });
  };

  const openEditModal = (config: SlaConfig) => {
    setEditingConfig(config);
    setFormData({
      name: config.name,
      acceptMinutes: config.acceptMinutes,
      scheduleHours: config.scheduleHours,
      escalationSteps: config.escalationSteps,
    });
    setShowModal(true);
  };

  const addEscalationStep = () => {
    const lastStep = formData.escalationSteps[formData.escalationSteps.length - 1];
    setFormData({
      ...formData,
      escalationSteps: [
        ...formData.escalationSteps,
        { afterMinutes: (lastStep?.afterMinutes || 0) + 5, action: 'NOTIFY', notifyRoles: [] },
      ],
    });
  };

  const removeEscalationStep = (index: number) => {
    if (formData.escalationSteps.length <= 1) return;
    setFormData({
      ...formData,
      escalationSteps: formData.escalationSteps.filter((_, i) => i !== index),
    });
  };

  const updateEscalationStep = (index: number, field: string, value: unknown) => {
    setFormData({
      ...formData,
      escalationSteps: formData.escalationSteps.map((step, i) =>
        i === index ? { ...step, [field]: value } : step
      ),
    });
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SLA Configuration</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure response times and escalation rules.
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingConfig(null);
            setShowModal(true);
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-admin-600 hover:bg-admin-700"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Configuration
        </button>
      </div>

      {/* Configs List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">Loading configurations...</p>
          </div>
        ) : configs.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            No SLA configurations found. Create one to get started.
          </div>
        ) : (
          configs.map((config) => (
            <div key={config.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-medium text-gray-900">{config.name}</h3>
                    {config.isDefault && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-admin-100 text-admin-800 rounded-full">
                        Default
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEditModal(config)}
                    className="px-3 py-1.5 text-sm text-admin-600 hover:bg-admin-50 rounded-lg"
                  >
                    Edit
                  </button>
                  {!config.isDefault && (
                    <button
                      onClick={() => handleDelete(config)}
                      className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Accept Window</p>
                  <p className="text-2xl font-bold text-gray-900">{config.acceptMinutes} min</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Schedule Deadline</p>
                  <p className="text-2xl font-bold text-gray-900">{config.scheduleHours} hrs</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Escalation Steps</p>
                <div className="space-y-2">
                  {config.escalationSteps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-3 text-sm">
                      <span className="w-6 h-6 rounded-full bg-admin-100 text-admin-700 flex items-center justify-center text-xs font-medium">
                        {idx + 1}
                      </span>
                      <span className="text-gray-600">
                        After {step.afterMinutes} min:
                      </span>
                      <span className="font-medium text-gray-900">
                        {ESCALATION_ACTIONS.find(a => a.value === step.action)?.label || step.action}
                      </span>
                      {step.notifyRoles.length > 0 && (
                        <span className="text-gray-500">
                          → {step.notifyRoles.join(', ')}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto py-8">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 my-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingConfig ? 'Edit SLA Configuration' : 'New SLA Configuration'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                  placeholder="e.g., Standard SLA"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Accept Window (min)</label>
                  <input
                    type="number"
                    value={formData.acceptMinutes}
                    onChange={(e) => setFormData({ ...formData, acceptMinutes: parseInt(e.target.value) || 5 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                    min={1}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Schedule Deadline (hrs)</label>
                  <input
                    type="number"
                    value={formData.scheduleHours}
                    onChange={(e) => setFormData({ ...formData, scheduleHours: parseInt(e.target.value) || 24 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                    min={1}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Escalation Steps</label>
                  <button
                    type="button"
                    onClick={addEscalationStep}
                    className="text-sm text-admin-600 hover:text-admin-700"
                  >
                    + Add Step
                  </button>
                </div>
                <div className="space-y-3">
                  {formData.escalationSteps.map((step, idx) => (
                    <div key={idx} className="p-3 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Step {idx + 1}</span>
                        {formData.escalationSteps.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeEscalationStep(idx)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-500">After (min)</label>
                          <input
                            type="number"
                            value={step.afterMinutes}
                            onChange={(e) => updateEscalationStep(idx, 'afterMinutes', parseInt(e.target.value) || 0)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-admin-500"
                            min={0}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Action</label>
                          <select
                            value={step.action}
                            onChange={(e) => updateEscalationStep(idx, 'action', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-admin-500"
                          >
                            {ESCALATION_ACTIONS.map((action) => (
                              <option key={action.value} value={action.value}>{action.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="mt-2">
                        <label className="text-xs text-gray-500">Notify Roles</label>
                        <div className="flex gap-2 mt-1">
                          {ROLES.map((role) => (
                            <label key={role} className="flex items-center gap-1 text-xs">
                              <input
                                type="checkbox"
                                checked={step.notifyRoles.includes(role)}
                                onChange={(e) => {
                                  const roles = e.target.checked
                                    ? [...step.notifyRoles, role]
                                    : step.notifyRoles.filter(r => r !== role);
                                  updateEscalationStep(idx, 'notifyRoles', roles);
                                }}
                                className="rounded border-gray-300 text-admin-600 focus:ring-admin-500"
                              />
                              {role}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingConfig(null);
                  resetForm();
                }}
                disabled={isProcessing}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isProcessing || !formData.name}
                className="flex-1 py-2 px-4 bg-admin-600 text-white rounded-lg hover:bg-admin-700 disabled:opacity-50"
              >
                {isProcessing ? 'Saving...' : editingConfig ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
