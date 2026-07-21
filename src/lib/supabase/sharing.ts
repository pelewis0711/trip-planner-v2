import type { SupabaseClient } from "@supabase/supabase-js";
import type { Plan } from "@/lib/store/plan";
import { fetchProfileEmails } from "./profiles";

export interface PlanRow {
  id: string;
  user_id: string;
  name: string;
  data: Omit<
    Plan,
    "id" | "name" | "ownerId" | "readOnly" | "shareViewToken" | "shareCollabToken" | "collaboratorIds" | "lastEditedBy" | "lastEditedAt"
  >;
  share_view_token: string | null;
  share_collab_token: string | null;
  collaborator_ids: string[];
  last_edited_by: string | null;
  last_edited_at: string | null;
}

export function rowToPlan(row: PlanRow, emails: Map<string, string>): Plan {
  return {
    id: row.id,
    name: row.name,
    ...row.data,
    ownerId: row.user_id,
    shareViewToken: row.share_view_token,
    shareCollabToken: row.share_collab_token,
    collaboratorIds: row.collaborator_ids ?? [],
    lastEditedBy: row.last_edited_by ? (emails.get(row.last_edited_by) ?? null) : null,
    lastEditedAt: row.last_edited_at ? new Date(row.last_edited_at).getTime() : null,
  };
}

/** Resolves the emails a PlanRow needs (owner, collaborators, last editor)
 * and converts it to a Plan in one step. */
export async function rowToPlanWithEmails(supabase: SupabaseClient, row: PlanRow): Promise<Plan> {
  const ids = [row.user_id, row.last_edited_by, ...(row.collaborator_ids ?? [])].filter(
    (x): x is string => !!x
  );
  const emails = await fetchProfileEmails(supabase, ids);
  return rowToPlan(row, emails);
}

/** Row for creating a brand-new plan (owner-only INSERT — sharing columns
 * stay at their defaults and are only ever changed via the RPCs below). */
export function planToInsertRow(userId: string, p: Plan) {
  return {
    id: p.id,
    user_id: userId,
    name: p.name,
    data: {
      home: p.home,
      bag: p.bag,
      budget: p.budget,
      placements: p.placements,
      created: p.created,
      updated: p.updated,
      semester: p.semester,
    },
    updated_at: new Date(p.updated).toISOString(),
  };
}

async function callPlanRpc(
  supabase: SupabaseClient,
  fn: string,
  args: Record<string, unknown>
): Promise<Plan | null> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    console.error(`${fn} failed`, error);
    return null;
  }
  const row = (data as PlanRow[] | null)?.[0];
  if (!row) return null;
  return rowToPlanWithEmails(supabase, row);
}

export const enableViewShare = (supabase: SupabaseClient, planId: string) =>
  callPlanRpc(supabase, "enable_view_share", { p_id: planId });

export const disableViewShare = (supabase: SupabaseClient, planId: string) =>
  callPlanRpc(supabase, "disable_view_share", { p_id: planId });

export const enableCollabShare = (supabase: SupabaseClient, planId: string) =>
  callPlanRpc(supabase, "enable_collab_share", { p_id: planId });

export const disableCollabShare = (supabase: SupabaseClient, planId: string) =>
  callPlanRpc(supabase, "disable_collab_share", { p_id: planId });

export const getSharedPlan = (supabase: SupabaseClient, token: string) =>
  callPlanRpc(supabase, "get_shared_plan", { p_token: token });

export const joinPlanAsCollaborator = (supabase: SupabaseClient, token: string) =>
  callPlanRpc(supabase, "join_plan_as_collaborator", { p_token: token });

export const savePlanData = (supabase: SupabaseClient, id: string, name: string, data: PlanRow["data"]) =>
  callPlanRpc(supabase, "update_plan_data", { p_id: id, p_name: name, p_data: data });
