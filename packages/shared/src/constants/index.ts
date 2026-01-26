// Constants and configuration values shared across the platform

// ============================================
// FEATURE FLAG KEYS
// ============================================
export const FEATURE_FLAGS = {
  DISPATCH_ENABLED: 'DISPATCH_ENABLED',
  BOOKING_ENABLED: 'BOOKING_ENABLED',
  PHONE_AGENT_ENABLED: 'PHONE_AGENT_ENABLED',
  REQUIRE_BEFORE_PHOTOS: 'REQUIRE_BEFORE_PHOTOS',
  REQUIRE_AFTER_PHOTOS: 'REQUIRE_AFTER_PHOTOS',
  ENABLE_PREFERRED_CONTRACTOR: 'ENABLE_PREFERRED_CONTRACTOR',
  ENABLE_BOOST: 'ENABLE_BOOST',
  CONSENT_REQUIRED_FOR_RECORDING: 'CONSENT_REQUIRED_FOR_RECORDING',
  PORTFOLIO_OPT_IN_REQUIRED: 'PORTFOLIO_OPT_IN_REQUIRED',
} as const;

// ============================================
// POLICY KEYS
// ============================================
export const POLICY_KEYS = {
  BOOKING_MODE: 'BOOKING_MODE',
  PHONE_AGENT_MODE: 'PHONE_AGENT_MODE',
  SLA_ACCEPT_MINUTES: 'SLA_ACCEPT_MINUTES',
  SLA_SCHEDULE_HOURS: 'SLA_SCHEDULE_HOURS',
  SLA_STATUS_UPDATE_HOURS: 'SLA_STATUS_UPDATE_HOURS',
  DISPATCH_ESCALATION_STEPS: 'DISPATCH_ESCALATION_STEPS',
  IDENTITY_REVEAL_POLICY: 'IDENTITY_REVEAL_POLICY',
  VISIBILITY_DEFAULT_PHOTOS: 'VISIBILITY_DEFAULT_PHOTOS',
  DATA_RETENTION_DAYS: 'DATA_RETENTION_DAYS',
  MAX_DISPATCH_ATTEMPTS: 'MAX_DISPATCH_ATTEMPTS',
  LEAD_TIME_MINUTES: 'LEAD_TIME_MINUTES',
  BUFFER_MINUTES: 'BUFFER_MINUTES',
  MAX_BOOKINGS_PER_DAY: 'MAX_BOOKINGS_PER_DAY',
  CANCELLATION_HOURS: 'CANCELLATION_HOURS',
} as const;

// ============================================
// DEFAULT POLICY VALUES
// ============================================
export const DEFAULT_POLICIES = {
  [POLICY_KEYS.BOOKING_MODE]: 'EXACT',
  [POLICY_KEYS.PHONE_AGENT_MODE]: 'INBOUND_ONLY',
  [POLICY_KEYS.SLA_ACCEPT_MINUTES]: 5,
  [POLICY_KEYS.SLA_SCHEDULE_HOURS]: 24,
  [POLICY_KEYS.SLA_STATUS_UPDATE_HOURS]: 48,
  [POLICY_KEYS.DISPATCH_ESCALATION_STEPS]: [1, 2, 5],
  [POLICY_KEYS.IDENTITY_REVEAL_POLICY]: 'AFTER_ACCEPT_OR_PREFERRED_BOOKING',
  [POLICY_KEYS.VISIBILITY_DEFAULT_PHOTOS]: 'PRIVATE',
  [POLICY_KEYS.DATA_RETENTION_DAYS]: 365,
  [POLICY_KEYS.MAX_DISPATCH_ATTEMPTS]: 10,
  [POLICY_KEYS.LEAD_TIME_MINUTES]: 60,
  [POLICY_KEYS.BUFFER_MINUTES]: 15,
  [POLICY_KEYS.MAX_BOOKINGS_PER_DAY]: 10,
  [POLICY_KEYS.CANCELLATION_HOURS]: 24,
} as const;

