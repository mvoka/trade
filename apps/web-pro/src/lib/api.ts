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
      return localStorage.getItem('pro_token');
    }
    return null;
  }

  private clearToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('pro_token');
    }
  }

  setToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('pro_token', token);
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

  async upload<T>(url: string, formData: FormData, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, formData, {
      ...config,
      headers: {
        ...config?.headers,
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }
}

export const api = new ApiClient();

// API endpoints
export const proApi = {
  // Auth (uses main auth endpoints)
  login: (email: string, password: string) =>
    api.post<{ token: string; user: ProUser }>('/auth/login', { email, password }),

  register: (data: RegisterData) =>
    api.post<{ token: string; user: ProUser }>('/auth/register', data),

  logout: () => api.post('/auth/logout'),

  getProfile: () => api.get<ProUser>('/auth/me'),

  // Onboarding
  getOnboardingStatus: () => api.get<OnboardingStatus>('/api/pro/onboarding/status'),

  updateBusinessProfile: (data: BusinessProfileData) =>
    api.put<OnboardingStatus>('/api/pro/onboarding/profile', data),

  updateServiceArea: (data: ServiceAreaData) =>
    api.put<OnboardingStatus>('/api/pro/onboarding/service-area', data),

  updateServiceHours: (data: ServiceHoursData) =>
    api.put<OnboardingStatus>('/api/pro/onboarding/hours', data),

  uploadDocument: (type: DocumentType, file: FormData) =>
    api.upload<UploadedDocument>(`/api/pro/onboarding/documents/${type}`, file),

  completeOnboarding: () =>
    api.post<OnboardingStatus>('/api/pro/onboarding/complete'),

  // Dispatches
  getPendingDispatches: () =>
    api.get<Dispatch[]>('/api/pro/dispatches/pending'),

  getDispatch: (jobId: string) =>
    api.get<DispatchDetails>(`/api/pro/dispatches/${jobId}`),

  acceptDispatch: (jobId: string) =>
    api.post<Job>(`/api/pro/dispatches/${jobId}/accept`),

  declineDispatch: (jobId: string, reason: string, additionalNotes?: string) =>
    api.post(`/api/pro/dispatches/${jobId}/decline`, { reason, additionalNotes }),

  // Jobs (CRM)
  getJobs: (params?: JobListParams) =>
    api.get<PaginatedResponse<Job>>('/api/pro/jobs', { params }),

  getJob: (id: string) =>
    api.get<JobDetails>(`/api/pro/jobs/${id}`),

  updateJobStatus: (id: string, status: JobStatus) =>
    api.patch<Job>(`/api/pro/jobs/${id}/status`, { status }),

  startJob: (id: string) =>
    api.post<Job>(`/api/pro/jobs/${id}/start`),

  completeJob: (id: string, data: JobCompletionData) =>
    api.post<Job>(`/api/pro/jobs/${id}/complete`, data),

  uploadJobPhoto: (id: string, file: FormData, type: 'before' | 'after') =>
    api.upload<JobPhoto>(`/api/pro/jobs/${id}/photos?type=${type}`, file),

  // Availability
  getAvailability: () =>
    api.get<AvailabilityRules>('/api/pro/availability'),

  updateAvailability: (data: AvailabilityRules) =>
    api.put<AvailabilityRules>('/api/pro/availability', data),

  setUnavailable: (data: UnavailablePeriod) =>
    api.post<UnavailablePeriod>('/api/pro/availability/unavailable', data),

  removeUnavailable: (id: string) =>
    api.delete(`/api/pro/availability/unavailable/${id}`),

  // Bookings
  getUpcomingBookings: () =>
    api.get<Booking[]>('/api/pro/bookings/upcoming'),

  getBooking: (id: string) =>
    api.get<BookingDetails>(`/api/pro/bookings/${id}`),

  confirmBooking: (id: string) =>
    api.post<Booking>(`/api/pro/bookings/${id}/confirm`),

  // Portfolio
  getPortfolio: () =>
    api.get<PortfolioItem[]>('/api/pro/portfolio'),

  addPortfolioItem: (data: FormData) =>
    api.upload<PortfolioItem>('/api/pro/portfolio', data),

  removePortfolioItem: (id: string) =>
    api.delete(`/api/pro/portfolio/${id}`),

  updatePortfolioOptIn: (jobId: string, optIn: boolean) =>
    api.patch(`/api/pro/portfolio/opt-in/${jobId}`, { optIn }),

  // Profile Settings
  updateProfile: (data: ProfileUpdateData) =>
    api.put<ProUser>('/api/pro/profile', data),

  updateNotificationSettings: (data: NotificationSettings) =>
    api.put<NotificationSettings>('/api/pro/profile/notifications', data),

  // Messages
  getMessages: (jobId: string) =>
    api.get<Message[]>(`/api/pro/messages/${jobId}`),

  sendMessage: (jobId: string, content: string) =>
    api.post<Message>(`/api/pro/messages/${jobId}`, { content }),
};

// Types
export interface ProUser {
  id: string;
  email: string;
  name: string;
  phone: string;
  avatar?: string;
  businessName: string;
  trade: string;
  rating: number;
  completedJobs: number;
  onboardingComplete: boolean;
  verified: boolean;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  phone: string;
  trade: string;
}

export interface OnboardingStatus {
  profileComplete: boolean;
  serviceAreaComplete: boolean;
  hoursComplete: boolean;
  documentsComplete: boolean;
  allComplete: boolean;
  currentStep: OnboardingStep;
}

export type OnboardingStep = 'profile' | 'service-area' | 'hours' | 'documents' | 'complete';

export interface BusinessProfileData {
  businessName: string;
  description: string;
  yearsInBusiness: number;
  licenseNumber?: string;
  insuranceProvider?: string;
  trades: string[];
}

export interface ServiceAreaData {
  zipCodes: string[];
  radius: number;
  centerLatitude: number;
  centerLongitude: number;
}

export interface ServiceHoursData {
  schedule: DaySchedule[];
  emergencyAvailable: boolean;
}

export interface DaySchedule {
  day: DayOfWeek;
  enabled: boolean;
  slots: TimeSlot[];
}

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface TimeSlot {
  start: string; // HH:mm format
  end: string;
}

export type DocumentType = 'license' | 'insurance' | 'w9' | 'id';

export interface UploadedDocument {
  id: string;
  type: DocumentType;
  filename: string;
  url: string;
  uploadedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface Dispatch {
  id: string;
  jobId: string;
  referenceNumber: string;
  smbName: string;
  trade: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY';
  description: string;
  location: {
    city: string;
    state: string;
    distance: number;
  };
  scheduledDate?: string;
  scheduledTimeSlot?: string;
  slaDeadline: string;
  createdAt: string;
  expiresAt: string;
}

export interface DispatchDetails extends Dispatch {
  address: string;
  smbPhone: string;
  smbContactName: string;
  photos: string[];
  additionalNotes?: string;
}

export interface Job {
  id: string;
  referenceNumber: string;
  smbName: string;
  smbId: string;
  trade: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY';
  status: JobStatus;
  description: string;
  createdAt: string;
  acceptedAt?: string;
  scheduledDate?: string;
  scheduledTimeSlot?: string;
  completedAt?: string;
  location: {
    city: string;
    state: string;
  };
}

export interface JobDetails extends Job {
  address: string;
  smbPhone: string;
  smbContactName: string;
  photos: JobPhoto[];
  notes: string;
  estimatedAmount?: number;
  finalAmount?: number;
}

export type JobStatus =
  | 'ACCEPTED'
  | 'SCHEDULED'
  | 'EN_ROUTE'
  | 'ON_SITE'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export interface JobPhoto {
  id: string;
  url: string;
  type: 'before' | 'after';
  uploadedAt: string;
}

export interface JobCompletionData {
  summary: string;
  workPerformed: string;
  materialsUsed?: string;
  finalAmount?: number;
  customerSignature?: string;
}

export interface AvailabilityRules {
  schedule: DaySchedule[];
  emergencyAvailable: boolean;
  unavailablePeriods: UnavailablePeriod[];
}

export interface UnavailablePeriod {
  id?: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

export interface Booking {
  id: string;
  jobId: string;
  smbName: string;
  trade: string;
  scheduledDate: string;
  scheduledTimeSlot: string;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  location: {
    city: string;
    state: string;
  };
}

export interface BookingDetails extends Booking {
  address: string;
  smbPhone: string;
  smbContactName: string;
  description: string;
  notes?: string;
}

export interface PortfolioItem {
  id: string;
  jobId?: string;
  title: string;
  description?: string;
  images: string[];
  trade: string;
  createdAt: string;
}

export interface ProfileUpdateData {
  name?: string;
  phone?: string;
  businessName?: string;
  description?: string;
  avatar?: FormData;
}

export interface NotificationSettings {
  dispatchPush: boolean;
  dispatchSms: boolean;
  dispatchEmail: boolean;
  bookingPush: boolean;
  bookingSms: boolean;
  bookingEmail: boolean;
  messagePush: boolean;
}

export interface Message {
  id: string;
  jobId: string;
  senderId: string;
  senderName: string;
  senderType: 'PRO' | 'SMB' | 'SYSTEM';
  content: string;
  createdAt: string;
}

export interface JobListParams {
  page?: number;
  limit?: number;
  status?: JobStatus | JobStatus[];
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const DECLINE_REASONS = [
  { value: 'too_far', label: 'Location too far' },
  { value: 'not_available', label: 'Not available at scheduled time' },
  { value: 'workload', label: 'Current workload too high' },
  { value: 'not_qualified', label: 'Not qualified for this job type' },
  { value: 'pricing', label: 'Pricing concerns' },
  { value: 'other', label: 'Other (please specify)' },
] as const;
