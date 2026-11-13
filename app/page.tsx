import { getProfile } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import Landing from "./_landing/Landing";

// Public totals for the landing page's stats band. Counts only (no rows), so nothing personal is exposed.
async function stats() {
  try {
    const db = admin();
    const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
    const [live, members, games] = await Promise.all([
      count(db.from("clips").select("id", { count: "exact", head: true }).eq("status", "on_youtube")),
      count(db.from("profiles").select("id", { count: "exact", head: true }).eq("approved", true)),
      count(db.from("games").select("name", { count: "exact", head: true })),
    ]);
    return { live, members, games };
  } catch {
    return null; // stats band is hidden if the database can't be reached
  }
}

// Everyone sees the landing page; signed-in people get a button to their desk instead of "Sign in".
export default async function Home() {
  const [p, s] = await Promise.all([getProfile(), stats()]);
  return <Landing stats={s} cta={p ? { href: "/desk", label: "Open clip desk" } : { href: "/login", label: "Sign in with Google" }} />;
}
