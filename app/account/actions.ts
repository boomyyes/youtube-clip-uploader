"use server";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { remove } from "@/lib/r2.mjs";

/** Deletes the signed-in user's account and everything stored about them (privacy policy: within 7 days; this is immediate). */
export async function deleteAccount(f: FormData) {
  const p = await getProfile();
  if (!p) redirect("/login");
  if (f.get("confirm") !== "yes") redirect("/account?msg=" + encodeURIComponent("Tick the box to confirm."));
  if (p.role === "owner") redirect("/account?msg=" + encodeURIComponent("The owner account can't be deleted here; it would leave the site without an admin."));

  const db = admin();
  const { data: clips } = await db.from("clips").select("storage_path").eq("user_id", p.id);
  for (const c of clips ?? []) await remove(c.storage_path); // missing files are fine
  await db.from("upload_log").delete().eq("uploader_id", p.id);
  const { error } = await db.auth.admin.deleteUser(p.id); // cascades to profile and clip records
  if (error) redirect("/account?msg=" + encodeURIComponent(`Deletion failed: ${error.message}`));
  await (await createClient()).auth.signOut();
  redirect("/login?deleted=1");
}
