"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  GRADE_ORDER,
  GRADE_BAR_COLORS,
  DEFAULT_BAR_COLOR,
  REMARK_COLORS,
} from "../../lib/courses";
import PageHeader from "../components/PageHeader";
import { COHORTS, GPA_MAX } from "../../lib/constants";

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [cohort, setCohort] = useState("all"); // all | 23 | 24
  const [selectedCourse, setSelectedCourse] = useState("");

  const [year, setYear] = useState("");
  const [years, setYears] = useState([]);
  const [gpaField, setGpaField] = useState("annual"); // annual | sem1 | sem2
  const [op, setOp] = useState("gte"); // gte | lte | between
  const [threshold, setThreshold] = useState("3.0"); // kept as text so the field can be cleared while typing
  const [thresholdMax, setThresholdMax] = useState(GPA_MAX.toFixed(1));

  useEffect(() => {
    setData(null);
    setError(null);
    fetch(`/api/analytics?cohort=${cohort}&year=${year}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((d) => {
        if (d.error) throw new Error(d.error === "Forbidden" ? "You don't have access to this page yet. If you are a student, open Profile to link your university ID; otherwise contact the administrator." : d.error);
        setData(d);
        setYears(d.years || []);
        setSelectedCourse((cur) => (d.courses[cur] ? cur : Object.keys(d.courses)[0] || ""));
      })
      .catch((e) => setError(String(e.message || e)));
  }, [cohort, year]);

  const thresholdCount = useMemo(() => {
    if (!data) return { count: 0, total: 0 };
    const list = data.gpas[gpaField === "cumulative" && data.basis < 2 ? "annual" : gpaField] || [];
    const lo = parseFloat(threshold), hi = parseFloat(thresholdMax);
    let count;
    if (op === "gte") count = list.filter((v) => v >= lo).length;
    else if (op === "lte") count = list.filter((v) => v <= lo).length;
    else count = list.filter((v) => v >= lo && v <= hi).length;
    return { count, total: list.length };
  }, [data, gpaField, op, threshold, thresholdMax]);

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 text-red-600 dark:text-red-400 p-6">
        {error}
      </main>
    );
  }

  const courseStats = data?.courses?.[selectedCourse];
  const courseTotal = courseStats?.total || 0;

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100 transition-colors">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        <PageHeader
          title="Analytics"
          subtitle={data ? `${data.totalStudents} shown${COHORTS.map((c) => ` · ${data.cohortCounts[c] ?? 0} in cohort ${c}`).join("")} (overall)` : "Loading…"}
        >
          <Link href="/" className="hidden sm:inline-block px-3 py-2 rounded-lg text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 whitespace-nowrap">🏆 Board</Link>
        </PageHeader>

        {/* Cohort filter — applies to every section below */}
        <div className="flex flex-wrap gap-2 mb-6">
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
              {c === "all" ? "All students" : `Cohort ${c}`}
            </button>
          ))}
          {years.length > 0 && (
            <select
              value={year || (data ? String(data.year) : "")}
              onChange={(e) => setYear(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            >
              {years.map((y) => (
                <option key={y} value={y}>Year {y}</option>
              ))}
            </select>
          )}
        </div>

        {!data ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        ) : (
          <div className="space-y-6">
            {/* Course grade distribution */}
            <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-4">
                <h2 className="font-semibold text-sm sm:text-base">
                  Grade distribution
                </h2>
                <select
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  className="ml-0 sm:ml-auto px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                >
                  {Object.entries(data.courses).map(([code, c]) => (
                    <option key={code} value={code}>
                      {c.name} (Sem {c.semester})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                {GRADE_ORDER.map((g) => {
                  const n = courseStats?.counts?.[g] || 0;
                  const pct = courseTotal ? (n / courseTotal) * 100 : 0;
                  const barColor = GRADE_BAR_COLORS[g] || DEFAULT_BAR_COLOR;
                  return (
                    <div key={g} className="flex items-center gap-3 text-sm">
                      <div className="w-8 font-mono font-semibold">{g}</div>
                      <div className="flex-1 h-6 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden">
                        <div
                          className={`h-full ${barColor} transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="w-24 text-right text-gray-500 dark:text-gray-400">
                        {n} ({pct.toFixed(0)}%)
                      </div>
                    </div>
                  );
                })}
                {courseTotal === 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    No recorded grades for this subject.
                  </p>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                {courseTotal} students with a recorded grade in {courseStats?.name}.
              </p>
            </section>

            {/* GPA threshold / range counter */}
            <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
              <h2 className="font-semibold text-sm sm:text-base mb-4">
                How many students have a GPA...
              </h2>
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <select
                  value={gpaField}
                  onChange={(e) => setGpaField(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                >
                  <option value="annual">Year GPA</option>
                  <option value="sem1">First semester GPA (of this year)</option>
                  <option value="sem2">Second semester GPA</option>
                  {data && data.basis >= 2 && (
                    <option value="cumulative">Cumulative GPA (Years 1–{data.basis})</option>
                  )}
                </select>
                <select
                  value={op}
                  onChange={(e) => setOp(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                >
                  <option value="gte">≥ (at or above)</option>
                  <option value="lte">≤ (at or below)</option>
                  <option value="between">between</option>
                </select>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={GPA_MAX}
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  className="w-24 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                />
                {op === "between" && (
                  <>
                    <span className="text-sm text-gray-500 dark:text-gray-400">and</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={GPA_MAX}
                      value={thresholdMax}
                      onChange={(e) => setThresholdMax(e.target.value)}
                      className="w-24 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                    />
                  </>
                )}
              </div>
              <div className="text-3xl font-bold">
                {thresholdCount.count}{" "}
                <span className="text-base font-normal text-gray-500 dark:text-gray-400">
                  / {thresholdCount.total} students (
                  {thresholdCount.total
                    ? ((thresholdCount.count / thresholdCount.total) * 100).toFixed(1)
                    : 0}
                  %)
                </span>
              </div>
            </section>

            {/* Remark breakdown */}
            <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
              <h2 className="font-semibold text-sm sm:text-base mb-4">
                Remark breakdown
              </h2>
              <div className="space-y-2">
                {Object.entries(data.remarkCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([label, n]) => {
                    const pct = data.totalStudents ? (n / data.totalStudents) * 100 : 0;
                    const colors = REMARK_COLORS[label] || REMARK_COLORS.Other;
                    return (
                      <div key={label} className="flex items-center gap-3 text-sm">
                        <div className={`w-28 sm:w-36 shrink-0 px-2 py-0.5 rounded text-xs font-medium truncate ${colors.badge}`}>
                          {label}
                        </div>
                        <div className="flex-1 h-6 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden">
                          <div
                            className="h-full bg-indigo-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="w-16 sm:w-20 text-right text-xs sm:text-sm text-gray-500 dark:text-gray-400 shrink-0">
                          {n} ({pct.toFixed(0)}%)
                        </div>
                      </div>
                    );
                  })}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
