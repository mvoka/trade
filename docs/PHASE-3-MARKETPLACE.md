# Phase 3: Marketplace Expansion

## Overview

Phase 3 transforms the platform from an SMB-focused job dispatch system into a full homeowner marketplace with subscription services, professional portfolios, compliant lead generation, and enhanced AI automation.

## Architecture

### New Modules

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Phase 3 Module Architecture                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │    Homeowner     │  │  Subscriptions   │  │    Portfolio     │  │
│  │     Module       │  │     Module       │  │   Enhancement    │  │
│  │                  │  │                  │  │                  │  │
│  │ - Registration   │  │ - Service Plans  │  │ - Public Pages   │  │
│  │ - Profile Mgmt   │  │ - Subscriptions  │  │ - Opt-in Mgmt    │  │
│  │ - Service Hist   │  │ - Occurrences    │  │ - Themes         │  │
│  └──────────────────┘  │ - Stripe Billing │  └──────────────────┘  │
│                        └──────────────────┘                         │
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │     Offers       │  │    Branches      │  │   AI Agents      │  │
│  │     Module       │  │     Module       │  │   Enhancement    │  │
│  │                  │  │                  │  │                  │  │
│  │ - Campaigns      │  │ - Multi-branch   │  │ - New Skills     │  │
│  │ - Lead Capture   │  │ - Regions        │  │ - Automation     │  │
│  │ - Compliance     │  │ - Franchises     │  │ - Guardrails     │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Phase 3.1: Database Foundation

### New Enums

| Enum | Values | Description |
|------|--------|-------------|
| UserType | CONSUMER, BUSINESS | Distinguish user types |
| SubscriptionStatus | ACTIVE, PAUSED, CANCELLED, PAST_DUE, TRIAL | Subscription lifecycle |
| BillingInterval | WEEKLY, BIWEEKLY, MONTHLY, QUARTERLY, ANNUALLY | Billing frequencies |
| ServiceOccurrenceStatus | SCHEDULED, JOB_CREATED, COMPLETED, SKIPPED, CANCELLED | Visit states |
| OfferStatus | DRAFT, ACTIVE, PAUSED, EXPIRED, ARCHIVED | Campaign states |
| AgentAutomationMode | MANUAL, ASSIST, AUTO | Agent operation modes |
| BranchType | HEADQUARTERS, BRANCH, FRANCHISE | Organization types |

### New Models

#### ConsumerProfile
```prisma
model ConsumerProfile {
  id                   String    @id @default(uuid())
  userId               String    @unique
  propertyType         String?   // house, condo, commercial
  propertyAddressLine1 String?
  propertyAddressLine2 String?
  propertyCity         String?
  propertyProvince     String?
  propertyPostalCode   String?
  propertyLat          Float?
  propertyLng          Float?
  marketingOptIn       Boolean   @default(false)
  preferredContactMethod String? // email, phone, sms
  notes                String?

  user          User           @relation(fields: [userId])
  subscriptions Subscription[]
}
```

#### ServicePlan
```prisma
model ServicePlan {
  id                    String   @id @default(uuid())
  name                  String
  description           String?
  billingInterval       BillingInterval
  pricePerIntervalCents Int
  serviceCategoryId     String?
  proProfileId          String?
  estimatedDurationMins Int?
  serviceTemplate       Json?    // Default job template
  isActive              Boolean  @default(true)

  subscriptions Subscription[]
}
```

#### Subscription
```prisma
model Subscription {
  id                    String   @id @default(uuid())
  consumerProfileId     String
  servicePlanId         String
  proProfileId          String?
  status                SubscriptionStatus
  startDate             DateTime
  currentPeriodStart    DateTime?
  currentPeriodEnd      DateTime?
  pausedAt              DateTime?
  cancelledAt           DateTime?
  stripeSubscriptionId  String?
  stripeCustomerId      String?
  preferredDayOfWeek    Int?     // 0-6
  preferredTimeSlot     String?

  occurrences ServiceOccurrence[]
}
```

#### ServiceOccurrence
```prisma
model ServiceOccurrence {
  id               String   @id @default(uuid())
  subscriptionId   String
  scheduledDate    DateTime
  scheduledTimeSlot String?
  occurrenceNumber Int
  status           ServiceOccurrenceStatus
  jobId            String?  @unique
  jobCreatedAt     DateTime?
  completedAt      DateTime?
  skipReason       String?
  notes            String?
}
```

