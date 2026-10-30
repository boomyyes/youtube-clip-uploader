"use server";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { remove } from "@/lib/r2.mjs";

/** Changes the display name. Only clips approved afterwards use it: approved titles are what the owner reviewed. */
export async function changeName(f: FormData) {
  const p = await getProfile();
  if (!p) redirect("/login");
  const name = String(f.get("name") ?? "").trim();
  if (name.length < 1 || name.length > 40) redirect("/account?msg=" + encodeURIComponent("Name must be 1 to 40 characters."));
  if (/[<>]/.test(name)) redirect("/account?msg=" + encodeURIComponent("Names can't contain < or > (YouTube doesn't allow them in titles)."));
  const { error } = await admin().rpc("rename_user", { p_user: p.id, p_name: name });
  redirect("/account?msg=" + encodeURIComponent(error ? `Couldn't change your name: ${error.message}` : "Name updated."));
}

/** Deletes the signed-in user's account and data (privacy policy: within 7 days; this is immediate). Upload records are kept 12 months. */
export async function deleteAccount(f: FormData) {
  const p = await getProfile();
  if (!p) redirect("/login");
  if (f.get("confirm") !== "yes") redirect("/account?msg=" + encodeURIComponent("Tick the box to confirm."));
  if (p.role === "owner") redirect("/account?msg=" + encodeURIComponent("The owner account can't be deleted here; it would leave the site without an admin."));

  const db = admin();
  // Cancel approved clips first so the worker can't claim one after the check below (it only claims 'approved').
  await db.from("clips").update({ status: "rejected", reject_reason: "Account deleted" }).eq("user_id", p.id).eq("status", "approved");
  // A clip already mid-upload could still be published after the account is gone, so wait for it.
  const { count } = await db.from("clips").select("id", { count: "exact", head: true }).eq("user_id", p.id).eq("status", "uploading");
  if (count) redirect("/account?msg=" + encodeURIComponent("One of your clips is uploading to YouTube right now. Your other approved clips were cancelled; try deleting again in a few minutes."));
  const { data: clips } = await db.from("clips").select("storage_path").eq("user_id", p.id);
  for (const c of clips ?? []) await remove(c.storage_path); // missing files are fine
  // upload_log is kept (with the uploader's email) for 12 months for copyright/abuse complaints; see the privacy policy.
  const { error } = await db.auth.admin.deleteUser(p.id); // cascades to profile and clip records
  if (error) redirect("/account?msg=" + encodeURIComponent(`Deletion failed: ${error.message}`));
  await (await createClient()).auth.signOut();
  redirect("/login?deleted=1");
}
