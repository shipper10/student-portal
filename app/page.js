"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { describeGrade } from "../lib/courses";
import { useBoardPrefs } from "../lib/useBoardPrefs";
import { COHORTS, emptyCohortCounts } from "../lib/constants";
import StudentModal from "./components/board/StudentModal";
import ColumnManager from "./components/board/ColumnManager";
import { ThemeToggle } from "../lib/useTheme";
import { fmtGpa, fmtRank, firstTwoWords } from "../lib/format";

const BASE_COLUMNS = [
  "rank_all",
  "id",
  "name_en",
  "name_ar",
  "gpa",
  "sem1_gpa",
  "sem2_gpa",
  "rank_cohort",
];
const DEFAULT_VISIBILITY = {
  rank_all: true,
  id: false,
  name_en: false,
  name_ar: true,
  gpa: true, // GPA + remark of the selected view
  sem1_gpa: true,
  sem2_gpa: true,
  rank_cohort: false,
};

const BOARD_DEFAULTS = { cohort: "all", sortBy: "gpa", sortDir: "desc", visibility: DEFAULT_VISIBILITY, order: BASE_COLUMNS, pinned: [], viewParam: "" };
// On a phone: only rank, name and GPA, with rank and name pinned.
const MOBILE_DEFAULTS = { visibility: { ...DEFAULT_VISIBILITY, id: false, sem1_gpa: false, sem2_gpa: false }, pinned: ["rank_all", "name_en"] };

// Columns whose first click sorts ascending (rank 1 first, names A-Z); the rest start descending.
const ASC_FIRST = new Set(["name_en", "name_ar", "rank_all", "rank_cohort"]);

const BASE_LABELS = {
  rank_all: "Rank (batch)",
  id: "University ID",
  name_en: "Name (English)",
  name_ar: "Name (Arabic)",
  gpa: "GPA/RM",
  sem1_gpa: "First semester GPA",
  sem2_gpa: "Second semester GPA",
  rank_cohort: "Rank (cohort)",
};

