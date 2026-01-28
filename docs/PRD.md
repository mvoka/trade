# Trades Dispatch Platform - Product Requirements Document

## Overview

The Trades Dispatch Platform is a comprehensive SaaS solution designed for trades service businesses (HVAC, plumbing, electrical, pool service, etc.) to manage their operations, connect with customers, and grow their businesses.

## Vision

Transform how trades service businesses operate by providing an integrated platform that:
- Streamlines job dispatch and management
- Enables AI-powered automation for routine operations
- Connects homeowners with verified service professionals
- Provides subscription-based recurring service management
- Ensures compliance with marketing and data regulations

## Target Users

### Primary Users

1. **Service Business Owners/Operators**
   - Manage technician dispatch
   - Track jobs and revenue
   - Handle customer relationships
   - View analytics and reports

2. **Technicians/Pros**
   - Receive job assignments
   - Update job status in real-time
   - Build professional portfolios
   - Manage their schedules

3. **Homeowners/Consumers**
   - Request services
   - Subscribe to recurring maintenance plans
   - Manage their service history
   - Review and rate service providers

4. **Administrators**
   - Configure platform features
   - Manage feature flags and policies
   - Monitor system health
   - Handle compliance and reporting

## Core Features

### Phase 1: Foundation (Completed)

#### User Management
- Multi-role authentication (Admin, Operator, Pro, Consumer)
- JWT-based security with refresh tokens
- Organization-based multi-tenancy
- Role-based access control (RBAC)

#### Job Management
- Job creation with service categories
- Job lifecycle management (Draft → Assigned → In Progress → Completed)
- Photo attachments (before/after)
- Scheduling with preferred dates/times
- Location tracking and routing

#### Pro Profile Management
- Professional profiles with verification
- Service category specialization
- Availability scheduling
- Document management (licenses, insurance, certifications)

#### Document Management
- Secure file upload/download
- Job attachments
- Verification documents
- Portfolio items

### Phase 2: AI Agent Integration (Completed)

#### AI Agent Framework
- Conversational AI assistants for different user roles
- Skill-based architecture for extensible capabilities
- Tool integration for platform operations
- Session management with context preservation

#### Agent Types
- **DISPATCHER**: Job triage, routing, scheduling optimization
- **INTAKE_BOT**: Customer inquiry handling, job creation
- **TECH_ASSISTANT**: Technician support, checklists, documentation
- **ADMIN_AGENT**: System configuration, report generation

#### Core Skills
- JobManagement: CRUD operations, assignments, status updates
- Scheduling: Availability checking, appointment booking
- Routing: Optimal route calculation for technicians
- CustomerComms: Email/SMS notifications
- Reporting: Analytics and insights generation

#### Feature Flags & Policies
- Hierarchical flag system (Global → Region → Org → Category)
- Runtime feature toggling without deployment
- Configurable policies for business rules

### Phase 3: Marketplace Expansion (Completed)

#### Homeowner Module
- Consumer registration and profiles
- Property information management
- Marketing consent tracking
- Service history viewing

#### Subscriptions Module
- Service plan templates (weekly/monthly/quarterly/annual)
- Subscription lifecycle management
- Occurrence scheduling for recurring services
- Stripe Billing integration
- Automatic job creation from scheduled occurrences

#### Portfolio Enhancement
- Public portfolio pages with custom URLs
- Customer opt-in for photo sharing
- Theme customization
- Review integration

#### Offer Campaigns
- Lead generation landing pages
- Marketing consent capture
- Lead lifecycle management
- Follow-up tracking with compliance limits
- Compliance reporting

#### AI Agent Enhancements
- New skills: SubscriptionOps, PortfolioOps, OutreachOps, HomeownerConcierge
- New agent types for subscription and outreach management
- Automation modes: Manual, Assist, Auto
- Guardrails and approval workflows

#### Multi-Branch Support
- Headquarters, Branch, and Franchise organization types
- Region-based feature and policy inheritance
- Branch-specific configurations

## Technical Architecture

### Backend Stack
- **Framework**: NestJS (Node.js)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with passport.js
- **File Storage**: S3-compatible object storage
- **Job Queue**: BullMQ with Redis
- **AI Integration**: Anthropic Claude API

### Frontend Stack
- **Admin Dashboard**: Next.js (web-admin)
- **Operator Portal**: Next.js (web-operator)
- **Pro App**: Next.js (web-pro)
- **Shared UI**: Component library (@trades/ui)

### Infrastructure
- **Monorepo**: Turborepo with pnpm workspaces
- **Containerization**: Docker with docker-compose
- **CI/CD**: GitHub Actions
- **Deployment**: Cloud-native (AWS/GCP compatible)

## Security & Compliance

### Authentication & Authorization
- JWT tokens with short expiry
- Refresh token rotation
- Role-based access control
- API key authentication for integrations

### Data Protection
- Encryption at rest and in transit
- PII data handling compliance
- Marketing consent tracking
- Audit logging for all sensitive operations

### Compliance Features
- CASL (Canadian Anti-Spam Legislation) compliance
- GDPR-ready data handling
- Follow-up limits for lead management
- Consent verification workflows

## Success Metrics

### Business Metrics
- Job completion rate
- Customer satisfaction scores
- Subscription retention rate
- Lead conversion rate
- Revenue per technician

### Technical Metrics
- API response times (<200ms p95)
- System uptime (>99.9%)
- Error rates (<0.1%)
- AI agent task completion rate

## Roadmap

### Q1-Q2: Core Platform (Phase 1) ✅
- User and organization management
- Job dispatch and management
- Document handling
- Basic reporting

### Q3: AI Integration (Phase 2) ✅
- AI agent framework
- Core skills and tools
- Feature flags system
- Audit logging

### Q4: Marketplace (Phase 3) ✅
- Homeowner marketplace
- Subscription services
- Portfolio and lead generation
- Multi-branch support
- AI agent enhancements (automation modes, guardrails)

### Future: Advanced Features
- Mobile native apps
- Real-time GPS tracking
- Inventory management
- Financial integrations
- White-label solutions
