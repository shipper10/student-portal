"use client";

// Show/hide, pin and reorder the board's columns.
export default function ColumnManager({ order, visibility, pinned, labelOf, onToggle, onPin, onMove, onReset }) {
  return (
    <div className="mt-3 p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Check to show a column. The pin button pins it to the left while scrolling sideways (blue = pinned). ▲▼ change
          its order. Your choices are remembered on this device.
        </p>
        <button
          onClick={onReset}
          className="shrink-0 px-2 py-1 rounded border border-gray-300 dark:border-gray-700 text-xs hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          Reset layout
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-64 overflow-y-auto pr-1">
        {order.map((key) => {
          const isPinned = pinned.includes(key);
          return (
            <div key={key} className="flex items-center gap-2 py-1 border-b border-gray-100 dark:border-gray-800 last:border-0">
              <input type="checkbox" checked={!!visibility[key]} onChange={() => onToggle(key)} />
              <span className="flex-1 truncate">{labelOf(key)}</span>
              <button
                onClick={() => onPin(key)}
                title={isPinned ? "Unpin column" : "Pin column"}
                className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                  isPinned
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-transparent text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-700"
                }`}
              >
                {isPinned ? "📌 Pinned" : "📌 Pin"}
              </button>
              <button onClick={() => onMove(key, -1)} title="Move earlier" className="px-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">▲</button>
              <button onClick={() => onMove(key, 1)} title="Move later" className="px-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">▼</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
