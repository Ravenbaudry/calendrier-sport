import { useState } from 'react';

// Histogramme vertical en HTML (responsive sans calcul de dimensions).
// data : [{ key, label, value, detail }]
export default function BarChart({ data, formatValue = String, height = 160 }) {
  const [active, setActive] = useState(null);
  const max = Math.max(...data.map((d) => d.value), 1);
  const current = active != null ? data[active] : data.at(-1);

  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-3">
        <span className="min-w-0 text-xs text-zinc-500">{current?.label}</span>
        <span className="tabular shrink-0 text-right">
          <span className="block text-sm font-semibold text-zinc-100">{current ? formatValue(current.value) : '—'}</span>
          {current?.detail && <span className="block text-xs text-zinc-500">{current.detail}</span>}
        </span>
      </div>
      <div className="flex items-end gap-1 sm:gap-1.5" style={{ height }} onMouseLeave={() => setActive(null)}>
        {data.map((d, i) => {
          const isActive = i === (active ?? data.length - 1);
          return (
            <button
              key={d.key}
              type="button"
              className="group flex h-full flex-1 flex-col justify-end"
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onClick={() => setActive(i)}
              aria-label={`${d.label} : ${formatValue(d.value)}`}
            >
              <div
                className={`w-full rounded-t-md transition-colors ${
                  isActive ? 'bg-brand-500' : 'bg-zinc-700 group-hover:bg-zinc-600'
                }`}
                style={{ height: `${Math.max((d.value / max) * 100, d.value > 0 ? 3 : 1)}%` }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-zinc-500">
        <span>{data[0]?.shortLabel}</span>
        <span>{data.at(-1)?.shortLabel}</span>
      </div>
    </div>
  );
}

// Barres horizontales (répartition par groupe musculaire, etc.)
export function HorizontalBars({ data, formatValue = String }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <ul className="space-y-2.5">
      {data.map((d) => (
        <li key={d.label}>
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-zinc-300">{d.label}</span>
            <span className="tabular text-zinc-400">{formatValue(d.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-linear-to-r from-brand-600 to-brand-400"
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
