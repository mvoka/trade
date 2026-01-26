// Type definitions shared across the platform
import { z } from 'zod';

// ============================================
// USER ROLES
// ============================================
export const UserRole = {
  SMB_USER: 'SMB_USER',
  PRO_USER: 'PRO_USER',
  ADMIN: 'ADMIN',
  OPERATOR: 'OPERATOR',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

// ============================================
// VERIFICATION
// ============================================
export const VerificationStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  DENIED: 'DENIED',
  EXPIRED: 'EXPIRED',
} as const;
export type VerificationStatus = (typeof VerificationStatus)[keyof typeof VerificationStatus];

// ============================================
// JOB STATUS
// ============================================
export const JobStatus = {
  DRAFT: 'DRAFT',
  DISPATCHED: 'DISPATCHED',
  ACCEPTED: 'ACCEPTED',
  SCHEDULED: 'SCHEDULED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

// Job status transitions
export const JobStatusTransitions: Record<JobStatus, JobStatus[]> = {
  DRAFT: ['DISPATCHED', 'CANCELLED'],
  DISPATCHED: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['SCHEDULED', 'CANCELLED'],
  SCHEDULED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

// ============================================
// DISPATCH
// ============================================
export const DispatchAttemptStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
  TIMEOUT: 'TIMEOUT',
  CANCELLED: 'CANCELLED',
} as const;
export type DispatchAttemptStatus = (typeof DispatchAttemptStatus)[keyof typeof DispatchAttemptStatus];

// ============================================
// BOOKING
// ============================================
export const BookingMode = {
  EXACT: 'EXACT',
  WINDOW: 'WINDOW',
} as const;
export type BookingMode = (typeof BookingMode)[keyof typeof BookingMode];

export const BookingStatus = {
  PENDING_CONFIRMATION: 'PENDING_CONFIRMATION',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
  NO_SHOW: 'NO_SHOW',
} as const;
export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

// ============================================
// SCOPE
// ============================================
export const ScopeType = {
  GLOBAL: 'GLOBAL',
  REGION: 'REGION',
  ORG: 'ORG',
  SERVICE_CATEGORY: 'SERVICE_CATEGORY',
} as const;
export type ScopeType = (typeof ScopeType)[keyof typeof ScopeType];

// Scope hierarchy (higher index = more specific = higher priority)
export const ScopeHierarchy: ScopeType[] = ['GLOBAL', 'REGION', 'SERVICE_CATEGORY', 'ORG'];

// ============================================
// CONSENT
// ============================================
export const ConsentType = {
  TRANSACTIONAL_SMS: 'TRANSACTIONAL_SMS',
  MARKETING_SMS: 'MARKETING_SMS',
  TRANSACTIONAL_EMAIL: 'TRANSACTIONAL_EMAIL',
  MARKETING_EMAIL: 'MARKETING_EMAIL',
  CALL_RECORDING: 'CALL_RECORDING',
} as const;
export type ConsentType = (typeof ConsentType)[keyof typeof ConsentType];

// ============================================
// NOTIFICATION
// ============================================
export const NotificationChannel = {
  SMS: 'SMS',
  EMAIL: 'EMAIL',
  PUSH: 'PUSH',
  IN_APP: 'IN_APP',
} as const;
export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];

// ============================================
// MESSAGE SENDER
// ============================================
export const MessageSender = {
  SMB: 'SMB',
  PRO: 'PRO',
  SYSTEM: 'SYSTEM',
  OPERATOR: 'OPERATOR',
} as const;
export type MessageSender = (typeof MessageSender)[keyof typeof MessageSender];

// ============================================
// LEAD
// ============================================
export const LeadSource = {
  WEB_FORM: 'WEB_FORM',
  WEBHOOK: 'WEBHOOK',
  EMAIL: 'EMAIL',
  PHONE: 'PHONE',
  MANUAL: 'MANUAL',
} as const;
export type LeadSource = (typeof LeadSource)[keyof typeof LeadSource];

