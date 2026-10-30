import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import Icon from "../pixel-icon";
import { Logo, Notice } from "../ui";
import SignInButton from "./sign-in-button";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; deleted?: string }> }) {
  if (await getProfile()) redirect("/");
  const { error, deleted } = await searchParams;
  return (
    <div className="login-frame">
      <div className="login-left">
        <div className="login-brand"><Logo /></div>
        <div className="login-hero">
          <p className="eyebrow">PRIVATE CLIP DROPBOX / 01</p>
          <h1>Drop the clip.<br /><span>We&apos;ll handle the rest.</span></h1>
          <p className="login-explainer">
            Approved players submit gameplay clips here. The channel owner reviews each one before it is published to
            the shared YouTube channel.
          </p>
          <div className="login-signal"><span className="signal-light" aria-hidden="true" /><span>Invite-only crew · uploads reviewed by a human</span></div>
        </div>
        <div className="login-footer-line">BAOTW <span>•</span> ONE CHANNEL, MANY WORLDS</div>
      </div>
      <div className="login-right">
        <div className="login-card">
          <div className="login-card-top"><span className="mini-label">MEMBER ACCESS</span></div>
          <div className="login-card-icon"><Icon name="key" size={22} /></div>
          <h2>Sign in to your clip desk</h2>
          <p className="muted">Use the Google account the owner approved, or sign in to request access.</p>
          {deleted && <Notice tone="success">Your account and data were deleted. Videos already published on YouTube were not affected.</Notice>}
          {error && <Notice tone="error">Sign-in failed. Please try again.</Notice>}
          <SignInButton />
          <p className="legal-line">
            By signing in you agree to our <Link href="/terms">Terms of Service</Link> and{" "}
            <Link href="/privacy">Privacy Policy</Link>, and to the{" "}
            <a href="https://www.youtube.com/t/terms">YouTube Terms of Service</a>.
          </p>
        </div>
        <div className="login-side-note"><Icon name="check" /> No YouTube account access is needed from you. We handle publishing after approval.</div>
        <nav className="login-side-note" aria-label="Legal">
          <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link> · <Link href="/credits">Credits</Link>
        </nav>
      </div>
    </div>
  );
}
