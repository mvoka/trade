import { z } from 'zod';
import * as dotenv from 'dotenv';
import { join } from 'path';

// Load environment variables
dotenv.config({ path: join(process.cwd(), '.env') });

// Environment schema
const envSchema = z.object({
  // Node
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Database
  DATABASE_URL: z.string().min(1),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  // Storage
  STORAGE_ENDPOINT: z.string().default('http://localhost:9000'),
  STORAGE_ACCESS_KEY: z.string().min(1),
  STORAGE_SECRET_KEY: z.string().min(1),
  STORAGE_BUCKET: z.string().default('trades-dispatch'),

  // API
  API_PORT: z.string().default('3000').transform(Number),
  API_PREFIX: z.string().default('/api/v1'),

  // Frontend URLs
  SMB_APP_URL: z.string().default('http://localhost:3001'),
  PRO_APP_URL: z.string().default('http://localhost:3002'),
  ADMIN_APP_URL: z.string().default('http://localhost:3003'),
  OPERATOR_APP_URL: z.string().default('http://localhost:3004'),

  // Feature Flags (defaults)
  DEFAULT_SLA_ACCEPT_MINUTES: z.string().default('5').transform(Number),
  DEFAULT_SLA_SCHEDULE_HOURS: z.string().default('24').transform(Number),

  // LLM Configuration (AI Agents)
  ANTHROPIC_API_KEY: z.string().optional(),
  CLAUDE_MODEL_ID: z.string().default('claude-sonnet-4-20250514'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL_ID: z.string().default('gpt-4-turbo'),
  LLM_MAX_TOKENS: z.string().default('4096').transform(Number),
  LLM_TEMPERATURE: z.string().default('0.7').transform(Number),
  LLM_STREAMING_ENABLED: z.string().default('true').transform((v) => v === 'true'),
  LLM_FALLBACK_ENABLED: z.string().default('true').transform((v) => v === 'true'),
});

// Parse and validate environment
const parseEnv = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.format());
    throw new Error('Invalid environment configuration');
  }

  return result.data;
};

// Export validated config
export const config = parseEnv();

// Export typed config interface
export type Config = z.infer<typeof envSchema>;

// Individual config sections for convenience
export const databaseConfig = {
  url: config.DATABASE_URL,
};

export const redisConfig = {
  url: config.REDIS_URL,
};

export const jwtConfig = {
  secret: config.JWT_SECRET,
  accessExpiry: config.JWT_ACCESS_EXPIRY,
  refreshExpiry: config.JWT_REFRESH_EXPIRY,
};

export const storageConfig = {
  endpoint: config.STORAGE_ENDPOINT,
  accessKey: config.STORAGE_ACCESS_KEY,
  secretKey: config.STORAGE_SECRET_KEY,
  bucket: config.STORAGE_BUCKET,
};

export const apiConfig = {
  port: config.API_PORT,
  prefix: config.API_PREFIX,
};

export const frontendUrls = {
  smb: config.SMB_APP_URL,
  pro: config.PRO_APP_URL,
  admin: config.ADMIN_APP_URL,
  operator: config.OPERATOR_APP_URL,
};

export const defaultSla = {
  acceptMinutes: config.DEFAULT_SLA_ACCEPT_MINUTES,
  scheduleHours: config.DEFAULT_SLA_SCHEDULE_HOURS,
};

export const llmConfig = {
  anthropic: {
    apiKey: config.ANTHROPIC_API_KEY,
    modelId: config.CLAUDE_MODEL_ID,
  },
  openai: {
    apiKey: config.OPENAI_API_KEY,
    modelId: config.OPENAI_MODEL_ID,
  },
  maxTokens: config.LLM_MAX_TOKENS,
  temperature: config.LLM_TEMPERATURE,
  streamingEnabled: config.LLM_STREAMING_ENABLED,
  fallbackEnabled: config.LLM_FALLBACK_ENABLED,
};

// CORS origins
export const corsOrigins = [
  config.SMB_APP_URL,
  config.PRO_APP_URL,
  config.ADMIN_APP_URL,
  config.OPERATOR_APP_URL,
];

// Environment helpers
export const isDevelopment = config.NODE_ENV === 'development';
export const isProduction = config.NODE_ENV === 'production';
export const isTest = config.NODE_ENV === 'test';
