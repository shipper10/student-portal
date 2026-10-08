// Search helpers. Used server-side only (inside API routes) so the real
// student_id never needs to leave the server to be searched.

// Unifies common Arabic letter variants so "احمد" and "أحمد" (or "ة"/"ه",
// "ي"/"ى"/"ئ") are treated as the same text, and strips diacritics.
export function normalizeArabic(s) {
  if (!s) return "";
  return String(s)
    .replace(/[إأآا]/g, "ا")
    .replace(/[ئى]/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[\u064B-\u0652\u0670]/g, "") // tashkeel / diacritics
    .toLowerCase()
    .trim();
}

// Lower relevance number = better match. 0 = query matches the start of the
// first word (i.e. the person almost certainly meant the first name).
// Later word-start matches score a bit higher, and a match that only
// occurs mid-word scores much higher (worst, but still included).
export function nameRelevance(name, normalizedQuery) {
  if (!normalizedQuery) return Infinity;
  const norm = normalizeArabic(name || "");
  if (!norm) return Infinity;
  const words = norm.split(/\s+/).filter(Boolean);
  const wordIdx = words.findIndex((w) => w.startsWith(normalizedQuery));
  if (wordIdx !== -1) return wordIdx;
  const pos = norm.indexOf(normalizedQuery);
  if (pos !== -1) return 100 + pos;
  return Infinity;
}
