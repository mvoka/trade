import { z } from 'zod';
import { BaseSkill } from '../base.skill';
import { SkillExecutionContext, SkillInputSchema } from '../../skill-registry.service';

/**
 * Input schema for DocumentUpload skill
 */
const DocumentUploadInputSchema = z.object({
  action: z.enum(['CHECK_STATUS', 'GET_REQUIREMENTS', 'UPLOAD', 'VERIFY_STATUS']),
  documentType: z.enum([
    'DRIVERS_LICENSE',
    'TRADE_LICENSE',
    'INSURANCE_CERTIFICATE',
    'CERTIFICATION',
    'BACKGROUND_CHECK',
    'W9_TAX_FORM',
    'VEHICLE_REGISTRATION',
    'PROFILE_PHOTO',
    'OTHER',
  ]).optional(),
  documentData: z.object({
    fileName: z.string().optional(),
    fileType: z.string().optional(),
    fileSize: z.number().optional(),
    base64Content: z.string().optional(),
    expiryDate: z.string().optional(),
    documentNumber: z.string().optional(),
  }).optional(),
  notes: z.string().optional(),
});

type DocumentUploadInput = z.infer<typeof DocumentUploadInputSchema>;

/**
 * Document requirement
 */
interface DocumentRequirement {
  documentType: string;
  displayName: string;
  required: boolean;
  description: string;
  acceptedFormats: string[];
  maxSizeMb: number;
  expiryRequired: boolean;
  status: 'NOT_SUBMITTED' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  submittedAt?: string;
  expiresAt?: string;
  rejectionReason?: string;
}

/**
 * Upload result
 */
interface UploadResult {
  documentId: string;
  documentType: string;
  status: 'UPLOADED' | 'PENDING_REVIEW';
  uploadedAt: string;
  estimatedReviewTime: string;
  nextSteps: string[];
}

/**
 * DocumentUpload Skill
 *
 * Handles contractor document uploads and verification.
 * Used by Contractor Onboarding agent.
 */
export class DocumentUploadSkill extends BaseSkill {
  readonly name = 'DocumentUpload';
  readonly description = 'Manage contractor documents including checking requirements, uploading files, and verifying status';
  readonly requiredFlags = [];
  readonly requiredPermissions = ['contractor:documents'];
  readonly inputSchema: SkillInputSchema = DocumentUploadInputSchema;

  // Document requirements configuration
  private readonly documentConfig: Record<string, Omit<DocumentRequirement, 'status' | 'submittedAt' | 'expiresAt' | 'rejectionReason'>> = {
    DRIVERS_LICENSE: {
      documentType: 'DRIVERS_LICENSE',
      displayName: "Driver's License",
      required: true,
      description: 'Valid government-issued photo ID',
      acceptedFormats: ['jpg', 'jpeg', 'png', 'pdf'],
      maxSizeMb: 10,
      expiryRequired: true,
    },
    TRADE_LICENSE: {
      documentType: 'TRADE_LICENSE',
      displayName: 'Trade License',
      required: true,
      description: 'Professional trade license for your specialty',
      acceptedFormats: ['jpg', 'jpeg', 'png', 'pdf'],
      maxSizeMb: 10,
      expiryRequired: true,
    },
    INSURANCE_CERTIFICATE: {
      documentType: 'INSURANCE_CERTIFICATE',
      displayName: 'Insurance Certificate',
      required: true,
      description: 'Proof of liability insurance ($1M minimum coverage)',
      acceptedFormats: ['pdf'],
      maxSizeMb: 10,
      expiryRequired: true,
    },
    CERTIFICATION: {
      documentType: 'CERTIFICATION',
      displayName: 'Professional Certification',
      required: false,
      description: 'Additional certifications (e.g., gas fitter, electrician)',
      acceptedFormats: ['jpg', 'jpeg', 'png', 'pdf'],
      maxSizeMb: 10,
      expiryRequired: true,
    },
    BACKGROUND_CHECK: {
      documentType: 'BACKGROUND_CHECK',
      displayName: 'Background Check Consent',
      required: true,
      description: 'Consent form for background verification',
      acceptedFormats: ['pdf'],
      maxSizeMb: 5,
      expiryRequired: false,
    },
    W9_TAX_FORM: {
      documentType: 'W9_TAX_FORM',
      displayName: 'W-9 Tax Form',
      required: true,
      description: 'IRS W-9 form for tax purposes',
      acceptedFormats: ['pdf'],
      maxSizeMb: 5,
      expiryRequired: false,
    },
    VEHICLE_REGISTRATION: {
      documentType: 'VEHICLE_REGISTRATION',
      displayName: 'Vehicle Registration',
      required: false,
      description: 'Registration for service vehicle',
      acceptedFormats: ['jpg', 'jpeg', 'png', 'pdf'],
      maxSizeMb: 10,
      expiryRequired: true,
    },
    PROFILE_PHOTO: {
      documentType: 'PROFILE_PHOTO',
      displayName: 'Profile Photo',
      required: true,
      description: 'Clear, professional headshot photo',
      acceptedFormats: ['jpg', 'jpeg', 'png'],
      maxSizeMb: 5,
      expiryRequired: false,
    },
    OTHER: {
      documentType: 'OTHER',
      displayName: 'Other Document',
      required: false,
      description: 'Additional supporting documents',
      acceptedFormats: ['jpg', 'jpeg', 'png', 'pdf'],
      maxSizeMb: 10,
      expiryRequired: false,
    },
  };

