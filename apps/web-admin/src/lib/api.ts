import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const api: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('admin_token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Admin API endpoints
export const adminApi = {
  // Auth (uses main auth endpoints)
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),

  // Dashboard
  getDashboardStats: () => api.get('/admin/dashboard/stats'),
  getRecentActivity: () => api.get('/admin/dashboard/activity'),

  // Verification
  getPendingVerifications: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get('/admin/verifications', { params }),
  getVerification: (id: string) => api.get(`/admin/verifications/${id}`),
  approveVerification: (id: string, data: { notes?: string }) =>
    api.post(`/admin/verifications/${id}/approve`, data),
  rejectVerification: (id: string, data: { reason: string; notes?: string }) =>
    api.post(`/admin/verifications/${id}/reject`, data),
  requestMoreInfo: (id: string, data: { fields: string[]; message: string }) =>
    api.post(`/admin/verifications/${id}/request-info`, data),

  // Feature Flags
  getFeatureFlags: (params?: { scope?: string; scopeId?: string }) =>
    api.get('/admin/feature-flags', { params }),
  getFeatureFlag: (key: string) => api.get(`/admin/feature-flags/${key}`),
  createFeatureFlag: (data: {
    key: string;
    name: string;
    description?: string;
    defaultValue: boolean;
    scope: string;
  }) => api.post('/admin/feature-flags', data),
  updateFeatureFlag: (key: string, data: { enabled?: boolean; scope?: string; scopeId?: string }) =>
    api.patch(`/admin/feature-flags/${key}`, data),
  deleteFeatureFlag: (key: string) => api.delete(`/admin/feature-flags/${key}`),

  // Policies
  getPolicies: (params?: { scope?: string; scopeId?: string; category?: string }) =>
    api.get('/admin/policies', { params }),
  getPolicy: (key: string) => api.get(`/admin/policies/${key}`),
  updatePolicy: (key: string, data: { value: unknown; scope: string; scopeId?: string }) =>
    api.patch(`/admin/policies/${key}`, data),
  resetPolicy: (key: string, scope: string, scopeId?: string) =>
    api.post(`/admin/policies/${key}/reset`, { scope, scopeId }),

  // SLA Configuration
  getSlaConfigs: () => api.get('/admin/sla-configs'),
  getSlaConfig: (id: string) => api.get(`/admin/sla-configs/${id}`),
  createSlaConfig: (data: {
    name: string;
    acceptMinutes: number;
    scheduleHours: number;
    escalationSteps: Array<{ afterMinutes: number; action: string; notifyRoles: string[] }>;
  }) => api.post('/admin/sla-configs', data),
  updateSlaConfig: (id: string, data: Partial<{
    name: string;
    acceptMinutes: number;
    scheduleHours: number;
    escalationSteps: Array<{ afterMinutes: number; action: string; notifyRoles: string[] }>;
  }>) => api.patch(`/admin/sla-configs/${id}`, data),
  deleteSlaConfig: (id: string) => api.delete(`/admin/sla-configs/${id}`),

  // Decline Reasons
  getDeclineReasons: (params?: { category?: string; active?: boolean }) =>
    api.get('/admin/decline-reasons', { params }),
  createDeclineReason: (data: { code: string; label: string; category: string; requiresNote: boolean }) =>
    api.post('/admin/decline-reasons', data),
  updateDeclineReason: (id: string, data: Partial<{ code: string; label: string; active: boolean; requiresNote: boolean }>) =>
    api.patch(`/admin/decline-reasons/${id}`, data),
  deleteDeclineReason: (id: string) => api.delete(`/admin/decline-reasons/${id}`),

  // Job Templates
  getJobTemplates: (params?: { category?: string; active?: boolean }) =>
    api.get('/admin/job-templates', { params }),
  getJobTemplate: (id: string) => api.get(`/admin/job-templates/${id}`),
  createJobTemplate: (data: {
    name: string;
    description: string;
    category: string;
    defaultDuration: number;
    checklist: string[];
    requiredSkills: string[];
  }) => api.post('/admin/job-templates', data),
  updateJobTemplate: (id: string, data: Partial<{
    name: string;
    description: string;
    category: string;
    defaultDuration: number;
    checklist: string[];
    requiredSkills: string[];
    active: boolean;
  }>) => api.patch(`/admin/job-templates/${id}`, data),
  deleteJobTemplate: (id: string) => api.delete(`/admin/job-templates/${id}`),

  // Dispatch Logs
  getDispatchLogs: (params?: {
    page?: number;
    limit?: number;
    jobId?: string;
    proId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }) => api.get('/admin/dispatch-logs', { params }),
  getDispatchLog: (id: string) => api.get(`/admin/dispatch-logs/${id}`),

  // Audit Logs
  getAuditLogs: (params?: {
    page?: number;
    limit?: number;
    userId?: string;
    action?: string;
    resource?: string;
    dateFrom?: string;
    dateTo?: string;
  }) => api.get('/admin/audit-logs', { params }),

  // Users
  getUsers: (params?: { page?: number; limit?: number; role?: string; search?: string }) =>
    api.get('/admin/users', { params }),
  getUser: (id: string) => api.get(`/admin/users/${id}`),
  updateUser: (id: string, data: Partial<{ role: string; status: string; permissions: string[] }>) =>
    api.patch(`/admin/users/${id}`, data),
  suspendUser: (id: string, reason: string) =>
    api.post(`/admin/users/${id}/suspend`, { reason }),
  activateUser: (id: string) =>
    api.post(`/admin/users/${id}/activate`),
};

export default api;
