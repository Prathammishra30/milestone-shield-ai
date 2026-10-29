import { SupabaseClient } from '@supabase/supabase-js';
import { Submission, SubmissionStatus } from '../models/submissions';

interface DbSubmissionRow {
  id: string;
  milestone_id: string;
  contract_id: string;
  submitted_by: string;
  deliverable_url: string;
  notes: string | null;
  status: SubmissionStatus;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

export function mapDbSubmissionToApp(row: DbSubmissionRow): Submission {
  return {
    id: row.id,
    milestoneId: row.milestone_id,
    contractId: row.contract_id,
    submittedBy: row.submitted_by,
    deliverableUrl: row.deliverable_url,
    notes: row.notes || undefined,
    status: row.status,
    reviewNotes: row.review_notes || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Retrieves submissions for a milestone with user-scoped client.
 * PostgreSQL RLS ('submissions_select_member') ensures only contract members can read deliverables.
 */
export async function dbGetSubmissionsForMilestone(
  userClient: SupabaseClient,
  milestoneId: string
): Promise<Submission[]> {
  const { data, error } = await userClient
    .from('submissions')
    .select('*')
    .eq('milestone_id', milestoneId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Database error fetching submissions: ${error.message}`);
  }

  return (data || []).map(mapDbSubmissionToApp);
}

/**
 * Creates a deliverable submission with user-scoped client.
 * PostgreSQL RLS ('submissions_insert_freelancer') checks auth.uid() = submitted_by
 * and validates that the caller is an assigned freelancer on the contract.
 */
export async function dbCreateSubmission(
  userClient: SupabaseClient,
  input: {
    milestoneId: string;
    contractId: string;
    submittedBy: string;
    deliverableUrl: string;
    notes?: string;
  }
): Promise<Submission> {
  const { data, error } = await userClient
    .from('submissions')
    .insert({
      milestone_id: input.milestoneId,
      contract_id: input.contractId,
      submitted_by: input.submittedBy,
      deliverable_url: input.deliverableUrl,
      notes: input.notes || null,
      status: 'pending_review',
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Database error creating submission: ${error.message}`);
  }

  return mapDbSubmissionToApp(data);
}
