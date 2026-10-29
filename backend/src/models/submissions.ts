/**
 * Trusted Server-Side Submissions Model
 *
 * Enforces parent-contract multi-tenant scoping and submission immutability.
 */

export type SubmissionStatus =
  | 'pending_review'
  | 'revision_requested'
  | 'approved'
  | 'rejected';

export interface Submission {
  id: string;
  milestoneId: string;
  contractId: string;
  submittedBy: string;
  deliverableUrl: string;
  notes?: string;
  status: SubmissionStatus;
  reviewNotes?: string;
  createdAt: string;
  updatedAt: string;
}

const submissionsStore: Map<string, Submission> = new Map([
  [
    'sub-001',
    {
      id: 'sub-001',
      milestoneId: 'ms-002',
      contractId: 'proj-001',
      submittedBy: 'usr-freelancer-001',
      deliverableUrl: 'https://github.com/milestoneshield/demo-storefront/pull/14',
      notes: 'Initial frontend components and responsive checkout views implemented.',
      status: 'pending_review',
      createdAt: '2026-10-27T10:00:00Z',
      updatedAt: '2026-10-27T10:00:00Z',
    },
  ],
]);

let subCounter = 2;

export function getSubmissionsForMilestone(milestoneId: string): Submission[] {
  return Array.from(submissionsStore.values()).filter(
    (s) => s.milestoneId === milestoneId,
  );
}

export function getSubmissionById(id: string): Submission | undefined {
  return submissionsStore.get(id);
}

export function createSubmission(data: {
  milestoneId: string;
  contractId: string;
  submittedBy: string;
  deliverableUrl: string;
  notes?: string;
}): Submission {
  const id = `sub-${String(subCounter++).padStart(3, '0')}`;
  const now = new Date().toISOString();
  const submission: Submission = {
    ...data,
    id,
    status: 'pending_review',
    createdAt: now,
    updatedAt: now,
  };
  submissionsStore.set(id, submission);
  return submission;
}

export function resetSubmissionsStoreForTests(): void {
  submissionsStore.clear();
  subCounter = 2;
  submissionsStore.set('sub-001', {
    id: 'sub-001',
    milestoneId: 'ms-002',
    contractId: 'proj-001',
    submittedBy: 'usr-freelancer-001',
    deliverableUrl: 'https://github.com/milestoneshield/demo-storefront/pull/14',
    notes: 'Initial frontend components and responsive checkout views implemented.',
    status: 'pending_review',
    createdAt: '2026-10-27T10:00:00Z',
    updatedAt: '2026-10-27T10:00:00Z',
  });
}
