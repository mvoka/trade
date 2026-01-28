# Phase 2: AI Agent Integration

## Overview

Phase 2 introduces AI-powered agents to automate and assist with platform operations. The system uses a skill-based architecture that allows agents to perform various tasks while maintaining security and audit compliance.

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         AI Agent Module                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │   Sessions   │    │    Skills    │    │    Tools     │     │
│  │   Service    │───▶│   Service    │───▶│   Service    │     │
│  └──────────────┘    └──────────────┘    └──────────────┘     │
│         │                   │                   │              │
│         │                   │                   │              │
│         ▼                   ▼                   ▼              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │   Message    │    │    Agent     │    │   Prisma     │     │
│  │   Handler    │    │   Configs    │    │   Service    │     │
│  └──────────────┘    └──────────────┘    └──────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Agent Session Flow

```
User Message → Session Service → Skills Service → Tools Service → Database
     │              │                  │                │
     │              │                  │                ▼
     │              │                  │         Execute Action
     │              │                  │                │
     │              │                  ▼                │
     │              │           Process Result         │
     │              ▼                                   │
     │        Generate Response ◄──────────────────────┘
     │              │
     ▼              ▼
  User ◄─────── Response
```

## Agent Types

### DISPATCHER
**Purpose**: Job triage, routing, and scheduling optimization

**Skills**:
- `JobManagement` - Create, update, assign jobs
- `Scheduling` - Check availability, book appointments
- `Routing` - Calculate optimal routes
- `CustomerComms` - Send notifications

**Use Cases**:
- Automatically assign jobs to best-fit technicians
- Optimize daily routes for multiple technicians
- Handle rescheduling requests
- Send automated updates to customers

### INTAKE_BOT
**Purpose**: Customer-facing inquiry handling and job creation

**Skills**:
- `JobManagement` - Create initial job requests
- `CustomerComms` - Send confirmations
- `Scheduling` - Check availability for estimates

**Use Cases**:
- Handle incoming service requests via chat/web
- Gather job details through conversation
- Provide initial quotes when possible
- Schedule estimates or appointments

### TECH_ASSISTANT
**Purpose**: Support technicians in the field

**Skills**:
- `JobManagement` - Update job status, add notes
- `Checklists` - Provide service checklists
- `Documentation` - Help with photo documentation

**Use Cases**:
- Guide technicians through service procedures
- Ensure all required photos are captured
- Assist with parts lookup
- Generate completion reports

### ADMIN_AGENT
**Purpose**: System administration and reporting

**Skills**:
- `Reporting` - Generate analytics and reports
- `SystemConfig` - Help with configuration
- `UserManagement` - Assist with user operations

**Use Cases**:
- Generate custom reports on demand
- Explain feature flag configurations
- Assist with bulk operations
- Answer questions about system usage

## Skills System

### Skill Structure

```typescript
interface Skill {
  name: string;
  description: string;
  category: SkillCategory;
  actions: SkillAction[];
  requiredPermissions: string[];
  featureFlag?: string;
}

interface SkillAction {
  name: string;
  description: string;
  parameters: Parameter[];
  execute: (context: ExecutionContext) => Promise<ActionResult>;
}
```

### Available Skills

| Skill | Category | Actions | Feature Flag |
|-------|----------|---------|--------------|
| JobManagement | Operations | create, update, assign, complete | - |
| Scheduling | Operations | checkAvailability, bookSlot, reschedule | - |
| Routing | Operations | calculateRoute, optimizeDay | AI_ROUTING_ENABLED |
| CustomerComms | Communications | sendSMS, sendEmail, sendNotification | - |
| Reporting | Analytics | generateReport, getMetrics | - |
| Checklists | Operations | getChecklist, validateCompletion | - |
| Documentation | Operations | capturePhoto, generateReport | - |

## Tools Service

The Tools Service provides the execution layer for agent actions.

### Tool Categories

#### Job Tools
```typescript
JobTool.create(params)        // Create new job
JobTool.update(jobId, params) // Update job details
JobTool.assign(jobId, proId)  // Assign to technician
JobTool.complete(jobId)       // Mark as completed
JobTool.getStatus(jobId)      // Get current status
```

#### Scheduling Tools
```typescript
ScheduleTool.getAvailability(proId, dateRange)
ScheduleTool.bookSlot(proId, datetime, duration)
ScheduleTool.reschedule(jobId, newDatetime)
ScheduleTool.cancelAppointment(jobId)
```

#### Communication Tools
```typescript
CommsTool.sendSMS(phone, message)
CommsTool.sendEmail(email, subject, body)
CommsTool.sendPushNotification(userId, payload)
```

#### Routing Tools
```typescript
RoutingTool.calculateRoute(stops[])
RoutingTool.optimizeDaySchedule(proId, date)
RoutingTool.getETAs(jobIds)
```

