import type { Metadata } from "next";
import Link from "next/link";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { getProfile } from "@/lib/auth";
import Icon, { type IconName } from "./pixel-icon";
import NavLinks from "./nav-links";
import BananaRain from "./banana-rain";
import { Logo } from "./ui";
import "./globals.css";

const display = Space_Grotesk({ weight: ["400", "500", "600", "700"], subsets: ["latin"], variable: "--f-display" });
const mono = IBM_Plex_Mono({ weight: ["400", "500", "600"], subsets: ["latin"], variable: "--f-mono" });

export const metadata: Metadata = {
  title: "Bananas All Over The World · Clip Desk",
  description: "Share game clips to our YouTube channel",
  icons: { icon: "/assets/openmoji-banana.svg" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const p = await getProfile();
  const items: { href: string; label: string; icon: IconName }[] = [];
  if (p?.approved) items.push({ href: "/upload", label: "Upload", icon: "upload" }, { href: "/clips", label: "My clips", icon: "clips" });
  if (p?.approved && p.role === "owner") items.push({ href: "/admin", label: "Admin", icon: "admin" });
  if (p) items.push({ href: "/account", label: "Account", icon: "account" });
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <body>
        <div className="app-frame">
          <BananaRain />
          <header className="topbar">
            <div className="topbar-inner">
              <Logo />
              <NavLinks items={items} />
              {p && (
                <form action="/auth/signout" method="post" className="user-menu">
                  <span className="user-avatar" aria-hidden="true">{p.display_name.charAt(0).toUpperCase()}</span>
                  <span className="user-name">{p.display_name}</span>
                  <button type="submit" className="sign-out"><Icon name="signout" size={15} /> <span>Sign out</span></button>
                </form>
              )}
            </div>
          </header>
          <main className="main-content">{children}</main>
          <footer className="site-footer">
            <div className="footer-inner">
              <Logo compact />
              <p className="footer-note">Private clip dropbox for the BAOTW crew.</p>
              <nav className="footer-links" aria-label="Footer navigation">
                <Link href="/privacy">Privacy</Link>
                <Link href="/terms">Terms</Link>
                <Link href="/credits">Credits</Link>
              </nav>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
