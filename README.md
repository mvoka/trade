# Trades Dispatch Platform

A modular MVP monorepo for an SMB-first Trades Dispatch Platform serving Electrical and Plumbing contractors in York Region, Ontario.

## Overview

The platform enables:
- **Instant Job Dispatch**: Match SMBs with verified trade professionals
- **Pro Matching**: Based on location, category, and availability
- **Flexible Booking**: Exact slot or time window modes
- **CRM Tools**: Pipeline management for pros
- **Privacy-First**: Identity revealed only after job acceptance
- **Full Admin Control**: Feature flags and policy settings

## Architecture

```
/trades-dispatch-platform
├── /apps
│   ├── /api                 # NestJS backend (port 3000)
│   ├── /web-smb             # Next.js SMB portal (port 3001)
│   ├── /web-pro             # Next.js Pro portal (port 3002)
│   ├── /web-admin           # Next.js Admin console (port 3003)
│   └── /web-operator        # Next.js Operator console (port 3004)
├── /packages
│   ├── /prisma              # Prisma schema + migrations
│   ├── /shared              # Shared types, utils, constants
│   ├── /config              # Shared configuration
│   └── /ui                  # Shared UI components (shadcn/ui)
└── /docker
    └── docker-compose.yml   # PostgreSQL, Redis, MinIO
```

## Prerequisites

- Node.js >= 20.0.0
- pnpm >= 8.0.0
- Docker & Docker Compose
- PostgreSQL 15 (or use Docker)

## Getting Started

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Environment Setup

```bash
cp .env.example .env
# Edit .env with your database credentials
```

### 3. Start Infrastructure

```bash
# Start PostgreSQL, Redis, MinIO
pnpm docker:up
```

### 4. Database Setup

```bash
# Generate Prisma client
pnpm db:generate

# Run migrations
pnpm db:migrate

# Seed initial data
pnpm db:seed
```

### 5. Start Development

```bash
# Start all apps in development mode
pnpm dev
```

Access the applications:
- API: http://localhost:3000
- API Docs: http://localhost:3000/docs
- SMB Portal: http://localhost:3001
- Pro Portal: http://localhost:3002
- Admin Console: http://localhost:3003
- Operator Console: http://localhost:3004

## Default Users

After seeding, these users are available:

| Email | Password | Role |
|-------|----------|------|
| admin@tradesdispatch.com | Admin123! | ADMIN |
| operator@tradesdispatch.com | Admin123! | OPERATOR |
| smb@example.com | Admin123! | SMB_USER |
| pro.electric1@example.com | Admin123! | PRO_USER |
| pro.plumb1@example.com | Admin123! | PRO_USER |

## User Roles

| Role | Description |
|------|-------------|
| SMB_USER | Business requesting services |
| PRO_USER | Trade professional |
| ADMIN | Platform administrator |
| OPERATOR | Dispatcher staff |

## Key Features

### For SMBs
- Create jobs with before photos
- View anonymized pro info until acceptance
- Book exact time slots or time windows
- Message with assigned pro
- Save preferred contractors

### For Pros
- Onboarding wizard with document verification
- Dispatch inbox with accept/decline
- CRM pipeline for job management
- Availability and booking management
- Portfolio showcase

### For Admins
- Feature flags with scope hierarchy
- Policy settings configuration
- Pro verification approval
- SLA configuration
- Audit log viewing

### For Operators
- Live job queue
- Manual dispatch override
- Escalation controls
- SLA breach monitoring
- Contact relay

## Feature Flags

Feature flags support scope hierarchy: GLOBAL > REGION > ORG > SERVICE_CATEGORY

Key flags:
- `DISPATCH_ENABLED` - Enable automatic dispatch
- `BOOKING_ENABLED` - Enable booking
- `REQUIRE_BEFORE_PHOTOS` - Require photos at job creation
- `REQUIRE_AFTER_PHOTOS` - Require photos at completion
- `ENABLE_PREFERRED_CONTRACTOR` - Allow favorites
- `PHONE_AGENT_ENABLED` - Enable AI phone agent (P2)

## Policies

Configurable policies:
- `SLA_ACCEPT_MINUTES` - Time for pro to accept (default: 5)
- `SLA_SCHEDULE_HOURS` - Time to schedule (default: 24)
- `DISPATCH_ESCALATION_STEPS` - Escalation pattern (default: [1,2,5])
- `BOOKING_MODE` - EXACT or WINDOW
- `IDENTITY_REVEAL_POLICY` - When to reveal pro identity

## Scripts

```bash
# Development
pnpm dev           # Start all apps
pnpm build         # Build all apps
pnpm lint          # Lint all apps
pnpm test          # Run all tests

# Database
pnpm db:generate   # Generate Prisma client
pnpm db:migrate    # Run migrations
pnpm db:push       # Push schema to DB
pnpm db:seed       # Seed data

# Infrastructure
pnpm docker:up     # Start Docker services
pnpm docker:down   # Stop Docker services

# Cleanup
pnpm clean         # Clean build artifacts
```

## Testing

### Running Tests

```bash
# Run all tests
pnpm test

# Run unit tests only
pnpm test:unit

# Run integration tests
pnpm test:integration

# Run E2E tests (Playwright)
pnpm test:e2e

# Run tests with coverage
pnpm test:coverage
```

### Test Structure

```
apps/api/src/
├── modules/
│   ├── auth/
│   │   └── auth.service.spec.ts      # 18 unit tests
│   ├── booking/
│   │   └── booking.service.spec.ts   # 37 unit tests
│   ├── dispatch/
│   │   └── dispatch.service.spec.ts  # 24 unit tests
│   └── feature-flags/
│       └── feature-flags.service.spec.ts  # 24 unit tests
└── test/
    ├── setup.ts                 # Unit test setup
    ├── integration-setup.ts     # Integration test setup
    └── test-utils.ts           # Test utilities
```

### Test Coverage

Current test coverage includes:
- **Auth Service**: Registration, login, logout, token refresh, password reset
- **Feature Flags**: Scope resolution, caching, CRUD operations
- **Dispatch Service**: Pro matching, accept/decline, SLA timeouts, escalation
- **Booking Service**: Exact/window modes, confirmation, cancellation, policies

### Test Utilities

The `test-utils.ts` provides helpers for integration tests:
- `createTestApp()` - Create NestJS test application
- `cleanupTestApp()` - Cleanup after tests
- `createTestUser()` - Create test users with hashed passwords
- `getAuthTokens()` - Get JWT tokens for authenticated requests
- `authHeader()` - Generate Authorization header

## Tech Stack

- **Backend**: NestJS, Prisma, PostgreSQL, Redis, BullMQ
- **Frontend**: Next.js 14, React, Tailwind CSS, shadcn/ui
- **State**: Zustand
- **Forms**: React Hook Form + Zod
- **Testing**: Vitest, Supertest, Playwright
- **Infrastructure**: Docker, MinIO (S3-compatible)

## Service Categories

Initial categories:
- Electrical
- Plumbing

## Geographic Coverage

Initial market: York Region, Ontario

## API Documentation

Swagger documentation available at `/docs` when running the API.

## License

Proprietary - All rights reserved.