export default function Page() {
  const [students, setStudents] = useState([]);
  const [counts, setCounts] = useState({ all: 0, ...emptyCohortCounts() });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  // layout choices are remembered on this device (see lib/useBoardPrefs.js)
  const [prefs, set, { ready, reset: resetLayout }] = useBoardPrefs(BOARD_DEFAULTS, MOBILE_DEFAULTS);
  const { cohort, sortBy, sortDir, visibility, order, pinned, viewParam } = prefs;
  const { cohort: setCohort, sortBy: setSortBy, sortDir: setSortDir, visibility: setVisibility, order: setOrder, pinned: setPinned, viewParam: setViewParam } = set;
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [courses, setCourses] = useState([]); // catalog for the selected view
  const [views, setViews] = useState([]);
  const [ranking, setRanking] = useState(null);
  const [activeView, setActiveView] = useState("1");
  const [selected, setSelected] = useState(null); // student for detail modal

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!ready) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      q: debouncedQuery,
      cohort,
      sortBy,
      sortDir,
      view: viewParam,
    });
    fetch(`/api/students?${params.toString()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error === "Forbidden" ? "You don't have access to this page yet. If you are a student, open Profile to link your university ID; otherwise contact the administrator." : data.error);
        setStudents(data.students || []);
        setCounts(data.counts || { all: 0, ...emptyCohortCounts() });
        setCourses(data.courses || []);
        setViews(data.views || []);
        setRanking(data.ranking || null);
        setActiveView(String(data.view));
        const keys = (data.courses || []).map((c) => `course:${c.code}`);
        // keep the user's column order; new columns go last, columns that no longer exist are dropped
        setOrder((prev) => {
          const kept = prev.filter((k) => BASE_COLUMNS.includes(k) || keys.includes(k));
          return [...kept, ...[...BASE_COLUMNS, ...keys].filter((k) => !kept.includes(k))];
        });
        setVisibility((prev) => {
          const n = { ...DEFAULT_VISIBILITY, ...prev };
          keys.forEach((k) => { if (!(k in n)) n[k] = false; });
          return n;
        });
        setPinned((prev) => prev.filter((k) => BASE_COLUMNS.includes(k) || keys.includes(k)));
      })
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setLoading(false));
  }, [ready, debouncedQuery, cohort, sortBy, sortDir, viewParam]);

  const toggleSort = (key) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir(ASC_FIRST.has(key) ? "asc" : "desc"); // rank 1 and A-Z first; best GPA/grade first
    }
  };

  const moveColumn = (key, dir) => {
    setOrder((prev) => {
      const i = prev.indexOf(key);
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const togglePin = (key) => {
    setPinned((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // Pinned columns are shown first (in pin order), then the rest in their
  // current order.
  const visibleOrdered = useMemo(
    () => order.filter((k) => visibility[k]),
    [order, visibility]
  );
  const displayColumns = useMemo(() => {
    const pinnedVisible = pinned.filter((k) => visibility[k]);
    const rest = visibleOrdered.filter((k) => !pinned.includes(k));
    return [...pinnedVisible, ...rest];
  }, [pinned, visibleOrdered, visibility]);

  // --- Column pinning: measure each pinned column's left offset ---
  const thRefs = useRef({});
  const [leftOffsets, setLeftOffsets] = useState({});
  useLayoutEffect(() => {
    const pinnedVisible = displayColumns.filter((k) => pinned.includes(k));
    let acc = 0;
    const offsets = {};
    for (const key of pinnedVisible) {
      offsets[key] = acc;
      const el = thRefs.current[key];
      acc += el ? el.offsetWidth : 0;
    }
    setLeftOffsets(offsets);
  }, [displayColumns, pinned, students, loading]);

  const courseByKey = useMemo(
    () => Object.fromEntries(courses.map((c) => [`course:${c.code}`, c])),
    [courses]
  );
  const labelOf = (key) =>
    key.startsWith("course:")
      ? courseByKey[key]
        ? `${courseByKey[key].name} (S${courseByKey[key].semester})`
        : key
      : BASE_LABELS[key] || key;
  const semBase = (Number(activeView) || 1) * 2 - 1;

  const sortArrow = (key) =>
    sortBy === key ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  const renderHeaderContent = (key) => {
    if (key === "id") return "ID";
    if (key.startsWith("course:")) {
      const course = courseByKey[key];
      return `${course?.short ?? key}${sortArrow(key)}`;
    }
    const labels = {
      rank_all: "Rank",
      name_en: "Name (EN)",
      name_ar: "Name (AR)",
      gpa: activeView.startsWith("cum") ? "Cumulative GPA / Status" : "GPA/RM",
      sem1_gpa: `Sem ${semBase}`,
      sem2_gpa: `Sem ${semBase + 1}`,
      rank_cohort: "Cohort Rank",
    };
    return `${labels[key]}${sortArrow(key)}`;
  };

  const renderCell = (key, s) => {
    switch (key) {
      case "rank_all":
        return fmtRank(s.rank_all, s.rank_all_tie);
      case "id":
        return <span className="font-mono">{s.id}</span>;
      case "name_en":
        return <span className="text-blue-600 dark:text-blue-400">{firstTwoWords(s.name_en)}</span>;
      case "name_ar":
        return (
          <bdi dir="rtl" className="text-blue-600 dark:text-blue-400">
            {firstTwoWords(s.name_ar)}
          </bdi>
        );
      case "gpa":
        return (
          <>
            {fmtGpa(s.gpa)} <span className="text-gray-500">({s.remark || "—"})</span>
          </>
        );
      case "sem1_gpa":
        return fmtGpa(s.sem1_gpa);
      case "sem2_gpa":
        return fmtGpa(s.sem2_gpa);
      case "rank_cohort":
        return fmtRank(s.rank_cohort, s.rank_cohort_tie);
      default:
        if (key.startsWith("course:")) {
          const course = courseByKey[key];
          return (course && s.courses?.[course.code]?.grade) ?? "—";
        }
        return null;
    }
  };

  return (
    <main className="h-[calc(100dvh-4rem)] sm:h-screen flex flex-col bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100 transition-colors">
      {/* Fixed top area: title, search/filter controls, and (when open) the
          columns panel. None of this scrolls, so it's always visible and
          opening the columns panel never requires scrolling back up. */}
      <div className="shrink-0 max-w-7xl w-full mx-auto px-3 sm:px-6 pt-4 sm:pt-6">
        <header className="flex items-center justify-between gap-2 mb-3">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold leading-tight">BahriMed B13</h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              {counts.all} students{COHORTS.map((c) => ` · ${counts[c] ?? 0} in cohort ${c}`).join("")}
            </p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Link
              href="/analytics"
              className="hidden sm:inline-block px-3 py-2 rounded-lg text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 whitespace-nowrap"
            >
              📊<span className="hidden sm:inline"> Analytics</span>
            </Link>
            <Link href="/profile" className="hidden sm:inline-block px-3 py-2 rounded-lg text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 whitespace-nowrap">
              👤<span className="hidden sm:inline"> Profile</span>
            </Link>
            <UserButton />
            <ThemeToggle />
          </div>
        </header>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="relative flex-1">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by ID or name (English or Arabic)..."
              className="w-full px-3 py-2 pr-9 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                ×
              </button>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {["all", ...COHORTS].map((c) => (
              <button
                key={c}
                onClick={() => setCohort(c)}
                className={`px-3 py-2 rounded-lg text-sm border ${
                  cohort === c
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                }`}
              >
                {c === "all" ? "All" : `Cohort ${c}`}
              </button>
            ))}
            <select
              value={activeView}
              onChange={(e) => setViewParam(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
            >
              {views.map((v) => (
                <option key={v.key} value={v.key}>{v.label}</option>
              ))}
            </select>
            <button
              onClick={() => setColumnsOpen((o) => !o)}
              className={`px-3 py-2 rounded-lg text-sm border ${
                columnsOpen
                  ? "bg-blue-600 text-white border-blue-600"
                  : "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
              }`}
            >
              Columns
            </button>
          </div>
        </div>

        {columnsOpen && (
          <ColumnManager
            order={order}
            visibility={visibility}
            pinned={pinned}
            labelOf={labelOf}
            onToggle={(k) => setVisibility((v) => ({ ...v, [k]: !v[k] }))}
            onPin={togglePin}
            onMove={moveColumn}
            onReset={resetLayout}
          />
        )}

        {ranking && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{rankingNote(ranking)}</p>
        )}
        {error && (
          <p className="text-red-600 dark:text-red-400 text-sm mt-3">{error}</p>
        )}
      </div>

      {/* Scrollable table area — the only part of the page that scrolls
          (both vertically and horizontally), so the sticky header row
          below is reliably pinned to the top of THIS box. */}
      <div className="flex-1 min-h-0 max-w-7xl w-full mx-auto px-3 sm:px-6 pb-4 sm:pb-6 mt-3">
        <div className={`h-full overflow-auto rounded-lg border border-gray-200 dark:border-gray-800 transition-opacity ${loading ? "opacity-60" : ""}`}>
          <table className="min-w-full text-xs sm:text-sm">
            <thead className="bg-gray-100 dark:bg-gray-900 sticky top-0 z-20">
              <tr>
                {displayColumns.map((key) => {
                  const isPinned = pinned.includes(key);
                  const fullLabel =
                    labelOf(key);
                  return (
                    <th
                      key={key}
                      ref={(el) => (thRefs.current[key] = el)}
                      onClick={key === "id" ? undefined : () => toggleSort(key)}
                      title={fullLabel}
                      className={`px-3 py-2 text-left font-semibold bg-gray-100 dark:bg-gray-900 whitespace-nowrap overflow-hidden text-ellipsis ${
                        key === "id" ? "" : "cursor-pointer select-none"
                      } ${
                        key.startsWith("course:") ? "max-w-[92px]" : ""
                      } ${isPinned ? "sticky z-30" : ""}`}
                      style={isPinned ? { left: leftOffsets[key] ?? 0 } : undefined}
                    >
                      {renderHeaderContent(key)}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr>
                  <td className="p-4 text-center" colSpan={displayColumns.length || 1}>
                    {loading ? "Loading…" : ranking ? "No matching students." : "No results have been published yet."}
                  </td>
                </tr>
              ) : (
                students.map((s, i) => (
                  <tr
                    key={s.id + i}
                    tabIndex={0}
                    onClick={() => setSelected(s)}
                    onKeyDown={(e) => e.key === "Enter" && setSelected(s)}
                    className={`border-t border-gray-100 dark:border-gray-800 group cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400 ${
                      selected === s ? "bg-blue-100 dark:bg-blue-950/50" : "hover:bg-blue-50 dark:hover:bg-gray-900"
                    }`}
                  >
                    {displayColumns.map((key) => {
                      const isPinned = pinned.includes(key);
                      return (
                        <td
                          key={key}
                          className={`px-3 py-2 ${
                            key.startsWith("course:")
                              ? "max-w-[92px] text-center"
                              : "whitespace-nowrap"
                          } ${
                            isPinned
                              ? `sticky z-10 ${selected === s ? "bg-blue-100 dark:bg-blue-950" : "bg-white dark:bg-gray-950 group-hover:bg-blue-50 dark:group-hover:bg-gray-900"}`
                              : ""
                          }`}
                          style={isPinned ? { left: leftOffsets[key] ?? 0 } : undefined}
                        >
                          {renderCell(key, s)}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <StudentModal student={selected} courses={courses} semBase={semBase} onClose={() => setSelected(null)} />
      )}
    </main>
  );
}

function rankingNote(r) {
  if (r.kind === "year") return `Ranked on this year's GPA · ${r.ranked} ranked`;
  const what = r.final ? "Final ranking (all years completed)" : `Ranked on cumulative GPA through Year ${r.through}`;
  return r.ranked < r.total
    ? `${what} · ${r.ranked} of ${r.total} students have completed all these years; the others are not ranked`
    : `${what} · ${r.ranked} ranked`;
}
