import { Module } from '@nestjs/common';
import { AiAgentService } from './ai-agent.service';
import { AiAgentController } from './ai-agent.controller';
import { OrchestratorService } from './orchestrator.service';
import { SkillRegistryService } from './skill-registry.service';
import { ToolsService } from './tools.service';
import { CommunicationsModule } from '../communications/communications.module';

/**
 * AI Agent Module
 *
 * Provides AI-powered agent functionality for the platform:
 * - Phone agent for voice interactions
 * - Booking assistant
 * - Support agent (P2)
 * - Dispatch coordination (P2)
 *
 * Components:
 * - AiAgentController: REST API endpoints
 * - AiAgentService: High-level service API
 * - OrchestratorService: Session management and message processing
 * - SkillRegistryService: Skill/capability management
 * - ToolsService: Tool implementations (booking, dispatch, SMS, etc.)
 *
 * Dependencies:
 * - PrismaService: Database operations (via global module)
 * - FeatureFlagsService: Feature flag checks (via global module)
 * - PolicyService: Policy resolution (via global module)
 * - ConsentService: Consent checks for communications
 *
 * P1 Feature: Basic stubs and structure
 * P2 Feature: Full LLM integration, persistent state, analytics
 */
@Module({
  imports: [
    // Import CommunicationsModule for ConsentService
    CommunicationsModule,
  ],
  controllers: [AiAgentController],
  providers: [
    AiAgentService,
    OrchestratorService,
    SkillRegistryService,
    ToolsService,
  ],
  exports: [AiAgentService, OrchestratorService, SkillRegistryService],
})
export class AiAgentModule {}