#### ProPortfolio
```prisma
model ProPortfolio {
  id            String   @id @default(uuid())
  proProfileId  String   @unique
  slug          String   @unique
  theme         String   @default("DEFAULT")
  isPublished   Boolean  @default(false)
  headline      String?
  bio           String?
  displayEmail  String?
  displayPhone  String?
  showReviews   Boolean  @default(true)
  socialLinks   Json?
  viewCount     Int      @default(0)
  publishedAt   DateTime?
}
```

#### OfferCampaign
```prisma
model OfferCampaign {
  id                      String   @id @default(uuid())
  slug                    String   @unique
  headline                String
  subheadline             String?
  offerType               OfferType
  discountValue           Int?
  status                  OfferStatus
  serviceCategoryId       String?
  regionId                String?
  heroImageUrl            String?
  termsText               String?
  expiresAt               DateTime?
  requiresMarketingConsent Boolean @default(true)
  customFields            Json?    // Additional form fields

  leads OfferLead[]
}
```

#### OfferLead
```prisma
model OfferLead {
  id                     String   @id @default(uuid())
  campaignId             String
  name                   String
  email                  String
  phone                  String?
  address                String?
  notes                  String?
  status                 LeadStatus
  marketingConsentGranted Boolean
  customFieldValues      Json?
  followUpCount          Int      @default(0)
  lastContactedAt        DateTime?
  convertedAt            DateTime?
}
```

## Phase 3.2: Homeowner & Subscriptions Modules

### Homeowner Module

**Feature Flag**: `HOMEOWNER_MARKETPLACE_ENABLED`

#### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /homeowner/register | Register as consumer |
| GET | /homeowner/profile | Get consumer profile |
| PUT | /homeowner/profile | Update profile |
| GET | /homeowner/subscriptions | List subscriptions |
| GET | /homeowner/jobs | List service history |

#### Consumer Registration Flow

```
1. User Registration
   └─ Create User with userType=CONSUMER

2. Profile Creation
   └─ Create ConsumerProfile with property details

3. Marketing Consent
   └─ Capture marketingOptIn preference

4. Service Discovery
   └─ Browse available service plans
```

### Subscriptions Module

**Feature Flag**: `SUBSCRIPTIONS_ENABLED`

#### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /service-plans | List available plans (public) |
| GET | /service-plans/:id | Get plan details (public) |
| POST | /subscriptions | Create subscription (checkout) |
| GET | /subscriptions/:id | Get subscription details |
| PUT | /subscriptions/:id/pause | Pause subscription |
| PUT | /subscriptions/:id/resume | Resume subscription |
| DELETE | /subscriptions/:id | Cancel subscription |
| GET | /subscriptions/:id/occurrences | List scheduled visits |
| PUT | /occurrences/:id/skip | Skip an occurrence |
| PUT | /occurrences/:id/reschedule | Reschedule occurrence |

#### Subscription Lifecycle

```
CREATE → TRIAL → ACTIVE ←→ PAUSED → CANCELLED
              ↓
         PAST_DUE → CANCELLED
```

#### Occurrence Scheduling

```typescript
// Automatic job creation from occurrences
// Runs via BullMQ scheduler or manual trigger

1. Find scheduled occurrences within window
   └─ SUBSCRIPTION_AUTO_CREATE_JOB_DAYS policy (default: 7)

2. For each occurrence without job:
   └─ Create Job from subscription template
   └─ Link job to occurrence
   └─ Update occurrence status to JOB_CREATED

3. Notify relevant parties
   └─ Consumer: upcoming service reminder
   └─ Pro: new job assignment
```

#### Stripe Integration (P2)

```typescript
// Checkout flow
1. User selects plan
2. Create Stripe Checkout Session
3. User completes payment on Stripe
4. Webhook: checkout.session.completed
   └─ Create Subscription record
   └─ Schedule first occurrence

// Recurring billing
1. Webhook: invoice.paid
   └─ Update billing period dates

2. Webhook: invoice.payment_failed
   └─ Update status to PAST_DUE
   └─ Send notification

3. Webhook: customer.subscription.deleted
   └─ Update status to CANCELLED
```

