/**
 * Trusted Server-Side Milestone Data Source
 *
 * CRITICAL FINANCIAL SAFETY RULE:
 * Financial amounts, currency codes, and acceptance criteria MUST ALWAYS be derived
 * from trusted server-side models. Amounts supplied by clients or frontend payloads
 * are NEVER trusted for payment authorizations or captures.
 */

export type MilestoneStatus =
  | 'pending'
  | 'in_progress'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'paid';

export interface TrustedMilestone {
  id: string;
  projectId: string;
  projectName: string;
  milestoneNumber: number;
  title: string;
  description: string;
  amount: number;
  currency: string;
  status: MilestoneStatus;
  dueDate: string;
  acceptanceCriteria: string[];
}

/**
 * In-memory canonical milestone list for demo and testing workflows.
 * In production/Milestone 3, this will be backed by PostgreSQL.
 */
const initialMilestones: TrustedMilestone[] = [
  {
    id: 'ms-001',
    projectId: 'proj-001',
    projectName: 'E-Commerce Platform Redesign & Implementation',
    milestoneNumber: 1,
    title: 'Wireframes & Design System Architecture',
    description: 'Complete Figma design system with tokens, responsive layouts, and WCAG AA accessibility specs.',
    amount: 3000,
    currency: 'USD',
    status: 'paid',
    dueDate: '2026-09-30',
    acceptanceCriteria: [
      'Design tokens established for typography, spacing, and color palettes',
      'All 8 responsive page wireframes reviewed with contrast ratios >= 4.5:1',
      'Responsive breakpoint documentation for mobile, tablet, and desktop',
    ],
  },
  {
    id: 'ms-002',
    projectId: 'proj-001',
    projectName: 'E-Commerce Platform Redesign & Implementation',
    milestoneNumber: 2,
    title: 'Core Frontend Implementation & State Management',
    description: 'Build responsive React application matching approved wireframes with typed state and test suite.',
    amount: 3500,
    currency: 'USD',
    status: 'submitted',
    dueDate: '2026-10-28',
    acceptanceCriteria: [
      'All 8 pages implemented in React 19 and TypeScript with strict type checking',
      'Pixel-accurate responsive layout matching wireframes across all breakpoints',
      'Automated unit test coverage exceeding 80% line coverage',
    ],
  },
  {
    id: 'ms-003',
    projectId: 'proj-001',
    projectName: 'E-Commerce Platform Redesign & Implementation',
    milestoneNumber: 3,
    title: 'PayPal Sandbox Payment Gateway Integration',
    description: 'Coordinate order authorization, webhook signature verification, and automated settlement flow.',
    amount: 2500,
    currency: 'USD',
    status: 'in_progress',
    dueDate: '2026-11-15',
    acceptanceCriteria: [
      'PayPal Sandbox REST API v2 authorization and capture flow working end-to-end',
      'Webhook listener with cryptographic verification and replay prevention',
      'Graceful error handling and retry mechanisms for declined or voided authorizations',
    ],
  },
  {
    id: 'ms-004',
    projectId: 'proj-001',
    projectName: 'E-Commerce Platform Redesign & Implementation',
    milestoneNumber: 4,
    title: 'Production Deployment, Testing & Handover',
    description: 'Final security scanning, staging smoke tests, production rollout on Render, and client handover.',
    amount: 3000,
    currency: 'USD',
    status: 'pending',
    dueDate: '2026-11-30',
    acceptanceCriteria: [
      'Staging smoke test suite executed with 100% pass rate',
      'OWASP Top 10 dependency and static security scan with 0 high/critical issues',
      'Production deployment configured with zero-downtime health probes on Render',
    ],
  },
];

let milestonesStore: TrustedMilestone[] = JSON.parse(JSON.stringify(initialMilestones));

export function getMilestoneById(id: string): TrustedMilestone | undefined {
  return milestonesStore.find((m) => m.id === id);
}

export function getAllMilestones(): TrustedMilestone[] {
  return [...milestonesStore];
}

export function updateMilestoneStatus(id: string, status: MilestoneStatus): boolean {
  const milestone = milestonesStore.find((m) => m.id === id);
  if (!milestone) return false;
  milestone.status = status;
  return true;
}

export function resetMilestonesStore(): void {
  milestonesStore = JSON.parse(JSON.stringify(initialMilestones));
}
