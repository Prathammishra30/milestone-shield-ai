/**
 * Sample demonstration data for MilestoneShield AI.
 *
 * ⚠️  PROTOTYPE NOTICE:
 *     This is demonstration data only for the PayPal AI Hackathon 2026.
 *     No real payments, users, or legally binding contracts are represented.
 *     MilestoneShield AI is an AI-assisted workflow prototype, not a regulated escrow service.
 *     PayPal order IDs, references, and AI review outputs shown are simulated demonstration data.
 */

import type { Project, Milestone, Submission, PaymentRecord } from '../types';

// ── Primary Demo Contract & Projects ──────────────────────────────

export const sampleProjects: Project[] = [
  {
    id: 'proj-001',
    name: 'E-Commerce Platform Redesign & Implementation',
    client: 'Acme Retail Corp',
    clientEmail: 'billing@acmeretail.example',
    freelancer: 'Jane Dev & Studio',
    freelancerEmail: 'jane@studiodev.example',
    status: 'active',
    totalBudget: 12000,
    paidAmount: 3000,
    authorizedAmount: 3500,
    milestoneCount: 4,
    completedMilestones: 1,
    createdAt: '2026-09-15',
    targetDate: '2026-12-01',
    scopeSummary: 'Complete redesign of storefront, cart workflow, and checkout integration with strict milestone-gated payout criteria.',
  },
  {
    id: 'proj-002',
    name: 'Mobile App MVP & Companion API',
    client: 'SaaS Pulse Technologies',
    clientEmail: 'founders@saaspulse.example',
    freelancer: 'Alex Build (Mobile Specialist)',
    freelancerEmail: 'alex@codecraft.example',
    status: 'active',
    totalBudget: 8500,
    paidAmount: 0,
    authorizedAmount: 2000,
    milestoneCount: 3,
    completedMilestones: 0,
    createdAt: '2026-10-01',
    targetDate: '2026-12-15',
    scopeSummary: 'Native mobile client build with biometric login and real-time push notification endpoints.',
  },
  {
    id: 'proj-003',
    name: 'Brand Identity & Visual System Package',
    client: 'DesignCo Labs',
    clientEmail: 'ops@designcolabs.example',
    freelancer: 'Sam Create (Brand Designer)',
    freelancerEmail: 'sam@brandfoundry.example',
    status: 'completed',
    totalBudget: 4500,
    paidAmount: 4500,
    authorizedAmount: 0,
    milestoneCount: 3,
    completedMilestones: 3,
    createdAt: '2026-07-20',
    targetDate: '2026-09-30',
    scopeSummary: 'Complete corporate identity overhaul with brand book, typography licensing, and vector assets.',
  },
  {
    id: 'proj-004',
    name: 'API Data Ingestion & Federation Pipeline',
    client: 'TechFlow Financial Inc',
    clientEmail: 'integrations@techflow.example',
    freelancer: 'Pat Code (Backend Engineer)',
    freelancerEmail: 'pat@cloudsync.example',
    status: 'draft',
    totalBudget: 6000,
    paidAmount: 0,
    authorizedAmount: 0,
    milestoneCount: 2,
    completedMilestones: 0,
    createdAt: '2026-10-25',
    targetDate: '2027-01-15',
    scopeSummary: 'High-throughput webhook processing engine with schema validation and idempotency keys.',
  },
];

// ── Milestone Data with Criteria Checks ───────────────────────────

