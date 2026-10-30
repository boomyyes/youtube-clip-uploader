import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const LABEL: Record<string, string> = {
  queued: "Waiting for review",
  approved: "Approved, waiting to upload",
  uploading: "Uploading to YouTube",
  on_youtube: "On YouTube (private until published)",
  public: "Public on YouTube",
  rejected: "Rejected",
  failed: "Upload failed, the owner will retry",
};

export default async function MyClips() {
  await requireUser();
  const supabase = await createClient(); // RLS: only this user's clips
  const { data: clips } = await supabase
    .from("clips")
    .select("id, game, title, status, reject_reason, youtube_video_id, created_at")
    .order("created_at", { ascending: false });
  return (
    <>
      <h1>My clips</h1>
      {!clips?.length ? (
        <p>No clips yet.</p>
      ) : (
        <table>
          <thead><tr><th>Uploaded</th><th>Game</th><th>Title</th><th>Status</th></tr></thead>
          <tbody>
            {clips.map((c) => (
              <tr key={c.id}>
                <td>{new Date(c.created_at).toLocaleDateString("en-IN")}</td>
                <td>{c.game}</td>
                <td>{c.title ?? "Given on approval"}</td>
                <td>
                  {LABEL[c.status]}
                  {c.status === "rejected" && c.reject_reason && <>: {c.reject_reason}</>}
                  {c.status === "public" && c.youtube_video_id && (
                    <> (<a href={`https://youtu.be/${c.youtube_video_id}`}>watch</a>)</>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
