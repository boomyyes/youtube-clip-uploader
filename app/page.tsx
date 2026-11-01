import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import Landing from "./_landing/Landing";

// Signed out: the 3D landing page. Signed in: straight to your desk.
export default async function Home() {
  const p = await getProfile();
  if (!p) return <Landing />;
  if (!p.approved) redirect("/pending");
  redirect(p.role === "owner" ? "/admin" : "/upload");
}
