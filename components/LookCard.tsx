import type { Look } from "@/types/youcam";

interface LookCardProps {
  look: Look;
}

function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function LookCard({ look }: LookCardProps) {
  const { garment, renderedImageUrl, rationale, matchReasons, matchPercent } = look;
  const reasons = matchReasons.length > 0 ? matchReasons : [rationale];

  return (
    <div className="flex flex-col border border-ink bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={renderedImageUrl} alt={`${garment.name} styled on you`} className="aspect-[3/4] w-full border-b border-ink object-cover" />

      <div className="flex flex-col gap-3 p-4">
        <div>
          <span className="text-xs font-extrabold tracking-wide text-accent">{matchPercent}% MATCH</span>
          <div className="mt-1 flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 border border-ink" style={{ backgroundColor: garment.hexSwatch }} aria-hidden />
            <h3 className="text-lg font-extrabold leading-tight text-ink">{garment.name}</h3>
          </div>
        </div>

        <div className="border-t border-ink/15 pt-3">
          <span className="text-xs uppercase tracking-wide text-muted">Why it works for you</span>
          <ol className="mt-2 flex flex-col gap-2">
            {reasons.map((reason, i) => (
              <li key={i} className="flex gap-2 text-xs leading-relaxed text-ink">
                <span className="shrink-0 font-extrabold text-accent">{String(i + 1).padStart(2, "0")}</span>
                <span>{sentenceCase(reason)}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
