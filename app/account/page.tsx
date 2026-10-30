import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import Icon from "../pixel-icon";
import { Notice, PageHeader } from "../ui";
import { changeName, deleteAccount } from "./actions";

export default async function Account({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const p = await getProfile();
  if (!p) redirect("/login");
  const { msg } = await searchParams;
  return (
    <div className="content-page account-page">
      <PageHeader eyebrow="MEMBER SETTINGS / 04" title="Account">
        Signed in as {p.display_name} ({p.email}).
      </PageHeader>
      {msg && <Notice tone="success">{msg}</Notice>}
      <div className="account-grid">
        <section className="panel" aria-labelledby="name-h">
          <div className="panel-header">
            <div><span className="panel-kicker">PROFILE</span><h2 id="name-h">Display name</h2></div>
            <span className="panel-header-icon"><Icon name="account" size={21} /></span>
          </div>
          <p>
            Your name appears in your clips&apos; YouTube titles (&quot;{p.display_name}&apos;s clip in …&quot;). Changing it
            applies to clips approved from now on. Clips already approved (or on YouTube) keep the title the owner approved.
          </p>
          <form action={changeName}>
            <label className="field-label" htmlFor="name">Display name</label>
            <input id="name" name="name" defaultValue={p.display_name} required minLength={1} maxLength={40} />
            <p className="field-help">1–40 characters</p>
            <button type="submit" className="button button-primary"><Icon name="check" /> Save name</button>
          </form>
        </section>

        <section className="panel danger-panel" aria-labelledby="del-h">
          <div className="panel-header">
            <div><span className="panel-kicker danger-kicker">DESTRUCTIVE ACTION</span><h2 id="del-h">Delete your account</h2></div>
            <span className="danger-kicker"><Icon name="alert" size={21} /></span>
          </div>
          <p>
            This permanently deletes your account, your clip records, and any of your clips still stored on this site
            (waiting for review or upload). It happens immediately. A record of videos already published (video ID, date,
            your email) is kept for 12 months for copyright complaints, as the Privacy Policy explains.
          </p>
          <div className="danger-warning">
            <Icon name="alert" size={17} />
            <span>
              It does <strong>not</strong> delete videos already published on our YouTube channel. To have one removed,
              email the channel owner (see the <Link href="/privacy">Privacy Policy</Link>).
            </span>
          </div>
          <form action={deleteAccount}>
            <label className="check-row">
              <input type="checkbox" name="confirm" value="yes" required /> I understand this can&apos;t be undone
            </label>
            <button type="submit" className="button button-danger"><Icon name="bin" /> Delete my account</button>
          </form>
        </section>
      </div>
    </div>
  );
}
