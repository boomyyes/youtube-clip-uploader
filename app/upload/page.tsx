import { requireUser } from "@/lib/auth";
import UploadForm from "./upload-form";

export default async function Upload() {
  await requireUser();
  return (
    <>
      <h1>Upload a clip</h1>
      <p>Clips are reviewed by the channel owner before they go to YouTube. Max 2 GB (MP4, MOV, WebM, MKV).</p>
      <UploadForm />
    </>
  );
}
