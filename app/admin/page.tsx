import { requireUser } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { head, presignGet, reviewableBefore } from "@/lib/r2.mjs";
import { approveClip, approveUser, disconnectYouTube, rejectClip, retryClip } from "./actions";

type Clip = {
  id: string; game: string; note: string | null; storage_path: string; status: string; title: string | null;
  youtube_video_id: string | null; last_error: string | null; created_at: string; profiles: { display_name: string } | null;
};

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

  return (
    <>
      <h1>Admin</h1>
      {(msg || yt) && <p role="status">{msg ?? yt}</p>}

      <section aria-labelledby="yt">
        <h2 id="yt">YouTube channel</h2>
        {conn ? (
          <p>Connected to <strong>{conn.channel_title}</strong>.</p>
        ) : (
          <p className="error">Not connected. Uploads are paused until you connect (or reconnect, if access expired).</p>
        )}
        <p><a href="/api/youtube/connect">{conn ? "Reconnect YouTube" : "Connect YouTube"}</a></p>
        {conn && (
          <form action={disconnectYouTube}>
            <button type="submit">Disconnect YouTube</button> (revokes this site&apos;s access and deletes the stored token and channel details)
          </form>
        )}
      </section>

      <section aria-labelledby="users">
        <h2 id="users">Accounts waiting for approval ({users?.length ?? 0})</h2>
        {users?.map((u) => (
          <form key={u.id} action={approveUser}>
            <input type="hidden" name="id" value={u.id} />
            {u.display_name} ({u.email}) <button type="submit">Approve {u.display_name}</button>
          </form>
        ))}
      </section>

      <section aria-labelledby="review">
        <h2 id="review">Clips to review ({queued.length})</h2>
        {waiting.length > 0 && <p>{waiting.length} newer clip(s) become reviewable 15 minutes after upload.</p>}
        {queued.map((c) => (
          <article key={c.id} style={{ borderBottom: "1px solid #ddd", paddingBottom: 12 }}>
            <p><strong>{c.profiles?.display_name}</strong> · {c.game} · {new Date(c.created_at).toLocaleString("en-IN")}</p>
            {c.note && <p>Note: {c.note}</p>}
            {preview.get(c.storage_path)?.etag ? (
              <video controls preload="metadata" src={preview.get(c.storage_path)!.url} aria-label={`Clip by ${c.profiles?.display_name}`} />
            ) : (
              <p className="error">File missing from storage. Reject this clip.</p>
            )}
            <form action={approveClip}>
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="etag" value={preview.get(c.storage_path)?.etag ?? ""} />
              <button type="submit" aria-label={`Approve ${c.game} clip by ${c.profiles?.display_name}`}>Approve</button>
            </form>
            <form action={rejectClip}>
              <input type="hidden" name="id" value={c.id} />
              <label htmlFor={`reason-${c.id}`}>Reason for rejecting (shown to the uploader)</label>
              <input id={`reason-${c.id}`} name="reason" maxLength={300} />
              <button type="submit" aria-label={`Reject ${c.game} clip by ${c.profiles?.display_name}`}>Reject</button>
            </form>
          </article>
        ))}
      </section>

      <section aria-labelledby="pipeline">
        <h2 id="pipeline">Upload pipeline</h2>
        <p>Approved clips upload while the worker runs on your PC (<code>npm run worker</code>).</p>
        <table>
          <thead><tr><th>Title</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {[...by("approved"), ...by("uploading"), ...by("failed")].map((c) => (
              <tr key={c.id}>
                <td>{c.title}</td>
                <td>{c.status}{c.last_error && <div className="error">{c.last_error}</div>}</td>
                <td>
                  {c.status === "failed" && (
                    <form action={retryClip}><input type="hidden" name="id" value={c.id} /><button type="submit" aria-label={`Retry ${c.title}`}>Retry</button></form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3>Recently uploaded</h3>
        <ul>
          {recent?.map((c) => (
            <li key={c.id}>
              {c.title} · <a href={`https://youtu.be/${c.youtube_video_id}`}>watch</a> ·{" "}
              <a href={`https://studio.youtube.com/video/${c.youtube_video_id}/edit`}>Studio</a>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
