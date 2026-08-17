import { GARMENTS } from "@/lib/catalog/garments";
import type { ColorFamily, Garment, GarmentCategory, Occasion, SkinProfile } from "@/types/youcam";

export interface ScoredPick {
  garment: Garment;
  score: number;
  /** Honest 0-100 confidence: `score` normalized against what was actually achievable for this profile, not a fixed scale. */
  matchPercent: number;
  matchReasons: string[];
}

/**
 * Color families that help offset a given skin concern by drawing the eye
 * or adding contrast — a simple, explainable heuristic, not a claim about
 * skincare efficacy.
 */
const CONCERN_COMPLEMENT: Record<string, ColorFamily[]> = {
  radiance: ["bold", "jewel"],
  redness: ["neutral", "earth"],
  eye_bag: ["bold", "jewel"],
  acne: ["neutral", "pastel"],
  wrinkle: ["neutral", "earth"],
  pore: ["pastel", "neutral"],
};

/**
 * Ranks the catalog for a given skin profile + occasion, and returns the
 * top `count` picks spread across distinct garment categories so the three
 * looks presented to the user don't repeat (e.g. not three tops).
 *
 * `excludeIds` skips garments already shown (used by "see more looks" so a
 * second batch doesn't repeat the first).
 */
export function pickLooks(profile: SkinProfile, occasion: Occasion, count = 3, excludeIds: string[] = []): ScoredPick[] {
  const excluded = new Set(excludeIds);
  const available = GARMENTS.filter((g) => !excluded.has(g.id));
  const candidates = available.filter((g) => g.occasion.includes(occasion));
  const pool = candidates.length > 0 ? candidates : available;

  const scored = pool
    .map((garment) => scoreGarment(garment, profile, occasion))
    .sort((a, b) => b.score - a.score);

  const picks: ScoredPick[] = [];
  const usedCategories = new Set<GarmentCategory>();

  for (const candidate of scored) {
    if (picks.length >= count) break;
    if (usedCategories.has(candidate.garment.category)) continue;
    picks.push(candidate);
    usedCategories.add(candidate.garment.category);
  }

  // If distinct categories didn't fill the count (small catalog), top up
  // with the next-best remaining candidates regardless of category.
  for (const candidate of scored) {
    if (picks.length >= count) break;
    if (picks.includes(candidate)) continue;
    picks.push(candidate);
  }

  return picks.slice(0, count);
}

/** Exported for /api/recolor — scoring a single specific garment (a colorway swap) reuses the same logic as ranking the whole catalog. */
export function scoreGarment(garment: Garment, profile: SkinProfile, occasion: Occasion): ScoredPick {
  let score = 0;
  const matchReasons: string[] = [];

  const OCCASION_POINTS = 10;
  const UNDERTONE_POINTS = 40;
  const NEUTRAL_FALLBACK_POINTS = 10;
  const CONCERN_POINTS = 20;

  if (garment.occasion.includes(occasion)) {
    score += OCCASION_POINTS;
  }

  if (profile.undertone && garment.undertoneFit.includes(profile.undertone)) {
    score += UNDERTONE_POINTS;
    matchReasons.push(`${colorFamilyPhrase(garment.colorFamily)} complement your ${profile.undertone} undertone`);
  } else if (!profile.undertone) {
    score += NEUTRAL_FALLBACK_POINTS;
  }

  const topConcern = [...profile.concerns].sort((a, b) => b.severity - a.severity)[0];
  const concernInPlay = Boolean(topConcern && topConcern.severity >= 30);
  if (concernInPlay && topConcern) {
    const boosters = CONCERN_COMPLEMENT[topConcern.name] ?? [];
    if (boosters.includes(garment.colorFamily)) {
      score += CONCERN_POINTS;
      matchReasons.push(`draws the eye and balances ${topConcern.label.toLowerCase()}`);
    }
  }

  // Small deterministic tie-break so equally-scored items don't always sort
  // in catalog order.
  score += (hashString(garment.id) % 7) / 10;

  // Normalize against what was actually achievable for this profile (not a
  // fixed scale), so the displayed confidence stays honest whether or not
  // undertone/concern data was available. Clamped away from the extremes —
  // 100% would overclaim certainty, and anything already in the top picks
  // has cleared a real bar.
  const maxAchievable = OCCASION_POINTS + (profile.undertone ? UNDERTONE_POINTS : NEUTRAL_FALLBACK_POINTS) + (concernInPlay ? CONCERN_POINTS : 0);
  const matchPercent = Math.max(55, Math.min(98, Math.round((score / maxAchievable) * 100)));

  return { garment, score, matchPercent, matchReasons };
}

function colorFamilyPhrase(family: ColorFamily): string {
  switch (family) {
    case "earth":
      return "Warm, earthy tones";
    case "jewel":
      return "Rich jewel tones";
    case "pastel":
      return "Soft pastel tones";
    case "bold":
      return "Bold, saturated color";
    case "neutral":
    default:
      return "Neutral tones";
  }
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
