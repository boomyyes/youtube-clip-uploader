import { requireUser } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { PageHeader } from "../ui";
import UploadForm from "./upload-form";

export default async function Upload() {
  const p = await requireUser();
  // Numbers are given at upload (lowest free per game, migration 0007), so send the numbers in use.
  // Uploaders can't read seq (column grants), so read their own rows server-side.
  const { data: rows } = await admin().from("clips").select("game, seq").eq("user_id", p.id).not("seq", "is", null);
  const used: Record<string, number[]> = {};
  for (const r of rows ?? []) (used[r.game] ??= []).push(r.seq);
  return (
    <div className="content-page">
      <PageHeader eyebrow="MEMBER DESK / 01" title="Upload a clip" action={<div className="page-stamp"><span className="stamp-dot" /> REVIEWED BEFORE PUBLISH</div>}>
        Drop a moment worth replaying. Pick the game, add a note if you want, and we&apos;ll take it from there.
      </PageHeader>
      <div className="upload-layout">
        <UploadForm name={p.display_name} used={used} />
      </div>
    </div>
  );
}
