import { SupabaseClient } from '@supabase/supabase-js';
import { Contract, ContractMember, UserRole } from '../models/contracts';

interface DbContractRow {
  id: string;
  title: string;
  description: string | null;
  total_budget: number | string;
  currency: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  client_id: string;
  freelancer_id: string | null;
  created_at: string;
  updated_at: string;
  contract_memberships?: Array<{
    user_id: string;
    role: UserRole;
    joined_at: string;
  }>;
}

export function mapDbContractToApp(row: DbContractRow): Contract {
  const members: ContractMember[] = (row.contract_memberships || []).map((m) => ({
    userId: m.user_id,
    role: m.role,
    joinedAt: m.joined_at,
  }));

  // If memberships not joined or empty, ensure client_id is represented
  if (!members.some((m) => m.userId === row.client_id)) {
    members.push({
      userId: row.client_id,
      role: 'client',
      joinedAt: row.created_at,
    });
  }
  if (row.freelancer_id && !members.some((m) => m.userId === row.freelancer_id)) {
    members.push({
      userId: row.freelancer_id,
      role: 'freelancer',
      joinedAt: row.created_at,
    });
  }

  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    totalBudget: Number(row.total_budget),
    currency: row.currency,
    status: row.status,
    clientId: row.client_id,
    freelancerId: row.freelancer_id || undefined,
    members,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Lists contracts for the authenticated user using their user-scoped Supabase client.
 * PostgreSQL RLS ('contracts_select_member') automatically restricts rows to the caller's memberships.
 */
export async function dbListContracts(userClient: SupabaseClient, _userId: string): Promise<Contract[]> {
  const { data, error } = await userClient
    .from('contracts')
    .select('*, contract_memberships(user_id, role, joined_at)')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Database error listing contracts: ${error.message}`);
  }

  return (data || []).map(mapDbContractToApp);
}

/**
 * Retrieves a single contract by ID.
 * Returns null if the contract does not exist or if RLS forbids the caller.
 */
export async function dbGetContractById(userClient: SupabaseClient, contractId: string): Promise<Contract | null> {
  const { data, error } = await userClient
    .from('contracts')
    .select('*, contract_memberships(user_id, role, joined_at)')
    .eq('id', contractId)
    .maybeSingle();

  if (error) {
    throw new Error(`Database error retrieving contract '${contractId}': ${error.message}`);
  }

  if (!data) return null;
  return mapDbContractToApp(data);
}

/**
 * Inserts a new contract using the client's authenticated user client.
 * PostgreSQL RLS ('contracts_insert_client') checks auth.uid() = client_id.
 * Trigger 'on_contract_created_membership' automatically registers the client as a member.
 */
export async function dbCreateContract(
  userClient: SupabaseClient,
  input: {
    title: string;
    description?: string;
    totalBudget: number;
    currency: string;
    clientId: string;
    freelancerId?: string;
  }
): Promise<Contract> {
  const { data, error } = await userClient
    .from('contracts')
    .insert({
      title: input.title,
      description: input.description || null,
      total_budget: input.totalBudget,
      currency: input.currency,
      status: 'active',
      client_id: input.clientId,
      freelancer_id: input.freelancerId || null,
    })
    .select('*, contract_memberships(user_id, role, joined_at)')
    .single();

  if (error) {
    throw new Error(`Database error creating contract: ${error.message}`);
  }

  return mapDbContractToApp(data);
}
