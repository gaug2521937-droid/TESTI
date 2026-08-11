"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface PricePoint {
  t: number;
  p: number;
}

export function formatPrice(v: number): string {
  if (!isFinite(v)) return "—";
  if (v >= 1000) return v.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
  if (v >= 1) return v.toFixed(2);
  if (v >= 0.01) return v.toFixed(4);
  return v.toFixed(6);
}

export function formatCompact(v: number): string {
  if (!isFinite(v)) return "—";
  if (v >= 1e12) return (v / 1e12).toFixed(2) + " трлн";
  if (v >= 1e9) return (v / 1e9).toFixed(2) + " млрд";
  if (v >= 1e6) return (v / 1e6).toFixed(2) + " млн";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + " тыс";
  return v.toFixed(2);
}

// Плавная кривая через точки (Catmull-Rom → Безье)
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

interface Props {
  points: PricePoint[];
  positive: boolean;
  height?: number;
  rangeKey?: string;
  loading?: boolean;
}

export function CryptoChart({ points, positive, height = 320, rangeKey = "7d", loading }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const [animKey, setAnimKey] = useState(0);

  // Адаптивная ширина
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    ro.observe(el);
    setWidth(el.clientWidth || 800);
    return () => ro.disconnect();
  }, []);

  // Перезапуск анимации при смене данных
  useEffect(() => {
    setAnimKey((k) => k + 1);
    setHover(null);
  }, [points, rangeKey]);

  const padL = 8;
  const padR = 62;
  const padT = 18;
  const padB = 26;

  const geometry = useMemo(() => {
    if (points.length < 2) return null;
    const values = points.map((p) => p.p);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const span = rawMax - rawMin || rawMax * 0.02 || 1;
    const min = rawMin - span * 0.12;
    const max = rawMax + span * 0.12;

    const innerW = Math.max(width - padL - padR, 10);
    const innerH = Math.max(height - padT - padB, 10);

    const xy = points.map((pt, i) => ({
      x: padL + (i / (points.length - 1)) * innerW,
      y: padT + innerH - ((pt.p - min) / (max - min)) * innerH,
    }));

    // Горизонтальные линии сетки
    const gridCount = 5;
    const grid = Array.from({ length: gridCount }, (_, i) => {
      const ratio = i / (gridCount - 1);
      return {
        y: padT + innerH * ratio,
        value: max - (max - min) * ratio,
      };
    });

    // Метки времени
    const labelCount = width < 480 ? 3 : width < 800 ? 5 : 7;
    const ticks = Array.from({ length: labelCount }, (_, i) => {
      const idx = Math.round((i / (labelCount - 1)) * (points.length - 1));
      return { x: xy[idx].x, t: points[idx].t };
    });

    return { xy, min, max, innerH, innerW, grid, ticks, rawMin, rawMax };
  }, [points, width, height]);

  const stroke = positive ? "#00e0a4" : "#ff5470";
  const gradId = positive ? "gradUp" : "gradDown";

  const formatTick = (t: number) => {
    const d = new Date(t);
    if (rangeKey === "1d") return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    if (rangeKey === "1y") return d.toLocaleDateString("ru-RU", { month: "short", year: "2-digit" });
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  };

  const handleMove = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
    if (!geometry) return;
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
    const relX = clientX - rect.left;
    const ratio = Math.min(Math.max((relX - padL) / geometry.innerW, 0), 1);
    const i = Math.round(ratio * (points.length - 1));
    const pt = geometry.xy[i];
    if (pt) setHover({ i, x: pt.x, y: pt.y });
  };

  if (loading) {
    return (
      <div ref={wrapRef} className="chart-wrap" style={{ height }}>
        <div className="skeleton w-full h-full !rounded-2xl" />
      </div>
    );
  }

  if (!geometry) {
    return (
      <div
        ref={wrapRef}
        className="chart-wrap flex items-center justify-center text-[#6a6a7a] text-sm"
        style={{ height }}
      >
        Недостаточно данных для построения графика
      </div>
    );
  }

  const linePath = smoothPath(geometry.xy);
  const areaPath = `${linePath} L ${geometry.xy[geometry.xy.length - 1].x.toFixed(2)} ${(height - padB).toFixed(2)} L ${geometry.xy[0].x.toFixed(2)} ${(height - padB).toFixed(2)} Z`;

  const hoverPoint = hover ? points[hover.i] : null;
  const lastPoint = geometry.xy[geometry.xy.length - 1];

  // Позиция тултипа
  const tipLeft = hover ? Math.min(Math.max(hover.x - 60, 4), width - 150) : 0;

  return (
    <div ref={wrapRef} className="chart-wrap" style={{ height }}>
      <svg
        width={width}
        height={height}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        onTouchStart={handleMove}
        onTouchMove={handleMove}
        onTouchEnd={() => setHover(null)}
        style={{ display: "block", cursor: "crosshair", touchAction: "pan-y" }}
      >
        <defs>
          <linearGradient id="gradUp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00e0a4" stopOpacity="0.38" />
            <stop offset="55%" stopColor="#00e0a4" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#00e0a4" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradDown" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff5470" stopOpacity="0.35" />
            <stop offset="55%" stopColor="#ff5470" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#ff5470" stopOpacity="0" />
          </linearGradient>
          <filter id="glowLine" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Сетка + подписи цен */}
        {geometry.grid.map((g, i) => (
          <g key={i}>
            <line
              x1={padL}
              y1={g.y}
              x2={width - padR + 6}
              y2={g.y}
              stroke="rgba(255,255,255,0.055)"
              strokeWidth={1}
              strokeDasharray={i === geometry.grid.length - 1 ? "0" : "3 5"}
            />
            <text
              x={width - padR + 12}
              y={g.y + 3.5}
              fill="#6a6a7a"
              fontSize="10.5"
              fontWeight="600"
            >
              {formatPrice(g.value)}
            </text>
          </g>
        ))}

        {/* Метки времени */}
        {geometry.ticks.map((tk, i) => (
          <text
            key={i}
            x={tk.x}
            y={height - 7}
            fill="#5a5a6a"
            fontSize="10"
            fontWeight="600"
            textAnchor={i === 0 ? "start" : i === geometry.ticks.length - 1 ? "end" : "middle"}
          >
            {formatTick(tk.t)}
          </text>
        ))}

        {/* Заливка */}
        <path key={`a${animKey}`} d={areaPath} fill={`url(#${gradId})`} className="animate-fade" />

        {/* Линия */}
        <path
          key={`l${animKey}`}
          d={linePath}
          fill="none"
          stroke={stroke}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#glowLine)"
          strokeDasharray="2400"
          className="chart-line"
        />

        {/* Последняя точка */}
        <circle cx={lastPoint.x} cy={lastPoint.y} r={9} fill={stroke} opacity={0.16}>
          <animate attributeName="r" values="6;13;6" dur="2.2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.28;0;0.28" dur="2.2s" repeatCount="indefinite" />
        </circle>
        <circle cx={lastPoint.x} cy={lastPoint.y} r={3.6} fill={stroke} stroke="#12121a" strokeWidth={1.6} />

        {/* Курсор */}
        {hover && (
          <g>
            <line
              x1={hover.x}
              y1={padT - 6}
              x2={hover.x}
              y2={height - padB}
              stroke="rgba(255,255,255,0.28)"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <circle cx={hover.x} cy={hover.y} r={7} fill={stroke} opacity={0.22} />
            <circle cx={hover.x} cy={hover.y} r={4} fill="#fff" stroke={stroke} strokeWidth={2.2} />
          </g>
        )}
      </svg>

      {/* Тултип */}
      {hover && hoverPoint && (
        <div className="chart-tip" style={{ left: tipLeft, top: Math.max(hover.y - 62, 2) }}>
          <div className="font-extrabold text-[13px]" style={{ color: stroke }}>
            ${formatPrice(hoverPoint.p)}
          </div>
          <div className="text-[10.5px] text-[#8a8a99] mt-0.5">
            {new Date(hoverPoint.t).toLocaleString("ru-RU", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** Мини-график для карточек монет */
export function Sparkline({
  data,
  positive,
  width = 110,
  height = 34,
}: {
  data: number[];
  positive: boolean;
  width?: number;
  height?: number;
}) {
  if (!data || data.length < 2) {
    return <div style={{ width, height }} className="opacity-25 flex items-center text-[10px] text-[#6a6a7a]">—</div>;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - ((v - min) / span) * (height - 4) - 2,
  }));
  const d = smoothPath(pts);
  const color = positive ? "#00e0a4" : "#ff5470";
  const id = `spark-${positive ? "up" : "down"}`;

  return (
    <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L ${width} ${height} L 0 ${height} Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={2.4} fill={color} />
    </svg>
  );
}
