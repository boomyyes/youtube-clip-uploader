import SubmitButton from "@/app/submit-button";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { head, presignGet, reviewableBefore } from "@/lib/r2.mjs";
import { addGame, approveClip, approveUser, disconnectYouTube, rejectClip, removeGame, retryClip } from "./actions";
import Icon from "../ui-icon";
import { Notice, PageHeader, StatusPill } from "../ui";
import FormatPreview from "../format-preview";
import { OTHER_GAME, sortGames } from "@/lib/games";

type Clip = {
  id: string; game: string; note: string | null; storage_path: string; status: string; title: string | null;
  youtube_video_id: string | null; last_error: string | null; created_at: string; format: string; transform: string; trim_start: number | null; trim_end: number | null; crop_x: number | null; custom_title: string | null;
  profiles: { display_name: string } | null;
};

const initial = (name?: string) => (name ?? "?").charAt(0).toUpperCase();

export default async function Admin({ searchParams }: { searchParams: Promise<{ msg?: string; yt?: string }> }) {
  await requireUser(true);
  const { msg, yt } = await searchParams;
  const db = admin();
  const [{ data: conn }, { data: users }, { data: clips }, { data: recent }, { data: games }] = await Promise.all([
    db.from("youtube_connection").select("channel_title, updated_at").eq("id", 1).maybeSingle(),
    db.from("profiles").select("id, display_name, email, created_at").eq("approved", false).order("created_at"),
    db.from("clips")
      .select("id, game, note, storage_path, status, title, youtube_video_id, last_error, created_at, format, transform, trim_start, trim_end, crop_x, custom_title, profiles(display_name)")
      .in("status", ["queued", "approved", "uploading", "failed"])
      .order("created_at")
      .returns<Clip[]>(),
    db.from("clips").select("id, title, youtube_video_id").eq("status", "on_youtube").order("uploaded_at", { ascending: false }).limit(10),
    db.from("games").select("name").order("name"),
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
      <PageHeader eyebrow="OWNER CONSOLE / 01" title="Review queue" action={<Link href="/admin/members" className="button button-secondary"><Icon name="users" /> Members</Link>}>
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
              <SubmitButton variant="outline" className="rounded-full" title="Revokes this site's access and deletes the stored token and channel details">
                Disconnect
              </SubmitButton>
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
                <SubmitButton className="rounded-full" aria-label={`Approve ${u.display_name}`}><Icon name="check" /> Approve</SubmitButton>
              </form>
            ))}
          </div>
        ) : <p className="muted">Nobody waiting.</p>}
      </section>

      <section className="admin-section" aria-labelledby="games">
        <div className="section-heading">
          <div><span className="panel-kicker">UPLOAD OPTIONS</span><h2 id="games">Games <span className="count-badge">{games?.length ?? 0}</span></h2></div>
          <Icon name="film" size={20} />
        </div>
        <div className="account-approval-list">
          {sortGames((games ?? []).map((g) => g.name)).map((name) => (
            <form key={name} action={removeGame} className="approval-row">
              <input type="hidden" name="name" value={name} />
              <div className="approval-person"><strong>{name}</strong>{name === OTHER_GAME && <span>Always available</span>}</div>
              {name !== OTHER_GAME && <SubmitButton variant="ghost" className="rounded-full" aria-label={`Remove ${name}`}>Remove</SubmitButton>}
            </form>
          ))}
          <form action={addGame} className="approval-row">
            <label htmlFor="new-game" className="sr-only">New game</label>
            <input id="new-game" name="name" required maxLength={40} placeholder="Add a game, e.g. Fortnite" />
            <SubmitButton className="rounded-full"><Icon name="check" /> Add</SubmitButton>
          </form>
        </div>
        <p className="muted">Changes show up instantly on everyone&apos;s upload page. Removing a game doesn&apos;t touch clips already sent.</p>
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
                  <span className={`status-pill ${c.format === "short" ? "status-online" : "status-uploading"}`}>
                    <span className="status-dot" aria-hidden="true" />{c.format === "short" ? "Short" : "Regular"}
                  </span>
                </div>
                {c.transform !== "none" && (
                  <p className="review-note muted">
                    {c.transform === "crop" ? "Will be cropped to 9:16 for Shorts before upload." : "Will be padded to 16:9 (blurred sides) so it posts as a regular video."}
                  </p>
                )}
                {/* Uploaders can't edit clips after upload, so this is exactly what approval publishes. */}
                {c.custom_title && <div className="review-note"><span>CUSTOM TITLE (PUBLISHED AS &quot;{c.custom_title} | …&quot;)</span><p>{c.custom_title}</p></div>}
                {c.trim_start != null && (
                  <p className="review-note muted">Trimmed: only {c.trim_start}s to {c.trim_end}s is uploaded (the preview plays just that part).</p>
                )}
                {pv?.etag ? (
                  <FormatPreview src={pv.url} transform={c.transform} still label={`Clip by ${who}`}
                    trim={c.trim_start != null ? [Number(c.trim_start), Number(c.trim_end)] : null} cropX={c.crop_x ?? 0.5} />
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
                    <SubmitButton size="lg" className="rounded-full" data-cursor="Approve" aria-label={`Approve ${c.game} clip by ${who}`}><Icon name="check" /> Approve</SubmitButton>
                  </form>
                  <SubmitButton form={`reject-${c.id}`} size="lg" variant="outline" className="rounded-full text-destructive" aria-label={`Reject ${c.game} clip by ${who}`}>Reject</SubmitButton>
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
        <p className="muted">Approving (or retrying) a clip starts the GitHub Actions upload within a minute or two; it also runs every 6 hours as a backup. <code>npm run worker</code> works too.</p>
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
                      <SubmitButton variant="outline" className="rounded-full" aria-label={`Retry ${c.title}`}><Icon name="refresh" size={15} /> Retry</SubmitButton>
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
