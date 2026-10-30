import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Icon from "../pixel-icon";
import { PageHeader, StatusPill } from "../ui";

export default async function MyClips() {
  await requireUser();
  const supabase = await createClient(); // RLS: only this user's clips
  const { data: clips } = await supabase
    .from("clips")
    .select("id, game, title, status, reject_reason, youtube_video_id, created_at")
    .order("created_at", { ascending: false });
  return (
    <div className="content-page">
      <PageHeader eyebrow="MEMBER DESK / 02" title="My clips" action={<Link href="/upload" className="button button-primary"><Icon name="upload" /> New upload</Link>}>
        Everything you&apos;ve sent, from first upload to the yellow light of YouTube.
      </PageHeader>
      {!clips?.length ? (
        <div className="panel empty-state">
          <div className="empty-banana" aria-hidden="true">🍌</div>
          <h2>No clips yet.</h2>
          <p className="muted">Your first upload will show up here once you send it to the queue.</p>
          <Link href="/upload" className="button button-primary">Upload your first clip →</Link>
        </div>
      ) : (
        <div className="panel clips-panel">
          <div className="clips-summary">
            <div><span className="panel-kicker">YOUR QUEUE</span><h2>{clips.length} clip{clips.length === 1 ? "" : "s"}</h2></div>
            <div className="ripeness-legend" aria-hidden="true">
              <span><i className="legend-dot legend-green" /> Waiting</span>
              <span><i className="legend-dot legend-yellow" /> On YouTube</span>
              <span><i className="legend-dot legend-black" /> Rejected</span>
            </div>
          </div>
          <div className="clip-table" role="table" aria-label="My clips">
            <div className="clip-table-head" role="row">
              <span role="columnheader">Date</span><span role="columnheader">Game</span><span role="columnheader">Title</span>
              <span role="columnheader">Status</span><span role="columnheader"><span className="sr-only">Link</span></span>
            </div>
            {clips.map((c) => (
              <div className="clip-row" role="row" key={c.id}>
                <span role="cell" className="table-label" data-label="Date">{new Date(c.created_at).toLocaleDateString("en-IN")}</span>
                <span role="cell" className="table-label" data-label="Game"><span className="game-tag">{c.game}</span></span>
                <span role="cell" className="clip-title" data-label="Title">{c.title ?? "Given on approval"}</span>
                <span role="cell" data-label="Status">
                  <StatusPill status={c.status} />
                  {c.status === "rejected" && c.reject_reason && <small className="row-reason">{c.reject_reason}</small>}
                  {c.status === "failed" && <small className="row-reason">The owner will retry.</small>}
                </span>
                <span role="cell" className="row-action">
                  {c.status === "on_youtube" && c.youtube_video_id && (
                    <a className="watch-link" href={`https://youtu.be/${c.youtube_video_id}`}>Watch <Icon name="link" size={13} /></a>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="status-key"><Icon name="info" size={15} /><span>Clip titles are generated on approval. Notes are added to the YouTube description.</span></div>
    </div>
  );
}
