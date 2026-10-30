import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import SignInButton from "./sign-in-button";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; deleted?: string }> }) {
  if (await getProfile()) redirect("/");
  const { error, deleted } = await searchParams;
  return (
    <>
      <h1>Sign in</h1>
      <p>
        Clip Uploader lets an approved group of players submit gameplay clips. The channel owner reviews every clip
        before it is published on our YouTube channel.
      </p>
      {deleted && <p role="status">Your account and data were deleted.</p>}
      {error && <p className="error" role="alert">Sign-in failed. Please try again.</p>}
      <SignInButton />
      <p>
        By signing in you agree to our <Link href="/terms">Terms of Service</Link> and{" "}
        <Link href="/privacy">Privacy Policy</Link>, and to the{" "}
        <a href="https://www.youtube.com/t/terms">YouTube Terms of Service</a>.
      </p>
    </>
  );
}
