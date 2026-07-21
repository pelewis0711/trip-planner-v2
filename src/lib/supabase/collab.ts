import type { SupabaseClient } from "@supabase/supabase-js";

export interface VoteRow {
  user_id: string;
  emoji: string;
}

export interface CommentRow {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
}

export async function fetchVotes(supabase: SupabaseClient, planId: string, slotId: string): Promise<VoteRow[]> {
  const { data, error } = await supabase
    .from("plan_votes")
    .select("user_id, emoji")
    .eq("plan_id", planId)
    .eq("slot_id", slotId);
  if (error) {
    console.error("Failed to fetch votes", error);
    return [];
  }
  return data ?? [];
}

export async function setVote(
  supabase: SupabaseClient,
  planId: string,
  slotId: string,
  userId: string,
  emoji: string
): Promise<boolean> {
  const { error } = await supabase
    .from("plan_votes")
    .upsert({ plan_id: planId, slot_id: slotId, user_id: userId, emoji }, { onConflict: "plan_id,slot_id,user_id" });
  if (error) console.error("Failed to save vote", error);
  return !error;
}

export async function removeVote(
  supabase: SupabaseClient,
  planId: string,
  slotId: string,
  userId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("plan_votes")
    .delete()
    .eq("plan_id", planId)
    .eq("slot_id", slotId)
    .eq("user_id", userId);
  if (error) console.error("Failed to remove vote", error);
  return !error;
}

export async function fetchComments(
  supabase: SupabaseClient,
  planId: string,
  slotId: string
): Promise<CommentRow[]> {
  const { data, error } = await supabase
    .from("plan_comments")
    .select("id, user_id, body, created_at")
    .eq("plan_id", planId)
    .eq("slot_id", slotId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("Failed to fetch comments", error);
    return [];
  }
  return data ?? [];
}

export async function postComment(
  supabase: SupabaseClient,
  planId: string,
  slotId: string,
  userId: string,
  body: string
): Promise<CommentRow | null> {
  const { data, error } = await supabase
    .from("plan_comments")
    .insert({ plan_id: planId, slot_id: slotId, user_id: userId, body })
    .select("id, user_id, body, created_at")
    .single();
  if (error) {
    console.error("Failed to post comment", error);
    return null;
  }
  return data;
}

export async function deleteComment(supabase: SupabaseClient, id: string): Promise<boolean> {
  const { error } = await supabase.from("plan_comments").delete().eq("id", id);
  if (error) console.error("Failed to delete comment", error);
  return !error;
}
