# AI Agents & Skills Recommendations

## Executive Summary

Based on the comprehensive codebase analysis of the Trades Dispatch Platform, this document outlines recommendations for:
1. New AI agents to build
2. Skills for the LLM to offer
3. Market positioning and value propositions
4. Code simplification opportunities

---

## 1. AI AGENTS TO BUILD

### 1.1 Customer-Facing Agents

#### **Dispatch Concierge Agent**
- **Purpose**: Handle inbound customer inquiries via phone, SMS, chat
- **Capabilities**:
  - Gather job requirements through natural conversation
  - Qualify leads and determine urgency
  - Provide instant quotes based on service category
  - Schedule jobs with preferred or available contractors
  - Answer FAQs about service areas, pricing, policies
- **Integration Points**: LeadsModule, JobsModule, BookingModule, CommunicationsModule
- **Revenue Impact**: Reduces call center costs by 60-80%, 24/7 availability

#### **Job Status Agent**
- **Purpose**: Proactive and reactive job status updates
- **Capabilities**:
  - Send automated status updates at key milestones
  - Answer "where's my contractor?" queries
  - Handle rescheduling requests
  - Collect post-job satisfaction feedback
  - Escalate issues to human operators when needed
- **Integration Points**: JobsModule, DispatchModule, CommunicationsModule, AuditModule

#### **Quote Assistant Agent**
- **Purpose**: Generate instant quotes for common services
- **Capabilities**:
  - Use historical job data to estimate costs
  - Factor in service category, location, urgency
  - Provide price ranges with confidence levels
  - Upsell complementary services
  - Handle negotiation within policy limits
- **Integration Points**: JobsModule, PolicyModule (pricing rules), LeadsModule

### 1.2 Contractor-Facing Agents

#### **Dispatch Optimizer Agent**
- **Purpose**: Intelligent job matching and route optimization
- **Capabilities**:
  - Analyze contractor availability, location, skills
  - Optimize for minimizing drive time
  - Balance workload across contractors
  - Predict SLA risks and preemptively escalate
  - Learn from accept/decline patterns
- **Integration Points**: DispatchModule, BookingModule, ProProfile, AvailabilityService

#### **Contractor Onboarding Agent**
- **Purpose**: Guide new contractors through verification
- **Capabilities**:
  - Walk through document requirements step-by-step
  - Validate uploaded documents
  - Answer licensing/insurance questions
  - Schedule verification calls
  - Track onboarding progress
- **Integration Points**: VerificationModule, UsersModule, CommunicationsModule

#### **Earnings Optimizer Agent**
- **Purpose**: Help contractors maximize their earnings
- **Capabilities**:
  - Analyze job acceptance patterns
  - Recommend optimal availability windows
  - Suggest service area expansions
  - Identify high-value job opportunities
  - Provide performance insights
- **Integration Points**: ProProfile, DispatchModule, BookingModule, PaymentsModule

### 1.3 Operations Agents

#### **SLA Guardian Agent**
- **Purpose**: Monitor and prevent SLA breaches
- **Capabilities**:
  - Real-time SLA countdown monitoring
  - Predictive breach detection
  - Automated escalation triggering
  - Smart contractor reassignment
  - Generate SLA compliance reports
- **Integration Points**: DispatchModule, EscalationService, AuditModule, NotificationService

#### **Quality Assurance Agent**
- **Purpose**: Monitor service quality and compliance
- **Capabilities**:
  - Analyze customer feedback sentiment
  - Flag contractors with declining ratings
  - Detect fraudulent or suspicious activity
  - Monitor for compliance violations
  - Generate quality scorecards
- **Integration Points**: JobsModule, AuditModule, ProProfile, CommunicationsModule

#### **Capacity Planning Agent**
- **Purpose**: Predict and manage contractor capacity
- **Capabilities**:
  - Forecast demand by region and service category
  - Identify capacity gaps before they become problems
  - Recommend contractor recruitment targets
  - Analyze seasonal patterns
  - Optimize pricing based on supply/demand
- **Integration Points**: DispatchModule, BookingModule, ProProfile, FeatureFlagsModule

### 1.4 Admin Agents

#### **Policy Configuration Agent**
- **Purpose**: Help admins configure complex policies
- **Capabilities**:
  - Natural language policy creation
  - Impact analysis before policy changes
  - A/B testing recommendations
  - Compliance checking
  - Policy documentation generation
