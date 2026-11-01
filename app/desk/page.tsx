import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

// Sends a signed-in user to their starting page (used after sign-in; "/" is the landing page).
export default async function Desk() {
  const p = await requireUser();
  redirect(p.role === "owner" ? "/admin" : "/upload");
}