export const sampleMilestones: Milestone[] = [
  {
    id: 'ms-001',
    milestoneNumber: 1,
    projectId: 'proj-001',
    projectName: 'E-Commerce Platform Redesign & Implementation',
    title: 'Wireframes & Design System Architecture',
    description: 'Create comprehensive high-fidelity wireframes and an accessible, responsive design system.',
    status: 'paid',
    amount: 3000,
    dueDate: '2026-10-01',
    acceptanceCriteria: [
      'Interactive Figma prototypes for 8 core storefront views',
      'Design token library with WCAG AA color contrast specifications',
      'Responsive breakpoint documentation for mobile, tablet, and desktop',
    ],
    criteriaChecks: [
      {
        id: 'c-101',
        criterion: 'Interactive Figma prototypes for 8 core storefront views',
        status: 'met',
        evidence: 'Sample Figma file v3.2 reviewed; 8 primary flows mapped with transitions.',
      },
      {
        id: 'c-102',
        criterion: 'Design token library with WCAG AA color contrast specifications',
        status: 'met',
        evidence: 'Sample contrast audit passed 4.5:1 ratio across all primary text elements.',
      },
      {
        id: 'c-103',
        criterion: 'Responsive breakpoint documentation for mobile, tablet, and desktop',
        status: 'met',
        evidence: 'Breakpoints (375px, 768px, 1280px) documented in design specs.',
      },
    ],
    submissionDetails: {
      submittedAt: '2026-09-28T16:45:00Z',
      submittedBy: 'Jane Dev & Studio',
      summary: 'Delivered complete Figma architecture and tokens. All criteria met and reviewed in sample demonstration.',
      assets: [
        { name: 'Figma Design System Spec (Sample)', url: '#sample-figma-spec', type: 'figma', isSample: true },
        { name: 'WCAG Contrast Audit Report (Sample PDF)', url: '#sample-contrast-report', type: 'document', isSample: true },
      ],
      aiVerification: {
        confidenceScore: 0.95,
        model: 'SIMULATED AI REVIEW — DEMO DATA',
        evaluatedAt: '2026-09-28T16:46:12Z',
        summary: 'SIMULATED CRITERIA EVALUATION (DEMO DATA): Deliverable mock review indicates all 3 acceptance criteria met. Note: No live Anthropic API was called; this evaluation is pre-computed demonstration data.',
        missingRequirements: [],
        recommendation: 'approve',
        isSimulated: true,
        disclaimer: 'SIMULATED AI REVIEW — DEMO DATA. Anthropic Claude API integration is scheduled for Milestone 2.',
      },
      reviewDecision: {
        status: 'approved',
        decidedBy: 'Acme Retail Corp (Client)',
        decidedAt: '2026-09-30T10:00:00Z',
        feedback: 'Approved in sample demonstration; payment released in sample ledger.',
        auditRef: 'SAMPLE-AUDIT-LOG-101',
      },
    },
  },
  {
    id: 'ms-002',
    milestoneNumber: 2,
    projectId: 'proj-001',
    projectName: 'E-Commerce Platform Redesign & Implementation',
    title: 'Core Frontend Implementation & State Management',
    description: 'Build responsive React application matching approved wireframes with typed state and test suite.',
    status: 'submitted',
    amount: 3500,
    dueDate: '2026-10-28',
    acceptanceCriteria: [
      'All 8 pages implemented in React 19 and TypeScript with strict type checking',
      'Pixel-accurate responsive layout matching wireframes across all breakpoints',
      'Automated unit test coverage exceeding 80% line coverage',
    ],
    criteriaChecks: [
      {
        id: 'c-201',
        criterion: 'All 8 pages implemented in React 19 and TypeScript with strict type checking',
        status: 'met',
        evidence: 'TypeScript compiler exited with 0 errors across 47 component files in sample code.',
        notes: 'Strict mode validated without implicit any or type assertions.',
      },
      {
        id: 'c-202',
        criterion: 'Pixel-accurate responsive layout matching wireframes across all breakpoints',
        status: 'met',
        evidence: 'Sample layout visual verification passed at 375px, 768px, 1024px, and 1440px viewports.',
        notes: 'Sidebar navigation collapses cleanly on mobile devices.',
      },
      {
        id: 'c-203',
        criterion: 'Automated unit test coverage exceeding 80% line coverage',
        status: 'incomplete',
        evidence: 'Simulated Vitest report shows 78.4% line coverage (1.6% below required 80.0% threshold).',
        notes: 'Demonstration test delta for testing review workflows.',
      },
    ],
    submissionDetails: {
      submittedAt: '2026-10-27T14:30:00Z',
      submittedBy: 'Jane Dev & Studio',
      summary: 'All 8 page views delivered with typed React components, responsive layout, and initial Vitest suite in sample demonstration.',
      assets: [
        { name: 'GitHub PR #42 (Frontend Core — Sample)', url: '#sample-github-pr-42', type: 'pr', isSample: true },
        { name: 'Staging Deployment Preview (Sample)', url: '#sample-staging-preview', type: 'deploy', isSample: true },
        { name: 'Vitest Coverage Report (Sample Summary)', url: '#sample-test-report', type: 'test', isSample: true },
      ],
      aiVerification: {
        confidenceScore: 0.89,
        model: 'SIMULATED AI REVIEW — DEMO DATA',
        evaluatedAt: '2026-10-27T14:31:05Z',
        summary: 'SIMULATED CRITERIA EVALUATION (DEMO DATA): Implementation structure aligns with wireframes. Simulated criteria check flags test coverage (78.4% vs 80.0% required). Note: No live Anthropic API was called; this evaluation is pre-computed demonstration data.',
        missingRequirements: [
          'Simulated criteria check: Test coverage delta (78.4% achieved vs 80.0% required threshold).',
        ],
        recommendation: 'request_revision',
        isSimulated: true,
        disclaimer: 'SIMULATED AI REVIEW — DEMO DATA. Anthropic Claude API integration is scheduled for Milestone 2.',
      },
      reviewDecision: {
        status: 'pending_review',
        feedback: 'Awaiting client determination in demo workspace. Client may simulate approval with minor waiver or request revision.',
      },
    },
  },
  {
    id: 'ms-003',
    milestoneNumber: 3,
    projectId: 'proj-001',
    projectName: 'E-Commerce Platform Redesign & Implementation',
    title: 'PayPal Sandbox Payment Gateway Integration',
    description: 'Coordinate order authorization, webhook signature verification, and automated settlement flow.',
    status: 'in_progress',
    amount: 2500,
    dueDate: '2026-11-15',
    acceptanceCriteria: [
      'PayPal Sandbox REST API v2 authorization and capture flow working end-to-end',
      'Webhook listener with cryptographic verification and replay prevention',
      'Graceful error handling and retry mechanisms for declined or voided authorizations',
    ],
    criteriaChecks: [
      {
        id: 'c-301',
        criterion: 'PayPal Sandbox REST API v2 authorization and capture flow working end-to-end',
        status: 'pending',
        notes: 'Integration planned for Milestone 2.',
      },
      {
        id: 'c-302',
        criterion: 'Webhook listener with cryptographic verification and replay prevention',
        status: 'pending',
        notes: 'Awaiting backend webhook endpoint configuration in Milestone 2.',
      },
      {
        id: 'c-303',
        criterion: 'Graceful error handling and retry mechanisms for declined or voided authorizations',
        status: 'pending',
        notes: 'Scheduled for development in Milestone 2.',
      },
    ],
  },
  {
    id: 'ms-004',
    milestoneNumber: 4,
    projectId: 'proj-001',
    projectName: 'E-Commerce Platform Redesign & Implementation',
    title: 'End-to-End QA, Security Hardening & Launch',
    description: 'Final quality assurance verification, load testing, and production deployment on Render.',
    status: 'pending',
    amount: 3000,
    dueDate: '2026-12-01',
    acceptanceCriteria: [
      'Zero critical or high-severity vulnerabilities in dependencies',
      'Google Lighthouse performance and accessibility scores ≥ 90 on mobile and desktop',
      'Production deployment configured with zero-downtime health probes on Render',
    ],
    criteriaChecks: [
      {
        id: 'c-401',
        criterion: 'Zero critical or high-severity vulnerabilities in dependencies',
        status: 'pending',
      },
      {
        id: 'c-402',
        criterion: 'Google Lighthouse performance and accessibility scores ≥ 90 on mobile and desktop',
        status: 'pending',
      },
      {
        id: 'c-403',
        criterion: 'Production deployment configured with zero-downtime health probes on Render',
        status: 'pending',
      },
    ],
  },
];

