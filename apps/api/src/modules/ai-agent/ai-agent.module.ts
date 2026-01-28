import { Module } from '@nestjs/common';
import { AiAgentService } from './ai-agent.service';
import { AiAgentController } from './ai-agent.controller';
import { OrchestratorService } from './orchestrator.service';
import { SkillRegistryService } from './skill-registry.service';
import { ToolsService } from './tools.service';
import { CommunicationsModule } from '../communications/communications.module';

// LLM Services
import { LlmGatewayService } from './llm/llm-gateway.service';
import { ConversationMemoryService } from './llm/conversation-memory.service';
import { PromptTemplateService } from './llm/prompt-template.service';

// Agent Configuration
import { AgentConfigRegistryService } from './agents/agent-config.registry';

// Skills
import {
  // Core Skills
  JobIntakeSkill,
  QuoteGenerationSkill,
  ScheduleManagementSkill,
  StatusInquirySkill,
  IssueEscalationSkill,
  FeedbackCollectionSkill,
  // Contractor Skills
  AvailabilityManagementSkill,
  JobAcceptanceSkill,
  EarningsTrackingSkill,
  DocumentUploadSkill,
  // Operations Skills
  DispatchOverrideSkill,
  EscalationHandlingSkill,
  ContractorSearchSkill,
  ReportGenerationSkill,
  // Phase 3 Skills
  SubscriptionOpsSkill,
  PortfolioOpsSkill,
  OutreachOpsSkill,
  HomeownerConciergeSkill,
} from './skills';

// Automation Services
import {
  AutomationModeService,
  ApprovalQueueService,
  GuardrailsService,
} from './automation';

/**
 * AI Agent Module
 *
 * Provides AI-powered agent functionality for the platform:
 * - 11 specialized AI agents for different domains
 * - 14+ skills for agent capabilities
 * - LLM integration with Claude API
 * - Conversation memory and context management
 *
 * Components:
 * - AiAgentController: REST API endpoints
 * - AiAgentService: High-level service API
 * - OrchestratorService: Session management and LLM message processing
 * - SkillRegistryService: Skill/capability management
 * - ToolsService: Tool implementations (booking, dispatch, SMS, etc.)
 * - LlmGatewayService: Claude/OpenAI API integration
 * - ConversationMemoryService: Context and memory management
 * - PromptTemplateService: Agent system prompts
 * - AgentConfigRegistryService: Agent configurations
 *
 * Agents:
 * - Customer-Facing: Dispatch Concierge, Job Status, Quote Assistant, Homeowner Concierge
 * - Contractor-Facing: Dispatch Optimizer, Contractor Onboarding, Earnings Optimizer, Portfolio Assistant
 * - Operations: SLA Guardian, Quality Assurance, Subscription Manager, Outreach Coordinator
 * - Admin: Capacity Planning, Policy Configuration, Analytics Insight
 *
 * Dependencies:
 * - PrismaService: Database operations (via global module)
 * - FeatureFlagsService: Feature flag checks (via global module)
 * - PolicyService: Policy resolution (via global module)
 * - ConsentService: Consent checks for communications
 * - Redis: Session caching (via REDIS_URL env var)
 */
@Module({
  imports: [
    // Import CommunicationsModule for ConsentService
    CommunicationsModule,
  ],
  controllers: [AiAgentController],
  providers: [
    // Core Services
    AiAgentService,
    OrchestratorService,
    SkillRegistryService,
    ToolsService,

    // LLM Services
    LlmGatewayService,
    ConversationMemoryService,
    PromptTemplateService,

    // Agent Configuration
    AgentConfigRegistryService,

    // Core Skills
    JobIntakeSkill,
    QuoteGenerationSkill,
    ScheduleManagementSkill,
    StatusInquirySkill,
    IssueEscalationSkill,
    FeedbackCollectionSkill,

    // Contractor Skills
    AvailabilityManagementSkill,
    JobAcceptanceSkill,
    EarningsTrackingSkill,
    DocumentUploadSkill,

    // Operations Skills
    DispatchOverrideSkill,
    EscalationHandlingSkill,
    ContractorSearchSkill,
    ReportGenerationSkill,

    // Phase 3 Skills
    SubscriptionOpsSkill,
    PortfolioOpsSkill,
    OutreachOpsSkill,
    HomeownerConciergeSkill,

    // Automation Services
    AutomationModeService,
    ApprovalQueueService,
    GuardrailsService,
  ],
  exports: [
    AiAgentService,
    OrchestratorService,
    SkillRegistryService,
    LlmGatewayService,
    AgentConfigRegistryService,

    // Phase 3 Automation (used by other modules)
    AutomationModeService,
    ApprovalQueueService,
    GuardrailsService,
  ],
})
export class AiAgentModule {}
