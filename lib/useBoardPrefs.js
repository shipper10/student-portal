"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const KEY = "board-prefs-v1";

// Remembers the board layout (sort, cohort, view, column visibility / order / pins) in this
// browser, so moving between pages or reloading does not reset it.
//   const [prefs, set, { ready, reset }] = useBoardPrefs(defaults, mobileOverrides);
//   prefs.sortBy, set.sortBy("name_en"), set.order((prev) => ...)
// `ready` turns true once the saved values are loaded (fetch data only after that).
export function useBoardPrefs(defaults, mobileOverrides = {}) {
  const [prefs, setPrefs] = useState(defaults);
  const [ready, setReady] = useState(false);

  const baseDefaults = useCallback(
    () => (window.matchMedia("(max-width: 639px)").matches ? { ...defaults, ...mobileOverrides } : defaults),
    [defaults, mobileOverrides]
  );

  useEffect(() => {
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(KEY)); } catch {}
    setPrefs(stored && typeof stored === "object" ? { ...baseDefaults(), ...stored } : baseDefaults());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch {}
  }, [prefs, ready]);

  const set = useMemo(
    () => Object.fromEntries(Object.keys(defaults).map((k) => [k, (v) => setPrefs((p) => ({ ...p, [k]: typeof v === "function" ? v(p[k]) : v }))])),
    [defaults]
  );
  const reset = useCallback(() => setPrefs(baseDefaults()), [baseDefaults]);
  return [prefs, set, { ready, reset }];
}
