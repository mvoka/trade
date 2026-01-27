import { z } from 'zod';
import { BaseSkill } from '../base.skill';
import { SkillExecutionContext, SkillInputSchema } from '../../skill-registry.service';

/**
 * Input schema for EscalationHandling skill
 */
const EscalationHandlingInputSchema = z.object({
  action: z.enum(['VIEW_ESCALATIONS', 'TAKE_ACTION', 'RESOLVE', 'ESCALATE_FURTHER', 'ADD_NOTE']),
  escalationId: z.string().optional(),
  filter: z.object({
    status: z.enum(['OPEN', 'IN_PROGRESS', 'PENDING', 'RESOLVED', 'ALL']).optional(),
    priority: z.enum(['P1', 'P2', 'P3', 'P4', 'ALL']).optional(),
    type: z.string().optional(),
    assignedTo: z.string().optional(),
  }).optional(),
  resolution: z.object({
    action: z.string().optional(),
    outcome: z.string().optional(),
    customerCompensation: z.number().optional(),
    preventiveMeasures: z.string().optional(),
  }).optional(),
  targetTeam: z.string().optional(),
  note: z.string().optional(),
});

type EscalationHandlingInput = z.infer<typeof EscalationHandlingInputSchema>;

/**
 * Escalation record
 */
interface Escalation {
  escalationId: string;
  ticketId: string;
  type: string;
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  status: 'OPEN' | 'IN_PROGRESS' | 'PENDING' | 'RESOLVED';
  summary: string;
  createdAt: string;
  updatedAt: string;
  slaDeadline: string;
  slaBreached: boolean;
  assignedTeam: string;
  assignedAgent?: string;
  relatedEntities: {
    jobId?: string;
    customerId?: string;
    contractorId?: string;
  };
  timeline: Array<{
    timestamp: string;
    action: string;
    actor: string;
    note?: string;
  }>;
}

/**
 * EscalationHandling Skill
 *
 * Manages escalation tickets and resolutions.
 * Used by SLA Guardian agent.
 */
export class EscalationHandlingSkill extends BaseSkill {
  readonly name = 'EscalationHandling';
  readonly description = 'View and manage escalation tickets including taking action, resolving issues, and escalating further';
  readonly requiredFlags = [];
  readonly requiredPermissions = ['escalation:manage'];
  readonly inputSchema: SkillInputSchema = EscalationHandlingInputSchema;

  protected async executeInternal(
    input: EscalationHandlingInput,
    context: SkillExecutionContext,
  ): Promise<{
    action: string;
    success: boolean;
    escalations?: Escalation[];
    escalation?: Escalation;
    summary?: {
      total: number;
      byPriority: Record<string, number>;
      byStatus: Record<string, number>;
      slaAtRisk: number;
      slaBreached: number;
    };
    message: string;
  }> {
    this.logger.debug('Processing escalation action', { action: input.action });

    switch (input.action) {
      case 'VIEW_ESCALATIONS':
        return this.viewEscalations(input.filter, context);
      case 'TAKE_ACTION':
        return this.takeAction(input.escalationId, input.note, context);
      case 'RESOLVE':
        return this.resolveEscalation(input.escalationId, input.resolution, context);
      case 'ESCALATE_FURTHER':
        return this.escalateFurther(input.escalationId, input.targetTeam, input.note, context);
      case 'ADD_NOTE':
        return this.addNote(input.escalationId, input.note, context);
      default:
        return {
          action: input.action,
          success: false,
          message: 'Unknown action',
        };
    }
  }

