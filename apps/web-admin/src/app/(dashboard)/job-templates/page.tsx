'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';

interface JobTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  defaultDuration: number;
  checklist: string[];
  requiredSkills: string[];
  active: boolean;
  createdAt: string;
}

const CATEGORIES = [
  { value: 'ELECTRICAL', label: 'Electrical' },
  { value: 'PLUMBING', label: 'Plumbing' },
  { value: 'HVAC', label: 'HVAC' },
  { value: 'GENERAL', label: 'General' },
];

export default function JobTemplatesPage() {
  const [templates, setTemplates] = useState<JobTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<JobTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'GENERAL',
    defaultDuration: 60,
    checklist: [''],
    requiredSkills: [''],
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    loadTemplates();
  }, [filter]);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const params = filter ? { category: filter } : undefined;
      const response = await adminApi.getJobTemplates(params);
      setTemplates(response.data.data || response.data || []);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.description) return;
    setIsProcessing(true);
    try {
      const data = {
        ...formData,
        checklist: formData.checklist.filter(Boolean),
        requiredSkills: formData.requiredSkills.filter(Boolean),
      };
      if (editingTemplate) {
        await adminApi.updateJobTemplate(editingTemplate.id, data);
      } else {
        await adminApi.createJobTemplate(data);
      }
      setShowModal(false);
      setEditingTemplate(null);
      resetForm();
      loadTemplates();
    } catch (error) {
      console.error('Failed to save template:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (template: JobTemplate) => {
    if (!confirm(`Delete template "${template.name}"?`)) return;
    try {
      await adminApi.deleteJobTemplate(template.id);
      loadTemplates();
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  };

  const handleToggleActive = async (template: JobTemplate) => {
    try {
      await adminApi.updateJobTemplate(template.id, { active: !template.active });
      setTemplates(templates.map(t => t.id === template.id ? { ...t, active: !t.active } : t));
    } catch (error) {
      console.error('Failed to toggle status:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: 'GENERAL',
      defaultDuration: 60,
      checklist: [''],
      requiredSkills: [''],
    });
  };

  const openEditModal = (template: JobTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description,
      category: template.category,
      defaultDuration: template.defaultDuration,
      checklist: template.checklist.length > 0 ? template.checklist : [''],
      requiredSkills: template.requiredSkills.length > 0 ? template.requiredSkills : [''],
    });
    setShowModal(true);
  };

  const addListItem = (field: 'checklist' | 'requiredSkills') => {
    setFormData({ ...formData, [field]: [...formData[field], ''] });
  };

  const updateListItem = (field: 'checklist' | 'requiredSkills', index: number, value: string) => {
    const newList = [...formData[field]];
    newList[index] = value;
    setFormData({ ...formData, [field]: newList });
  };

  const removeListItem = (field: 'checklist' | 'requiredSkills', index: number) => {
    if (formData[field].length <= 1) return;
    setFormData({ ...formData, [field]: formData[field].filter((_, i) => i !== index) });
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Job Templates</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create reusable templates for common job types.
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingTemplate(null);
            setShowModal(true);
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-admin-600 hover:bg-admin-700"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Template
        </button>
      </div>

      {/* Filter */}
      <div className="mb-6">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>
      </div>

      {/* Templates Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">Loading templates...</p>
          </div>
        ) : templates.length === 0 ? (
          <div className="col-span-full bg-white rounded-lg shadow p-8 text-center text-gray-500">
            No templates found. Create one to get started.
          </div>
        ) : (
          templates.map((template) => (
            <div
              key={template.id}
              className={`bg-white rounded-lg shadow p-6 ${!template.active ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">{template.name}</h3>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    template.category === 'ELECTRICAL' ? 'bg-yellow-100 text-yellow-800' :
                    template.category === 'PLUMBING' ? 'bg-blue-100 text-blue-800' :
                    template.category === 'HVAC' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {template.category}
                  </span>
                </div>
                <button
                  onClick={() => handleToggleActive(template)}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    template.active ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                    template.active ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              <p className="text-sm text-gray-500 mb-4 line-clamp-2">{template.description}</p>

              <div className="text-sm text-gray-600 mb-4">
                <span className="font-medium">{template.defaultDuration} min</span> estimated
              </div>

              {template.checklist.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 mb-1">Checklist ({template.checklist.length} items)</p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {template.checklist.slice(0, 3).map((item, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
                        </svg>
                        {item}
                      </li>
                    ))}
                    {template.checklist.length > 3 && (
                      <li className="text-gray-400 text-xs">+{template.checklist.length - 3} more</li>
                    )}
                  </ul>
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t">
                <button
                  onClick={() => openEditModal(template)}
                  className="flex-1 py-1.5 text-sm text-admin-600 hover:bg-admin-50 rounded"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(template)}
                  className="flex-1 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto py-8">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 my-auto max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingTemplate ? 'Edit Template' : 'New Template'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                  placeholder="e.g., Outlet Installation"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                  placeholder="Describe the job type..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration (min)</label>
                  <input
                    type="number"
                    value={formData.defaultDuration}
                    onChange={(e) => setFormData({ ...formData, defaultDuration: parseInt(e.target.value) || 60 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                    min={15}
                    step={15}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Checklist Items</label>
                  <button
                    type="button"
                    onClick={() => addListItem('checklist')}
                    className="text-sm text-admin-600 hover:text-admin-700"
                  >
                    + Add Item
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.checklist.map((item, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => updateListItem('checklist', idx, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                        placeholder="Checklist item..."
                      />
                      {formData.checklist.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeListItem('checklist', idx)}
                          className="p-2 text-gray-400 hover:text-red-500"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Required Skills</label>
                  <button
                    type="button"
                    onClick={() => addListItem('requiredSkills')}
                    className="text-sm text-admin-600 hover:text-admin-700"
                  >
                    + Add Skill
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.requiredSkills.map((skill, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        value={skill}
                        onChange={(e) => updateListItem('requiredSkills', idx, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                        placeholder="Skill..."
                      />
                      {formData.requiredSkills.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeListItem('requiredSkills', idx)}
                          className="p-2 text-gray-400 hover:text-red-500"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingTemplate(null);
                  resetForm();
                }}
                disabled={isProcessing}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isProcessing || !formData.name || !formData.description}
                className="flex-1 py-2 px-4 bg-admin-600 text-white rounded-lg hover:bg-admin-700 disabled:opacity-50"
              >
                {isProcessing ? 'Saving...' : editingTemplate ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
