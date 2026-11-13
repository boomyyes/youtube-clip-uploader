import SubmitButton from "@/app/submit-button";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import Icon from "../../pixel-icon";
import { Notice, PageHeader } from "../../ui";
import { deleteMember, renameMember, setApproved } from "./actions";

export const metadata = { title: "Members · Clip Desk" };

export default async function Members({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireUser(true);
  const { msg } = await searchParams;
  const db = admin();
  const [{ data: people }, { data: clips }] = await Promise.all([
    db.from("profiles").select("id, email, display_name, role, approved, created_at").order("created_at"),
    db.from("clips").select("user_id, status"),
  ]);
  // Clip counts per member: total, live on YouTube, waiting for review.
  const stats = new Map<string, { total: number; live: number; waiting: number }>();
  for (const c of clips ?? []) {
    const s = stats.get(c.user_id) ?? { total: 0, live: 0, waiting: 0 };
    s.total++;
    if (c.status === "on_youtube") s.live++;
    if (c.status === "queued") s.waiting++;
    stats.set(c.user_id, s);
  }

  return (
    <div className="content-page admin-page">
      <PageHeader eyebrow="OWNER CONSOLE / 02" title="Members" action={<Link href="/admin" className="button button-ghost">← Admin</Link>}>
        Everyone who has signed in. Rename, suspend or remove accounts.
      </PageHeader>
      {msg && <Notice tone="success">{msg}</Notice>}
      <div className="review-grid">
        {people?.map((m) => {
          const s = stats.get(m.id) ?? { total: 0, live: 0, waiting: 0 };
          const isOwner = m.role === "owner";
          return (
            <article key={m.id} className="review-card">
              <div className="review-meta">
                <span className="user-avatar small" aria-hidden="true">{m.display_name.charAt(0).toUpperCase()}</span>
                <div><strong>{m.display_name}</strong><span>{m.email} · joined {new Date(m.created_at).toLocaleDateString("en-IN")}</span></div>
                <span className={`status-pill ${isOwner ? "status-online" : m.approved ? "status-waiting" : "status-failed"}`}>
                  <span className="status-dot" aria-hidden="true" />{isOwner ? "Owner" : m.approved ? "Active" : "Suspended / pending"}
                </span>
              </div>
              <div className="review-note">
                <span>CLIPS</span>
                <p>{s.total} total · {s.live} on YouTube · {s.waiting} waiting for review</p>
              </div>
              {isOwner ? (
                <p className="review-note muted">Manage your own account on the <Link href="/account">Account</Link> page.</p>
              ) : (
                <>
                  <form action={renameMember} className="reject-reason">
                    <input type="hidden" name="id" value={m.id} />
                    <label htmlFor={`name-${m.id}`}>Display name <span className="optional">Applies to clips approved from now on</span></label>
                    <div className="review-actions" style={{ padding: 0 }}>
                      <input id={`name-${m.id}`} name="name" defaultValue={m.display_name} required minLength={1} maxLength={40} />
                      <SubmitButton variant="outline" className="rounded-full">Rename</SubmitButton>
                    </div>
                  </form>
                  <div className="review-actions">
                    <form action={setApproved} className="inline-form">
                      <input type="hidden" name="id" value={m.id} />
                      <input type="hidden" name="approved" value={String(!m.approved)} />
                      <SubmitButton variant={m.approved ? "outline" : "default"} className="rounded-full">
                        {m.approved ? "Suspend" : <><Icon name="check" /> Activate</>}
                      </SubmitButton>
                    </form>
                  </div>
                  <form action={deleteMember} className="review-actions" style={{ flexWrap: "wrap" }}>
                    <input type="hidden" name="id" value={m.id} />
                    <label className="muted" style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
                      <input type="checkbox" name="confirm" value="yes" required style={{ width: "auto" }} /> Delete account and stored clips
                    </label>
                    <SubmitButton variant="destructive" className="rounded-full" aria-label={`Delete ${m.display_name}'s account`}><Icon name="bin" /> Delete</SubmitButton>
                  </form>
                </>
              )}
            </article>
          );
        })}
      </div>
      <div className="status-key">
        <Icon name="info" size={15} />
        <span>Suspending blocks uploads but doesn&apos;t cancel clips already approved. Deleting keeps upload records 12 months and doesn&apos;t remove videos from YouTube.</span>
      </div>
    </div>
  );
}
