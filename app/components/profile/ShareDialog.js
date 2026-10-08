"use client";

import { useEffect, useRef, useState } from "react";
import { useBackClose } from "../../../lib/useBackClose";
import { nodeToCanvas, downloadCanvas, siteIsDark } from "../../../lib/exportImage";
import { firstTwoWords } from "../../../lib/format";
import ShareSheet, { sheetWidth } from "./ShareSheet";

const DETAILS = [["summary", "Summary"], ["grades", "Grade counts"], ["courses", "All courses"]];
const THEMES = [["auto", "Auto"], ["light", "Light"], ["dark", "Dark"]];
const seg = (on) => `px-3 py-1.5 text-sm border ${on ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 dark:border-gray-700"}`;

// Choose what goes into the picture, see it, then download it.
export default function ShareDialog({ student, onClose }) {
  const close = useBackClose(onClose);
  const available = [...student.years].sort((a, b) => a.year - b.year);
  const [picked, setPicked] = useState(available.map((y) => y.year));
  const [detail, setDetail] = useState("grades");
  const [theme, setTheme] = useState("auto");
  const [showRanks, setShowRanks] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [room, setRoom] = useState(320);
  const exportRef = useRef(null);

  useEffect(() => {
    const fit = () => setRoom(Math.min(window.innerWidth - 64, 480));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const years = available.filter((y) => picked.includes(y.year));
  const dark = theme === "auto" ? siteIsDark() : theme === "dark";
  const options = { detail, showRanks, dark };
  const width = sheetWidth(years.length, detail);
  const zoom = Math.min(1, room / width);
  const toggleYear = (n) => setPicked((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]));

  async function download() {
    setExporting(true);
    try {
      const canvas = await nodeToCanvas(exportRef.current, { dark });
      downloadCanvas(canvas, `${firstTwoWords(student.name_en) || "profile"}-results`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={close}>
      <div className="bg-white dark:bg-gray-900 w-full sm:max-w-xl sm:rounded-xl rounded-t-2xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          <h2 className="text-lg font-semibold">Export as image</h2>

          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Years</div>
            <div className="flex flex-wrap gap-2">
              {available.map((y) => (
                <button key={y.year} onClick={() => toggleYear(y.year)} className={`rounded-full ${seg(picked.includes(y.year))}`}>
                  Year {y.year}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Details</div>
            <div className="inline-flex rounded-lg overflow-hidden">
              {DETAILS.map(([v, l]) => <button key={v} onClick={() => setDetail(v)} className={seg(detail === v)}>{l}</button>)}
            </div>
            {detail === "courses" && years.length > 1 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Years are placed side by side (up to 3 per row) so the picture stays compact.</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Colours</div>
              <div className="inline-flex rounded-lg overflow-hidden">
                {THEMES.map(([v, l]) => <button key={v} onClick={() => setTheme(v)} className={seg(theme === v)}>{l}</button>)}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={showRanks} onChange={(e) => setShowRanks(e.target.checked)} /> Include ranks
            </label>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">Your university ID is never included in the picture.</p>

          {years.length === 0 ? (
            <p className="text-sm text-gray-500">Pick at least one year.</p>
          ) : (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div style={{ zoom }}><ShareSheet student={student} years={years} options={options} /></div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-gray-200 dark:border-gray-800 p-3 flex gap-2">
          <button onClick={close} className="flex-1 px-3 py-2.5 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-700">Close</button>
          <button onClick={download} disabled={exporting || years.length === 0} className="flex-1 px-3 py-2.5 rounded-lg text-sm font-medium bg-blue-600 text-white disabled:opacity-50">
            {exporting ? "Preparing…" : "⬇ Download image"}
          </button>
        </div>
      </div>

      {/* off-screen, unscaled copy that is actually captured */}
      <div ref={exportRef} aria-hidden="true" style={{ position: "fixed", left: -100000, top: 0 }}>
        {years.length > 0 && <ShareSheet student={student} years={years} options={options} />}
      </div>
    </div>
  );
}
