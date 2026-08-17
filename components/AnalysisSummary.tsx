import type { SkinProfile } from "@/types/youcam";

interface AnalysisSummaryProps {
  profile: SkinProfile;
}

interface Cell {
  label: string;
  value: string;
  sub?: string;
}

export default function AnalysisSummary({ profile }: AnalysisSummaryProps) {
  const sortedConcerns = [...profile.concerns].sort((a, b) => b.severity - a.severity);
  const topConcern = sortedConcerns[0];

  const cells: Cell[] = [];
  if (profile.skinType) {
    cells.push({ label: "Skin Type", value: profile.skinType });
  }
  if (topConcern) {
    cells.push({ label: "Top Concern", value: topConcern.label, sub: `${topConcern.severity} / 100` });
  }
  if (profile.toneBucket) {
    cells.push({
      label: "Tone",
      value: profile.toneBucket,
      sub: profile.undertone ? `${profile.undertone} undertone` : undefined,
    });
  }
  if (profile.faceShape) {
    cells.push({ label: "Face Shape", value: profile.faceShape });
  }

  return (
    <div className="border border-ink bg-panel">
      <div className="border-b border-ink px-5 py-3">
        <span className="text-xs font-extrabold uppercase tracking-wide text-accent">Your Skin AI Snapshot</span>
      </div>

      {cells.length > 0 && (
        <div
          className={`grid grid-cols-1 divide-y divide-ink border-b border-ink sm:divide-y-0 sm:divide-x sm:border-b-0 ${
            cells.length === 2 ? "sm:grid-cols-2" : cells.length >= 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"
          }`}
        >
          {cells.map((cell) => (
            <div key={cell.label} className="p-5">
              <span className="text-xs uppercase tracking-wide text-muted">{cell.label}</span>
              <p className="mt-1 text-xl font-extrabold capitalize text-ink">{cell.value}</p>
              {cell.sub && <p className="mt-0.5 text-xs text-muted">{cell.sub}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 p-5">
        {sortedConcerns.map((concern) => (
          <div key={concern.name} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-xs uppercase tracking-wide text-muted">{concern.label}</span>
            <div className="h-1.5 flex-1 bg-white">
              <div className="h-full bg-accent" style={{ width: `${concern.severity}%` }} />
            </div>
            <span className="w-8 shrink-0 text-right text-xs font-bold text-ink">{concern.severity}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
