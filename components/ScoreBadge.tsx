"use client";

interface ScoreBadgeProps {
  score: number;
}

export default function ScoreBadge({ score }: ScoreBadgeProps) {
  const pct = score * 10;
  const radius = 28;
  const circ = 2 * Math.PI * radius;
  const dash = (pct / 100) * circ;

  const color =
    score >= 9 ? "#16a34a" : score >= 7 ? "#ca8a04" : "#dc2626";
  const bg =
    score >= 9 ? "#dcfce7" : score >= 7 ? "#fef9c3" : "#fee2e2";
  const label =
    score >= 9.5
      ? "Sobresaliente"
      : score >= 9
      ? "Excelente"
      : score >= 8
      ? "Muy Bueno"
      : score >= 7
      ? "Bueno"
      : "Regular";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-20 h-20">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 72 72">
          <circle
            cx="36"
            cy="36"
            r={radius}
            fill={bg}
            stroke="#e5e7eb"
            strokeWidth="6"
          />
          <circle
            cx="36"
            cy="36"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-black" style={{ color }}>
            {score}
          </span>
        </div>
      </div>
      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color }}>
        {label}
      </span>
    </div>
  );
}