  protected async executeInternal(
    input: DocumentUploadInput,
    context: SkillExecutionContext,
  ): Promise<{
    action: string;
    success: boolean;
    requirements?: DocumentRequirement[];
    uploadResult?: UploadResult;
    verificationStatus?: {
      overallStatus: 'COMPLETE' | 'INCOMPLETE' | 'PENDING' | 'ACTION_REQUIRED';
      completionPercentage: number;
      pendingDocuments: string[];
      expiringSoon: string[];
      actionRequired: string[];
    };
    message: string;
  }> {
    this.logger.debug('Processing document action', { action: input.action });

    switch (input.action) {
      case 'GET_REQUIREMENTS':
        return this.getRequirements(context);
      case 'CHECK_STATUS':
        return this.checkStatus(input.documentType, context);
      case 'UPLOAD':
        return this.uploadDocument(input.documentType, input.documentData, input.notes, context);
      case 'VERIFY_STATUS':
        return this.verifyStatus(context);
      default:
        return {
          action: input.action,
          success: false,
          message: 'Unknown action',
        };
    }
  }

  private async getRequirements(context: SkillExecutionContext): Promise<{
    action: string;
    success: boolean;
    requirements: DocumentRequirement[];
    message: string;
  }> {
    // Generate requirements with mock statuses
    const requirements: DocumentRequirement[] = Object.values(this.documentConfig).map(config => {
      const statusOptions = ['NOT_SUBMITTED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED'] as const;
      const randomStatus = statusOptions[Math.floor(Math.random() * statusOptions.length)];

      const requirement: DocumentRequirement = {
        ...config,
        status: randomStatus,
      };

      if (randomStatus !== 'NOT_SUBMITTED') {
        requirement.submittedAt = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString();
      }

      if (config.expiryRequired && randomStatus === 'APPROVED') {
        requirement.expiresAt = new Date(Date.now() + (Math.random() * 365 + 30) * 24 * 60 * 60 * 1000).toISOString();
      }

      if (randomStatus === 'REJECTED') {
        requirement.rejectionReason = 'Document unclear or incomplete. Please resubmit.';
      }

      return requirement;
    });

    const requiredCount = requirements.filter(r => r.required).length;
    const approvedRequired = requirements.filter(r => r.required && r.status === 'APPROVED').length;

    return {
      action: 'GET_REQUIREMENTS',
      success: true,
      requirements,
      message: `${approvedRequired}/${requiredCount} required documents approved`,
    };
  }

  private async checkStatus(
    documentType: string | undefined,
    context: SkillExecutionContext,
  ): Promise<{
    action: string;
    success: boolean;
    requirements: DocumentRequirement[];
    message: string;
  }> {
    if (!documentType) {
      return this.getRequirements(context);
    }

    const config = this.documentConfig[documentType];
    if (!config) {
      return {
        action: 'CHECK_STATUS',
        success: false,
        requirements: [],
        message: `Unknown document type: ${documentType}`,
      };
    }

    // Generate single document status
    const statusOptions = ['NOT_SUBMITTED', 'PENDING_REVIEW', 'APPROVED'] as const;
    const status = statusOptions[Math.floor(Math.random() * statusOptions.length)];

    const requirement: DocumentRequirement = {
      ...config,
      status,
      submittedAt: status !== 'NOT_SUBMITTED' ? new Date().toISOString() : undefined,
      expiresAt: config.expiryRequired && status === 'APPROVED'
        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        : undefined,
    };

    return {
      action: 'CHECK_STATUS',
      success: true,
      requirements: [requirement],
      message: `${config.displayName}: ${status.replace('_', ' ')}`,
    };
  }

