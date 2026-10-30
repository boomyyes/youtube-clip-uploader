import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import Icon from "../pixel-icon";

export default async function Pending() {
  const p = await getProfile();
  if (!p) redirect("/login");
  if (p.approved) redirect("/");
  return (
    <div className="narrow-page pending-page">
      <div className="pending-orbit" aria-hidden="true"><span>🍌</span></div>
      <p className="eyebrow">MEMBER STATUS / 02</p>
      <h1>Waiting for approval<span className="yellow-dot">.</span></h1>
      <p className="page-lede">Thanks for signing up, {p.display_name}. The channel owner needs to approve your account before you can upload.</p>
      <div className="panel pending-panel">
        <div className="panel-kicker"><Icon name="clock" /> ACCOUNT QUEUED</div>
        <div className="pending-detail">
          <span className="user-avatar large" aria-hidden="true">{p.display_name.charAt(0).toUpperCase()}</span>
          <div><strong>{p.display_name}</strong><span>{p.email}</span></div>
          <span className="status-pill status-waiting"><span className="status-dot" aria-hidden="true" />Waiting for approval</span>
        </div>
      </div>
      <p className="muted small-copy">Nothing else is needed from you right now. Check back later.</p>
    </div>
  );
}
