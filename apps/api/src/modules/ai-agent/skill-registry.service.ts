import { Injectable, Logger } from '@nestjs/common';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { PolicyService } from '../feature-flags/policy.service';
import { z } from 'zod';

// ============================================
// SKILL INTERFACE DEFINITIONS
// ============================================

/**
 * Input schema type using Zod for validation
 */
export type SkillInputSchema = z.ZodType<unknown>;

/**
 * Skill execution context
 * Contains all contextual information needed for skill execution
 */
export interface SkillExecutionContext {
  sessionId: string;
  userId?: string;
  orgId?: string;
  role?: string;
  permissions?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Result of a skill execution
 */
export interface SkillExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Skill definition interface
 * All agent skills must implement this interface
 *
 * P1 Feature: Core skill structure
 * P2 Feature: Full implementation with validation and execution
 */
export interface Skill {
  /** Unique skill identifier */
  name: string;

  /** Human-readable description */
  description: string;

  /** Feature flags required for this skill to be available */
  requiredFlags: string[];

  /** RBAC permissions required to execute this skill */
  requiredPermissions: string[];

  /** Zod schema for input validation */
  inputSchema: SkillInputSchema;

  /** Execute the skill with validated input and context */
  execute(input: unknown, context: SkillExecutionContext): Promise<SkillExecutionResult>;
}

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  allowed: boolean;
  missingFlags: string[];
  missingPermissions: string[];
  reason?: string;
}

// ============================================
// SKILL REGISTRY SERVICE
// ============================================

/**
 * SkillRegistryService - Manages AI agent skills
 *
 * Responsibilities:
 * - Register and manage available skills
 * - Check RBAC permissions and feature flags
 * - Provide skill lookup for the orchestrator
 *
 * P1 Feature: Basic skill registration and lookup
 * P2 Feature: Dynamic skill loading, versioning, analytics
 */
@Injectable()
export class SkillRegistryService {
  private readonly logger = new Logger(SkillRegistryService.name);
  private readonly skills = new Map<string, Skill>();

  constructor(
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly policyService: PolicyService,
  ) {
    this.logger.log('SkillRegistryService initialized');
  }

  // ============================================
  // SKILL REGISTRATION
  // ============================================

  /**
   * Register a new skill in the registry
   *
   * @param skill - Skill to register
   * @throws Error if skill with same name already exists
   *
   * P1: Basic registration
   * P2: Validation, versioning, hot-reload support
   */
  registerSkill(skill: Skill): void {
    if (this.skills.has(skill.name)) {
      this.logger.warn(`Skill ${skill.name} already registered, overwriting`);
    }

    // Validate skill structure
    if (!skill.name || !skill.execute) {
      throw new Error('Invalid skill: must have name and execute function');
    }

    this.skills.set(skill.name, skill);
    this.logger.log(`Registered skill: ${skill.name}`);
  }

  /**
   * Unregister a skill from the registry
   *
   * @param name - Skill name to unregister
   * @returns true if skill was removed, false if not found
   */
  unregisterSkill(name: string): boolean {
    const removed = this.skills.delete(name);
    if (removed) {
      this.logger.log(`Unregistered skill: ${name}`);
    }
    return removed;
  }

  // ============================================
  // SKILL LOOKUP
  // ============================================

  /**
   * Get a skill by name
   *
   * @param name - Skill name
   * @returns Skill or undefined if not found
   */
  getSkill(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  /**
   * Get all registered skills
   *
   * @returns Array of all registered skills
   */
  getAllSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Get skill names only (lighter weight)
   *
   * @returns Array of skill names
   */
  getSkillNames(): string[] {
    return Array.from(this.skills.keys());
  }

  /**
   * Check if a skill exists
   *
   * @param name - Skill name to check
   */
  hasSkill(name: string): boolean {
    return this.skills.has(name);
  }

  // ============================================
  // PERMISSION CHECKING
  // ============================================

  /**
   * Check if a skill can be executed in the given context
   * Validates both feature flags and RBAC permissions
   *
   * @param skill - Skill to check
   * @param context - Execution context with user info
   * @returns PermissionCheckResult with detailed information
   *
   * P1: Basic flag and permission checking
   * P2: Contextual policies, org-level overrides, audit logging
   */
  async checkSkillPermissions(
    skill: Skill,
    context: SkillExecutionContext,
  ): Promise<PermissionCheckResult> {
    const missingFlags: string[] = [];
    const missingPermissions: string[] = [];

    // Check required feature flags
    for (const flag of skill.requiredFlags) {
      const isEnabled = await this.checkFeatureFlag(flag, context);
      if (!isEnabled) {
        missingFlags.push(flag);
      }
    }

    // Check required RBAC permissions
    // P1: Stub - compare against context.permissions
    // P2: Full RBAC integration with PolicyService
    const userPermissions = context.permissions ?? [];
    for (const permission of skill.requiredPermissions) {
      if (!userPermissions.includes(permission)) {
        missingPermissions.push(permission);
      }
    }

    const allowed = missingFlags.length === 0 && missingPermissions.length === 0;

    if (!allowed) {
      this.logger.debug(
        `Skill ${skill.name} permission check failed for session ${context.sessionId}`,
        { missingFlags, missingPermissions },
      );
    }

    return {
      allowed,
      missingFlags,
      missingPermissions,
      reason: allowed
        ? undefined
        : `Missing flags: [${missingFlags.join(', ')}], Missing permissions: [${missingPermissions.join(', ')}]`,
    };
  }

  /**
   * Check if a feature flag is enabled for the context
   *
   * @param flag - Flag name to check
   * @param context - Execution context for scope resolution
   *
   * P1: Basic flag check
   * P2: Scoped flags (org, region, service category)
   */
  private async checkFeatureFlag(
    flag: string,
    context: SkillExecutionContext,
  ): Promise<boolean> {
    try {
      // P1: Simple global flag check
      // P2: Pass full scope context for resolution
      const scopeContext = {
        orgId: context.orgId,
        // Add regionId, serviceCategoryId when available
      };

      const isEnabled = await this.featureFlagsService.isEnabled(flag, scopeContext);
      return isEnabled;
    } catch (error) {
      this.logger.error(`Error checking feature flag ${flag}:`, error);
      // Fail closed - if we can't check the flag, deny access
      return false;
    }
  }

  // ============================================
  // SKILL FILTERING
  // ============================================

  /**
   * Get all skills available for a given context
   * Filters skills based on permissions and flags
   *
   * @param context - Execution context
   * @returns Array of available skills
   *
   * P2 Feature: Useful for dynamic skill discovery
   */
  async getAvailableSkills(context: SkillExecutionContext): Promise<Skill[]> {
    const availableSkills: Skill[] = [];

    for (const skill of this.skills.values()) {
      const permissionCheck = await this.checkSkillPermissions(skill, context);
      if (permissionCheck.allowed) {
        availableSkills.push(skill);
      }
    }

    return availableSkills;
  }

  /**
   * Get skill metadata for LLM context
   * Returns simplified skill info suitable for prompt context
   *
   * @param context - Execution context
   * @returns Skill metadata array
   *
   * P2 Feature: For dynamic prompt construction
   */
  async getSkillMetadataForLLM(
    context: SkillExecutionContext,
  ): Promise<{ name: string; description: string; inputSchema: unknown }[]> {
    const availableSkills = await this.getAvailableSkills(context);

    return availableSkills.map(skill => ({
      name: skill.name,
      description: skill.description,
      // Convert Zod schema to JSON schema for LLM
      inputSchema: skill.inputSchema._def ?? {},
    }));
  }
}
