import { useEffect, useMemo, useRef, useState } from 'react';

const H = 220;
const PAD = { top: 12, right: 12, bottom: 26, left: 40 };

// Courbe de progression en SVG. points : [{ key, x: label, y: number }]
// Le viewBox suit la largeur réelle du conteneur : textes et traits gardent une taille constante.
export default function LineChart({ points, formatValue = String, formatLabel = String }) {
  const [active, setActive] = useState(null);
  const containerRef = useRef(null);
  const [W, setWidth] = useState(640);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const geometry = useMemo(() => {
    if (points.length === 0) return null;
    const ys = points.map((p) => p.y);
    let min = Math.min(...ys);
    let max = Math.max(...ys);
    if (min === max) {
      min -= 5;
      max += 5;
    }
    const margin = (max - min) * 0.1;
    min = Math.max(0, min - margin);
    max += margin;

    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const x = (i) => PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const y = (v) => PAD.top + innerH - ((v - min) / (max - min)) * innerH;
    const ticks = Array.from({ length: 4 }, (_, i) => min + ((max - min) * i) / 3);

    const coords = points.map((p, i) => [x(i), y(p.y)]);
    const line = coords.map(([cx, cy], i) => `${i ? 'L' : 'M'}${cx},${cy}`).join(' ');
    const area = `${line} L${coords.at(-1)[0]},${PAD.top + innerH} L${coords[0][0]},${PAD.top + innerH} Z`;
    return { coords, line, area, ticks, y };
  }, [points, W]);

  if (!geometry) return <div ref={containerRef} />;

  const current = points[active ?? points.length - 1];
  const [cx, cy] = geometry.coords[active ?? points.length - 1];

  // Sélection du point le plus proche du pointeur
  const onPointer = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    geometry.coords.forEach(([x], i) => {
      if (Math.abs(x - px) < Math.abs(geometry.coords[best][0] - px)) best = i;
    });
    setActive(best);
  };

  return (
    <div ref={containerRef}>
      <div className="mb-2 flex items-baseline justify-between text-sm">
        <span className="text-zinc-500">{formatLabel(current.x)}</span>
        <span className="tabular font-semibold text-zinc-100">{formatValue(current.y)}</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none"
        role="img"
        aria-label="Courbe de progression"
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={() => setActive(null)}
      >
        <defs>
          <linearGradient id="line-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {geometry.ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={geometry.y(tick)}
              y2={geometry.y(tick)}
              stroke="var(--color-zinc-800)"
              strokeDasharray="4 4"
            />
            <text x={PAD.left - 8} y={geometry.y(tick) + 4} textAnchor="end" fontSize="11" fill="var(--color-zinc-500)">
              {Math.round(tick)}
            </text>
          </g>
        ))}

        <path d={geometry.area} fill="url(#line-area)" />
        <path d={geometry.line} fill="none" stroke="var(--color-brand-500)" strokeWidth="2.5" strokeLinejoin="round" />
        {geometry.coords.length <= 40 &&
          geometry.coords.map(([x, y], i) => (
            <circle key={points[i].key} cx={x} cy={y} r="3.5" fill="var(--color-zinc-950)" stroke="var(--color-brand-500)" strokeWidth="2" />
          ))}

        <line x1={cx} x2={cx} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--color-zinc-600)" />
        <circle cx={cx} cy={cy} r="6" fill="var(--color-brand-500)" stroke="white" strokeWidth="2" />

        <text x={PAD.left} y={H - 8} fontSize="11" fill="var(--color-zinc-500)">
          {formatLabel(points[0].x)}
        </text>
        <text x={W - PAD.right} y={H - 8} fontSize="11" textAnchor="end" fill="var(--color-zinc-500)">
          {formatLabel(points.at(-1).x)}
        </text>
      </svg>
    </div>
  );
}
