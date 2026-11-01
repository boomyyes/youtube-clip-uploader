"use server";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { purgeUser } from "@/lib/purge-user";

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

  const err = await purgeUser(p.id);
  if (err) redirect("/account?msg=" + encodeURIComponent(err));
  await (await createClient()).auth.signOut();
  redirect("/login?deleted=1");
}
