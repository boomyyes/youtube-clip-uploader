"use server";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { purgeUser } from "@/lib/purge-user";

function done(msg?: string): never {
  redirect(msg ? `/admin/members?msg=${encodeURIComponent(msg)}` : "/admin/members");
}

// Server actions are public POST endpoints: re-check the owner, and never act on an owner account.
async function memberTarget(f: FormData) {
  const p = await getProfile();
  if (p?.role !== "owner" || !p.approved) throw new Error("Forbidden");
  const id = String(f.get("id") ?? "");
  const { data: target } = await admin().from("profiles").select("id, display_name, role").eq("id", id).maybeSingle();
  if (!target) done("No such account.");
  if (target.role === "owner") done("The owner account can't be changed here.");
  return target;
}

/** Suspend (can't upload or see clips) or reactivate. Clips already approved still upload; reject or delete to stop them. */
export async function setApproved(f: FormData) {
  const t = await memberTarget(f);
  const approved = f.get("approved") === "true";
  const { error } = await admin().from("profiles").update({ approved }).eq("id", t.id);
  done(error?.message ?? `${t.display_name} ${approved ? "reactivated" : "suspended"}.`);
}

/** Same rules as self-rename: only clips approved afterwards use the new name. */
export async function renameMember(f: FormData) {
  const t = await memberTarget(f);
  const name = String(f.get("name") ?? "").trim();
  if (name.length < 1 || name.length > 40) done("Name must be 1 to 40 characters.");
  if (/[<>]/.test(name)) done("Names can't contain < or >.");
  const { error } = await admin().rpc("rename_user", { p_user: t.id, p_name: name });
  done(error?.message ?? `Renamed to ${name}.`);
}

export async function deleteMember(f: FormData) {
  const t = await memberTarget(f);
  if (f.get("confirm") !== "yes") done("Tick the box to confirm deleting the account.");
  done((await purgeUser(t.id)) ?? `${t.display_name}'s account and stored clips were deleted.`);
}
