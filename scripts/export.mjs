// Export one year to a wide CSV (one row per student, one column per course) that
// scripts/import.mjs can read back: edit it in a spreadsheet, then import again.
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/export.mjs --year 1
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const i = process.argv.indexOf("--year");
const year = i >= 0 ? Number(process.argv[i + 1]) : NaN;
if (!(year >= 1 && year <= 6)) { console.error("Usage: node scripts/export.mjs --year <1-6>"); process.exit(1); }
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function all(make) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await make().range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) return out;
  }
}
const { data: courses, error } = await db.from("courses").select("id, code, semester, sort_order").in("semester", [year * 2 - 1, year * 2]).eq("active", true).order("semester").order("sort_order");
if (error) throw error;
const students = await all(() => db.from("students").select("student_id, name_en, name_ar, cohort").order("name_en"));
const yearRes = new Map((await all(() => db.from("year_results").select("student_id, gpa, remark").eq("year", year).order("student_id"))).map((r) => [r.student_id, r]));
const sem = new Map();
for (const r of await all(() => db.from("semester_results").select("student_id, semester, gpa").in("semester", [year * 2 - 1, year * 2]).order("student_id").order("semester"))) sem.set(`${r.student_id}:${r.semester}`, r.gpa);
const grades = new Map();
if (courses.length) {
  for (const g of await all(() => db.from("grades").select("student_id, course_id, grade, attempt_type, original_grade").in("course_id", courses.map((c) => c.id)).order("student_id").order("course_id"))) {
    grades.set(`${g.student_id}:${g.course_id}`, g.grade ? g.grade + (g.original_grade ? "/" + g.original_grade : "") : "");
  }
}
const esc = (v) => (v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const head = ["student_id", "name_en", "name_ar", "cohort", "gpa", "remark", "sem1_gpa", "sem2_gpa", ...courses.map((c) => c.code)];
const lines = [head.join(",")];
for (const s of students) {
  const y = yearRes.get(s.student_id);
  lines.push([s.student_id, s.name_en, s.name_ar, s.cohort, y?.gpa, y?.remark, sem.get(`${s.student_id}:${year * 2 - 1}`), sem.get(`${s.student_id}:${year * 2}`), ...courses.map((c) => grades.get(`${s.student_id}:${c.id}`) ?? "")].map(esc).join(","));
}
fs.mkdirSync("data", { recursive: true });
const file = `data/export-year${year}.csv`;
fs.writeFileSync(file, lines.join("\n") + "\n", "utf-8");
console.log(`Wrote ${file} (${students.length} students, ${courses.length} courses)`);
