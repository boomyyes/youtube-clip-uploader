import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";

export default async function Pending() {
  const p = await getProfile();
  if (!p) redirect("/login");
  if (p.approved) redirect("/");
  return (
    <>
      <h1>Waiting for approval</h1>
      <p>Thanks for signing up, {p.display_name}. The channel owner needs to approve your account before you can upload. Check back later.</p>
    </>
  );
}
