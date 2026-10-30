import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Profile = { id: string; email: string; display_name: string; role: "owner" | "member"; approved: boolean };

/** The signed-in user's profile, verified with the Auth server; null if signed out. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("id, email, display_name, role, approved").eq("id", user.id).single();
  return data as Profile | null;
});

/** For pages: redirects anyone who isn't an approved user (or the owner, if ownerOnly). */
export async function requireUser(ownerOnly = false): Promise<Profile> {
  const p = await getProfile();
  if (!p) redirect("/login");
  if (!p.approved) redirect("/pending");
  if (ownerOnly && p.role !== "owner") redirect("/");
  return p;
}
