"use client";
import { createClient } from "@/lib/supabase/browser";

export default function SignInButton() {
  const signIn = () =>
    createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  return <button onClick={signIn}>Sign in with Google</button>;
}