## Phase 3.3: Portfolio & Offers Modules

### Portfolio Enhancement

**Feature Flag**: `PRO_PORTFOLIO_ENABLED`

#### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /portfolio/:slug | Public portfolio page |
| GET | /portfolio/check-slug/:slug | Check slug availability |
| GET | /my-portfolio/:proProfileId | Get own portfolio |
| PUT | /my-portfolio/:proProfileId | Update settings |
| PUT | /my-portfolio/:proProfileId/publish | Publish portfolio |
| PUT | /my-portfolio/:proProfileId/unpublish | Unpublish |
| GET | /my-portfolio/:proProfileId/stats | Get analytics |
| POST | /my-portfolio/:proProfileId/items/from-job | Add from job |

#### Customer Opt-in Flow

```
1. Job Completed with Photos
   └─ Pro requests opt-in

2. Customer Notification
   └─ Email/SMS with opt-in request

3. Customer Response
   └─ Grant or deny permission

4. Portfolio Update
   └─ If granted, mark item as optInGranted=true
   └─ Item visible on public portfolio
```

#### Policy: `PORTFOLIO_REQUIRE_OPT_IN`
- Default: `true`
- When true, photos require customer consent for public display

### Offers Module

**Feature Flag**: `OFFER_CAMPAIGNS_ENABLED`

#### Endpoints

**Public**:
| Method | Path | Description |
|--------|------|-------------|
| GET | /offers/:slug | View offer landing page |
| POST | /offers/:slug/submit | Submit lead |

**Admin**:
| Method | Path | Description |
|--------|------|-------------|
| GET | /admin/offers | List campaigns |
| POST | /admin/offers | Create campaign |
| GET | /admin/offers/:id | Get campaign |
| PUT | /admin/offers/:id | Update campaign |
| PUT | /admin/offers/:id/activate | Activate |
| PUT | /admin/offers/:id/pause | Pause |
| PUT | /admin/offers/:id/archive | Archive |
| GET | /admin/offers/:id/stats | Get statistics |
| GET | /admin/offers/:id/leads | List leads |
| GET | /admin/offers/:id/compliance | Compliance report |
| PUT | /admin/leads/:id/status | Update lead status |
| POST | /admin/leads/:id/follow-up | Record follow-up |
| GET | /admin/leads/follow-up-queue | Get follow-up queue |
| POST | /admin/leads/opt-out | Process opt-out |

#### Lead Lifecycle

```
NEW → CONTACTED → QUALIFIED → CONVERTED
                           ↓
                         LOST
```

#### Compliance Features

1. **Marketing Consent**
   - Required flag per campaign
   - Stored per lead
   - Opt-out processing

2. **Follow-up Limits**
   - Policy: `OFFER_MAX_FOLLOWUPS` (default: 3)
   - Tracked per lead
   - Enforced at service level

3. **Compliance Reporting**
   - Consent rates
   - Follow-up metrics
   - Compliance score

## Phase 3.4: AI Agent Enhancements

### New Skills

| Skill | Actions | Feature Flag |
|-------|---------|--------------|
| SubscriptionOps | schedule, pause, resume, reschedule | AGENT_SUBSCRIPTION_OPS_ENABLED |
| PortfolioOps | add_item, update, publish, request_opt_in | AGENT_PORTFOLIO_OPS_ENABLED |
| OutreachOps | create_campaign, follow_up, check_compliance | AGENT_OUTREACH_OPS_ENABLED |
| HomeownerConcierge | book_service, manage_subscription, inquiry | AGENT_HOMEOWNER_CONCIERGE_ENABLED |

### New Agent Configurations

| Agent | Category | Description |
|-------|----------|-------------|
| SUBSCRIPTION_MANAGER | Operations | Subscription lifecycle with ASSIST/AUTO modes |
| HOMEOWNER_CONCIERGE | Customer-Facing | Homeowner booking & inquiries |
| PORTFOLIO_ASSISTANT | Contractor-Facing | Portfolio building assistance |
| OUTREACH_COORDINATOR | Operations | Compliant lead follow-up |

### Automation Modes

```
MANUAL    - Agent suggests, human executes
ASSIST    - Agent executes with human approval
AUTO      - Agent executes autonomously within guardrails
```

### Guardrails

