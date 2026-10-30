import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export default async function Home() {
  const p = await requireUser();
  redirect(p.role === "owner" ? "/admin" : "/upload");
}