- **Integration Points**: PolicyModule, FeatureFlagsModule, AuditModule

#### **Analytics Insight Agent**
- **Purpose**: Generate actionable insights from data
- **Capabilities**:
  - Daily/weekly performance summaries
  - Anomaly detection and alerts
  - Trend analysis and forecasting
  - Competitive benchmarking
  - Custom report generation
- **Integration Points**: All modules (read-only), External BI tools

---

## 2. LLM SKILLS TO OFFER

### 2.1 Core Business Skills

| Skill Name | Description | Market Value |
|------------|-------------|--------------|
| **Job Intake** | Conversationally gather job requirements | High - Reduces friction |
| **Quote Generation** | Instant pricing estimates | High - Speeds sales cycle |
| **Schedule Management** | Natural language booking | High - User experience |
| **Status Inquiry** | Answer "where's my contractor?" | Medium - Reduces support calls |
| **Issue Escalation** | Detect and route problems | Medium - Customer satisfaction |
| **Feedback Collection** | Post-job satisfaction surveys | Medium - Quality data |

### 2.2 Contractor Skills

| Skill Name | Description | Market Value |
|------------|-------------|--------------|
| **Availability Management** | Voice/text availability updates | High - Contractor adoption |
| **Job Acceptance** | Quick accept/decline with reasons | High - Response time |
| **Route Planning** | Daily job optimization | Medium - Efficiency |
| **Earnings Tracking** | Income summaries and projections | Medium - Engagement |
| **Document Upload** | Guided verification uploads | Medium - Onboarding |

### 2.3 Operations Skills

| Skill Name | Description | Market Value |
|------------|-------------|--------------|
| **Dispatch Override** | Manual dispatch with justification | High - Control |
| **Escalation Handling** | Voice escalation management | High - SLA compliance |
| **Contractor Search** | Find available contractors fast | Medium - Efficiency |
| **Audit Trail** | Natural language audit queries | Medium - Compliance |
| **Report Generation** | Custom analytics on demand | Medium - Insights |

### 2.4 Integration Skills

| Skill Name | Description | Market Value |
|------------|-------------|--------------|
| **Calendar Sync** | Google/M365 integration | High - Contractor UX |
| **Payment Processing** | Stripe payment flows | High - Revenue |
| **SMS Relay** | Privacy-preserving messaging | Medium - Trust |
| **Email Parsing** | Lead extraction from emails | Medium - Lead capture |
| **Webhook Processing** | External system integration | Medium - Ecosystem |

---

## 3. MARKET POSITIONING & VALUE PROPOSITIONS

### 3.1 Primary Market Opportunity

**Target**: SMB Trades Dispatch for Electrical & Plumbing in Ontario (York Region initial)

**Why This Market**:
- Fragmented industry with no dominant player
- High pain points: scheduling chaos, no-shows, payment disputes
- Growing demand for home services
- Government retrofit incentives creating demand surge

### 3.2 Unique Value Propositions

#### For SMBs (Customers)
1. **Instant Dispatch**: Get a contractor in minutes, not hours
2. **Privacy-First**: Contractor identity protected until commitment
3. **Quality Guaranteed**: Verified, insured professionals only
4. **Transparent Pricing**: No surprise fees, milestone payments
5. **AI-Powered Support**: 24/7 assistance via voice/chat

#### For Contractors (Pros)
1. **Steady Work Flow**: Algorithmic job matching to your skills
2. **Fair Dispatch**: Ranking based on performance, not favoritism
3. **Instant Pay**: Milestone-based payments via Stripe
4. **Minimal Admin**: AI handles scheduling, reminders, invoicing
5. **Growth Tools**: Analytics to optimize your business

#### For Platform (Business)
1. **Lower CAC**: AI agents reduce acquisition costs
2. **Higher LTV**: Better matching = repeat customers
3. **Scalable Ops**: Fewer operators needed per region
4. **Data Moat**: Learning from every interaction
5. **Expansion Ready**: Policy engine enables multi-region

### 3.3 Competitive Differentiation

| Feature | TradesDispatch | Traditional Platforms | DIY Apps |
|---------|---------------|----------------------|----------|
| AI Dispatch | Native | Bolt-on | None |
| Privacy Protection | Built-in | None | None |
| Policy Engine | Scope-aware | Fixed rules | None |
| Voice Support | Native | Call center | None |
| Instant Quotes | AI-powered | Manual | None |
| SLA Guarantees | Automated | Manual tracking | None |

