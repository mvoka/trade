/**
 * AI Agent Module Exports
 *
 * P1/P2 Feature: AI Agent Orchestrator Module
 *
 * This module provides AI-powered agent functionality including:
 * - Session management
 * - Message processing (stub - LLM integration in P2)
 * - Tool execution (booking, dispatch, SMS, email, calls)
 * - Human takeover handling
 * - Skill registry for extensibility
 */

// Module
export * from './ai-agent.module';

// Services
export * from './ai-agent.service';
export * from './orchestrator.service';
export * from './skill-registry.service';
export * from './tools.service';

// Controller
export * from './ai-agent.controller';

// DTOs
export * from './dto/ai-agent.dto';
