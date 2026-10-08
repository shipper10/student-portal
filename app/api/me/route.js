import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { route, json } from "../../../lib/http";
import { canView } from "../../../lib/auth";
import { PAGES, ROLES } from "../../../lib/constants";
import { loadYearVisibility, visibleYears } from "../../../lib/visibility";
import { permissionsOf } from "../../../lib/permissions";
import { loadCatalog, loadYearResults, groupYearResults, yearGpasOf, fetchAll } from "../../../lib/data";
import { maxYearOf, weightedGpa, rankStudents } from "../../../lib/academics";

export const dynamic = "force-dynamic";

// The signed-in user's role, permissions, page access and (if linked) their own
// full record year by year. The real university ID is returned here: it is theirs.
export const GET = route({}, async (_request, session) => {
  const access = { board: await canView(session, PAGES.BOARD), analytics: await canView(session, PAGES.ANALYTICS) };
  const base = { role: session.role, permissions: permissionsOf(session), access };
  if (!session.studentId) {
    return json({ ...base, linked: false, pending: session.pendingStudentId ? { studentId: session.pendingStudentId } : null });
  }

  const db = supabaseAdmin();
  const sid = session.studentId;
  const [{ courses: coursesAll, weights }, yearRowsAll, allStudents, meRes, semRes, gradeRes] = await Promise.all([
    loadCatalog(),
    loadYearResults(db),
    fetchAll(() => db.from("students").select("student_id, cohort").order("student_id")),
    db.from("students").select("student_id, name_en, name_ar, cohort").eq("student_id", sid).single(),
    db.from("semester_results").select("semester, gpa").eq("student_id", sid),
    db.from("grades").select("course_id, grade, attempt_type, original_grade").eq("student_id", sid),
  ]);
  for (const r of [meRes, semRes, gradeRes]) if (r.error) throw r.error;
  const me = meRes.data;

  // Non-admins only see the years the admin made visible on student profiles.
  const vis = session.role === ROLES.ADMIN ? null : visibleYears(await loadYearVisibility(db), "profile");
  const courses = vis ? coursesAll.filter((c) => vis.has(c.year)) : coursesAll;
  const yearRows = vis ? yearRowsAll.filter((r) => vis.has(r.year)) : yearRowsAll;
  const maxYear = maxYearOf(weights);
  const byStudent = groupYearResults(yearRows);
  const gpasById = new Map(allStudents.map((s) => [s.student_id, yearGpasOf(byStudent.get(s.student_id))]));
  const items = allStudents.map((s) => ({ id: s.student_id, cohort: s.cohort }));

  // Cumulative result over the years this student completed in a row (Years 1..n), ranked among
  // the students who completed the same years (see lib/academics.js). Updates as soon as a new
  // year is entered.
  const mine = gpasById.get(sid);
  let n = 0;
  while (n < maxYear && typeof mine[n + 1] === "number") n++;
  const cumAt = (id) => { const c = weightedGpa(gpasById.get(id), weights, n); return c.eligible ? c.gpa : null; };
  const cumulative = n >= 1
    ? { through: n, final: n === maxYear, gpa: cumAt(sid), ...(() => { const r = rankStudents(items, (it) => cumAt(it.id), (it) => it.cohort)(sid); return { rank: r.all, cohortRank: r.group }; })() }
    : null;
  const overall = weightedGpa(mine, weights); // everything entered so far

  const gradeByCourse = new Map(gradeRes.data.map((g) => [g.course_id, g]));
  const semGpa = Object.fromEntries(semRes.data.map((r) => [r.semester, r.gpa]));
  const myYears = byStudent.get(sid) || {};
  const yearList = [...new Set(courses.map((c) => c.year))].sort((a, b) => a - b);
  const years = yearList
    .map((y) => {
      const cs = courses
        .filter((c) => c.year === y && gradeByCourse.get(c.id)?.grade)
        .map((c) => {
          const g = gradeByCourse.get(c.id);
          return { code: c.code, name: c.name, short: c.short, credits: c.credits, semester: c.semester, grade: g.grade, type: g.attempt_type, orig: g.original_grade };
        });
      const yr = myYears[y];
      const yr_rank = typeof yr?.gpa === "number" ? rankStudents(items, (it) => gpasById.get(it.id)[y] ?? null, (it) => it.cohort)(sid) : null;
      return {
        year: y, gpa: yr?.gpa ?? null, remark: yr?.remark ?? null, rank: yr_rank ? yr_rank.all : null, cohortRank: yr_rank ? yr_rank.group : null,
        semesters: [y * 2 - 1, y * 2].map((n) => ({ semester: n, gpa: semGpa[n] ?? null })),
        courses: cs,
      };
    })
    .filter((y) => y.courses.length || typeof y.gpa === "number");

  return json({
    ...base,
    linked: true,
    student: {
      student_id: me.student_id, name_en: me.name_en, name_ar: me.name_ar, cohort: me.cohort,
      overall: { gpa: overall.gpa, years: overall.years, final: overall.final, maxYear },
      cumulative,
      years,
    },
  });
});
