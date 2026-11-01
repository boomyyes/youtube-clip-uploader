import { getProfile } from "@/lib/auth";
import Landing from "./_landing/Landing";

// Everyone sees the landing page; signed-in people get a button to their desk instead of "Sign in".
export default async function Home() {
  const p = await getProfile();
  return <Landing cta={p ? { href: "/desk", label: "Open clip desk" } : { href: "/login", label: "Sign in with Google" }} />;
}