### 3.4 Expansion Roadmap

**Phase 1** (Current): York Region, ON - Electrical & Plumbing
**Phase 2**: GTA expansion, add HVAC
**Phase 3**: Ontario-wide, add General Contracting
**Phase 4**: Canada major metros
**Phase 5**: US market entry (Texas, Florida)

---

## 4. CODE SIMPLIFICATION OPPORTUNITIES

### 4.1 Module Consolidation

| Current | Recommendation | Benefit |
|---------|---------------|---------|
| Separate SMS/Email/Push services | Unified NotificationService | Simpler API, consistent behavior |
| LeadsModule + JobsModule overlap | LeadNormalized → Job conversion in single transaction | Cleaner data flow |
| Multiple queue processors | Unified job processor with task routing | Easier debugging |

### 4.2 Code Deduplication

| Area | Issue | Solution |
|------|-------|----------|
| Status transitions | Duplicated across Job, Dispatch, Booking | State machine pattern |
| Validation logic | Repeated in controllers and services | Shared validation service |
| Date/time handling | Inconsistent timezone handling | Centralized DateTimeService |
| Error responses | Different formats across modules | Unified error factory |

### 4.3 Simplification Priorities

1. **High Priority**
   - Consolidate notification channels into single service
   - Create unified state machine for job lifecycle
   - Standardize API response format across all controllers

2. **Medium Priority**
   - Extract common validation patterns into shared decorators
   - Consolidate date/time utilities
   - Create unified audit logging decorator

3. **Low Priority**
   - Refactor Redis caching into consistent pattern
   - Standardize queue naming conventions
   - Consolidate test utilities

### 4.4 Architecture Recommendations

#### Current Pain Points
- 18 feature modules may be too granular
- Some modules have significant overlap
- AI agent module could be split by concern

#### Proposed Simplification
```
/modules
  /core          # Auth, Users, Orgs (identity)
  /jobs          # Jobs, Leads, Tasks, Reminders (CRM)
  /dispatch      # Dispatch, Booking, Availability (operations)
  /communication # All messaging, notifications, consents
  /payments      # Payments, Escrow, Milestones
  /verification  # Pro verification, documents
  /agents        # AI agent orchestration
  /admin         # Feature flags, policies, audit
```

---

## 5. RECOMMENDED NEXT STEPS

### Immediate (Next 2 Weeks)
1. Implement Dispatch Concierge Agent (highest ROI)
2. Deploy Quote Generation skill
3. Complete Stripe payment integration

### Short-term (1-2 Months)
1. Build SLA Guardian Agent
2. Launch Contractor Onboarding Agent
3. Implement Calendar Sync skill
4. Deploy to production in York Region

### Medium-term (3-6 Months)
1. Build Capacity Planning Agent
2. Add voice support for key agents
3. Expand to GTA
4. Launch mobile apps for contractors

### Long-term (6-12 Months)
1. Multi-language support (French for Quebec)
2. US market entry preparation
3. Advanced analytics and ML predictions
4. White-label platform offering

---

## 6. TECHNOLOGY RECOMMENDATIONS

### AI/ML Stack
- **LLM Provider**: Claude (Anthropic) for core agents
- **Voice**: Deepgram for STT, ElevenLabs for TTS
- **Embeddings**: OpenAI or Cohere for semantic search
- **Fine-tuning**: Consider Claude fine-tuning for domain specificity

### Observability
- **Tracing**: OpenTelemetry for agent traces
- **Metrics**: Prometheus + Grafana
- **Logging**: Structured JSON logs to ELK
- **Alerting**: PagerDuty for SLA breaches

### Security
- **PII Handling**: Vault for secrets, field-level encryption
- **Rate Limiting**: Already implemented (good!)
- **API Security**: Consider adding API key rotation
- **Audit**: Already comprehensive (good!)

---

## Conclusion

The Trades Dispatch Platform has a solid foundation with:
- Well-architected backend with proper separation of concerns
- Comprehensive policy engine for multi-region scaling
- AI agent infrastructure ready for skill development
- Privacy-first design that differentiates from competitors

**Key Focus Areas**:
1. Build customer-facing AI agents for differentiation
2. Develop contractor engagement tools for supply-side growth
3. Simplify codebase to reduce maintenance burden
4. Position as the "AI-native" trades dispatch platform

The market opportunity is significant, and the technical foundation supports rapid scaling with the right agent and skill investments.
