import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { route, json } from "../../../lib/http";
import { PAGES, COHORTS, emptyCohortCounts } from "../../../lib/constants";
import { GRADE_ORDER } from "../../../lib/courses";
import { maskId } from "../../../lib/mask";
import { normalizeArabic, nameRelevance } from "../../../lib/text";
import { loadCatalog, publicCourse, loadYearResults, groupYearResults, yearGpasOf, defaultYear, fetchAll } from "../../../lib/data";
import { ROLES } from "../../../lib/constants";
import { loadYearVisibility, visibleYears } from "../../../lib/visibility";
import { maxYearOf, weightedGpa, defaultBasisYear, parseView, viewKey, viewOptions, rankStudents } from "../../../lib/academics";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// Board data for one view: a single year ("3") or cumulative through a year
// ("cum3"). Ranks are computed here (lib/academics.js), never in the browser.
export const GET = route({ page: PAGES.BOARD }, async (request, session) => {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const cohortFilter = searchParams.get("cohort") || "all"; // all | 23 | 24
  const sortBy = searchParams.get("sortBy") || "gpa";
  const sortDir = searchParams.get("sortDir") || "desc";

  const db = supabaseAdmin();
  const [{ courses: catalogAll, weights }, yearRowsAll, students] = await Promise.all([
    loadCatalog(),
    loadYearResults(db),
    fetchAll(() => db.from("students").select("student_id, name_en, name_ar, cohort").order("student_id")),
  ]);
  // Non-admins only see the years the admin made visible on the board.
  const vis = session.role === ROLES.ADMIN ? null : visibleYears(await loadYearVisibility(db), "board");
  const catalog = vis ? catalogAll.filter((c) => vis.has(c.year)) : catalogAll;
  const yearRows = vis ? yearRowsAll.filter((r) => vis.has(r.year)) : yearRowsAll;
  const maxYear = maxYearOf(weights);
  const yearMap = groupYearResults(yearRows);
  const gpasOf = (id) => yearGpasOf(yearMap.get(id));
  const years = [...new Set([...catalog.map((c) => c.year), ...yearRows.map((r) => r.year)])].sort((a, b) => a - b);
  const dataYears = [...new Set(yearRows.filter((r) => typeof r.gpa === "number").map((r) => r.year))].sort((a, b) => a - b);
  const cumYears = dataYears.filter((n) => Array.from({ length: n }, (_, i) => i + 1).every((y) => !vis || vis.has(y)));
  if (vis && years.length === 0) {
    return json({ students: [], view: "1", views: [], courses: [], ranking: null, counts: { all: 0, ...emptyCohortCounts() } });
  }
  const basis = defaultBasisYear(students.map((s) => gpasOf(s.student_id)), weights);
  const viewDefaults = { maxYear, defaultYear: defaultYear(yearRows, years), basis };
  let view = parseView(searchParams.get("view"), viewDefaults);
  // a saved or hand-typed view that this account may not see falls back to the default
  const allowed = view.kind === "year" ? years.includes(view.year) : cumYears.includes(view.through);
  if (!allowed) view = parseView("", viewDefaults);
  const isYear = view.kind === "year";
  const viewCourses = isYear ? catalog.filter((c) => c.year === view.year) : [];

  const [semRows, gradeRows] = await Promise.all([
    isYear
      ? fetchAll(() => db.from("semester_results").select("student_id, semester, gpa").in("semester", [view.year * 2 - 1, view.year * 2]).order("student_id").order("semester"))
      : [],
    viewCourses.length
      ? fetchAll(() => db.from("grades").select("student_id, course_id, grade, attempt_type, original_grade").in("course_id", viewCourses.map((c) => c.id)).order("student_id").order("course_id"))
      : [],
  ]);
  const semMap = new Map();
  for (const r of semRows) {
    if (!semMap.has(r.student_id)) semMap.set(r.student_id, {});
    semMap.get(r.student_id)[r.semester] = r.gpa;
  }
  const codeById = new Map(viewCourses.map((c) => [c.id, c.code]));
  const gradeMap = new Map();
  for (const g of gradeRows) {
    if (!g.grade) continue;
    if (!gradeMap.has(g.student_id)) gradeMap.set(g.student_id, {});
    gradeMap.get(g.student_id)[codeById.get(g.course_id)] = { grade: g.grade, type: g.attempt_type, orig: g.original_grade };
  }

  // One value per student for this view. Cumulative views only give a GPA (and a
  // rank) to students who completed every year in the range; the others show
  // "Incomplete" and stay unranked instead of being compared unfairly.
  const rows = students.map((st) => {
    const yg = gpasOf(st.student_id);
    const overall = weightedGpa(yg, weights);
    let gpa, remark;
    if (isYear) {
      const yr = yearMap.get(st.student_id)?.[view.year];
      gpa = typeof yr?.gpa === "number" ? yr.gpa : null;
      remark = yr?.remark ?? null;
    } else {
      const c = weightedGpa(yg, weights, view.through);
      gpa = c.eligible ? c.gpa : null;
      remark = c.final ? "Final" : c.eligible ? `Years 1–${view.through}` : `Incomplete · ${c.years.length}/${view.through} yrs`;
    }
    const sem = semMap.get(st.student_id) || {};
    return {
      student_id: st.student_id, name_en: st.name_en, name_ar: st.name_ar, cohort: st.cohort,
      gpa, remark,
      sem1_gpa: isYear ? sem[view.year * 2 - 1] ?? null : null,
      sem2_gpa: isYear ? sem[view.year * 2] ?? null : null,
      courses: gradeMap.get(st.student_id) || {},
      overall: { gpa: overall.gpa, years: overall.years, final: overall.final },
    };
  });

  const ranks = rankStudents(rows.map((r) => ({ ...r, id: r.student_id })), (r) => r.gpa, (r) => r.cohort);
  let enriched = rows.map((r) => {
    const rk = ranks(r.student_id);
    return {
      id: maskId(r.student_id), // masked: the only "id" the client ever sees
      name_en: r.name_en, name_ar: r.name_ar, cohort: r.cohort,
      gpa: r.gpa, remark: r.remark, sem1_gpa: r.sem1_gpa, sem2_gpa: r.sem2_gpa,
      courses: r.courses, overall: r.overall,
      rank_all: rk.all.rank, rank_all_tie: rk.all.tie, total_all: rk.all.total,
      rank_cohort: rk.group.rank, rank_cohort_tie: rk.group.tie, total_cohort: rk.group.total,
      _realId: String(r.student_id), // used only for server-side search below
      _relevance: Infinity,
    };
  });

    // --- Search: matches the REAL id server-side (never exposed to the
    // client), and is Arabic-letter-variant aware (اإأآ, ةه, يىئ all match)
    // and prioritizes a match at the start of a name's first word. ---
    if (q) {
      const nq = normalizeArabic(q);
      enriched = enriched
        .map((r) => {
          const idMatch = r._realId.toLowerCase() === nq;
          const relEn = nameRelevance(r.name_en, nq);
          const relAr = nameRelevance(r.name_ar, nq);
          const relevance = idMatch ? -1 : Math.min(relEn, relAr);
          return { ...r, _relevance: relevance };
        })
        .filter((r) => Number.isFinite(r._relevance));
    }

    // --- Cohort filter ---
    if (COHORTS.includes(cohortFilter)) {
      enriched = enriched.filter((r) => r.cohort === cohortFilter);
    }

    // --- Sort ---
    const dir = sortDir === "asc" ? 1 : -1;
    const getVal = (r, key) => {
      if (key.startsWith("course:")) {
        const code = key.slice(7);
        const g = r.courses?.[code]?.grade;
        // best grade = highest value, so "descending" lists the best grades first
        return g ? GRADE_ORDER.length - (GRADE_ORDER.indexOf(g) === -1 ? GRADE_ORDER.length : GRADE_ORDER.indexOf(g)) : null;
      }
      return r[key];
    };
    enriched.sort((a, b) => {
      // While the person is actively searching, the best-matching names
      // come first regardless of the column sort (which still applies as
      // the tie-breaker among equally relevant matches).
      if (q && a._relevance !== b._relevance) {
        return a._relevance - b._relevance;
      }
      const av = getVal(a, sortBy);
      const bv = getVal(b, sortBy);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * dir;
      }
      return String(av).localeCompare(String(bv)) * dir;
    });

    // Strip server-only fields before anything leaves the server
    enriched = enriched.map(({ _realId, _relevance, ...rest }) => rest);

    return json({
    students: enriched,
    view: viewKey(view),
    views: viewOptions(years, cumYears, maxYear),
    courses: viewCourses.map(publicCourse),
    ranking: { kind: view.kind, through: isYear ? null : view.through, final: !isYear && view.through === maxYear, ranked: ranks.rankedCount, total: rows.length },
    counts: { all: rows.length, ...Object.fromEntries(COHORTS.map((c) => [c, rows.filter((r) => r.cohort === c).length])) },
  });
});
