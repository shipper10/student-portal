import { GRADE_ORDER } from "../../../lib/courses";
import { fmtGpa, fmtRankFull } from "../../../lib/format";

// The picture itself. Colours are explicit (no dark: classes) so the preview and the exported
// image look the same whatever theme the site is in. The university ID and the cohort are never shown.
const PALETTE = {
  light: { bg: "#ffffff", text: "#111827", muted: "#6b7280", line: "#e5e7eb", tile: "#f3f4f6", bad: "#dc2626", sub: "#7e22ce", supp: "#b45309" },
  dark: { bg: "#111827", text: "#f3f4f6", muted: "#9ca3af", line: "#374151", tile: "#1f2937", bad: "#f87171", sub: "#c084fc", supp: "#fbbf24" },
};
const COL = 340, GAP = 16, PAD = 20;

// "courses" lays the years out side by side (up to 3 columns), so six years with every course
// make a wide sheet instead of a very tall one.
export function sheetWidth(yearCount, detail) {
  const cols = detail === "courses" ? Math.min(Math.max(yearCount, 1), 3) : 1;
  return PAD * 2 + cols * COL + (cols - 1) * GAP;
}

const rankText = (r) => (r ? fmtRankFull(r.rank, r.total, r.tie) : "—");

function gradeColor(c, p) {
  if (c.grade === "F") return p.bad;
  if (c.grade === "Sub" || c.type === "substitute") return p.sub;
  if (c.type === "supplementary") return p.supp;
  return p.text;
}

function YearBlock({ y, detail, showRanks, p }) {
  const sems = [...new Set(y.courses.map((c) => c.semester))];
  const counts = {};
  y.courses.forEach((c) => { counts[c.grade] = (counts[c.grade] || 0) + 1; });
  const order = Object.keys(counts).sort((a, b) => GRADE_ORDER.indexOf(a) - GRADE_ORDER.indexOf(b));
  return (
    <div style={{ border: `1px solid ${p.line}`, borderRadius: 10, padding: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <b style={{ fontSize: 15 }}>Year {y.year}</b>
        <span style={{ fontSize: 12, color: p.muted, textAlign: "right" }}>
          GPA <b style={{ color: p.text }}>{fmtGpa(y.gpa)}</b>
          {showRanks && ` · Rank ${rankText(y.rank)} · Cohort ${rankText(y.cohortRank)}`}
          {y.remark ? ` · ${y.remark}` : ""}
        </span>
      </div>
      {detail === "grades" && order.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {order.map((g) => (
            <span key={g} style={{ background: p.tile, borderRadius: 6, padding: "2px 8px", fontSize: 12, color: g === "F" ? p.bad : p.text }}>
              <b>{g}</b> ×{counts[g]}
            </span>
          ))}
        </div>
      )}
      {detail === "courses" && sems.map((n) => (
        <div key={n} style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, color: p.muted, fontWeight: 600, marginBottom: 2 }}>
            Semester {n} · GPA {fmtGpa(y.semesters.find((s) => s.semester === n)?.gpa)}
          </div>
          {y.courses.filter((c) => c.semester === n).map((c) => (
            <div key={c.code} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5, lineHeight: "20px", borderBottom: `1px solid ${p.line}` }}>
              <span>{c.short || c.name}</span>
              <b style={{ color: gradeColor(c, p) }}>{c.grade}{c.type === "supplementary" ? " ·supp" : ""}</b>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// student: the /api/me record; years: the selected year objects (ascending);
// options: { detail: "summary"|"grades"|"courses", showRanks: boolean, dark: boolean }
export default function ShareSheet({ student, years, options }) {
  const { detail, showRanks, dark } = options;
  const p = dark ? PALETTE.dark : PALETTE.light;
  const cum = student.cumulative;
  const width = sheetWidth(years.length, detail);
  const cols = detail === "courses" ? Math.min(Math.max(years.length, 1), 3) : 1;
  return (
    <div style={{ width, boxSizing: "border-box", padding: PAD, background: p.bg, color: p.text, lineHeight: 1.4, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{student.name_en}</div>
      {student.name_ar && <div dir="rtl" style={{ fontSize: 15, color: p.muted, marginBottom: 10 }}>{student.name_ar}</div>}
      <div style={{ display: "grid", gridTemplateColumns: showRanks ? "1fr 1fr 1fr" : "1fr", gap: 8, margin: "8px 0 14px" }}>
        {[
          [cum ? (cum.final ? "Final CGPA" : `CGPA · Y1–Y${cum.through}`) : "CGPA", fmtGpa(cum?.gpa)],
          ...(showRanks ? [["CGPA rank", rankText(cum?.rank)], ["Cohort rank", rankText(cum?.cohortRank)]] : []),
        ].map(([label, value]) => (
          <div key={label} style={{ background: p.tile, borderRadius: 8, padding: "6px 10px" }}>
            <div style={{ fontSize: 11, color: p.muted }}>{label}</div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${COL}px)`, gap: GAP, alignItems: "start" }}>
        {years.map((y) => <YearBlock key={y.year} y={y} detail={detail} showRanks={showRanks} p={p} />)}
      </div>
      <div style={{ fontSize: 10, color: p.muted, textAlign: "right", marginTop: 12 }}>
        {cum && !cum.final ? "Provisional · " : ""}Student Results Portal
      </div>
    </div>
  );
}
