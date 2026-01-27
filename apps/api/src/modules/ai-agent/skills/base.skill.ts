import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { Skill, SkillExecutionContext, SkillExecutionResult, SkillInputSchema } from '../skill-registry.service';

/**
 * Base class for all skills
 * Provides common functionality and structure
 */
export abstract class BaseSkill implements Skill {
  protected readonly logger: Logger;

  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly requiredFlags: string[];
  abstract readonly requiredPermissions: string[];
  abstract readonly inputSchema: SkillInputSchema;

  constructor() {
    this.logger = new Logger(this.constructor.name);
  }

  /**
   * Execute the skill
   * Subclasses must implement executeInternal
   */
  async execute(input: unknown, context: SkillExecutionContext): Promise<SkillExecutionResult> {
    const startTime = Date.now();

    try {
      // Validate input
      const validatedInput = this.inputSchema.parse(input);

      this.logger.debug(`Executing skill ${this.name}`, {
        sessionId: context.sessionId,
        userId: context.userId,
      });

      // Execute the skill logic
      const result = await this.executeInternal(validatedInput, context);

      const durationMs = Date.now() - startTime;
      this.logger.debug(`Skill ${this.name} completed in ${durationMs}ms`);

      return {
        success: true,
        data: result,
        metadata: {
          durationMs,
          skillName: this.name,
        },
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.logger.error(`Skill ${this.name} failed:`, error);

      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: `Invalid input: ${error.errors.map((e) => e.message).join(', ')}`,
          metadata: {
            durationMs,
            skillName: this.name,
            validationErrors: error.errors,
          },
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          durationMs,
          skillName: this.name,
        },
      };
    }
  }

  /**
   * Internal execution logic - must be implemented by subclasses
   */
  protected abstract executeInternal(
    input: unknown,
    context: SkillExecutionContext,
  ): Promise<unknown>;
}

/**
 * Skill category types
 */
export type SkillCategory = 'core' | 'contractor' | 'operations' | 'admin';

/**
 * Skill metadata for registration
 */
export interface SkillMetadata {
  name: string;
  description: string;
  category: SkillCategory;
  requiredFlags: string[];
  requiredPermissions: string[];
  version: string;
}
