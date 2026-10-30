import Link from "next/link";
import Icon from "./pixel-icon";

export function PageHeader({ eyebrow, title, children, action }: { eyebrow: string; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {children && <p className="page-lede">{children}</p>}
      </div>
      {action && <div className="page-header-action">{action}</div>}
    </header>
  );
}

// Clip status, coloured on the ripeness scale: green waiting … yellow on YouTube … dark rejected.
const TONE: Record<string, string> = {
  queued: "waiting", approved: "approved", uploading: "uploading", on_youtube: "online", rejected: "rejected", failed: "failed",
};
export const STATUS_LABEL: Record<string, string> = {
  queued: "Waiting for review",
  approved: "Approved, waiting to upload",
  uploading: "Uploading to YouTube",
  on_youtube: "On YouTube",
  rejected: "Rejected",
  failed: "Upload failed",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`status-pill status-${TONE[status] ?? "waiting"}`}>
      <span className="status-dot" aria-hidden="true" />{STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function Notice({ tone, children }: { tone: "success" | "error" | "info" | "warning"; children: React.ReactNode }) {
  const icon = tone === "success" ? "check" : tone === "error" ? "alert" : tone === "warning" ? "clock" : "info";
  return (
    <div className={`notice notice-${tone}`} role={tone === "error" ? "alert" : "status"}>
      <Icon name={icon} size={18} /><div>{children}</div>
    </div>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className={`brand-lockup ${compact ? "brand-lockup-compact" : ""}`} aria-label="Bananas All Over The World home">
      <span className="banana-mark" aria-hidden="true"><img src="/assets/openmoji-banana.svg" alt="" width={24} height={24} /></span>
      <span className="brand-copy">
        <span className="brand-kicker">BAOTW / CLIP DESK</span>
        {!compact && <span className="brand-name">Bananas All Over <strong>The World</strong></span>}
      </span>
    </Link>
  );
}