export const LeadStatus = {
  RAW: 'RAW',
  NORMALIZED: 'NORMALIZED',
  CONVERTED: 'CONVERTED',
  DUPLICATE: 'DUPLICATE',
  INVALID: 'INVALID',
} as const;
export type LeadStatus = (typeof LeadStatus)[keyof typeof LeadStatus];

// ============================================
// DAY OF WEEK
// ============================================
export const DayOfWeek = {
  MONDAY: 'MONDAY',
  TUESDAY: 'TUESDAY',
  WEDNESDAY: 'WEDNESDAY',
  THURSDAY: 'THURSDAY',
  FRIDAY: 'FRIDAY',
  SATURDAY: 'SATURDAY',
  SUNDAY: 'SUNDAY',
} as const;
export type DayOfWeek = (typeof DayOfWeek)[keyof typeof DayOfWeek];

// ============================================
// ATTACHMENT
// ============================================
export const AttachmentType = {
  BEFORE_PHOTO: 'BEFORE_PHOTO',
  AFTER_PHOTO: 'AFTER_PHOTO',
  DOCUMENT: 'DOCUMENT',
  OTHER: 'OTHER',
} as const;
export type AttachmentType = (typeof AttachmentType)[keyof typeof AttachmentType];

// ============================================
// PORTFOLIO
// ============================================
export const PortfolioVisibility = {
  PRIVATE: 'PRIVATE',
  PUBLIC: 'PUBLIC',
} as const;
export type PortfolioVisibility = (typeof PortfolioVisibility)[keyof typeof PortfolioVisibility];

// ============================================
// ZOD SCHEMAS
// ============================================

// Auth schemas
export const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
  role: z.enum(['SMB_USER', 'PRO_USER']).default('SMB_USER'),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof LoginSchema>;

// Job schemas
export const CreateJobSchema = z.object({
  serviceCategoryId: z.string().min(1, 'Service category is required'),
  contactName: z.string().min(1, 'Contact name is required'),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().min(10, 'Valid phone number required'),
  businessName: z.string().optional(),
  serviceAddressLine1: z.string().min(1, 'Address is required'),
  serviceAddressLine2: z.string().optional(),
  serviceCity: z.string().min(1, 'City is required'),
  serviceProvince: z.string().min(1, 'Province is required'),
  servicePostalCode: z.string().min(1, 'Postal code is required'),
  serviceCountry: z.string().default('CA'),
  serviceLat: z.number().optional(),
  serviceLng: z.number().optional(),
  title: z.string().optional(),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  preferredDateStart: z.string().datetime().optional(),
  preferredDateEnd: z.string().datetime().optional(),
  urgency: z.enum(['LOW', 'NORMAL', 'HIGH', 'EMERGENCY']).default('NORMAL'),
});
export type CreateJobInput = z.infer<typeof CreateJobSchema>;

// Booking schemas
export const CreateBookingSchema = z.object({
  jobId: z.string().min(1),
  proProfileId: z.string().min(1),
  mode: z.enum(['EXACT', 'WINDOW']),
  slotStart: z.string().datetime().optional(),
  slotEnd: z.string().datetime().optional(),
  windowStart: z.string().datetime().optional(),
  windowEnd: z.string().datetime().optional(),
});
export type CreateBookingInput = z.infer<typeof CreateBookingSchema>;

// Service area schema
export const ServiceAreaSchema = z.object({
  centerLat: z.number().min(-90).max(90),
  centerLng: z.number().min(-180).max(180),
  radiusKm: z.number().min(1).max(100),
});
export type ServiceAreaInput = z.infer<typeof ServiceAreaSchema>;

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Auth types
export interface JwtPayload {
  sub: string; // userId
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Scope context for flag/policy resolution
export interface ScopeContext {
  regionId?: string;
  orgId?: string;
  serviceCategoryId?: string;
}
