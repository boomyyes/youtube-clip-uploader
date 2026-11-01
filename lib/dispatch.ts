import "server-only";

/**
 * Starts the upload workflow now (GitHub Actions workflow_dispatch) so an approved clip goes out in minutes,
 * not at the next 6-hourly run. Best effort: never blocks or fails an approval; the schedule is the fallback.
 * Needs GITHUB_DISPATCH_TOKEN (fine-grained token, this repo only, "Actions: read and write") and GITHUB_REPO.
 */
export async function startUploadWorker() {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) return;
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/upload.yml/dispatches`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      body: JSON.stringify({ ref: "main" }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error(`Couldn't start the upload workflow: HTTP ${res.status}`);
  } catch (e) {
    console.error("Couldn't start the upload workflow:", e);
  }
}
