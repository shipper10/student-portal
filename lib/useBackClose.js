"use client";

import { useCallback, useEffect, useRef } from "react";

// Lets the phone's Back button (and Esc) close a card or dialog instead of leaving the page.
// Always close through the returned function: it removes the extra history entry.
export function useBackClose(onClose) {
  const latest = useRef(onClose);
  latest.current = onClose;
  const pushed = useRef(false);

  const close = useCallback(() => {
    if (pushed.current) window.history.back(); // the popstate handler below does the closing
    else latest.current();
  }, []);

  useEffect(() => {
    // keep Next.js's own history flags so the router treats this entry as its own
    window.history.pushState({ ...(window.history.state || {}), overlay: true }, "", window.location.href);
    pushed.current = true;
    const onPop = () => {
      pushed.current = false;
      latest.current();
    };
    const onKey = (e) => e.key === "Escape" && close();
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
    };
  }, [close]);

  return close;
}
