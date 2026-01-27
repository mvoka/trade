import { z } from 'zod';
import { BaseSkill } from '../base.skill';
import { SkillExecutionContext, SkillInputSchema } from '../../skill-registry.service';

/**
 * Input schema for QuoteGeneration skill
 */
const QuoteGenerationInputSchema = z.object({
  serviceType: z.string().describe('Type of service'),
  jobDescription: z.string().describe('Description of the work needed'),
  estimatedDuration: z.number().optional().describe('Estimated hours'),
  location: z.object({
    postalCode: z.string().optional(),
    city: z.string().optional(),
  }).optional(),
  urgency: z.enum(['LOW', 'NORMAL', 'HIGH', 'EMERGENCY']).optional().default('NORMAL'),
  specialRequirements: z.array(z.string()).optional(),
  materialsNeeded: z.boolean().optional().default(false),
});

type QuoteGenerationInput = z.infer<typeof QuoteGenerationInputSchema>;

/**
 * Quote line item
 */
interface QuoteLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  type: 'LABOR' | 'MATERIALS' | 'FEE' | 'DISCOUNT';
}

/**
 * Generated quote structure
 */
interface GeneratedQuote {
  quoteId: string;
  status: 'DRAFT' | 'PENDING' | 'APPROVED';
  lineItems: QuoteLineItem[];
  subtotal: number;
  taxes: number;
  total: number;
  validUntil: string;
  notes: string;
  terms: string[];
}

/**
 * QuoteGeneration Skill
 *
 * Generates service quotes based on job requirements.
 * Used by Dispatch Concierge and Quote Assistant agents.
 */
export class QuoteGenerationSkill extends BaseSkill {
  readonly name = 'QuoteGeneration';
  readonly description = 'Generate detailed service quotes including labor, materials, and fees based on job requirements';
  readonly requiredFlags = ['BOOKING_ENABLED'];
  readonly requiredPermissions = ['booking:read'];
  readonly inputSchema: SkillInputSchema = QuoteGenerationInputSchema;

  // Stub pricing data (would come from PolicyService/database)
  private readonly pricingData = {
    baseRates: {
      PLUMBING: 85,
      ELECTRICAL: 95,
      HVAC: 90,
      GENERAL: 75,
      EMERGENCY_MULTIPLIER: 1.5,
    },
    serviceFee: 25,
    taxRate: 0.13, // 13% HST
  };

  protected async executeInternal(
    input: QuoteGenerationInput,
    context: SkillExecutionContext,
  ): Promise<GeneratedQuote> {
    this.logger.debug('Generating quote', { serviceType: input.serviceType });

    const lineItems: QuoteLineItem[] = [];

    // Calculate labor cost
    const hourlyRate = this.getHourlyRate(input.serviceType, input.urgency || 'NORMAL');
    const estimatedHours = input.estimatedDuration || this.estimateHours(input.jobDescription);

    lineItems.push({
      description: `${input.serviceType} - Labor`,
      quantity: estimatedHours,
      unitPrice: hourlyRate,
      total: estimatedHours * hourlyRate,
      type: 'LABOR',
    });

    // Add materials if needed
    if (input.materialsNeeded) {
      const materialsCost = this.estimateMaterialsCost(input.serviceType, input.jobDescription);
      lineItems.push({
        description: 'Materials and supplies (estimated)',
        quantity: 1,
        unitPrice: materialsCost,
        total: materialsCost,
        type: 'MATERIALS',
      });
    }

    // Add service fee
    lineItems.push({
      description: 'Service/dispatch fee',
      quantity: 1,
      unitPrice: this.pricingData.serviceFee,
      total: this.pricingData.serviceFee,
      type: 'FEE',
    });

    // Calculate totals
    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    const taxes = subtotal * this.pricingData.taxRate;
    const total = subtotal + taxes;

    // Generate quote ID
    const quoteId = `quote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Calculate validity (7 days from now)
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 7);

    return {
      quoteId,
      status: 'DRAFT',
      lineItems,
      subtotal: Math.round(subtotal * 100) / 100,
      taxes: Math.round(taxes * 100) / 100,
      total: Math.round(total * 100) / 100,
      validUntil: validUntil.toISOString().split('T')[0],
      notes: this.generateNotes(input),
      terms: [
        'Quote valid for 7 days',
        'Final price may vary based on actual work required',
        'Materials priced at cost plus 15%',
        'Payment due upon completion',
      ],
    };
  }

  private getHourlyRate(serviceType: string, urgency: string): number {
    const baseRates = this.pricingData.baseRates as Record<string, number>;
    let rate = baseRates[serviceType.toUpperCase()] || baseRates.GENERAL;

    if (urgency === 'EMERGENCY') {
      rate *= this.pricingData.baseRates.EMERGENCY_MULTIPLIER;
    } else if (urgency === 'HIGH') {
      rate *= 1.25;
    }

    return rate;
  }

  private estimateHours(description: string): number {
    // Simple estimation based on description length and keywords
    const descLower = description.toLowerCase();

    if (descLower.includes('quick') || descLower.includes('simple') || descLower.includes('minor')) {
      return 1;
    }
    if (descLower.includes('install') || descLower.includes('replace')) {
      return 2;
    }
    if (descLower.includes('repair') || descLower.includes('fix')) {
      return 1.5;
    }
    if (descLower.includes('major') || descLower.includes('complete') || descLower.includes('full')) {
      return 4;
    }

    return 2; // Default estimate
  }

  private estimateMaterialsCost(serviceType: string, description: string): number {
    // Simple materials estimation
    const baseMaterials: Record<string, number> = {
      PLUMBING: 75,
      ELECTRICAL: 50,
      HVAC: 100,
      GENERAL: 40,
    };

    return baseMaterials[serviceType.toUpperCase()] || 50;
  }

  private generateNotes(input: QuoteGenerationInput): string {
    const notes: string[] = [];

    if (input.urgency === 'EMERGENCY') {
      notes.push('Emergency rate applied (1.5x)');
    }

    if (input.specialRequirements && input.specialRequirements.length > 0) {
      notes.push(`Special requirements noted: ${input.specialRequirements.join(', ')}`);
    }

    if (input.materialsNeeded) {
      notes.push('Materials estimate included - final cost based on actual materials used');
    }

    return notes.join('. ') || 'Standard service quote';
  }
}

export { QuoteGenerationInputSchema };
