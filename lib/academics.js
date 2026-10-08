// Business rules for GPA, ranking and board views. Pure functions: no database,
// no React. Year weights come from the `year_weights` table and are passed in.

export const maxYearOf = (weights) => Math.max(...Object.keys(weights).map(Number));

// Weighted GPA over the years entered, using only years <= `through`.
//   gpa       sum(weight x year GPA) / sum(weights of the entered years)
//   years     the years that have a GPA
//   eligible  every year 1..through has a GPA -> comparable between students
//   final     eligible AND `through` is the last year of the program
export function weightedGpa(yearGpas, weights, through = maxYearOf(weights)) {
  let sum = 0, sw = 0;
  const years = [];
  for (let y = 1; y <= through; y++) {
    const g = yearGpas[y], w = weights[y];
    if (typeof g === "number" && typeof w === "number") { sum += w * g; sw += w; years.push(y); }
  }
  const eligible = years.length === through;
  return { gpa: sw ? sum / sw : null, years, eligible, final: eligible && through === maxYearOf(weights) };
}

// Cumulative ranking is only meaningful between students who completed the same
// years. The "basis" is the latest year N that at least half of the students
// have completed (years 1..N all entered); it is the default for cumulative views.
export function defaultBasisYear(allYearGpas, weights) {
  let best = 1;
  for (let n = 1; n <= maxYearOf(weights); n++) {
    const done = allYearGpas.filter((yg) => weightedGpa(yg, weights, n).eligible).length;
    if (allYearGpas.length && done * 2 >= allYearGpas.length) best = n;
  }
  return best;
}

// A board view is either one year ("3") or cumulative through a year ("cum3").
export function parseView(param, { maxYear, defaultYear, basis }) {
  const clamp = (n) => Math.min(maxYear, Math.max(1, n));
  const m = /^cum(\d+)$/.exec(param || "");
  if (m) return { kind: "cumulative", through: clamp(Number(m[1])) };
  if (param === "overall") return { kind: "cumulative", through: basis };
  const n = parseInt(param, 10);
  return { kind: "year", year: clamp(Number.isFinite(n) ? n : defaultYear) };
}
export const viewKey = (v) => (v.kind === "year" ? String(v.year) : `cum${v.through}`);

export function viewOptions(years, dataYears, maxYear) {
  const out = years.map((y) => ({ key: String(y), label: `Year ${y}` }));
  for (const y of dataYears) {
    if (y >= 2) out.push({ key: `cum${y}`, label: y === maxYear ? `Final (${maxYear} years)` : `Cumulative · Years 1–${y}` });
  }
  return out;
}

function ranksOf(list) {
  const sorted = [...list].sort((a, b) => b.value - a.value);
  const out = new Map();
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1].value === sorted[i].value) j++;
    for (let k = i; k <= j; k++) out.set(sorted[k].id, { rank: i + 1, tie: j > i, total: sorted.length });
    i = j + 1;
  }
  return out;
}

// Competition ranking ("1224"): equal values share a rank. Only students with a
// numeric value are ranked (the rest get rank null). Returns lookup(id) ->
// { all, group } where group is the rank inside the student's own group (cohort).
export function rankStudents(items, valueOf, groupOf = () => null) {
  const ranked = items
    .map((it) => ({ id: it.id, group: groupOf(it), value: valueOf(it) }))
    .filter((x) => typeof x.value === "number")
    .map((x) => ({ ...x, value: Math.round(x.value * 1e6) / 1e6 }));
  const all = ranksOf(ranked);
  const byGroup = new Map();
  for (const x of ranked) {
    if (!byGroup.has(x.group)) byGroup.set(x.group, []);
    byGroup.get(x.group).push(x);
  }
  const inGroup = new Map();
  for (const list of byGroup.values()) for (const [id, r] of ranksOf(list)) inGroup.set(id, r);
  const none = { rank: null, tie: false, total: ranked.length };
  return Object.assign((id) => ({ all: all.get(id) ?? none, group: inGroup.get(id) ?? { ...none, total: null } }), { rankedCount: ranked.length });
}

// Course-detail levels an admin can allow: which semester of each year shows course grades.
export const COURSE_LEVELS = ["none", "sem1", "sem2", "both"];
export const SEMESTERS_OF = { none: [], sem1: [1], sem2: [2], both: [1, 2] };
// first / second semester of its year: semesters 1,3,5.. are "1", 2,4,6.. are "2"
export const relSemester = (semester) => (semester % 2 === 1 ? 1 : 2);
