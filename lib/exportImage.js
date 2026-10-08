// Turns an element into a PNG and downloads it. Used by the board card and the profile export.
// `dark` picks the colours of the picture (independent of the page's current theme).
export async function nodeToCanvas(node, { dark = false } = {}) {
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  if (document.fonts?.ready) await document.fonts.ready;
  const html2canvas = (await import("html2canvas")).default;
  return html2canvas(node, {
    backgroundColor: dark ? "#111827" : "#ffffff",
    scale: Math.min(3, Math.max(2, window.devicePixelRatio || 1)),
    useCORS: true,
    onclone: (doc) => doc.documentElement.classList.toggle("dark", dark),
  });
}

export function downloadCanvas(canvas, baseName) {
  const pad = (n) => String(n).padStart(2, "0");
  const d = new Date();
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  const link = document.createElement("a");
  link.download = `${baseName}_${stamp}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

export const siteIsDark = () => document.documentElement.classList.contains("dark");