  private async viewEscalations(
    filter?: {
      status?: string;
      priority?: string;
      type?: string;
      assignedTo?: string;
    },
    context?: SkillExecutionContext,
  ): Promise<{
    action: string;
    success: boolean;
    escalations: Escalation[];
    summary: {
      total: number;
      byPriority: Record<string, number>;
      byStatus: Record<string, number>;
      slaAtRisk: number;
      slaBreached: number;
    };
    message: string;
  }> {
    // Generate mock escalations
    const escalationTypes = ['NO_SHOW', 'SLA_BREACH', 'QUALITY_ISSUE', 'BILLING_DISPUTE', 'SAFETY_CONCERN'];
    const teams = ['dispatch-operations', 'customer-support', 'quality-assurance', 'billing'];
    const escalations: Escalation[] = [];

    const numEscalations = Math.floor(Math.random() * 8) + 3;

    for (let i = 0; i < numEscalations; i++) {
      const priority = (['P1', 'P2', 'P3', 'P4'] as const)[Math.floor(Math.random() * 4)];
      const status = (['OPEN', 'IN_PROGRESS', 'PENDING'] as const)[Math.floor(Math.random() * 3)];
      const type = escalationTypes[Math.floor(Math.random() * escalationTypes.length)];
      const createdAt = new Date(Date.now() - Math.random() * 48 * 60 * 60 * 1000);
      const slaHours = { P1: 1, P2: 4, P3: 24, P4: 72 }[priority];
      const slaDeadline = new Date(createdAt.getTime() + slaHours * 60 * 60 * 1000);

      escalations.push({
        escalationId: `ESC-${Date.now().toString(36).toUpperCase()}-${i}`,
        ticketId: `TKT-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        type,
        priority,
        status,
        summary: `${type.replace('_', ' ')} reported for job`,
        createdAt: createdAt.toISOString(),
        updatedAt: new Date(createdAt.getTime() + Math.random() * 2 * 60 * 60 * 1000).toISOString(),
        slaDeadline: slaDeadline.toISOString(),
        slaBreached: slaDeadline < new Date(),
        assignedTeam: teams[Math.floor(Math.random() * teams.length)],
        assignedAgent: Math.random() > 0.3 ? `agent_${Math.floor(Math.random() * 10)}` : undefined,
        relatedEntities: {
          jobId: `job_${Date.now()}_${i}`,
          customerId: `cust_${Math.floor(Math.random() * 1000)}`,
          contractorId: Math.random() > 0.5 ? `pro_${Math.floor(Math.random() * 100)}` : undefined,
        },
        timeline: [
          {
            timestamp: createdAt.toISOString(),
            action: 'CREATED',
            actor: 'System',
            note: 'Escalation created automatically',
          },
        ],
      });
    }

    // Apply filters
    let filtered = escalations;
    if (filter?.status && filter.status !== 'ALL') {
      filtered = filtered.filter(e => e.status === filter.status);
    }
    if (filter?.priority && filter.priority !== 'ALL') {
      filtered = filtered.filter(e => e.priority === filter.priority);
    }
    if (filter?.type) {
      filtered = filtered.filter(e => e.type === filter.type);
    }

    // Calculate summary
    const summary = {
      total: filtered.length,
      byPriority: {
        P1: filtered.filter(e => e.priority === 'P1').length,
        P2: filtered.filter(e => e.priority === 'P2').length,
        P3: filtered.filter(e => e.priority === 'P3').length,
        P4: filtered.filter(e => e.priority === 'P4').length,
      },
      byStatus: {
        OPEN: filtered.filter(e => e.status === 'OPEN').length,
        IN_PROGRESS: filtered.filter(e => e.status === 'IN_PROGRESS').length,
        PENDING: filtered.filter(e => e.status === 'PENDING').length,
      },
      slaAtRisk: filtered.filter(e => {
        const timeToSla = new Date(e.slaDeadline).getTime() - Date.now();
        return timeToSla > 0 && timeToSla < 30 * 60 * 1000; // Less than 30 min
      }).length,
      slaBreached: filtered.filter(e => e.slaBreached).length,
    };

    return {
      action: 'VIEW_ESCALATIONS',
      success: true,
      escalations: filtered,
      summary,
      message: `${filtered.length} escalation(s) found. ${summary.slaBreached} SLA breached, ${summary.slaAtRisk} at risk.`,
    };
  }

  private async takeAction(
    escalationId: string | undefined,
    note: string | undefined,
    context: SkillExecutionContext,
  ): Promise<{
    action: string;
    success: boolean;
    escalation: Escalation;
    message: string;
  }> {
    if (!escalationId) {
      return {
        action: 'TAKE_ACTION',
        success: false,
        escalation: {} as Escalation,
        message: 'Escalation ID is required',
      };
    }

    const mockEscalation: Escalation = {
      escalationId,
      ticketId: 'TKT-12345',
      type: 'SLA_BREACH',
      priority: 'P2',
      status: 'IN_PROGRESS',
      summary: 'SLA breach for job dispatch',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
      slaDeadline: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      slaBreached: false,
      assignedTeam: 'dispatch-operations',
      assignedAgent: context.userId,
      relatedEntities: { jobId: 'job_123' },
      timeline: [
        {
          timestamp: new Date().toISOString(),
          action: 'ASSIGNED',
          actor: context.userId || 'agent',
          note: note || 'Taking ownership of this escalation',
        },
      ],
    };

    return {
      action: 'TAKE_ACTION',
      success: true,
      escalation: mockEscalation,
      message: `Escalation ${escalationId} assigned to you. Status updated to IN_PROGRESS.`,
    };
  }

  private async resolveEscalation(
    escalationId: string | undefined,
    resolution: {
      action?: string;
      outcome?: string;
      customerCompensation?: number;
      preventiveMeasures?: string;
    } | undefined,
    context: SkillExecutionContext,
  ): Promise<{
    action: string;
    success: boolean;
    escalation: Escalation;
    message: string;
  }> {
    if (!escalationId) {
      return {
        action: 'RESOLVE',
        success: false,
        escalation: {} as Escalation,
        message: 'Escalation ID is required',
      };
    }

    const mockEscalation: Escalation = {
      escalationId,
      ticketId: 'TKT-12345',
      type: 'SLA_BREACH',
      priority: 'P2',
      status: 'RESOLVED',
      summary: 'SLA breach for job dispatch - RESOLVED',
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
      slaDeadline: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      slaBreached: true,
      assignedTeam: 'dispatch-operations',
      assignedAgent: context.userId,
      relatedEntities: { jobId: 'job_123' },
      timeline: [
        {
          timestamp: new Date().toISOString(),
          action: 'RESOLVED',
          actor: context.userId || 'agent',
          note: `Resolved: ${resolution?.outcome || 'Issue addressed'}`,
        },
      ],
    };

    let compensationNote = '';
    if (resolution?.customerCompensation) {
      compensationNote = ` Customer compensation of $${resolution.customerCompensation} applied.`;
    }

    return {
      action: 'RESOLVE',
      success: true,
      escalation: mockEscalation,
      message: `Escalation ${escalationId} resolved.${compensationNote}`,
    };
  }

  private async escalateFurther(
    escalationId: string | undefined,
    targetTeam: string | undefined,
    note: string | undefined,
    context: SkillExecutionContext,
  ): Promise<{
    action: string;
    success: boolean;
    escalation: Escalation;
    message: string;
  }> {
    if (!escalationId) {
      return {
        action: 'ESCALATE_FURTHER',
        success: false,
        escalation: {} as Escalation,
        message: 'Escalation ID is required',
      };
    }

    const team = targetTeam || 'management';

    const mockEscalation: Escalation = {
      escalationId,
      ticketId: 'TKT-12345',
      type: 'CRITICAL_ISSUE',
      priority: 'P1',
      status: 'OPEN',
      summary: 'Critical issue - escalated to management',
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
      slaDeadline: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      slaBreached: false,
      assignedTeam: team,
      relatedEntities: { jobId: 'job_123' },
      timeline: [
        {
          timestamp: new Date().toISOString(),
          action: 'ESCALATED',
          actor: context.userId || 'agent',
          note: note || `Escalated to ${team}`,
        },
      ],
    };

    return {
      action: 'ESCALATE_FURTHER',
      success: true,
      escalation: mockEscalation,
      message: `Escalation ${escalationId} has been escalated to ${team}. Priority upgraded to P1.`,
    };
  }

  private async addNote(
    escalationId: string | undefined,
    note: string | undefined,
    context: SkillExecutionContext,
  ): Promise<{
    action: string;
    success: boolean;
    message: string;
  }> {
    if (!escalationId || !note) {
      return {
        action: 'ADD_NOTE',
        success: false,
        message: 'Escalation ID and note are required',
      };
    }

    return {
      action: 'ADD_NOTE',
      success: true,
      message: `Note added to escalation ${escalationId}`,
    };
  }
}

export { EscalationHandlingInputSchema };
