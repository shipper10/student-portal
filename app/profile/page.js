"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { describeGrade } from "../../lib/courses";
import { ThemeToggle } from "../../lib/useTheme";
import { fmtGpa, fmtRankFull } from "../../lib/format";
import { PERMISSIONS } from "../../lib/permissions";

const nav = "hidden sm:inline-block px-3 py-2 rounded-lg text-sm border border-gray-300 dark:border-gray-700 whitespace-nowrap";
const rankText = (r) => (r ? fmtRankFull(r.rank, r.total, r.tie) : "—");

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2.5">
      <div className="text-[11px] leading-tight text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function LinkForm({ onLinked }) {
  const [id, setId] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      onLinked();
    } catch (e) {
      setMsg(String(e.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
      <h2 className="text-lg font-semibold">Link your university ID</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Students: enter your university ID once. An administrator reviews the request before you can see results.
        Not a student of this batch? Ask the administrator to approve your account as a visitor.
      </p>
      <input
        value={id}
        onChange={(e) => setId(e.target.value)}
        placeholder="University ID"
        className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
      />
      <button onClick={submit} disabled={busy || !id.trim()} className="w-full rounded-lg bg-blue-600 text-white py-2 disabled:opacity-50">
        {busy ? "Linking…" : "Link"}
      </button>
      {msg && <p className="text-sm text-red-600">{msg}</p>}
    </div>
  );
}

function Notice({ title, text }) {
  return (
    <div className="max-w-md mx-auto rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-1">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400">{text}</p>
    </div>
  );
}

function CourseRow({ c }) {
  const flag = describeGrade(c);
  return (
    <div className="flex items-center justify-between gap-2 py-1 text-sm border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="truncate">
        {c.name} <span className="text-xs text-gray-400">· {c.credits}h</span>
      </span>
      <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-semibold ${flag ? flag.chip : ""}`}>
        {c.grade}
        {c.type === "supplementary" ? " · supp" : ""}
      </span>
    </div>
  );
}

// Newest year is open; older years are collapsed to one summary line.
function YearBlock({ y, open }) {
  const sems = [...new Set(y.courses.map((c) => c.semester))];
  return (
    <details open={open} className="rounded-lg border border-gray-200 dark:border-gray-700">
      <summary className="cursor-pointer select-none px-3 py-2 flex flex-wrap items-center justify-between gap-x-3 text-sm">
        <span className="font-semibold">Year {y.year}</span>
        <span className="text-gray-500 dark:text-gray-400 tabular-nums">
          GPA {fmtGpa(y.gpa)} · Rank {rankText(y.rank)}
          {y.remark ? ` · ${y.remark}` : ""}
        </span>
      </summary>
      <div className="px-3 pb-2">
        {sems.map((n) => (
          <div key={n} className="mb-1">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 py-1">
              Semester {n} · GPA {fmtGpa(y.semesters.find((s) => s.semester === n)?.gpa)}
            </div>
            {y.courses.filter((c) => c.semester === n).map((c) => <CourseRow key={c.code} c={c} />)}
          </div>
        ))}
      </div>
    </details>
  );
}

function Profile({ s }) {
  const o = s.overall, r = s.ranking;
  const years = [...s.years].sort((a, b) => b.year - a.year);
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-bold leading-tight">{s.name_en}</h2>
        {s.name_ar && <div dir="rtl" className="text-sm text-gray-600 dark:text-gray-300">{s.name_ar}</div>}
        <div className="text-xs text-gray-500 dark:text-gray-400">ID {s.student_id} · Cohort {s.cohort}</div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label={o.final ? "Final GPA" : `GPA · ${o.years.length}/${o.maxYear} yrs`} value={fmtGpa(o.gpa)} />
        <Stat label={`Rank · through Y${r.through}`} value={rankText(r.eligible ? r.all : null)} />
        <Stat label={`Cohort ${s.cohort} rank`} value={rankText(r.eligible ? r.cohort : null)} />
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {o.final
          ? "Final result for all years."
          : `Provisional: the final result is available after all ${o.maxYear} years.`}
        {!r.eligible && ` Complete Years 1–${r.through} to be included in the ranking.`}
      </p>
      {years.length === 0 && <p className="text-gray-500">No results have been published for you yet.</p>}
      {years.map((y, i) => <YearBlock key={y.year} y={y} open={i === 0} />)}
    </div>
  );
}

export default function ProfilePage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  function load() {
    setError(null);
    fetch("/api/me", { cache: "no-store" })
      .then((res) => res.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setError(String(e.message || e)));
  }
  useEffect(load, []);

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100 transition-colors">
      <div className="max-w-3xl mx-auto p-3 sm:p-4 space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg sm:text-2xl font-bold">My profile</h1>
          <div className="flex flex-wrap items-center gap-2">
            <ThemeToggle />
            {data?.permissions?.includes(PERMISSIONS.ADMIN_PANEL) && <Link href="/admin" className={nav}>Admin</Link>}
            {data?.access?.board && <Link href="/" className={nav}>Results board</Link>}
            <UserButton />
          </div>
        </header>
        {error && <p className="text-red-600">{error}</p>}
        {!data && !error && <p className="text-gray-500">Loading…</p>}
        {data && !data.linked && (
          data.permissions.includes(PERMISSIONS.ADMIN_PANEL)
            ? <p className="text-sm">Administrator account (not linked to a student).</p>
            : data.pending
              ? <Notice title="Waiting for approval" text={`Your request to link ID ${data.pending.studentId} is waiting for the administrator. Your results will appear here once it is approved.`} />
              : data.role === "visitor"
                ? <Notice title="Visitor account" text="You can open the pages the administrator enabled for you." />
                : <LinkForm onLinked={load} />
        )}
        {data?.linked && <Profile s={data.student} />}
      </div>
    </main>
  );
}
