import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Public: sign-in / sign-up pages and Clerk's own /__clerk proxy path (must never be protected)
const isPublic = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/__clerk(.*)",
]);

// Clerk Frontend API proxy. On a production *.vercel.app domain Clerk cannot use DNS records,
// so Clerk's servers are reached through https://<your-app>.vercel.app/__clerk instead.
// This turns the proxy on for vercel.app hosts only (not localhost, not a future custom domain).
// Needs @clerk/nextjs v7+ and a Next.js 15+ app.
export default clerkMiddleware(
  async (auth, req) => {
    if (!isPublic(req)) await auth.protect();
  },
  { frontendApiProxy: { enabled: (url) => url.hostname.endsWith(".vercel.app") } }
);

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    // Always run for Clerk's Frontend API proxy path (its files end in .js, which the first pattern skips)
    "/__clerk/:path*",
  ],
};
