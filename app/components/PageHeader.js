"use client";

import { UserButton } from "@clerk/nextjs";
import { ThemeToggle } from "../../lib/useTheme";

// One header for every page, so the buttons keep the same size and place whatever the title is.
// `children` are the wide-screen navigation links (phones use the bottom bar).
export default function PageHeader({ title, subtitle, children }) {
  return (
    <header className="flex items-center justify-between gap-3 mb-3">
      <div className="min-w-0">
        <h1 className="text-lg sm:text-2xl font-bold leading-tight truncate">{title}</h1>
        {subtitle && <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {children}
        <ThemeToggle />
        <UserButton appearance={{ elements: { avatarBox: "h-10 w-10" } }} />
      </div>
    </header>
  );
}
