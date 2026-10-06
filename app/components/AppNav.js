"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PERMISSIONS } from "../../lib/permissions";

const PUBLIC_PATHS = ["/sign-in", "/sign-up"];

// Phone-only bottom bar. Wide screens keep the buttons in each page header.
export default function AppNav() {
  const path = usePathname();
  const hidden = PUBLIC_PATHS.some((p) => path.startsWith(p));
  const [nav, setNav] = useState(null);

  useEffect(() => {
    if (hidden) return;
    fetch("/api/nav", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setNav)
      .catch(() => {});
  }, [path, hidden]);

  if (hidden || !nav) return null;
  const items = [
    nav.access.board && { href: "/", label: "Board", icon: "🏆" },
    nav.access.analytics && { href: "/analytics", label: "Analytics", icon: "📊" },
    { href: "/profile", label: "Profile", icon: "👤" },
    nav.permissions.includes(PERMISSIONS.ADMIN_PANEL) && { href: "/admin", label: "Admin", icon: "⚙️" },
  ].filter(Boolean);
  const isActive = (href) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 pb-[env(safe-area-inset-bottom)]">
      <ul className="flex h-16">
        {items.map((it) => (
          <li key={it.href} className="flex-1">
            <Link
              href={it.href}
              className={`h-full flex flex-col items-center justify-center gap-0.5 text-xs ${
                isActive(it.href) ? "text-blue-600 dark:text-blue-400 font-semibold" : "text-gray-500 dark:text-gray-400"
              }`}
            >
              <span className="text-lg leading-none">{it.icon}</span>
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
