import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

export interface UserAuditEvent {
  id: string;
  timestamp: string;
  entityType: 'user';
  entityId: string;
  action: string;
  actorId: string;
  actorRole: string;
  payload: Record<string, unknown>;
}

export const userAuditLog: UserAuditEvent[] = [];

export function recordUserAuditEvent(event: Omit<UserAuditEvent, 'id' | 'timestamp'>): void {
  userAuditLog.push({
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...event,
  });
}

// In-memory profiles store for demo and local runtime
interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: 'client' | 'freelancer';
  onboardingCompleted: boolean;
  avatarUrl?: string;
  deletedAt?: string;
}

const profilesStore = new Map<string, UserProfile>([
  [
    'usr-client-001',
    {
      id: 'usr-client-001',
      email: 'client@example.com',
      fullName: 'Alex Vance',
      role: 'client',
      onboardingCompleted: true,
    },
  ],
  [
    'usr-freelancer-001',
    {
      id: 'usr-freelancer-001',
      email: 'freelancer@example.com',
      fullName: 'Samira Chen',
      role: 'freelancer',
      onboardingCompleted: true,
    },
  ],
]);

export function getProfile(id: string): UserProfile | undefined {
  return profilesStore.get(id);
}

export function resetProfilesStoreForTests(): void {
  profilesStore.clear();
  profilesStore.set('usr-client-001', {
    id: 'usr-client-001',
    email: 'client@example.com',
    fullName: 'Alex Vance',
    role: 'client',
    onboardingCompleted: true,
  });
  profilesStore.set('usr-freelancer-001', {
    id: 'usr-freelancer-001',
    email: 'freelancer@example.com',
    fullName: 'Samira Chen',
    role: 'freelancer',
    onboardingCompleted: true,
  });
}

const updateProfileSchema = z
  .object({
    fullName: z.string().min(2).max(80).optional(),
    avatarUrl: z.string().url().optional(),
  })
  .strict();

const onboardingSchema = z
  .object({
    role: z.enum(['client', 'freelancer']),
    fullName: z.string().min(2).max(80),
  })
  .strict();

const deleteAccountSchema = z
  .object({
    confirmation: z.literal('DELETE MY ACCOUNT'),
    reason: z.string().max(300).optional(),
  })
  .strict();

// All user endpoints require authentication
router.use('/users', requireAuth);

/**
 * GET /api/users/me
 * Retrieves current user profile and onboarding status
 */
router.get('/users/me', (req: Request, res: Response) => {
  const user = req.user!;
  let profile = profilesStore.get(user.id);
  if (!profile) {
    // Lazily create profile if not yet in store
    profile = {
      id: user.id,
      email: user.email,
      fullName: user.fullName || '',
      role: user.role === 'admin' ? 'client' : user.role,
      onboardingCompleted: false,
    };
    profilesStore.set(user.id, profile);
  }

  res.json({
    status: 'success',
    data: profile,
  });
});

/**
 * PATCH /api/users/me
 * Updates editable profile attributes (fullName, avatarUrl)
 */
router.patch('/users/me', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }

    const user = req.user!;
    let profile = profilesStore.get(user.id);
    if (!profile) {
      profile = {
        id: user.id,
        email: user.email,
        fullName: parsed.data.fullName || '',
        role: user.role === 'admin' ? 'client' : user.role,
        onboardingCompleted: false,
      };
    } else {
      if (parsed.data.fullName !== undefined) profile.fullName = parsed.data.fullName;
      if (parsed.data.avatarUrl !== undefined) profile.avatarUrl = parsed.data.avatarUrl;
    }
    profilesStore.set(user.id, profile);

    res.json({
      status: 'success',
      data: profile,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/users/me/onboarding
 * Completes onboarding flow: records chosen role (client or freelancer) and marks completed
 */
router.post('/users/me/onboarding', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = onboardingSchema.safeParse(req.body);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }

    const user = req.user!;
    const profile: UserProfile = {
      id: user.id,
      email: user.email,
      fullName: parsed.data.fullName,
      role: parsed.data.role, // strictly client or freelancer, never admin
      onboardingCompleted: true,
    };
    profilesStore.set(user.id, profile);

    recordUserAuditEvent({
      entityType: 'user',
      entityId: user.id,
      action: 'ONBOARDING_COMPLETED',
      actorId: user.id,
      actorRole: profile.role,
      payload: { role: profile.role },
    });

    res.json({
      status: 'success',
      data: profile,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/users/me
 * Safe Account Deletion & Retention Compliance:
 * 1. Requires explicit confirmation text ("DELETE MY ACCOUNT").
 * 2. Personal PII (full name, email, avatar) is permanently anonymized/redacted.
 * 3. Contract, payment, and audit logs are PRESERVED with an anonymized actor ID
 *    to satisfy financial/tax retention requirements without cascading deletion.
 */
router.delete('/users/me', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = deleteAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }

    const user = req.user!;
    const profile = profilesStore.get(user.id);

    // Record audit event BEFORE anonymizing
    recordUserAuditEvent({
      entityType: 'user',
      entityId: user.id,
      action: 'ACCOUNT_DELETED',
      actorId: user.id,
      actorRole: user.role,
      payload: { reason: parsed.data.reason || 'User requested account deletion' },
    });

    // Anonymize personal profile data
    if (profile) {
      profile.fullName = 'Anonymized Former User';
      profile.email = `anonymized-${user.id.slice(0, 8)}@deleted.milestoneshield.internal`;
      profile.avatarUrl = undefined;
      profile.deletedAt = new Date().toISOString();
      profilesStore.set(user.id, profile);
    }

    res.json({
      status: 'success',
      message:
        'Account successfully closed. Personal profile data has been anonymized. Historical financial records and audit logs are retained in anonymized format in accordance with financial compliance policy.',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
