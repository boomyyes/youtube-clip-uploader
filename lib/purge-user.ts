import "server-only";
import { admin } from "@/lib/supabase/admin";
import { remove } from "@/lib/r2.mjs";

/**
 * Deletes a user's account and data (used by self-deletion and by the owner). Returns an error message, or null.
 * Upload records are kept 12 months for copyright/abuse complaints; see the privacy policy.
 */
export async function purgeUser(userId: string): Promise<string | null> {
  const db = admin();
  // Cancel approved clips first so the worker can't claim one after the check below (it only claims 'approved').
  await db.from("clips").update({ status: "rejected", reject_reason: "Account deleted", seq: null }).eq("user_id", userId).eq("status", "approved");
  // A clip already mid-upload could still be published after the account is gone, so wait for it.
  const { count } = await db.from("clips").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "uploading");
  if (count) return "A clip is uploading to YouTube right now. Other approved clips were cancelled; try again in a few minutes.";
  const { data: clips } = await db.from("clips").select("storage_path").eq("user_id", userId);
  for (const c of clips ?? []) await remove(c.storage_path); // missing files are fine
  const { error } = await db.auth.admin.deleteUser(userId); // cascades to profile and clip records
  return error ? `Deletion failed: ${error.message}` : null;
}