// ============================================
// AUDIT ACTION TYPES
// ============================================
export const AUDIT_ACTIONS = {
  // Auth
  USER_REGISTERED: 'USER_REGISTERED',
  USER_LOGGED_IN: 'USER_LOGGED_IN',
  USER_LOGGED_OUT: 'USER_LOGGED_OUT',
  PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED: 'PASSWORD_RESET_COMPLETED',

  // Pro
  PRO_ONBOARDED: 'PRO_ONBOARDED',
  PRO_PROFILE_UPDATED: 'PRO_PROFILE_UPDATED',
  PRO_VERIFIED: 'PRO_VERIFIED',
  PRO_VERIFICATION_DENIED: 'PRO_VERIFICATION_DENIED',

  // Job
  JOB_CREATED: 'JOB_CREATED',
  JOB_UPDATED: 'JOB_UPDATED',
  JOB_STATUS_CHANGED: 'JOB_STATUS_CHANGED',
  JOB_COMPLETED: 'JOB_COMPLETED',
  JOB_CANCELLED: 'JOB_CANCELLED',

  // Dispatch
  DISPATCH_INITIATED: 'DISPATCH_INITIATED',
  DISPATCH_ACCEPTED: 'DISPATCH_ACCEPTED',
  DISPATCH_DECLINED: 'DISPATCH_DECLINED',
  DISPATCH_TIMEOUT: 'DISPATCH_TIMEOUT',
  DISPATCH_ESCALATED: 'DISPATCH_ESCALATED',
  DISPATCH_MANUAL_OVERRIDE: 'DISPATCH_MANUAL_OVERRIDE',

  // Booking
  BOOKING_CREATED: 'BOOKING_CREATED',
  BOOKING_CONFIRMED: 'BOOKING_CONFIRMED',
  BOOKING_CANCELLED: 'BOOKING_CANCELLED',

  // Documents
  DOCUMENT_UPLOADED: 'DOCUMENT_UPLOADED',
  DOCUMENT_ACCESSED: 'DOCUMENT_ACCESSED',
  DOCUMENT_DELETED: 'DOCUMENT_DELETED',

  // Admin
  FEATURE_FLAG_UPDATED: 'FEATURE_FLAG_UPDATED',
  POLICY_UPDATED: 'POLICY_UPDATED',
  DECLINE_REASON_CREATED: 'DECLINE_REASON_CREATED',
  DECLINE_REASON_UPDATED: 'DECLINE_REASON_UPDATED',

  // Agent
  AGENT_SESSION_STARTED: 'AGENT_SESSION_STARTED',
  AGENT_SESSION_ENDED: 'AGENT_SESSION_ENDED',
  AGENT_TOOL_CALLED: 'AGENT_TOOL_CALLED',
  AGENT_HUMAN_TAKEOVER: 'AGENT_HUMAN_TAKEOVER',

  // Operator
  OPERATOR_INTERVENTION: 'OPERATOR_INTERVENTION',
  OPERATOR_NOTE_ADDED: 'OPERATOR_NOTE_ADDED',
} as const;

// ============================================
// NOTIFICATION TYPES
// ============================================
export const NOTIFICATION_TYPES = {
  // Dispatch
  DISPATCH_NEW: 'DISPATCH_NEW',
  DISPATCH_ACCEPTED: 'DISPATCH_ACCEPTED',
  DISPATCH_DECLINED: 'DISPATCH_DECLINED',
  DISPATCH_TIMEOUT_WARNING: 'DISPATCH_TIMEOUT_WARNING',

  // Booking
  BOOKING_CONFIRMATION: 'BOOKING_CONFIRMATION',
  BOOKING_REMINDER: 'BOOKING_REMINDER',
  BOOKING_CANCELLED: 'BOOKING_CANCELLED',

  // Job
  JOB_SCHEDULED: 'JOB_SCHEDULED',
  JOB_STARTED: 'JOB_STARTED',
  JOB_COMPLETED: 'JOB_COMPLETED',

  // Verification
  VERIFICATION_SUBMITTED: 'VERIFICATION_SUBMITTED',
  VERIFICATION_APPROVED: 'VERIFICATION_APPROVED',
  VERIFICATION_DENIED: 'VERIFICATION_DENIED',
  DOCUMENT_EXPIRING: 'DOCUMENT_EXPIRING',

  // Messages
  NEW_MESSAGE: 'NEW_MESSAGE',
} as const;