// ── Submissions Feed ──────────────────────────────────────────────

export const sampleSubmissions: Submission[] = [
  {
    id: 'sub-001',
    milestoneId: 'ms-002',
    milestoneTitle: 'Core Frontend Implementation & State Management',
    projectName: 'E-Commerce Platform Redesign & Implementation',
    submittedBy: 'Jane Dev & Studio',
    status: 'pending_review',
    submittedAt: '2026-10-27T14:30:00Z',
    aiConfidence: 0.89,
    summary: 'All 8 page views delivered with typed React components, responsive layout, and initial Vitest suite in sample demonstration.',
    criteriaChecks: sampleMilestones[1].criteriaChecks,
    assets: sampleMilestones[1].submissionDetails?.assets,
    aiVerification: sampleMilestones[1].submissionDetails?.aiVerification,
  },
  {
    id: 'sub-002',
    milestoneId: 'ms-001',
    milestoneTitle: 'Wireframes & Design System Architecture',
    projectName: 'E-Commerce Platform Redesign & Implementation',
    submittedBy: 'Jane Dev & Studio',
    status: 'approved',
    submittedAt: '2026-09-28T16:45:00Z',
    aiConfidence: 0.95,
    summary: 'Delivered complete Figma architecture and tokens. All criteria met and reviewed in sample demonstration.',
    criteriaChecks: sampleMilestones[0].criteriaChecks,
    assets: sampleMilestones[0].submissionDetails?.assets,
    aiVerification: sampleMilestones[0].submissionDetails?.aiVerification,
  },
];

// ── Payment Ledger & Transaction History (Sample Only) ────────────

