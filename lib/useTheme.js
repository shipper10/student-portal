"use client";

import { useCallback, useSyncExternalStore } from "react";

// The theme lives on <html class="dark"> (set before first paint by a script in
// app/layout.js; dark unless the user chose light). Every component reads it
// through this store, so the toggle, the pages and Clerk's widgets always agree.
const subscribe = (notify) => {
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
};
const isDark = () => document.documentElement.classList.contains("dark");

function applyTheme(dark) {
  document.documentElement.classList.toggle("dark", dark);
  try {
    localStorage.setItem("theme", dark ? "dark" : "light");
  } catch {}
}

// const [dark, setDark] = useTheme();  setDark(true) or setDark((d) => !d)
export function useTheme() {
  const dark = useSyncExternalStore(subscribe, isDark, () => true);
  const setDark = useCallback((v) => applyTheme(typeof v === "function" ? v(isDark()) : v), []);
  return [dark, setDark];
}

export function ThemeToggle() {
  const [dark, setDark] = useTheme();
  return (
    <button
      onClick={() => setDark((d) => !d)}
      aria-label="Toggle theme"
      className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-full border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 leading-none"
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
