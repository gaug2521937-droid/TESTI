"use client";

/**
 * Логотип GASHPROJECT — геометрическая монограмма «G»
 * из трёх слоёв: внешнее кольцо, разрыв-скол и центральное ядро.
 * Никаких эмодзи — чистый SVG, масштабируется без потерь.
 */
export function Logo({ size = 36, animated = true }: { size?: number; animated?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={animated ? "logo-mark" : ""}
    >
      <defs>
        <linearGradient id="lg-ring" x1="4" y1="4" x2="44" y2="44">
          <stop offset="0%" stopColor="#a68fff" />
          <stop offset="45%" stopColor="#7c5cff" />
          <stop offset="100%" stopColor="#4a2fc7" />
        </linearGradient>
        <linearGradient id="lg-core" x1="16" y1="14" x2="34" y2="34">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="60%" stopColor="#7c5cff" />
          <stop offset="100%" stopColor="#f043a0" />
        </linearGradient>
        <filter id="lg-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Внешний шестиугольник */}
      <path
        d="M24 3.2 42 13.6v20.8L24 44.8 6 34.4V13.6L24 3.2Z"
        stroke="url(#lg-ring)"
        strokeWidth="2.6"
        strokeLinejoin="round"
        fill="rgba(124,92,255,0.07)"
      />

      {/* Скол — характерная «G» */}
      <path
        d="M31.5 17.5a9.5 9.5 0 1 0 1.2 11.7h-8.2"
        stroke="url(#lg-core)"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        filter="url(#lg-glow)"
      />

      {/* Ядро */}
      <circle cx="24" cy="24" r="2.6" fill="#22d3ee" className="logo-core" />
    </svg>
  );
}

/** Полный логотип с текстом */
export function LogoFull({ size = 36 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <Logo size={size} />
      <div className="leading-none">
        <div className="text-[16px] font-black gradient-text tracking-[-0.04em]">GASHPROJECT</div>
        <div className="text-[8.5px] text-[#4a4a5e] tracking-[0.3em] font-bold mt-[3px]">
          HUB · 2026
        </div>
      </div>
    </div>
  );
}
