"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "./pixel-icon";

export default function NavLinks({ items }: { items: { href: string; label: string; icon: IconName }[] }) {
  const path = usePathname();
  return (
    <nav className="main-nav" aria-label="Primary navigation">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={`nav-link ${path === i.href ? "is-active" : ""}`} aria-current={path === i.href ? "page" : undefined}>
          <Icon name={i.icon} />{i.label}
        </Link>
      ))}
    </nav>
  );
}