// ============================================
// FILE UPLOAD
// ============================================
export const FILE_UPLOAD = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'image/jpeg', 'image/png'],
  MAX_BEFORE_PHOTOS: 5,
  MIN_BEFORE_PHOTOS: 1,
  MAX_AFTER_PHOTOS: 10,
  MIN_AFTER_PHOTOS: 1,
} as const;

// ============================================
// RATE LIMITING
// ============================================
export const RATE_LIMITS = {
  AUTH: {
    LOGIN: { points: 5, duration: 60 }, // 5 attempts per minute
    REGISTER: { points: 3, duration: 60 }, // 3 attempts per minute
    PASSWORD_RESET: { points: 3, duration: 300 }, // 3 attempts per 5 minutes
  },
  API: {
    DEFAULT: { points: 100, duration: 60 }, // 100 requests per minute
    UPLOAD: { points: 20, duration: 60 }, // 20 uploads per minute
    WEBHOOK: { points: 50, duration: 60 }, // 50 webhook calls per minute
  },
} as const;

// ============================================
// CACHE KEYS
// ============================================
export const CACHE_KEYS = {
  FEATURE_FLAG: (key: string, scopeType: string, scopeId?: string) =>
    `ff:${key}:${scopeType}:${scopeId || 'global'}`,
  POLICY: (key: string, scopeType: string, scopeId?: string) =>
    `policy:${key}:${scopeType}:${scopeId || 'global'}`,
  USER: (userId: string) => `user:${userId}`,
  PRO_PROFILE: (userId: string) => `pro:${userId}`,
  SERVICE_AREA: (proProfileId: string) => `service-area:${proProfileId}`,
  BOOKABLE_SLOTS: (proProfileId: string, date: string) =>
    `slots:${proProfileId}:${date}`,
} as const;

// ============================================
// CACHE TTL (in seconds)
// ============================================
export const CACHE_TTL = {
  FEATURE_FLAG: 300, // 5 minutes
  POLICY: 300, // 5 minutes
  USER: 600, // 10 minutes
  PRO_PROFILE: 600, // 10 minutes
  SERVICE_AREA: 3600, // 1 hour
  BOOKABLE_SLOTS: 60, // 1 minute
} as const;

// ============================================
// SERVICE CATEGORIES (Initial)
// ============================================
export const SERVICE_CATEGORIES = {
  ELECTRICAL: {
    code: 'ELECTRICAL',
    name: 'Electrical',
  },
  PLUMBING: {
    code: 'PLUMBING',
    name: 'Plumbing',
  },
} as const;

// ============================================
// REGIONS (Initial)
// ============================================
export const REGIONS = {
  YORK_REGION: {
    code: 'YORK_REGION',
    name: 'York Region',
    center: { lat: 44.0592, lng: -79.4614 },
  },
} as const;

// ============================================
// ERROR CODES
// ============================================
export const ERROR_CODES = {
  // Auth
  INVALID_CREDENTIALS: 'AUTH_001',
  TOKEN_EXPIRED: 'AUTH_002',
  TOKEN_INVALID: 'AUTH_003',
  EMAIL_NOT_VERIFIED: 'AUTH_004',
  USER_DISABLED: 'AUTH_005',
  INSUFFICIENT_PERMISSIONS: 'AUTH_006',

  // Validation
  VALIDATION_ERROR: 'VAL_001',
  MISSING_REQUIRED_FIELD: 'VAL_002',
  INVALID_FORMAT: 'VAL_003',

  // Resource
  NOT_FOUND: 'RES_001',
  ALREADY_EXISTS: 'RES_002',
  CONFLICT: 'RES_003',

  // Business Logic
  JOB_NOT_DISPATCHABLE: 'BIZ_001',
  PRO_NOT_AVAILABLE: 'BIZ_002',
  BOOKING_CONFLICT: 'BIZ_003',
  SLA_EXCEEDED: 'BIZ_004',
  PHOTOS_REQUIRED: 'BIZ_005',
  VERIFICATION_REQUIRED: 'BIZ_006',

  // External Services
  STORAGE_ERROR: 'EXT_001',
  NOTIFICATION_ERROR: 'EXT_002',
  PAYMENT_ERROR: 'EXT_003',

  // System
  INTERNAL_ERROR: 'SYS_001',
  SERVICE_UNAVAILABLE: 'SYS_002',
  RATE_LIMITED: 'SYS_003',
} as const;
