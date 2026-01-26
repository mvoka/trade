import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

// Core modules
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { StorageModule } from './common/storage/storage.module';

// Feature modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrgsModule } from './modules/orgs/orgs.module';
import { VerificationModule } from './modules/verification/verification.module';
import { FeatureFlagsModule } from './modules/feature-flags/feature-flags.module';
import { LeadsModule } from './modules/leads/leads.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { DispatchModule } from './modules/dispatch/dispatch.module';
import { BookingModule } from './modules/booking/booking.module';
import { PreferredModule } from './modules/preferred/preferred.module';
import { CommunicationsModule } from './modules/communications/communications.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { AiAgentModule } from './modules/ai-agent/ai-agent.module';
import { AdminModule } from './modules/admin/admin.module';
import { OperatorModule } from './modules/operator/operator.module';
import { AuditModule } from './modules/audit/audit.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { HealthModule } from './modules/health/health.module';

// Common
import { ThrottlerGuard } from '@nestjs/throttler';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 10,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 50,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Core modules
    PrismaModule,
    RedisModule,
    StorageModule,

    // Feature modules
    AuthModule,
    UsersModule,
    OrgsModule,
    VerificationModule,
    FeatureFlagsModule,
    LeadsModule,
    JobsModule,
    DispatchModule,
    BookingModule,
    PreferredModule,
    CommunicationsModule,
    DocumentsModule,
    AiAgentModule,
    AdminModule,
    OperatorModule,
    AuditModule,
    PaymentsModule,
    HealthModule,
  ],
  providers: [
    // Global throttler guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Global exception filter
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    // Global logging interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    // Global response transform interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule {}