  private async uploadDocument(
    documentType: string | undefined,
    documentData: { fileName?: string; fileType?: string; fileSize?: number; expiryDate?: string; documentNumber?: string } | undefined,
    notes: string | undefined,
    context: SkillExecutionContext,
  ): Promise<{
    action: string;
    success: boolean;
    uploadResult: UploadResult;
    message: string;
  }> {
    if (!documentType) {
      return {
        action: 'UPLOAD',
        success: false,
        uploadResult: {
          documentId: '',
          documentType: '',
          status: 'UPLOADED',
          uploadedAt: '',
          estimatedReviewTime: '',
          nextSteps: [],
        },
        message: 'Document type is required',
      };
    }

    const config = this.documentConfig[documentType];
    if (!config) {
      return {
        action: 'UPLOAD',
        success: false,
        uploadResult: {
          documentId: '',
          documentType: '',
          status: 'UPLOADED',
          uploadedAt: '',
          estimatedReviewTime: '',
          nextSteps: [],
        },
        message: `Unknown document type: ${documentType}`,
      };
    }

    // Validate file if provided
    if (documentData?.fileType) {
      const fileExt = documentData.fileType.split('/').pop()?.toLowerCase();
      if (fileExt && !config.acceptedFormats.includes(fileExt)) {
        return {
          action: 'UPLOAD',
          success: false,
          uploadResult: {
            documentId: '',
            documentType: documentType,
            status: 'UPLOADED',
            uploadedAt: '',
            estimatedReviewTime: '',
            nextSteps: [],
          },
          message: `Invalid file format. Accepted formats: ${config.acceptedFormats.join(', ')}`,
        };
      }
    }

    if (documentData?.fileSize && documentData.fileSize > config.maxSizeMb * 1024 * 1024) {
      return {
        action: 'UPLOAD',
        success: false,
        uploadResult: {
          documentId: '',
          documentType: documentType,
          status: 'UPLOADED',
          uploadedAt: '',
          estimatedReviewTime: '',
          nextSteps: [],
        },
        message: `File too large. Maximum size: ${config.maxSizeMb}MB`,
      };
    }

    // Create upload result
    const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const nextSteps: string[] = [
      'Document is being reviewed by our team',
      'You will be notified when verification is complete',
    ];

    if (config.required) {
      nextSteps.push('This document is required for activation');
    }

    const uploadResult: UploadResult = {
      documentId,
      documentType,
      status: 'PENDING_REVIEW',
      uploadedAt: new Date().toISOString(),
      estimatedReviewTime: '24-48 hours',
      nextSteps,
    };

    return {
      action: 'UPLOAD',
      success: true,
      uploadResult,
      message: `${config.displayName} uploaded successfully. Review typically takes 24-48 hours.`,
    };
  }

  private async verifyStatus(context: SkillExecutionContext): Promise<{
    action: string;
    success: boolean;
    verificationStatus: {
      overallStatus: 'COMPLETE' | 'INCOMPLETE' | 'PENDING' | 'ACTION_REQUIRED';
      completionPercentage: number;
      pendingDocuments: string[];
      expiringSoon: string[];
      actionRequired: string[];
    };
    message: string;
  }> {
    const { requirements } = await this.getRequirements(context);

    const requiredDocs = requirements.filter(r => r.required);
    const approvedDocs = requiredDocs.filter(r => r.status === 'APPROVED');
    const pendingDocs = requiredDocs.filter(r => r.status === 'PENDING_REVIEW');
    const rejectedDocs = requiredDocs.filter(r => r.status === 'REJECTED');
    const notSubmitted = requiredDocs.filter(r => r.status === 'NOT_SUBMITTED');

    const expiringSoon = requirements.filter(r => {
      if (!r.expiresAt) return false;
      const expiresIn = new Date(r.expiresAt).getTime() - Date.now();
      return expiresIn > 0 && expiresIn < 30 * 24 * 60 * 60 * 1000; // 30 days
    });

    const completionPercentage = Math.round((approvedDocs.length / requiredDocs.length) * 100);

    let overallStatus: 'COMPLETE' | 'INCOMPLETE' | 'PENDING' | 'ACTION_REQUIRED';
    if (approvedDocs.length === requiredDocs.length) {
      overallStatus = 'COMPLETE';
    } else if (rejectedDocs.length > 0 || notSubmitted.length > 0) {
      overallStatus = 'ACTION_REQUIRED';
    } else if (pendingDocs.length > 0) {
      overallStatus = 'PENDING';
    } else {
      overallStatus = 'INCOMPLETE';
    }

    const actionRequired = [
      ...rejectedDocs.map(d => `Resubmit ${this.documentConfig[d.documentType]?.displayName || d.documentType}`),
      ...notSubmitted.map(d => `Submit ${this.documentConfig[d.documentType]?.displayName || d.documentType}`),
    ];

    return {
      action: 'VERIFY_STATUS',
      success: true,
      verificationStatus: {
        overallStatus,
        completionPercentage,
        pendingDocuments: pendingDocs.map(d => this.documentConfig[d.documentType]?.displayName || d.documentType),
        expiringSoon: expiringSoon.map(d => this.documentConfig[d.documentType]?.displayName || d.documentType),
        actionRequired,
      },
      message: `Verification ${completionPercentage}% complete. Status: ${overallStatus.replace('_', ' ')}`,
    };
  }
}

export { DocumentUploadInputSchema };
