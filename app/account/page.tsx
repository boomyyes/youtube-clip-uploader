import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { changeName, deleteAccount } from "./actions";

export default async function Account({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const p = await getProfile();
  if (!p) redirect("/login");
  const { msg } = await searchParams;
  return (
    <>
      <h1>Your account</h1>
      <p>Signed in as {p.display_name} ({p.email}).</p>
      {msg && <p role="status">{msg}</p>}
      <h2>Your name</h2>
      <p>
        Your name appears in your clips&apos; YouTube titles (&quot;{p.display_name}&apos;s clip in …&quot;). Changing it
        applies to clips approved from now on. Clips already approved (or on YouTube) keep the title the owner approved.
      </p>
      <form action={changeName}>
        <label htmlFor="name">Display name</label>
        <input id="name" name="name" defaultValue={p.display_name} required minLength={1} maxLength={40} />{" "}
        <button type="submit">Save name</button>
      </form>
      <h2>Delete your account</h2>
      <p>
        This permanently deletes your account, your clip records, and any of your clips still stored on this site
        (waiting for review or upload). It happens immediately. A record of videos already published (video ID, date,
        your email) is kept for 12 months for copyright complaints, as the Privacy Policy explains.
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
