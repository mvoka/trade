import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
    });

    this.client.interceptors.request.use(
      (config) => {
        const token = this.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          this.clearToken();
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  private getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('operator_token');
    }
    return null;
  }

  private clearToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('operator_token');
    }
  }

  setToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('operator_token', token);
    }
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  async patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.patch<T>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }
}

export const api = new ApiClient();

// API endpoints
export const operatorApi = {
  // Auth (uses main auth endpoints)
  login: (email: string, password: string) =>
    api.post<{ token: string; user: OperatorUser }>('/auth/login', { email, password }),

  logout: () => api.post('/auth/logout'),

  getProfile: () => api.get<OperatorUser>('/auth/me'),

  // Jobs & Queue
  getJobQueue: (params?: JobQueueParams) =>
    api.get<PaginatedResponse<Job>>('/api/operator/jobs', { params }),

  getJob: (id: string) => api.get<JobDetails>(`/api/operator/jobs/${id}`),

  getJobHistory: (id: string) => api.get<JobHistoryEntry[]>(`/api/operator/jobs/${id}/history`),

  getDispatchHistory: (id: string) => api.get<DispatchAttempt[]>(`/api/operator/jobs/${id}/dispatch-history`),

  // Dispatch
  manualDispatch: (jobId: string, proId: string, note?: string) =>
    api.post(`/api/operator/jobs/${jobId}/dispatch`, { proId, note }),

  searchPros: (params: ProSearchParams) =>
    api.get<Pro[]>('/api/operator/pros/search', { params }),

  getAvailablePros: (jobId: string) =>
    api.get<Pro[]>(`/api/operator/jobs/${jobId}/available-pros`),

  // Escalations
  getEscalatedJobs: (params?: JobQueueParams) =>
    api.get<PaginatedResponse<Job>>('/api/operator/escalations', { params }),

  overrideEscalation: (jobId: string, action: EscalationAction, note: string) =>
    api.post(`/api/operator/jobs/${jobId}/escalation/override`, { action, note }),

  // SLA Breaches
  getSlaBreaches: (params?: SlaBreachParams) =>
    api.get<PaginatedResponse<SlaBreachJob>>('/api/operator/sla-breaches', { params }),

  // Notes
  getJobNotes: (jobId: string) =>
    api.get<InternalNote[]>(`/api/operator/jobs/${jobId}/notes`),

  addJobNote: (jobId: string, content: string) =>
    api.post<InternalNote>(`/api/operator/jobs/${jobId}/notes`, { content }),

  // Contact Relay
  initiateContact: (jobId: string, contactType: ContactType, targetType: 'smb' | 'pro') =>
    api.post(`/api/operator/jobs/${jobId}/contact`, { contactType, targetType }),

  // Alerts
  getAlerts: () => api.get<Alert[]>('/api/operator/alerts'),

  dismissAlert: (alertId: string) =>
    api.post(`/api/operator/alerts/${alertId}/dismiss`),
};

// Types
export interface OperatorUser {
  id: string;
  email: string;
  name: string;
  role: 'OPERATOR' | 'OPERATOR_LEAD';
  avatar?: string;
}

export interface Job {
  id: string;
  referenceNumber: string;
  smbName: string;
  smbId: string;
  trade: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY';
  status: JobStatus;
  createdAt: string;
  slaDeadline: string;
  slaPercentage: number;
  escalated: boolean;
  assignedProId?: string;
  assignedProName?: string;
  location: {
    city: string;
    state: string;
  };
}

export interface JobDetails extends Job {
  description: string;
  smbPhone: string;
  smbEmail: string;
  address: string;
  scheduledDate?: string;
  scheduledTimeSlot?: string;
  history: JobHistoryEntry[];
  dispatchAttempts: DispatchAttempt[];
  notes: InternalNote[];
}

export type JobStatus =
  | 'PENDING'
  | 'DISPATCHING'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'EN_ROUTE'
  | 'ON_SITE'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ESCALATED';

export interface JobHistoryEntry {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  actorType: 'SYSTEM' | 'OPERATOR' | 'PRO' | 'SMB';
  details?: string;
}

export interface DispatchAttempt {
  id: string;
  proId: string;
  proName: string;
  timestamp: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'TIMEOUT' | 'CANCELLED';
  responseTime?: number;
  declineReason?: string;
}

export interface Pro {
  id: string;
  name: string;
  trade: string;
  rating: number;
  completedJobs: number;
  distance?: number;
  available: boolean;
  currentJobCount: number;
  phone: string;
}

export interface InternalNote {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

export interface SlaBreachJob extends Job {
  breachTime: string;
  breachDuration: number;
}

export interface Alert {
  id: string;
  type: 'SLA_WARNING' | 'SLA_BREACH' | 'ESCALATION' | 'DISPATCH_FAILURE';
  jobId: string;
  jobReference: string;
  message: string;
  createdAt: string;
  dismissed: boolean;
}

export type EscalationAction = 'RESOLVE' | 'REASSIGN' | 'CANCEL' | 'ESCALATE_FURTHER';
export type ContactType = 'CALL' | 'SMS' | 'EMAIL';

export interface JobQueueParams {
  page?: number;
  limit?: number;
  status?: JobStatus | JobStatus[];
  escalated?: boolean;
  slaBreached?: boolean;
  trade?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ProSearchParams {
  trade?: string;
  query?: string;
  available?: boolean;
  latitude?: number;
  longitude?: number;
  radius?: number;
}

export interface SlaBreachParams {
  page?: number;
  limit?: number;
  severity?: 'warning' | 'breach';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
