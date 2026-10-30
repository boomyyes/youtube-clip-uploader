import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import SignInButton from "./sign-in-button";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getProfile()) redirect("/");
  const { error } = await searchParams;
  return (
    <>
      <h1>Sign in</h1>
      {error && <p className="error" role="alert">Sign-in failed. Please try again.</p>}
      <SignInButton />
    </>
  );
}