export const samplePayments: PaymentRecord[] = [
  {
    id: 'pay-001',
    projectName: 'E-Commerce Platform Redesign & Implementation',
    milestoneTitle: 'Wireframes & Design System Architecture',
    amount: 3000,
    status: 'captured',
    paypalOrderId: 'SAMPLE-PAYPAL-ORD-7X9K2M',
    referenceId: 'SAMPLE-TX-001',
    timestamp: '2026-09-30T10:00:00Z',
    note: 'Authorized on Sep 15, captured in demo data upon milestone approval (sample transaction)',
  },
  {
    id: 'pay-002',
    projectName: 'Brand Identity & Visual System Package',
    milestoneTitle: 'Logo & Visual Identity Core',
    amount: 2000,
    status: 'captured',
    paypalOrderId: 'SAMPLE-PAYPAL-ORD-4F8J1N',
    referenceId: 'SAMPLE-TX-002',
    timestamp: '2026-08-15T14:30:00Z',
    note: 'Final delivery approved; recorded as captured in demo data',
  },
  {
    id: 'pay-003',
    projectName: 'Brand Identity & Visual System Package',
    milestoneTitle: 'Brand Guidelines & Typography Book',
    amount: 1500,
    status: 'captured',
    paypalOrderId: 'SAMPLE-PAYPAL-ORD-2R5T8Q',
    referenceId: 'SAMPLE-TX-003',
    timestamp: '2026-09-01T11:00:00Z',
    note: 'Brand guidelines book verified; captured in demo data after milestone approval',
  },
  {
    id: 'pay-004',
    projectName: 'Brand Identity & Visual System Package',
    milestoneTitle: 'Collateral & Presentation Templates',
    amount: 1000,
    status: 'captured',
    paypalOrderId: 'SAMPLE-PAYPAL-ORD-9W3P6L',
    referenceId: 'SAMPLE-TX-004',
    timestamp: '2026-09-20T09:45:00Z',
    note: 'Final project milestone settled in demo data',
  },
];

// ── Financial Contract Summary Computations ───────────────────────

export function getContractSummary(project = sampleProjects[0], milestones = sampleMilestones) {
  const contractMilestones = milestones.filter((m) => m.projectId === project.id);
  const totalValue = project.totalBudget;

  // Mutually exclusive contract allocations:
  // 1. Released in sample ledger (status = 'paid' or 'approved' locally)
  const releasedAmount = contractMilestones
    .filter((m) => m.status === 'paid' || m.status === 'approved')
    .reduce((sum, m) => sum + m.amount, 0);

  // 2. PayPal authorized — not captured (status = 'submitted')
  const authorizedAmount = contractMilestones
    .filter((m) => m.status === 'submitted')
    .reduce((sum, m) => sum + m.amount, 0);

  // 3. Remaining unfunded (all remaining milestones)
  const unfundedAmount = Math.max(0, totalValue - releasedAmount - authorizedAmount);

  const releasedPercent = totalValue > 0 ? (releasedAmount / totalValue) * 100 : 0;
  const authorizedPercent = totalValue > 0 ? (authorizedAmount / totalValue) * 100 : 0;
  const unfundedPercent = totalValue > 0 ? (unfundedAmount / totalValue) * 100 : 0;

  return {
    totalValue,
    releasedAmount, // "Released in sample ledger"
    authorizedAmount, // "PayPal authorized — not captured"
    unfundedAmount, // "Remaining unfunded"
    releasedPercent,
    authorizedPercent,
    unfundedPercent,
    milestoneCount: contractMilestones.length,
    completedCount: contractMilestones.filter((m) => m.status === 'paid' || m.status === 'approved').length,
    inReviewCount: contractMilestones.filter((m) => m.status === 'submitted').length,
    inProgressCount: contractMilestones.filter((m) => m.status === 'in_progress').length,
  };
}

export function computeDashboardStats() {
  const activeProjects = sampleProjects.filter((p) => p.status === 'active').length;
  const totalBudget = sampleProjects.reduce((sum, p) => sum + p.totalBudget, 0);
  const totalPaid = sampleProjects.reduce((sum, p) => sum + p.paidAmount, 0);
  const pendingReview = sampleSubmissions.filter((s) => s.status === 'pending_review').length;
  const milestonesInProgress = sampleMilestones.filter(
    (m) => m.status === 'in_progress' || m.status === 'submitted',
  ).length;
  const completedMilestones = sampleMilestones.filter(
    (m) => m.status === 'paid' || m.status === 'approved',
  ).length;

  return {
    activeProjects,
    totalBudget,
    totalPaid,
    pendingReview,
    milestonesInProgress,
    completedMilestones,
    totalMilestones: sampleMilestones.length,
  };
}
