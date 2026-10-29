import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireContractMember, requireMilestoneContractMember, requireRole } from '../middleware/contractGuard';
import {
  listContractsForUser,
  getContractById,
  createContract,
  Contract,
} from '../models/contracts';
import { getAllMilestones, TrustedMilestone } from '../models/milestones';
import {
  createSubmission,
  getSubmissionsForMilestone,
  Submission,
} from '../models/submissions';
import { isSafePublicHttpsUrl } from '../utils/urlValidator';
import { AppError } from '../middleware/errorHandler';
import { isSupabaseConfigured } from '../db/client';
import { dbListContracts, dbCreateContract } from '../db/contracts';
import { dbListMilestonesByContract } from '../db/milestones';
import { dbGetSubmissionsForMilestone, dbCreateSubmission } from '../db/submissions';

const router = Router();

const createSubmissionSchema = z.object({
  deliverableUrl: z.string().url().refine(isSafePublicHttpsUrl, {
    message: 'Deliverable URL must be a public HTTPS URL and cannot target internal, private or metadata addresses (SSRF protection).',
  }),
  notes: z.string().max(1000).optional().default(''),
});

const createContractSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().max(1000).optional().default(''),
  totalBudget: z.number().positive(),
  currency: z.string().length(3).default('USD'),
  freelancerEmail: z.string().email().optional(),
});

// All contract and milestone endpoints require authentication
router.use(['/contracts', '/milestones'], requireAuth);

/**
 * GET /api/contracts
 * Returns contracts where the authenticated user is an authorized member
 */
router.get('/contracts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    let userContracts: Contract[];
    if (req.supabase && isSupabaseConfigured()) {
      userContracts = await dbListContracts(req.supabase, userId);
    } else {
      userContracts = listContractsForUser(userId);
    }
    res.json({
      status: 'success',
      data: userContracts,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/contracts/:id
 * Returns contract details, guarded by contract membership
 */
router.get(
  '/contracts/:id',
  requireContractMember('id'),
  (req: Request, res: Response) => {
    res.json({
      status: 'success',
      data: req.contract,
    });
  }
);

/**
 * GET /api/contracts/:id/milestones
 * Returns milestones scoped to a specific contract
 */
router.get(
  '/contracts/:id/milestones',
  requireContractMember('id'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawId = req.params.id;
      const contractId = Array.isArray(rawId) ? rawId[0] : rawId;
      let contractMilestones: TrustedMilestone[];
      if (req.supabase && isSupabaseConfigured()) {
        contractMilestones = await dbListMilestonesByContract(req.supabase, contractId);
      } else {
        const allMilestones = getAllMilestones();
        contractMilestones = allMilestones.filter((m: TrustedMilestone) => m.projectId === contractId);
      }
      res.json({
        status: 'success',
        data: contractMilestones,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/milestones/:id
 * Retrieves milestone details, strictly guarded by contract membership
 */
router.get(
  '/milestones/:id',
  requireMilestoneContractMember('id'),
  (req: Request, res: Response) => {
    res.json({
      status: 'success',
      data: req.milestone,
    });
  }
);

/**
 * GET /api/milestones/:id/submissions
 * Retrieves deliverable submissions for a milestone, strictly guarded by contract membership
 */
router.get(
  '/milestones/:id/submissions',
  requireMilestoneContractMember('id'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const milestone = req.milestone!;
      let submissions: Submission[];
      if (req.supabase && isSupabaseConfigured()) {
        submissions = await dbGetSubmissionsForMilestone(req.supabase, milestone.id);
      } else {
        submissions = getSubmissionsForMilestone(milestone.id);
      }
      res.json({
        status: 'success',
        data: submissions,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/milestones/:id/submissions
 * Creates deliverable proof submission:
 * - Strictly guarded by contract membership (only members can access)
 * - Requires 'freelancer' or 'admin' role
 * - Enforces SSRF-safe public HTTPS deliverable URL
 * - Assigns submitter ID strictly from authenticated req.user.id
 */
router.post(
  '/milestones/:id/submissions',
  requireMilestoneContractMember('id'),
  requireRole(['freelancer', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createSubmissionSchema.safeParse(req.body);
      if (!parsed.success) {
        next(parsed.error);
        return;
      }

      const milestone = req.milestone!;
      const submitter = req.user!;

      let submission: Submission;
      if (req.supabase && isSupabaseConfigured()) {
        submission = await dbCreateSubmission(req.supabase, {
          milestoneId: milestone.id,
          contractId: milestone.projectId,
          submittedBy: submitter.id,
          deliverableUrl: parsed.data.deliverableUrl,
          notes: parsed.data.notes,
        });
      } else {
        submission = createSubmission({
          milestoneId: milestone.id,
          contractId: milestone.projectId,
          submittedBy: submitter.id,
          deliverableUrl: parsed.data.deliverableUrl,
          notes: parsed.data.notes,
        });
      }

      res.status(201).json({
        status: 'success',
        data: submission,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/contracts
 * Creates a new contract with the authenticated user as client_id
 */
router.post(
  '/contracts',
  requireRole(['client', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createContractSchema.safeParse(req.body);
      if (!parsed.success) {
        next(parsed.error);
        return;
      }

      const clientUser = req.user!;
      let newContract: Contract;

      if (req.supabase && isSupabaseConfigured()) {
        newContract = await dbCreateContract(req.supabase, {
          title: parsed.data.title,
          description: parsed.data.description,
          totalBudget: parsed.data.totalBudget,
          currency: parsed.data.currency,
          clientId: clientUser.id,
        });
      } else {
        newContract = createContract({
          title: parsed.data.title,
          description: parsed.data.description,
          totalBudget: parsed.data.totalBudget,
          currency: parsed.data.currency,
          status: 'active',
          clientId: clientUser.id,
          members: [
            {
              userId: clientUser.id,
              role: 'client',
              joinedAt: new Date().toISOString(),
            },
          ],
        });
      }

      res.status(201).json({
        status: 'success',
        data: newContract,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
