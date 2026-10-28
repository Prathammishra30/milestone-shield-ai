/** Shared types for MilestoneShield AI */

export type ProjectStatus = 'active' | 'completed' | 'paused' | 'draft';
export type MilestoneStatus = 'pending' | 'in_progress' | 'submitted' | 'approved' | 'rejected' | 'paid';
export type SubmissionStatus = 'pending_review' | 'approved' | 'rejected' | 'revision_requested' | 'escalated';
export type PaymentStatus = 'pending' | 'authorized' | 'captured' | 'refunded' | 'voided';

export interface CriteriaCheck {
  id: string;
  criterion: string;
  status: 'met' | 'pending' | 'incomplete';
  evidence?: string;
  notes?: string;
}

export interface SubmissionAsset {
  name: string;
  url: string;
  type: 'pr' | 'figma' | 'document' | 'deploy' | 'test';
  isSample?: boolean;
}

export interface AIVerificationDetails {
  confidenceScore: number; // e.g. 0.89 (simulated demo score)
  model: string;
  evaluatedAt: string;
  summary: string;
  missingRequirements: string[];
  recommendation: 'approve' | 'request_revision' | 'escalate';
  isSimulated?: boolean;
  disclaimer?: string;
}

export interface ReviewDecision {
  status: 'pending_review' | 'approved' | 'revision_requested' | 'escalated';
  decidedBy?: string;
  decidedAt?: string;
  feedback?: string;
  auditRef?: string;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  clientEmail?: string;
  freelancer: string;
  freelancerEmail?: string;
  status: ProjectStatus;
  totalBudget: number;
  paidAmount: number;
  authorizedAmount?: number;
  milestoneCount: number;
  completedMilestones: number;
  createdAt: string;
  targetDate?: string;
  scopeSummary?: string;
}

export interface Milestone {
  id: string;
  milestoneNumber?: number;
  projectId: string;
  projectName: string;
  title: string;
  description: string;
  status: MilestoneStatus;
  amount: number;
  dueDate: string;
  acceptanceCriteria: string[];
  criteriaChecks?: CriteriaCheck[];
  submissionDetails?: {
    submittedAt: string;
    submittedBy: string;
    summary: string;
    assets: SubmissionAsset[];
    aiVerification: AIVerificationDetails | null;
    reviewDecision: ReviewDecision | null;
  };
}

export interface Submission {
  id: string;
  milestoneId: string;
  milestoneTitle: string;
  projectName: string;
  submittedBy: string;
  status: SubmissionStatus;
  submittedAt: string;
  aiConfidence: number | null;
  summary: string;
  criteriaChecks?: CriteriaCheck[];
  assets?: SubmissionAsset[];
  aiVerification?: AIVerificationDetails | null;
}

export interface PaymentRecord {
  id: string;
  projectName: string;
  milestoneTitle: string;
  amount: number;
  status: PaymentStatus;
  paypalOrderId: string | null;
  timestamp: string;
  note: string;
  referenceId?: string;
}
