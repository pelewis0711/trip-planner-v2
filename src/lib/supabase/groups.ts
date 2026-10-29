import type { SupabaseClient } from "@supabase/supabase-js";
export async function groupRpc<T>(
  client: SupabaseClient,
  name: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await client.rpc(name, args);
  if (error) {
    const errors: Record<string, string> = {
      WN_SHARE_SUM: "Shares must add up exactly to the cost.",
      WN_INVALID_SHARES: "Enter valid shares with at most two decimal places.",
      WN_INVALID_COST: "Enter a positive cost with at most two decimal places.",
      WN_COST_OWNER_REQUIRED: "Only the person who added or paid this cost can change it.",
      WN_COST_CHANGED: "This cost changed. Close the editor, refresh and try again.",
      WN_COST_MEMBER_REQUIRED: "Choose people on this trip or already included in this cost.",
      WN_SPLIT_PEOPLE_REQUIRED: "Choose at least one person to split this cost with.",
      WN_COST_LIMIT: "This weekend has reached its 500-cost limit.",
      WN_CURRENCY_LOCKED: "The group currency cannot change after costs or repayments are recorded.",
      WN_SETTLEMENT_PARTY_REQUIRED: "Only the two people involved can record or undo this repayment.",
      WN_BALANCE_CHANGED: "The balance changed or was already settled. Refresh and try again.",
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
