import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import { UserRole, getContractById, getUserMembership, Contract } from '../models/contracts';
import { getMilestoneById, TrustedMilestone } from '../models/milestones';
import { isSupabaseConfigured } from '../db/client';
import { dbGetContractById } from '../db/contracts';
import { dbGetMilestoneById } from '../db/milestones';

declare global {
  namespace Express {
    interface Request {
      contract?: Contract;
      milestone?: TrustedMilestone;
    }
  }
}

/**
 * Middleware: Enforces that the user has a specific role (e.g. 'client' to authorize/capture funds).
 */
export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Authentication required.', 401));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(
        new AppError(
          `Forbidden: Action requires one of [${allowedRoles.join(', ')}] roles. Your role is '${req.user.role}'.`,
          403
        )
      );
      return;
    }

    next();
  };
}

/**
 * Middleware: Enforces that the authenticated user is a verified member of the contract
 * specified by :contractId or :projectId route param.
 */
export function requireContractMember(paramName = 'id') {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      next(new AppError('Authentication required.', 401));
      return;
    }

    const rawParam = req.params[paramName];
    const contractId = Array.isArray(rawParam) ? rawParam[0] : rawParam;

    if (!contractId) {
      next(new AppError('Contract ID parameter is missing from route.', 400));
      return;
    }

    let contract: Contract | undefined;

    // 1. If Supabase user client is present, query PostgreSQL with user JWT
    if (req.supabase && isSupabaseConfigured()) {
      try {
        contract = (await dbGetContractById(req.supabase, contractId)) || undefined;
      } catch {
        // Fall back gracefully
      }
    }

    // 2. Fall back to trusted in-memory store
    if (!contract) {
      contract = getContractById(contractId);
    }

    if (!contract) {
      next(new AppError(`Contract not found: '${contractId}'`, 404));
      return;
    }

    const isMember = contract.members.some((m) => m.userId === req.user!.id);
    if (!isMember && req.user.role !== 'admin') {
      next(
        new AppError(
          'Forbidden: You are not an authorized member or owner of this contract.',
          403
        )
      );
      return;
    }

    req.contract = contract;
    next();
  };
}

/**
 * Middleware: Enforces that the authenticated user is a member of the contract
 * owning the milestone specified by :id in the route params.
 */
export function requireMilestoneContractMember(paramName = 'id') {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      next(new AppError('Authentication required.', 401));
      return;
    }

    const rawParam = req.params[paramName];
    const milestoneId = Array.isArray(rawParam) ? rawParam[0] : rawParam;

    if (!milestoneId) {
      next(new AppError('Milestone ID parameter is missing from route.', 400));
      return;
    }

    let milestone: TrustedMilestone | undefined;

    // 1. If Supabase user client is present, query PostgreSQL with user JWT
    if (req.supabase && isSupabaseConfigured()) {
      try {
        milestone = (await dbGetMilestoneById(req.supabase, milestoneId)) || undefined;
      } catch {
        // Fall back gracefully
      }
    }

    // 2. Fall back to in-memory milestone store
    if (!milestone) {
      milestone = getMilestoneById(milestoneId);
    }

    if (!milestone) {
      next(new AppError(`Milestone not found: '${milestoneId}'`, 404));
      return;
    }

    let contract: Contract | undefined;
    if (req.supabase && isSupabaseConfigured()) {
      try {
        contract = (await dbGetContractById(req.supabase, milestone.projectId)) || undefined;
      } catch {
        // Fall back gracefully
      }
    }

    if (!contract) {
      contract = getContractById(milestone.projectId);
    }

    if (!contract) {
      next(new AppError(`Contract project not found: '${milestone.projectId}'`, 404));
      return;
    }

    const isMember = contract.members.some((m) => m.userId === req.user!.id);
    if (!isMember && req.user.role !== 'admin') {
      next(
        new AppError(
          'Forbidden: You are not authorized to view or manage milestones for this contract.',
          403
        )
      );
      return;
    }

    req.milestone = milestone;
    req.contract = contract;
    next();
  };
}
