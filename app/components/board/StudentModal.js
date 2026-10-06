"use client";

import { useRef, useState } from "react";
import { describeGrade } from "../../../lib/courses";
import { fmtGpa, fmtRankFull, firstTwoWords } from "../../../lib/format";

function Stat({ label, value, className = "" }) {
  return (
    <div className={`bg-gray-50 dark:bg-gray-800 rounded-lg p-2 ${className}`}>
      <div className="text-gray-500 dark:text-gray-400 text-xs">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

// The student card. `exportMode` is the version captured as an image: fixed width,
// nothing truncated, so no text can be cut off or overlap.
function CardBody({ student, courses, semBase, exportMode = false }) {
  const clip = exportMode ? "" : "truncate";
  return (
    <>
      <div className="mb-3">
        <h2 className="text-lg font-bold leading-snug break-words">{student.name_en}</h2>
        <p className="text-gray-500 dark:text-gray-400 leading-snug" dir="rtl">
          {student.name_ar}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
        <Stat label="GPA" value={fmtGpa(student.gpa)} />
        <Stat label="Remark" value={student.remark || "—"} />
        {(student.sem1_gpa != null || student.sem2_gpa != null) && (
          <>
            <Stat label={`Semester ${semBase} GPA`} value={fmtGpa(student.sem1_gpa)} />
            <Stat label={`Semester ${semBase + 1} GPA`} value={fmtGpa(student.sem2_gpa)} />
          </>
        )}
        <Stat label="Rank (batch)" value={fmtRankFull(student.rank_all, student.total_all, student.rank_all_tie)} />
        <Stat label={`Rank (cohort ${student.cohort})`} value={fmtRankFull(student.rank_cohort, student.total_cohort, student.rank_cohort_tie)} />
        <Stat
          className="col-span-2"
          label={student.overall?.final ? "Final GPA (all years)" : "Overall so far (provisional)"}
          value={fmtGpa(student.overall?.gpa)}
        />
      </div>

      {[...new Set(courses.map((c) => c.semester))].map((sem) => (
        <div key={sem} className="mb-2">
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Semester {sem}</div>
          <div className="grid grid-cols-2 gap-2">
            {courses
              .filter((c) => c.semester === sem && student.courses?.[c.code])
              .map((c) => {
                const info = student.courses[c.code];
                const flag = describeGrade(info);
                return (
                  <div
                    key={c.code}
                    title={c.name}
                    className={`rounded-lg p-2 text-sm ${flag ? `border-2 ${flag.border}` : "border border-gray-200 dark:border-gray-800"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className={`${clip} font-medium leading-snug break-words min-w-0`}>{c.short}</span>
                      <span className={`shrink-0 ${flag ? `px-1.5 rounded text-xs font-semibold ${flag.chip}` : "font-semibold"}`}>{info.grade}</span>
                    </div>
                    <div className={`${clip} text-[11px] leading-snug text-gray-500 dark:text-gray-400`}>
                      {c.credits}h{flag ? ` · ${flag.label}` : ""}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ))}
    </>
  );
}

export default function StudentModal({ student, courses, semBase, onClose }) {
  const exportRef = useRef(null);
  const [exporting, setExporting] = useState(false);

  // Capture an off-screen, fixed-width, always-light copy of the card (the visible
  // card sits inside a scrolling box, which html2canvas renders badly).
  const handleExport = async () => {
    setExporting(true);
    try {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (document.fonts?.ready) await document.fonts.ready;
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(exportRef.current, {
        backgroundColor: "#ffffff",
        scale: Math.min(3, Math.max(2, window.devicePixelRatio || 1)),
        useCORS: true,
        onclone: (doc) => doc.documentElement.classList.remove("dark"),
      });
      const link = document.createElement("a");
      link.download = `${firstTwoWords(student.name_en) || "student"}-card.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 w-full sm:max-w-lg sm:rounded-xl rounded-t-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end px-4 pt-3">
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xl leading-none">
            ×
          </button>
        </div>

        <div className="mx-4 mb-2 p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <CardBody student={student} courses={courses} semBase={semBase} />
        </div>

        <div className="px-4 pb-4 pt-1">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full px-3 py-2 rounded-lg text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
          >
            {exporting ? "Exporting…" : "⬇ Export card as image"}
          </button>
        </div>
      </div>

      {exporting && (
        <div
          ref={exportRef}
          aria-hidden="true"
          className="bg-white text-gray-900 p-5"
          style={{ position: "fixed", left: -10000, top: 0, width: 420, lineHeight: 1.4 }}
        >
          <CardBody student={student} courses={courses} semBase={semBase} exportMode />
          <div className="text-[10px] text-gray-400 mt-2 text-right">Student Results Portal</div>
        </div>
      )}
    </div>
  );
}