| Guardrail | Policy | Default |
|-----------|--------|---------|
| Actions per hour | AUTOMATION_MAX_ACTIONS_PER_HOUR | 10 |
| Amount threshold | AUTOMATION_APPROVAL_THRESHOLD_CENTS | 10000 ($100) |
| Sensitive operations | Always require approval | - |

## Phase 3.5: Multi-Branch Support

### Branches Module

**Feature Flag**: `MULTI_BRANCH_ENABLED`

#### Branch Types

- **HEADQUARTERS**: Main organization
- **BRANCH**: Company-owned location
- **FRANCHISE**: Independent franchisee

#### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /orgs/:orgId/branches | List branches |
| POST | /orgs/:orgId/branches | Create branch |
| GET | /orgs/:orgId/branches/:id | Get branch |
| PUT | /orgs/:orgId/branches/:id | Update branch |

#### Configuration Inheritance

```
Organization Settings
  └─ Branch can inherit or override
       └─ Feature flags
       └─ Policies
       └─ Service categories
```

## Feature Flags Summary

| Flag | Default | Scope |
|------|---------|-------|
| HOMEOWNER_MARKETPLACE_ENABLED | false | REGION |
| SUBSCRIPTIONS_ENABLED | false | REGION |
| POOL_SERVICE_ENABLED | false | REGION |
| PRO_PORTFOLIO_ENABLED | true | GLOBAL |
| OFFER_CAMPAIGNS_ENABLED | false | REGION |
| MULTI_BRANCH_ENABLED | false | ORG |
| AGENT_ASSIST_MODE_ENABLED | false | ORG |
| AGENT_AUTO_MODE_ENABLED | false | ORG |
| AGENT_SUBSCRIPTION_OPS_ENABLED | false | GLOBAL |
| AGENT_PORTFOLIO_OPS_ENABLED | false | GLOBAL |
| AGENT_OUTREACH_OPS_ENABLED | false | GLOBAL |
| AGENT_HOMEOWNER_CONCIERGE_ENABLED | false | GLOBAL |

## Policies Summary

| Policy | Default | Description |
|--------|---------|-------------|
| SUBSCRIPTION_AUTO_CREATE_JOB_DAYS | 7 | Days before occurrence to create job |
| PORTFOLIO_REQUIRE_OPT_IN | true | Require customer opt-in for photos |
| OFFER_MAX_FOLLOWUPS | 3 | Max follow-up attempts per lead |
| AUTOMATION_MAX_ACTIONS_PER_HOUR | 10 | Guardrail for AUTO mode |
| AUTOMATION_APPROVAL_THRESHOLD_CENTS | 10000 | Amount requiring approval |

## Seed Data

### Pool Service Category
```typescript
{
  name: 'Pool Service',
  code: 'POOL_SERVICE'
}
```

### Sample Service Plans

| Plan | Billing | Price | Description |
|------|---------|-------|-------------|
| Weekly Pool Maintenance | Monthly | $199 | 4 visits/month |
| Bi-Weekly Pool Maintenance | Monthly | $129 | 2 visits/month |
| Pool Opening (Seasonal) | One-time | $299 | Spring opening |
| Pool Closing (Seasonal) | One-time | $249 | Fall closing |

## Verification Checklist

### Phase 3.1 (Database) ✅
- [x] Prisma schema updated
- [x] Migration generated and applied
- [x] Seed data loaded
- [x] Shared constants updated

### Phase 3.2 (Homeowner & Subscriptions) ✅
- [x] Homeowner module functional
- [x] Subscriptions module functional
- [x] Occurrence scheduling works
- [x] Feature flags respected

### Phase 3.3 (Portfolio & Offers) ✅
- [x] Portfolio pages render
- [x] Opt-in flow works
- [x] Offer campaigns functional
- [x] Lead capture works
- [x] Compliance enforced

### Phase 3.4 (AI Agents) ✅
- [x] New skills registered
- [x] New agent configs work
- [x] Automation modes function
- [x] Guardrails enforced

### Phase 3.5 (Integration) ✅
- [x] All modules imported in app.module.ts
- [x] API documentation updated
- [x] E2E tests pass
- [x] Build succeeds

## Implementation Status

**Phase 3 completed on 2026-01-28**

All modules are fully implemented and the API builds successfully.
