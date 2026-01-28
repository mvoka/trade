import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { AUDIT_ACTIONS } from '@trades/shared';

/**
 * Approval request status
 */
export enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  AUTO_APPROVED = 'AUTO_APPROVED',
}

/**
 * Approval request
 */
export interface ApprovalRequest {
  id: string;
  sessionId: string;
  orgId: string;
  agentId: string;
  actionType: string;
  actionDescription: string;
  actionPayload: Record<string, unknown>;
  status: ApprovalStatus;
  reason?: string;
  amountCents?: number;
  requestedAt: Date;
  respondedAt?: Date;
  respondedBy?: string;
  expiresAt: Date;
}

/**
 * ApprovalQueueService - Manages approval requests from AI agents
 *
 * When agents operate in ASSIST mode, actions are queued for approval.
 * This service handles:
 * - Creating approval requests
 * - Processing approvals/rejections
 * - Expiring stale requests
 * - Notifying agents of decisions
 */
@Injectable()
export class ApprovalQueueService {
  private readonly logger = new Logger(ApprovalQueueService.name);

  // In-memory queue for P1 (would use Redis/DB in P2)
  private readonly queue = new Map<string, ApprovalRequest>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Create an approval request
   */
  async createRequest(params: {
    sessionId: string;
    orgId: string;
    agentId: string;
    actionType: string;
    actionDescription: string;
    actionPayload: Record<string, unknown>;
    amountCents?: number;
    expiresInMinutes?: number;
  }): Promise<ApprovalRequest> {
    const id = `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + (params.expiresInMinutes ?? 60));

    const request: ApprovalRequest = {
      id,
      sessionId: params.sessionId,
      orgId: params.orgId,
      agentId: params.agentId,
      actionType: params.actionType,
      actionDescription: params.actionDescription,
      actionPayload: params.actionPayload,
      status: ApprovalStatus.PENDING,
      amountCents: params.amountCents,
      requestedAt: new Date(),
      expiresAt,
    };

    this.queue.set(id, request);

    await this.auditService.log({
      action: AUDIT_ACTIONS.AUTOMATION_APPROVAL_REQUESTED,
      targetType: 'ApprovalRequest',
      targetId: id,
      details: {
        sessionId: params.sessionId,
        agentId: params.agentId,
        actionType: params.actionType,
        actionDescription: params.actionDescription,
      },
    });

    this.logger.log(`Approval request created: ${id} for ${params.actionType}`);

    return request;
  }

  /**
   * Approve a request
   */
  async approve(id: string, approvedBy: string, reason?: string): Promise<ApprovalRequest> {
    const request = this.queue.get(id);

    if (!request) {
      throw new NotFoundException('Approval request not found');
    }

    if (request.status !== ApprovalStatus.PENDING) {
      throw new Error(`Request is already ${request.status}`);
    }

    if (request.expiresAt < new Date()) {
      request.status = ApprovalStatus.EXPIRED;
      throw new Error('Request has expired');
    }

    request.status = ApprovalStatus.APPROVED;
    request.respondedAt = new Date();
    request.respondedBy = approvedBy;
    request.reason = reason;

    await this.auditService.log({
      action: AUDIT_ACTIONS.AUTOMATION_APPROVAL_GRANTED,
      actorId: approvedBy,
      targetType: 'ApprovalRequest',
      targetId: id,
      details: { reason },
    });

    this.logger.log(`Approval request approved: ${id} by ${approvedBy}`);

    return request;
  }

  /**
   * Reject a request
   */
  async reject(id: string, rejectedBy: string, reason?: string): Promise<ApprovalRequest> {
    const request = this.queue.get(id);

    if (!request) {
      throw new NotFoundException('Approval request not found');
    }

    if (request.status !== ApprovalStatus.PENDING) {
      throw new Error(`Request is already ${request.status}`);
    }

    request.status = ApprovalStatus.REJECTED;
    request.respondedAt = new Date();
    request.respondedBy = rejectedBy;
    request.reason = reason;

    await this.auditService.log({
      action: AUDIT_ACTIONS.AUTOMATION_APPROVAL_DENIED,
      actorId: rejectedBy,
      targetType: 'ApprovalRequest',
      targetId: id,
      details: { reason },
    });

    this.logger.log(`Approval request rejected: ${id} by ${rejectedBy}`);

    return request;
  }

  /**
   * Get pending requests for an org
   */
  async getPendingRequests(orgId: string): Promise<ApprovalRequest[]> {
    const now = new Date();
    const requests: ApprovalRequest[] = [];

    for (const request of this.queue.values()) {
      if (request.orgId === orgId && request.status === ApprovalStatus.PENDING) {
        // Auto-expire stale requests
        if (request.expiresAt < now) {
          request.status = ApprovalStatus.EXPIRED;
          continue;
        }
        requests.push(request);
      }
    }

    return requests.sort((a, b) => a.requestedAt.getTime() - b.requestedAt.getTime());
  }

  /**
   * Get request by ID
   */
  async getRequest(id: string): Promise<ApprovalRequest | null> {
    return this.queue.get(id) ?? null;
  }

  /**
   * Get requests for a session
   */
  async getSessionRequests(sessionId: string): Promise<ApprovalRequest[]> {
    const requests: ApprovalRequest[] = [];

    for (const request of this.queue.values()) {
      if (request.sessionId === sessionId) {
        requests.push(request);
      }
    }

    return requests.sort((a, b) => a.requestedAt.getTime() - b.requestedAt.getTime());
  }

  /**
   * Expire old requests
   */
  async expireStaleRequests(): Promise<number> {
    const now = new Date();
    let expired = 0;

    for (const request of this.queue.values()) {
      if (request.status === ApprovalStatus.PENDING && request.expiresAt < now) {
        request.status = ApprovalStatus.EXPIRED;
        expired++;

        await this.auditService.log({
          action: 'AUTOMATION_APPROVAL_EXPIRED',
          targetType: 'ApprovalRequest',
          targetId: request.id,
        });
      }
    }

    if (expired > 0) {
      this.logger.log(`Expired ${expired} stale approval requests`);
    }

    return expired;
  }

  /**
   * Get approval queue stats
   */
  async getQueueStats(orgId: string): Promise<{
    pending: number;
    approved: number;
    rejected: number;
    expired: number;
    averageResponseTimeMs: number;
  }> {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let expired = 0;
    let totalResponseTime = 0;
    let respondedCount = 0;

    for (const request of this.queue.values()) {
      if (request.orgId !== orgId) continue;

      switch (request.status) {
        case ApprovalStatus.PENDING:
          pending++;
          break;
        case ApprovalStatus.APPROVED:
        case ApprovalStatus.AUTO_APPROVED:
          approved++;
          break;
        case ApprovalStatus.REJECTED:
          rejected++;
          break;
        case ApprovalStatus.EXPIRED:
          expired++;
          break;
      }

      if (request.respondedAt) {
        totalResponseTime += request.respondedAt.getTime() - request.requestedAt.getTime();
        respondedCount++;
      }
    }

    return {
      pending,
      approved,
      rejected,
      expired,
      averageResponseTimeMs: respondedCount > 0 ? Math.round(totalResponseTime / respondedCount) : 0,
    };
  }
}
