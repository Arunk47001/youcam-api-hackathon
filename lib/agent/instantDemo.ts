import { pickMockProfile } from "@/lib/mock/skinAnalysis.mock";
import { mockApparelVtoResult } from "@/lib/mock/apparelVto.mock";
import { pickLooks } from "@/lib/agent/styleEngine";
import { templatedRationale } from "@/lib/agent/rationale";
import { GARMENTS } from "@/lib/catalog/garments";
import type { ColorwayRender, Look, Occasion, SkinProfile } from "@/types/youcam";

export interface InstantDemo {
  profile: SkinProfile;
  looks: Look[];
}

/**
 * Builds a full "results" state entirely client-side — no network call, no
 * real or synthetic photo of a person. Backs the landing page's "See an
 * example" shortcut so a visitor can see the full experience before
 * uploading their own photo, without needing any sample photography (which
 * would carry its own likeness/rights questions — see HeroGraphic.tsx for
 * the same reasoning). Deterministic per occasion, so the same example
 * looks the same across visits.
 *
 * Also populates `colorwayRenders` for garments with color siblings, same
 * shape as the real /api/style response (see the note there) — free here
 * since it's all mock data, so the swatch-thumbnail picker works in example
 * mode too.
 */
export function buildInstantDemo(occasion: Occasion): InstantDemo {
  const seed = occasion.length + occasion.charCodeAt(0);
  const profile: SkinProfile = { ...pickMockProfile(seed), sourceFileId: "example" };

  const picks = pickLooks(profile, occasion, 3);
  const looks: Look[] = picks.map(({ garment, matchReasons, matchPercent }) => {
    const colorwayRenders: ColorwayRender[] | undefined = garment.colorwayGroup
      ? GARMENTS.filter((g) => g.colorwayGroup === garment.colorwayGroup).map((g) => ({
          garment: g,
          renderedImageUrl: mockApparelVtoResult(g),
        }))
      : undefined;

    return {
      garment,
      renderedImageUrl: mockApparelVtoResult(garment),
      rationale: templatedRationale(garment, matchReasons, occasion),
      matchReasons,
      matchPercent,
      colorwayRenders,
    };
  });

  return { profile, looks };
}
