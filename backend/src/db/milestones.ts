import { SupabaseClient } from '@supabase/supabase-js';
import { TrustedMilestone, MilestoneStatus } from '../models/milestones';

interface DbMilestoneRow {
  id: string;
  contract_id: string;
  title: string;
  description: string | null;
  amount: number | string;
  currency: string;
  status: MilestoneStatus;
  order_index: number;
  due_date: string | null;
  acceptance_criteria?: string[];
  contracts?: {
    title: string;
  };
}

export function mapDbMilestoneToApp(row: DbMilestoneRow): TrustedMilestone {
  return {
    id: row.id,
    projectId: row.contract_id,
    projectName: row.contracts?.title || 'Contract Project',
    milestoneNumber: row.order_index || 1,
    title: row.title,
    description: row.description || '',
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    dueDate: row.due_date || '',
    acceptanceCriteria: Array.isArray(row.acceptance_criteria) ? row.acceptance_criteria : [],
  };
}

/**
 * Retrieves a milestone by ID with user-scoped Supabase client.
 * PostgreSQL RLS ('milestones_select_member') ensures only contract members can read it.
 */
export async function dbGetMilestoneById(
  userClient: SupabaseClient,
  milestoneId: string
): Promise<TrustedMilestone | null> {
  const { data, error } = await userClient
    .from('milestones')
    .select('*, contracts(title)')
    .eq('id', milestoneId)
    .maybeSingle();

  if (error) {
    throw new Error(`Database error retrieving milestone '${milestoneId}': ${error.message}`);
  }

  if (!data) return null;
  return mapDbMilestoneToApp(data);
}

/**
 * Lists all milestones for a specific contract.
 */
export async function dbListMilestonesByContract(
  userClient: SupabaseClient,
  contractId: string
): Promise<TrustedMilestone[]> {
  const { data, error } = await userClient
    .from('milestones')
    .select('*, contracts(title)')
    .eq('contract_id', contractId)
    .order('order_index', { ascending: true });

  if (error) {
    throw new Error(`Database error listing milestones for contract '${contractId}': ${error.message}`);
  }

  return (data || []).map(mapDbMilestoneToApp);
}

/**
 * Creates a milestone in the database.
 * PostgreSQL RLS ('milestones_insert_client') enforces client membership on the parent contract.
 */
export async function dbCreateMilestone(
  userClient: SupabaseClient,
  input: {
    contractId: string;
    title: string;
    description?: string;
    amount: number;
    currency?: string;
    orderIndex?: number;
    dueDate?: string;
    acceptanceCriteria?: string[];
  }
): Promise<TrustedMilestone> {
  const { data, error } = await userClient
    .from('milestones')
    .insert({
      contract_id: input.contractId,
      title: input.title,
      description: input.description || null,
      amount: input.amount,
      currency: input.currency || 'USD',
      status: 'pending',
      order_index: input.orderIndex || 1,
      due_date: input.dueDate || null,
      acceptance_criteria: input.acceptanceCriteria || [],
    })
    .select('*, contracts(title)')
    .single();

  if (error) {
    throw new Error(`Database error creating milestone: ${error.message}`);
  }

  return mapDbMilestoneToApp(data);
}

/**
 * Updates a milestone status in the database.
 */
export async function dbUpdateMilestoneStatus(
  client: SupabaseClient,
  milestoneId: string,
  status: MilestoneStatus
): Promise<boolean> {
  const { error } = await client
    .from('milestones')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', milestoneId);

  if (error) {
    throw new Error(`Database error updating milestone '${milestoneId}': ${error.message}`);
  }

  return true;
}
