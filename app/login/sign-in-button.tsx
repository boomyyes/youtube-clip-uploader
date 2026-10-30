"use client";
import { createClient } from "@/lib/supabase/browser";

export default function SignInButton() {
  const signIn = () =>
    createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  return (
    <button type="button" className="button button-primary google-button" onClick={signIn}>
      <span className="google-g" aria-hidden="true">G</span>Sign in with Google<span aria-hidden="true">→</span>
    </button>
  );
}
