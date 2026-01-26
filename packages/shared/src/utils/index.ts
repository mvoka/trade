// Utility functions shared across the platform

/**
 * Calculate distance between two points using Haversine formula
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Check if a point is within a radius of a center point
 */
export function isWithinRadius(
  centerLat: number,
  centerLng: number,
  pointLat: number,
  pointLng: number,
  radiusKm: number
): boolean {
  const distance = calculateDistance(centerLat, centerLng, pointLat, pointLng);
  return distance <= radiusKm;
}

/**
 * Generate a random alphanumeric string
 */
export function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate a job number in format: JOB-YYYYMMDD-XXXX
 */
export function generateJobNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = generateRandomString(4).toUpperCase();
  return `JOB-${dateStr}-${random}`;
}

/**
 * Parse time string (HH:mm) to minutes from midnight
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes from midnight to time string (HH:mm)
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Check if current time is within service hours
 */
export function isWithinServiceHours(
  startTime: string,
  endTime: string,
  currentTime?: Date
): boolean {
  const now = currentTime || new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

/**
 * Get day of week as enum value
 */
export function getDayOfWeek(date: Date): string {
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  return days[date.getDay()];
}

/**
 * Mask sensitive data for logging
 */
export function maskSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'creditCard', 'ssn', 'sin'];
  const masked: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (sensitiveKeys.some((k) => key.toLowerCase().includes(k.toLowerCase()))) {
      masked[key] = '***MASKED***';
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = maskSensitiveData(value as Record<string, unknown>);
    } else {
      masked[key] = value;
    }
  }

  return masked;
}

/**
 * Mask PII in text (phone numbers, emails)
 */
export function maskPII(text: string): string {
  // Mask email addresses
  let masked = text.replace(
    /([a-zA-Z0-9._-]+)@([a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi,
    (match, local) => `${local.charAt(0)}***@***`
  );

  // Mask phone numbers (various formats)
  masked = masked.replace(
    /(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
    '***-***-$4'
  );

  return masked;
}

/**
 * Deep merge objects
 */
export function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceValue = source[key];
    const targetValue = result[key];

    if (
      sourceValue &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      ) as T[keyof T];
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue as T[keyof T];
    }
  }

  return result;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Create a fingerprint for lead deduplication
 */
export function createLeadFingerprint(
  email?: string,
  phone?: string,
  address?: string
): string {
  const parts = [
    email?.toLowerCase().trim(),
    phone?.replace(/\D/g, ''),
    address?.toLowerCase().replace(/\s+/g, ' ').trim(),
  ].filter(Boolean);

  return parts.join('|');
}

/**
 * Validate Canadian postal code
 */
export function isValidCanadianPostalCode(postalCode: string): boolean {
  const regex = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;
  return regex.test(postalCode);
}

/**
 * Format Canadian postal code
 */
export function formatPostalCode(postalCode: string): string {
  const cleaned = postalCode.replace(/\s|-/g, '').toUpperCase();
  if (cleaned.length === 6) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
  }
  return cleaned;
}

/**
 * Calculate pro ranking score
 */
export function calculateProRankingScore(
  distance: number,
  avgResponseMinutes: number | null,
  completionRate: number | null,
  totalJobsCompleted: number
): number {
  // Weights for different factors
  const distanceWeight = 0.4;
  const responseWeight = 0.3;
  const completionWeight = 0.2;
  const experienceWeight = 0.1;

  // Normalize distance (closer is better, max 50km)
  const distanceScore = Math.max(0, 1 - distance / 50);

  // Normalize response time (faster is better, max 30 minutes)
  const responseScore = avgResponseMinutes
    ? Math.max(0, 1 - avgResponseMinutes / 30)
    : 0.5; // Default if no data

  // Completion rate is already 0-1
  const completionScore = completionRate ?? 0.5;

  // Normalize experience (more is better, diminishing returns after 100 jobs)
  const experienceScore = Math.min(1, totalJobsCompleted / 100);

  return (
    distanceScore * distanceWeight +
    responseScore * responseWeight +
    completionScore * completionWeight +
    experienceScore * experienceWeight
  );
}
