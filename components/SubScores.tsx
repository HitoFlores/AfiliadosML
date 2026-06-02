import type { SubScore } from "@/lib/product";

interface SubScoresProps {
  subScores: SubScore[];
  scoreJustificacion?: string;
}

function barColor(score: number) {
  if (score >= 9) return "bg-green-500";
  if (score >= 7.5) return "bg-lime-500";
  if (score >= 6) return "bg-yellow-500";
  return "bg-orange-500";
}

/**
 * Desglose del score editorial por dimensión.
 * Solo se renderiza si el JSON trae sub_scores (schema v2).
 */
export default function SubScores({ subScores, scoreJustificacion }: SubScoresProps) {
  if (!subScores || subScores.length === 0) return null;

  return (
    <section className="my-10">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Cómo calificamos</h2>
      {scoreJustificacion && (
        <p className="text-gray-600 mb-5 text-sm leading-relaxed max-w-2xl">
          {scoreJustificacion}
        </p>
      )}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-5">
        {subScores.map((s) => (
          <div key={s.dimension}>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="font-semibold text-gray-800 text-sm">{s.dimension}</span>
              <span className="font-bold text-gray-900 tabular-nums">
                {s.score.toFixed(1)}
                <span className="text-gray-400 text-xs font-normal">/10</span>
              </span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${barColor(s.score)}`}
                style={{ width: `${Math.min(s.score * 10, 100)}%` }}
              />
            </div>
            {s.justificacion && (
              <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{s.justificacion}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
