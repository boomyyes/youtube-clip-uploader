import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { deleteAccount } from "./actions";

export default async function Account({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const p = await getProfile();
  if (!p) redirect("/login");
  const { msg } = await searchParams;
  return (
    <>
      <h1>Your account</h1>
      <p>Signed in as {p.display_name} ({p.email}).</p>
      {msg && <p role="alert" className="error">{msg}</p>}
      <h2>Delete your account</h2>
      <p>
        This permanently deletes your account, your clip records, and any of your clips still stored on this site
        (waiting for review or upload). It happens immediately.
      </p>
      <p>
        It does <strong>not</strong> delete videos already published on our YouTube channel: those live on YouTube.
        To have one removed, email the channel owner (see the <a href="/privacy">Privacy Policy</a>).
      </p>
      <form action={deleteAccount}>
        <label>
          <input type="checkbox" name="confirm" value="yes" required /> I understand this can&apos;t be undone
        </label>
        <p><button type="submit">Delete my account</button></p>
      </form>
    </>
  );
}
