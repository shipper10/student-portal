// Import one year's results from a CSV into Supabase.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   node scripts/import.mjs data/year2.csv --year 2 [--dry-run]
//
// CSV columns (header names):
//   student_id            required
//   name_en, name_ar, cohort   only needed for students not in the database yet
//   gpa, remark           the YEAR GPA and remark
//   sem1_gpa, sem2_gpa    the two semester GPAs of that year
//   <course code>         one column per course, e.g. MDCR1101 (a course name also works)
//
// Grade cells:  "B+"  = normal grade
//               "C/F"   = passed the supplementary exam with C after failing (F)
//               "B/Sub" = sat the substitute exam and got B
//               "Sub"   = substitute exam not sat yet
// Empty cells are skipped (nothing is deleted). Every course must already
// exist in the `courses` table and belong to the given year. Use --dry-run
// to check the file without writing anything. No student data lives in this
// script.

import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--") && a !== args[args.indexOf("--year") + 1]);
const yearArg = args.indexOf("--year");
const year = yearArg >= 0 ? Number(args[yearArg + 1]) : NaN;
const dry = args.includes("--dry-run");
if (!file || !(year >= 1 && year <= 6)) {
  console.error("Usage: node scripts/import.mjs <file.csv> --year <1-6> [--dry-run]");
  process.exit(1);
}
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}

// Old year-1 column names (from the first spreadsheet) -> course codes.
const LEGACY = {
  s1_english_1: "UBEL1101", s1_english_2: "UBEL1102", s1_study_skills: "UBUS1103",
  s1_cell_biology: "MDCR1101", s1_chemistry: "MDCR1102", s1_mathematics: "MDCR1103",
  s1_medical_physics: "MDCR1104", s1_sociology_psychology: "MDCR1105",
  s2_english_special_purposes: "UBEL1201", s2_biomolecules: "MDCR1201",
  s2_human_biology: "MDCR1202", s2_homeostasis: "MDCR1203", s2_community_health: "MDCR1204",
};
const META = new Set(["student_id", "name_en", "name_ar", "cohort", "gpa", "remark", "sem1_gpa", "sem2_gpa"]);

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1);
}
const num = (v) => (v === "" || v == null || Number.isNaN(Number(v)) ? null : Number(v));
const parseGrade = (cell) => {
  const [g, orig] = cell.split("/").map((x) => x.trim());
  const type = orig === "F" ? "supplementary" : orig === "Sub" ? "substitute" : g === "Sub" ? "substitute" : "regular";
  return { grade: g, original_grade: orig || null, attempt_type: type };
};

const db = createClient(url, key);
const { data: courses, error: ce } = await db.from("courses").select("id, code, name, semester");
if (ce) throw ce;
const byCode = new Map(courses.map((c) => [c.code.toLowerCase(), c]));
const byName = new Map(courses.map((c) => [c.name.toLowerCase(), c]));
const { data: existing, error: se } = await db.from("students").select("student_id");
if (se) throw se;
const known = new Set(existing.map((s) => s.student_id));

const [header, ...rows] = parseCsv(fs.readFileSync(file, "utf-8"));
const col = {};
const courseCols = [];
const problems = [];
header.forEach((h, i) => {
  const name = h.trim();
  if (META.has(name)) { col[name] = i; return; }
  const c = byCode.get((LEGACY[name] || name).toLowerCase()) || byName.get(name.toLowerCase());
  if (!c) { problems.push(`Unknown column "${name}" (add the course in the courses table first)`); return; }
  if (Math.ceil(c.semester / 2) !== year) { problems.push(`Column "${name}" is a year ${Math.ceil(c.semester / 2)} course, not year ${year}`); return; }
  courseCols.push({ i, course: c });
});
if (col.student_id === undefined) problems.push('Missing "student_id" column');
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }

const students = [], yearRes = [], semRes = [], grades = [];
for (const r of rows) {
  const id = (r[col.student_id] || "").trim();
  if (!id) continue;
  const get = (n) => (col[n] === undefined ? "" : (r[col[n]] || "").trim());
  if (get("name_en")) students.push({ student_id: id, name_en: get("name_en"), name_ar: get("name_ar") || null, ...(get("cohort") ? { cohort: get("cohort") } : {}) });
  else if (!known.has(id)) { console.warn(`Skipped ${id}: not in the database and no name_en given`); continue; }
  if (col.gpa !== undefined || col.remark !== undefined) yearRes.push({ student_id: id, year, gpa: num(get("gpa")), remark: get("remark") || null });
  if (col.sem1_gpa !== undefined) semRes.push({ student_id: id, semester: year * 2 - 1, gpa: num(get("sem1_gpa")) });
  if (col.sem2_gpa !== undefined) semRes.push({ student_id: id, semester: year * 2, gpa: num(get("sem2_gpa")) });
  for (const { i, course } of courseCols) {
    const cell = (r[i] || "").trim();
    if (cell) grades.push({ student_id: id, course_id: course.id, ...parseGrade(cell) });
  }
}

console.log(`${rows.length} rows -> ${students.length} new/updated students, ${yearRes.length} year results, ${semRes.length} semester results, ${grades.length} grades (year ${year})${dry ? " [dry run, nothing written]" : ""}`);
if (dry) process.exit(0);

async function upsert(table, recs, onConflict) {
  for (let i = 0; i < recs.length; i += 500) {
    const { error } = await db.from(table).upsert(recs.slice(i, i + 500), { onConflict });
    if (error) { console.error(`Failed on ${table}:`, error.message); process.exit(1); }
  }
  console.log(`  ${table}: ${recs.length}`);
}
await upsert("students", students, "student_id");
await upsert("year_results", yearRes, "student_id,year");
await upsert("semester_results", semRes, "student_id,semester");
await upsert("grades", grades, "student_id,course_id");
console.log("Done.");
