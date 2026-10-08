import { supabaseAdmin } from "./supabaseAdmin";

export const yearOfSemester = (s) => Math.ceil(s / 2);

// Supabase returns at most 1000 rows per request, so page through.
export async function fetchAll(make) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await make().range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

// Courses (curriculum) and year weights live in the database, not in code.
export async function loadCatalog() {
  const db = supabaseAdmin();
  const [c, w] = await Promise.all([
    db.from("courses").select("id, code, name, short_name, credit_hours, semester, sort_order")
      .eq("active", true).order("semester").order("sort_order").order("code"),
    db.from("year_weights").select("year, weight"),
  ]);
  if (c.error) throw c.error;
  if (w.error) throw w.error;
  const courses = c.data.map((x) => ({
    id: x.id, code: x.code, name: x.name, short: x.short_name || x.name,
    credits: Number(x.credit_hours), semester: x.semester, year: yearOfSemester(x.semester),
  }));
  const weights = Object.fromEntries(w.data.map((x) => [x.year, Number(x.weight)]));
  return { courses, weights };
}

export const publicCourse = ({ id, ...rest }) => rest;

export function loadYearResults(db) {
  return fetchAll(() => db.from("year_results").select("student_id, year, gpa, remark").order("student_id").order("year"));
}

export function groupYearResults(rows) {
  const m = new Map();
  for (const r of rows) {
    if (!m.has(r.student_id)) m.set(r.student_id, {});
    m.get(r.student_id)[r.year] = r;
  }
  return m;
}

export function yearGpasOf(byYear) {
  return Object.fromEntries(Object.entries(byYear || {}).map(([y, r]) => [y, r.gpa]));
}

// Default year to show: the latest year that has any year GPA entered.
export function defaultYear(yearRows, catalogYears) {
  const ys = yearRows.filter((r) => typeof r.gpa === "number").map((r) => r.year);
  return ys.length ? Math.max(...ys) : catalogYears[0] ?? 1;
}
