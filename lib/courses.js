// Grade display helpers (labels, colors, order). The curriculum itself (course
// names, credit hours) lives in the database table `courses`, not here.

// All grade values that actually occur in the data, in display order.
export const GRADE_ORDER = ["A", "B+", "B", "C", "Sub", "F"];

// Only two grades get a colored highlight on a course card: "F" (failed —
// needs a supplementary exam) and "Sub" (sat a substitute exam). A, B+, B
// and C are shown plainly so the flagged subject actually stands out
// instead of every card being colored.
export const FLAGGED_GRADES = {
  F: {
    label: "Needs supplementary exam",
    border: "border-red-500",
    chip: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  },
  Sub: {
    label: "Substitute exam",
    border: "border-purple-500",
    chip: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  },
};

// Bar colors for the analytics grade-distribution chart (every grade value
// gets a color there, unlike the flagged-only style on course cards).
export const GRADE_BAR_COLORS = {
  A: "bg-green-500",
  "B+": "bg-teal-500",
  B: "bg-blue-500",
  C: "bg-amber-500",
  Sub: "bg-purple-500",
  F: "bg-red-500",
};
export const DEFAULT_BAR_COLOR = "bg-gray-400";

export const REMARK_COLORS = {
  Pass: { badge: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
  Supplementary: { badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  "Subject(s) pending": { badge: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  "No remark": { badge: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  Other: { badge: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
};

// Same classification the analytics API uses, mirrored here for the client.
export function classifyRemark(remark) {
  const r = (remark || "").toLowerCase().trim();
  if (!r) return "No remark";
  if (r.includes("pas")) return "Pass";
  if (r.includes("sup")) return "Supplementary";
  if (r.includes("sub")) return "Subject(s) pending";
  return "Other";
}

// Style/label for a grade cell: by grade value (F, Sub) or by attempt type
// (supplementary pass, substitute exam sat).
export function describeGrade(info) {
  if (!info) return null;
  if (FLAGGED_GRADES[info.grade]) return FLAGGED_GRADES[info.grade];
  if (info.type === "supplementary") {
    return {
      label: info.orig ? `Supplementary (was ${info.orig})` : "Supplementary",
      border: "border-amber-500",
      chip: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    };
  }
  if (info.type === "substitute") {
    return { label: "Substitute exam", border: "border-purple-500", chip: FLAGGED_GRADES.Sub.chip };
  }
  return null;
}
