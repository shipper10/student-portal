import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { route, json } from "../../../lib/http";
import { PAGES, emptyCohortCounts } from "../../../lib/constants";
import { classifyRemark } from "../../../lib/courses";
import { loadCatalog, loadYearResults, groupYearResults, yearGpasOf, defaultYear, fetchAll } from "../../../lib/data";
import { ROLES } from "../../../lib/constants";
import { loadYearVisibility, visibleYears } from "../../../lib/visibility";
import { maxYearOf, weightedGpa, defaultBasisYear } from "../../../lib/academics";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// Aggregates only (grade counts, GPA lists, remark counts): no names, no IDs.
export const GET = route({ page: PAGES.ANALYTICS }, async (request, session) => {
  const { searchParams } = new URL(request.url);
  const cohortFilter = searchParams.get("cohort") || "all"; // all | 23 | 24

  const db = supabaseAdmin();
  const [{ courses: catalogAll, weights }, yearRowsAll, allStudents] = await Promise.all([
    loadCatalog(),
    loadYearResults(db),
    fetchAll(() => db.from("students").select("student_id, cohort").order("student_id")),
  ]);
  const vis = session.role === ROLES.ADMIN ? null : visibleYears(await loadYearVisibility(db), "board");
  const catalog = vis ? catalogAll.filter((c) => vis.has(c.year)) : catalogAll;
  const yearRows = vis ? yearRowsAll.filter((r) => vis.has(r.year)) : yearRowsAll;
  const maxYear = maxYearOf(weights);
  const years = [...new Set([...catalog.map((c) => c.year), ...yearRows.map((r) => r.year)])].sort((a, b) => a - b);
  if (vis && years.length === 0) {
    return json({ totalStudents: 0, cohortCounts: emptyCohortCounts(), year: 1, years: [], basis: 1, courses: {}, remarkCounts: {}, gpas: { annual: [], sem1: [], sem2: [], cumulative: [] } });
  }
  const asked = parseInt(searchParams.get("year") || "", 10);
  const year = years.includes(asked) ? asked : defaultYear(yearRows, years); // only years this account may see
  const yearCourses = catalog.filter((c) => c.year === year);

  const rows = allStudents.filter((s) => cohortFilter === "all" || s.cohort === cohortFilter);
  const ids = new Set(rows.map((s) => s.student_id));
  const byYear = groupYearResults(yearRows);

  const [semRows, gradeRows] = await Promise.all([
    fetchAll(() => db.from("semester_results").select("student_id, semester, gpa").in("semester", [year * 2 - 1, year * 2]).order("student_id").order("semester")),
    yearCourses.length
      ? fetchAll(() => db.from("grades").select("student_id, course_id, grade").in("course_id", yearCourses.map((c) => c.id)).order("student_id").order("course_id"))
      : [],
  ]);

  const courses = {};
  for (const c of yearCourses) courses[c.code] = { name: c.name, semester: c.semester, credits: c.credits, counts: {}, total: 0 };
  const codeById = new Map(yearCourses.map((c) => [c.id, c.code]));
  for (const g of gradeRows) {
    if (!g.grade || !ids.has(g.student_id)) continue;
    const e = courses[codeById.get(g.course_id)];
    e.counts[g.grade] = (e.counts[g.grade] || 0) + 1;
    e.total++;
  }

  // "Cumulative" counts only students who completed years 1..basis (same rule as ranking).
  const basis = defaultBasisYear(allStudents.map((s) => yearGpasOf(byYear.get(s.student_id))), weights);
  const remarkCounts = {};
  const annual = [], cumulative = [];
  for (const s of rows) {
    const yr = byYear.get(s.student_id)?.[year];
    const label = classifyRemark(yr?.remark);
    remarkCounts[label] = (remarkCounts[label] || 0) + 1;
    if (typeof yr?.gpa === "number") annual.push(yr.gpa);
    const c = weightedGpa(yearGpasOf(byYear.get(s.student_id)), weights, basis);
    if (c.eligible) cumulative.push(c.gpa);
  }
  const semList = (n) => semRows.filter((r) => ids.has(r.student_id) && r.semester === n && typeof r.gpa === "number").map((r) => r.gpa);
  const cohortCounts = emptyCohortCounts();
  allStudents.forEach((s) => { cohortCounts[s.cohort] = (cohortCounts[s.cohort] || 0) + 1; });

  return json({
    totalStudents: rows.length, cohortCounts, year, years, basis, courses, remarkCounts,
    gpas: { annual, sem1: semList(year * 2 - 1), sem2: semList(year * 2), cumulative },
  });
});
