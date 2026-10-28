import type { SupabaseClient } from "@supabase/supabase-js";
export async function groupRpc<T>(
  client: SupabaseClient,
  name: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await client.rpc(name, args);
  if (error) {
    const errors: Record<string, string> = {
      WN_GROUP_FULL: "Groups and weekends can include up to 10 people.",
      WN_GROUP_BLOCKED: "Someone in this group has a block with that person.",
      WN_INVITE_EXPIRED:
        "This invitation has expired or was reset. Ask for a new link.",
      WN_FRIEND_REQUIRED: "You can only add your current friends.",
      WN_ADMIN_REQUIRED: "Only a group admin can do that.",
      WN_GOING_REQUIRED: "Choose Going to suggest an edit or vote.",
      WN_PROPOSAL_LIMIT:
        "Finish one of the open votes before suggesting another edit.",
      WN_SHORTLIST_FULL: "This shortlist has reached 50 listings.",
    };
    throw new Error(
      Object.entries(errors).find(([key]) =>
        error.message.includes(key),
      )?.[1] ?? "Could not save or load this group. Refresh and try again.",
    );
  }
  return data as T;
}
