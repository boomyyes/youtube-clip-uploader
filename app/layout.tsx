import type { Metadata } from "next";
import Link from "next/link";
import { getProfile } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = { title: "Clip Uploader", description: "Share game clips to our YouTube channel" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const p = await getProfile();
  return (
    <html lang="en">
      <body>
        <nav aria-label="Main">
          <strong>Clip Uploader</strong>
          {p?.approved && <Link href="/upload">Upload</Link>}
          {p?.approved && <Link href="/clips">My clips</Link>}
          {p?.role === "owner" && p.approved && <Link href="/admin">Admin</Link>}
          {p && <Link href="/account">Account</Link>}
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          {p && (
            <form action="/auth/signout" method="post" style={{ marginLeft: "auto" }}>
              <span>{p.display_name} </span>
              <button type="submit">Sign out</button>
            </form>
          )}
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
