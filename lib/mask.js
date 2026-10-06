// Server-side only helpers. The raw student_id must never be sent to the
// browser — every response payload goes through maskId() first.

export function maskId(realId) {
  const s = String(realId ?? "");
  if (s.length <= 4) return "*".repeat(s.length);
  const first2 = s.slice(0, 2);
  const last2 = s.slice(-2);
  const stars = "*".repeat(s.length - 4);
  return `${first2}${stars}${last2}`;
}