## Session Management

### Session Lifecycle

```
1. CREATE SESSION
   └─ Initialize with agent type, user context

2. PROCESS MESSAGES
   └─ Send user messages, receive agent responses
   └─ Track tool usage and results

3. MAINTAIN CONTEXT
   └─ Store conversation history
   └─ Track session state

4. END SESSION
   └─ Save final state
   └─ Generate audit trail
```

### Session State

```typescript
interface SessionState {
  id: string;
  agentType: AgentType;
  userId: string;
  orgId: string;
  status: 'active' | 'paused' | 'completed' | 'failed';
  context: Record<string, unknown>;
  messages: Message[];
  toolUsage: ToolUsageRecord[];
  createdAt: Date;
  updatedAt: Date;
}
```

## Feature Flags

Phase 2 introduces the feature flags system for controlling AI capabilities.

### Agent-Related Flags

| Flag | Default | Scope | Description |
|------|---------|-------|-------------|
| AI_AGENTS_ENABLED | true | GLOBAL | Master switch for AI agents |
| AI_ROUTING_ENABLED | false | REGION | Enable AI-powered routing |
| AI_AUTO_DISPATCH_ENABLED | false | ORG | Auto-dispatch without approval |
| AI_CUSTOMER_CHAT_ENABLED | false | REGION | Customer-facing chat |

### Flag Hierarchy

```
GLOBAL (Platform-wide)
  └─ REGION (Geographic)
       └─ ORG (Organization)
            └─ SERVICE_CATEGORY (Per-service)
```

## Policies

Policies provide configurable values for agent behavior.

| Policy | Default | Description |
|--------|---------|-------------|
| AI_MAX_RETRIES | 3 | Max retries for failed actions |
| AI_TIMEOUT_MS | 30000 | Action timeout in milliseconds |
| AI_MAX_TOKENS | 4096 | Max tokens per response |
| AI_CONTEXT_WINDOW | 10 | Messages to include in context |

## Audit Logging

All agent actions are logged for compliance and debugging.

### Logged Events

- Session created/ended
- Message sent/received
- Tool executed (with parameters)
- Errors and retries
- Permission checks

### Audit Record Structure

```typescript
interface AuditRecord {
  id: string;
  action: string;
  actorType: 'user' | 'agent' | 'system';
  actorId: string;
  targetType: string;
  targetId: string;
  details: Record<string, unknown>;
  timestamp: Date;
  sessionId?: string;
}
```

## API Endpoints

### Session Management

```
POST   /api/ai-agent/sessions           Create session
GET    /api/ai-agent/sessions/:id       Get session
POST   /api/ai-agent/sessions/:id/message  Send message
DELETE /api/ai-agent/sessions/:id       End session
```

### Agent Configuration

```
GET    /api/ai-agent/agents             List agent types
GET    /api/ai-agent/agents/:type       Get agent config
GET    /api/ai-agent/skills             List available skills
```

## Error Handling

### Error Types

| Error | Code | Description |
|-------|------|-------------|
| AGENT_NOT_FOUND | AI001 | Invalid agent type |
| SESSION_EXPIRED | AI002 | Session timeout |
| TOOL_FAILED | AI003 | Tool execution failed |
| PERMISSION_DENIED | AI004 | Insufficient permissions |
| FEATURE_DISABLED | AI005 | Required feature flag off |

### Recovery Strategies

1. **Retry with backoff** for transient failures
2. **Fallback to manual** for critical operations
3. **Session recovery** for interrupted conversations
4. **Graceful degradation** when AI unavailable

## Security Considerations

### Permission Model

- Agents inherit user permissions
- Tools validate permissions before execution
- Feature flags can restrict capabilities
- All actions logged for audit

### Data Access

- Agents can only access data user can access
- PII is redacted in logs
- Sensitive operations require confirmation
- Rate limiting per session

## Testing

### Unit Tests

```bash
pnpm test --filter=api -- --grep "ai-agent"
```

### Integration Tests

```bash
pnpm test:e2e --filter=api -- --grep "ai-agent"
```

### Manual Testing

1. Create a session with desired agent type
2. Send test messages
3. Verify tool execution in audit logs
4. Check response quality

## Deployment

### Environment Variables

```env
ANTHROPIC_API_KEY=your-api-key
AI_MODEL_ID=claude-3-5-sonnet-20241022
AI_MAX_TOKENS=4096
AI_TEMPERATURE=0.7
```

### Feature Flag Seeding

Feature flags are seeded during deployment:

```bash
pnpm prisma db seed
```

## Future Enhancements

- **Multi-modal support**: Image analysis for job photos
- **Voice interface**: Phone-based agent interaction
- **Predictive scheduling**: ML-based demand forecasting
- **Sentiment analysis**: Customer satisfaction tracking
- **Autonomous agents**: Full auto-dispatch with guardrails
