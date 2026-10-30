import { requireUser } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { head, presignGet, reviewableBefore } from "@/lib/r2.mjs";
import { approveClip, approveUser, disconnectYouTube, rejectClip, retryClip } from "./actions";
import Icon from "../pixel-icon";
import { Notice, PageHeader, StatusPill } from "../ui";

type Clip = {
  id: string; game: string; note: string | null; storage_path: string; status: string; title: string | null;
  youtube_video_id: string | null; last_error: string | null; created_at: string; profiles: { display_name: string } | null;
};

const initial = (name?: string) => (name ?? "?").charAt(0).toUpperCase();

export default async function Admin({ searchParams }: { searchParams: Promise<{ msg?: string; yt?: string }> }) {
  await requireUser(true);
  const { msg, yt } = await searchParams;
  const db = admin();
  const [{ data: conn }, { data: users }, { data: clips }, { data: recent }] = await Promise.all([
    db.from("youtube_connection").select("channel_title, updated_at").eq("id", 1).maybeSingle(),
    db.from("profiles").select("id, display_name, email, created_at").eq("approved", false).order("created_at"),
    db.from("clips")
      .select("id, game, note, storage_path, status, title, youtube_video_id, last_error, created_at, profiles(display_name)")
      .in("status", ["queued", "approved", "uploading", "failed"])
      .order("created_at")
      .returns<Clip[]>(),
    db.from("clips").select("id, title, youtube_video_id").eq("status", "on_youtube").order("uploaded_at", { ascending: false }).limit(10),
  ]);
  const by = (s: string) => (clips ?? []).filter((c) => c.status === s);
  // Clips whose upload URL is still live can change, so they aren't shown for review yet.
  const cutoff = reviewableBefore();
  const waiting = by("queued").filter((c) => Date.parse(c.created_at) > cutoff);
  const queued = by("queued").filter((c) => Date.parse(c.created_at) <= cutoff);
  // One-hour preview links for the review queue.
  // The ETag goes into the Approve form, so approval is tied to the version the owner was shown.
  const preview = new Map(
    await Promise.all(queued.map(async (c) => [c.storage_path, { url: await presignGet(c.storage_path), etag: (await head(c.storage_path))?.etag }] as const)),
  );
  const pipeline = [...by("approved"), ...by("uploading"), ...by("failed")];

  return (
    <div className="content-page admin-page">
      <PageHeader eyebrow="OWNER CONSOLE / 01" title="Admin">
        Approve the crew, clear the review queue and keep the YouTube pipeline moving.
      </PageHeader>
      {(msg || yt) && <Notice tone="success">{msg ?? yt}</Notice>}

      <section className="admin-section" aria-labelledby="yt">
        <div className="section-heading">
          <div><span className="panel-kicker">CHANNEL CONNECTION</span><h2 id="yt">YouTube channel</h2></div>
          <Icon name="youtube" size={20} />
        </div>
        <div className={`connection-card ${conn ? "" : "is-disconnected"}`}>
          <div className="connection-icon"><Icon name="youtube" size={24} /></div>
          <div className="connection-copy">
            <strong>{conn ? `Connected: ${conn.channel_title}` : "Not connected, uploads paused"}</strong>
            <span>{conn ? "Approved clips upload to this channel." : "Connect (or reconnect, if access expired) to resume publishing."}</span>
          </div>
          <a href="/api/youtube/connect" className={`button ${conn ? "button-ghost" : "button-primary"}`}>
            <Icon name="link" /> {conn ? "Reconnect" : "Connect YouTube"}
          </a>
          {conn && (
            <form action={disconnectYouTube} className="inline-form">
              <button type="submit" className="button button-secondary" title="Revokes this site's access and deletes the stored token and channel details">
                Disconnect
              </button>
            </form>
          )}
        </div>
      </section>

      <section className="admin-section" aria-labelledby="users">
        <div className="section-heading">
          <div><span className="panel-kicker">INBOX / 02</span><h2 id="users">Accounts waiting for approval <span className="count-badge">{users?.length ?? 0}</span></h2></div>
          <Icon name="users" size={20} />
        </div>
        {users?.length ? (
          <div className="account-approval-list">
            {users.map((u) => (
              <form key={u.id} action={approveUser} className="approval-row">
                <input type="hidden" name="id" value={u.id} />
                <div className="approval-avatar" aria-hidden="true">{initial(u.display_name)}</div>
                <div className="approval-person"><strong>{u.display_name}</strong><span>{u.email}</span></div>
                <span className="approval-date">Joined {new Date(u.created_at).toLocaleDateString("en-IN")}</span>
                <button type="submit" className="button button-primary" aria-label={`Approve ${u.display_name}`}><Icon name="check" /> Approve</button>
              </form>
            ))}
          </div>
        ) : <p className="muted">Nobody waiting.</p>}
      </section>

      <section className="admin-section" aria-labelledby="review">
        <div className="section-heading">
          <div><span className="panel-kicker">REVIEW QUEUE / 03</span><h2 id="review">Clips to review <span className="count-badge">{queued.length}</span></h2></div>
          <Icon name="clips" size={20} />
        </div>
        {waiting.length > 0 && <Notice tone="warning">{waiting.length} newer clip(s) become reviewable 5 minutes after upload.</Notice>}
        {queued.length === 0 && <p className="muted">Queue is clear.</p>}
        <div className="review-grid">
          {queued.map((c) => {
            const pv = preview.get(c.storage_path);
            const who = c.profiles?.display_name;
            return (
              <article key={c.id} className="review-card">
                <div className="review-meta">
                  <span className="user-avatar small" aria-hidden="true">{initial(who)}</span>
                  <div><strong>{who}</strong><span>{c.game} · {new Date(c.created_at).toLocaleString("en-IN")}</span></div>
                  <StatusPill status={c.status} />
                </div>
                {pv?.etag ? (
                  <video className="review-video" controls preload="metadata" src={pv.url} aria-label={`Clip by ${who}`} />
                ) : (
                  <div className="missing-preview"><Icon name="alert" size={23} /><strong>File missing from storage</strong><span>Reject this clip.</span></div>
                )}
                {c.note && <div className="review-note"><span>UPLOADER NOTE</span><p>{c.note}</p></div>}
                <form action={rejectClip} id={`reject-${c.id}`}>
                  <input type="hidden" name="id" value={c.id} />
                  <div className="reject-reason">
                    <label htmlFor={`reason-${c.id}`}>Reject reason <span className="optional">Shown to the uploader</span></label>
                    <input id={`reason-${c.id}`} name="reason" maxLength={300} placeholder="Tell the uploader what to fix" />
                  </div>
                </form>
                <div className="review-actions">
                  <form action={approveClip} className="inline-form">
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="etag" value={pv?.etag ?? ""} />
                    <button type="submit" className="button button-primary" aria-label={`Approve ${c.game} clip by ${who}`}><Icon name="check" /> Approve</button>
                  </form>
                  <button type="submit" form={`reject-${c.id}`} className="button button-secondary" aria-label={`Reject ${c.game} clip by ${who}`}>Reject</button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="admin-section" aria-labelledby="pipeline">
        <div className="section-heading">
          <div><span className="panel-kicker">PIPELINE / 04</span><h2 id="pipeline">Upload pipeline</h2></div>
          <Icon name="refresh" size={20} />
        </div>
        <p className="muted">Approved clips upload every 6 hours (GitHub Actions), or right away with <code>npm run worker</code>.</p>
        {pipeline.length > 0 && (
          <div className="pipeline-table" role="table" aria-label="Upload pipeline">
            <div className="pipeline-head" role="row">
              <span role="columnheader">Clip</span><span role="columnheader">Status</span><span role="columnheader">Error</span>
              <span role="columnheader"><span className="sr-only">Action</span></span>
            </div>
            {pipeline.map((c) => (
              <div className="pipeline-row" role="row" key={c.id}>
                <div role="cell"><strong>{c.title}</strong><span>{c.game} · {c.profiles?.display_name}</span></div>
                <span role="cell"><StatusPill status={c.status} /></span>
                <span role="cell" className={c.last_error ? "error-text" : "muted"}>{c.last_error ?? "—"}</span>
                <span role="cell">
                  {c.status === "failed" && (
                    <form action={retryClip}>
                      <input type="hidden" name="id" value={c.id} />
                      <button type="submit" className="button button-secondary" aria-label={`Retry ${c.title}`}><Icon name="refresh" size={15} /> Retry</button>
                    </form>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="admin-section recent-section" aria-labelledby="recent">
        <div className="section-heading">
          <div><span className="panel-kicker">HISTORY / 05</span><h2 id="recent">Recently uploaded</h2></div>
          <Icon name="star" size={20} />
        </div>
        <div className="recent-list">
          {recent?.map((c, i) => (
            <a key={c.id} href={`https://studio.youtube.com/video/${c.youtube_video_id}/edit`} title="Open in YouTube Studio">
              <span>{String(i + 1).padStart(2, "0")}</span>{c.title}<Icon name="link" size={14} />
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
