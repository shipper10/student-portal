"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { useTheme } from "../../lib/useTheme";

// Clerk's sign-in / account widgets follow the site theme.
export default function Providers({ children }) {
  const [isDark] = useTheme();
  return <ClerkProvider appearance={{ baseTheme: isDark ? dark : undefined }}>{children}</ClerkProvider>;
}
