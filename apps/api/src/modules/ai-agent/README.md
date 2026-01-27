# AI Agent Module

AI-powered agent system for the Trades Dispatch Platform, providing specialized agents for customer interactions, contractor management, and operations support.

## Architecture

```
ai-agent/
├── llm/                    # LLM integration layer
│   ├── llm-gateway.service.ts        # Claude/OpenAI API wrapper
│   ├── llm-gateway.interface.ts      # Provider-agnostic interfaces
│   ├── conversation-memory.service.ts # Context & memory management
│   └── prompt-template.service.ts    # Agent system prompts
├── agents/                 # Agent configurations
│   ├── agent-config.registry.ts      # 11 agent configs
│   └── agent-config.interface.ts     # Config types
├── skills/                 # Agent capabilities
│   ├── core/               # Customer-facing skills
│   ├── contractor/         # Contractor-facing skills
│   └── operations/         # Internal operations skills
├── orchestrator.service.ts # Session & message orchestration
├── skill-registry.service.ts # Skill management
├── tools.service.ts        # External service integrations
├── ai-agent.service.ts     # Public API
└── ai-agent.controller.ts  # REST endpoints
```

## Agents

### Customer-Facing
| Agent | Description | Skills |
|-------|-------------|--------|
| Dispatch Concierge | Primary booking assistant | JobIntake, QuoteGeneration, ScheduleManagement |
| Job Status | Status inquiries & updates | StatusInquiry, IssueEscalation |
| Quote Assistant | Quote generation & explanation | QuoteGeneration |

### Contractor-Facing
| Agent | Description | Skills |
|-------|-------------|--------|
| Dispatch Optimizer | Smart job matching | ContractorSearch, JobAcceptance |
| Contractor Onboarding | Onboarding assistance | DocumentUpload |
| Earnings Optimizer | Financial optimization | EarningsTracking, AvailabilityManagement |

### Operations
| Agent | Description | Skills |
|-------|-------------|--------|
| SLA Guardian | SLA monitoring & escalations | EscalationHandling |
| Quality Assurance | Quality control | FeedbackCollection |
| Capacity Planning | Demand forecasting | ReportGeneration |
| Policy Configuration | Policy management | - |
| Analytics Insight | Business intelligence | ReportGeneration |

## Skills

### Core Skills
- **JobIntakeSkill** - Collect service requirements, location, urgency
- **QuoteGenerationSkill** - Generate pricing based on service type
- **ScheduleManagementSkill** - View/book/reschedule appointments
- **StatusInquirySkill** - Check job status and updates
- **IssueEscalationSkill** - Escalate problems to support
- **FeedbackCollectionSkill** - Collect ratings and reviews

### Contractor Skills
- **AvailabilityManagementSkill** - Manage schedules and working hours
- **JobAcceptanceSkill** - Accept/decline/negotiate jobs
- **EarningsTrackingSkill** - View earnings and payouts
- **DocumentUploadSkill** - Upload certifications and documents

### Operations Skills
- **DispatchOverrideSkill** - Manual dispatch assignments
- **EscalationHandlingSkill** - Manage escalation tickets
- **ContractorSearchSkill** - Search available contractors
- **ReportGenerationSkill** - Generate business reports

## Configuration

### Environment Variables

```bash
# Primary LLM (Claude)
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL_ID=claude-sonnet-4-20250514

# Fallback LLM (OpenAI)
OPENAI_API_KEY=sk-...
OPENAI_MODEL_ID=gpt-4-turbo

# LLM Settings
LLM_MAX_TOKENS=4096
LLM_TEMPERATURE=0.7
LLM_STREAMING_ENABLED=true
LLM_FALLBACK_ENABLED=true

# Redis (for session caching)
REDIS_URL=redis://localhost:6379
```

### Feature Flags

Each agent can be enabled/disabled via feature flags:
- `AGENT_DISPATCH_CONCIERGE_ENABLED`
- `AGENT_JOB_STATUS_ENABLED`
- `AGENT_QUOTE_ASSISTANT_ENABLED`
- `AGENT_DISPATCH_OPTIMIZER_ENABLED`
- `AGENT_CONTRACTOR_ONBOARDING_ENABLED`
- `AGENT_EARNINGS_OPTIMIZER_ENABLED`
- `AGENT_SLA_GUARDIAN_ENABLED`
- `AGENT_QA_ENABLED`
- `AGENT_CAPACITY_PLANNING_ENABLED`
- `AGENT_POLICY_CONFIG_ENABLED`
- `AGENT_ANALYTICS_INSIGHT_ENABLED`

## API Usage

### Create Session
```typescript
POST /api/v1/ai-agent/sessions
{
  "sessionType": "DISPATCH_CONCIERGE",
  "userId": "user_123",
  "orgId": "org_456",
  "context": {
    "channel": "web",
    "locale": "en-CA"
  }
}
```

### Send Message
```typescript
POST /api/v1/ai-agent/sessions/:sessionId/messages
{
  "content": "I need a plumber for a leaking pipe",
  "metadata": {
    "intent": "book_service"
  }
}
```

### Response
```typescript
{
  "sessionId": "session_abc",
  "message": {
    "role": "assistant",
    "content": "I can help you book a plumber...",
    "timestamp": "2024-01-15T10:30:00Z"
  },
  "toolCalls": [...],
  "suggestedActions": ["confirm_booking", "change_time"],
  "sessionActive": true
}
```

## Development

### Adding a New Skill

1. Create skill file in appropriate directory:
```typescript
// skills/core/my-skill.skill.ts
import { z } from 'zod';
import { BaseSkill } from '../base.skill';

const MySkillInputSchema = z.object({
  // Define input schema
});

export class MySkill extends BaseSkill {
  readonly name = 'MySkill';
  readonly description = 'What this skill does';
  readonly requiredFlags = [];
  readonly requiredPermissions = ['my:permission'];
  readonly inputSchema = MySkillInputSchema;

  protected async executeInternal(input, context) {
    // Implementation
  }
}
```

2. Export from index file
3. Add to `ai-agent.module.ts` providers
4. Add to agent configs in `agent-config.registry.ts`

### Adding a New Agent

1. Add config to `DEFAULT_AGENT_CONFIGS` in `agent-config.registry.ts`
2. Add prompt template in `prompt-template.service.ts`
3. Add feature flag to config

## LLM Integration

The system uses Claude as the primary LLM with automatic fallback to OpenAI:

```typescript
// LLM Gateway handles provider abstraction
const response = await llmGateway.complete({
  messages: [...],
  tools: [...],
  systemPrompt: agentPrompt,
});

// Tool calls are automatically routed through skills
if (response.toolCalls) {
  for (const toolCall of response.toolCalls) {
    const result = await skillRegistry.execute(toolCall.name, toolCall.arguments);
    // Results fed back to LLM for final response
  }
}
```

## Session Management

Sessions are cached in Redis for horizontal scaling:
- Session state persisted for 24 hours
- Conversation history maintained per session
- Automatic cleanup on session end

## Human Takeover

Agents can escalate to human operators:
```typescript
POST /api/v1/ai-agent/sessions/:sessionId/takeover
{
  "reason": "Complex issue requiring human intervention",
  "priority": "HIGH"
}
```
