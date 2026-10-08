"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/ui/themes";
import { useTheme } from "../../lib/useTheme";

// Clerk's sign-in / account widgets follow the site theme. (Clerk 7 uses `theme` from
// @clerk/ui/themes; the old `baseTheme` option from @clerk/themes is ignored.)
export default function Providers({ children }) {
  const [isDark] = useTheme();
  return <ClerkProvider appearance={{ theme: isDark ? dark : undefined }}>{children}</ClerkProvider>;
}
