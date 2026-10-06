export const fmtGpa = (v) => (typeof v === "number" ? v.toFixed(2) : "—");
// "3" or "T-3" (tie); the Full form adds "/total".
export const fmtRank = (rank, isTie) => (rank == null ? "—" : `${isTie ? "T-" : ""}${rank}`);
export const fmtRankFull = (rank, total, isTie) => (rank == null ? "—" : `${isTie ? "T-" : ""}${rank}/${total}`);

// "Ahmed Mohamed Ali Hassan" -> "Ahmed Mohamed" (compact name for tables and file names)
export function firstTwoWords(str) {
  if (!str) return "";
  return str.trim().split(/\s+/).slice(0, 2).join(" ");
}
