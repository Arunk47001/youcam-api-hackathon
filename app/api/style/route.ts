import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pickLooks } from "@/lib/agent/styleEngine";
import { generateRationale } from "@/lib/agent/rationale";
import { runApparelVto } from "@/lib/youcam/apparelVto";
import { uploadFile, YouCamApiError } from "@/lib/youcam/client";
import { GARMENTS } from "@/lib/catalog/garments";
import type { ColorwayRender, Look, Occasion } from "@/types/youcam";

export const runtime = "nodejs";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const OCCASIONS: Occasion[] = ["work", "casual", "date-night", "event"];

const skinProfileSchema = z.object({
  // From the real skin-tone-analysis task (see lib/youcam/skinToneAnalysis.ts) when it succeeds; mock-populated otherwise.
  toneBucket: z.enum(["fair", "light", "medium", "tan", "deep"]).optional(),
  undertone: z.enum(["warm", "cool", "neutral"]).optional(),
  concerns: z.array(
    z.object({
      name: z.string(),
      label: z.string(),
      severity: z.number().min(0).max(100),
    })
  ),
  skinType: z.string().optional(),
  faceShape: z.string().optional(),
  annotatedImageUrl: z.string().optional(),
  sourceFileId: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const photo = form.get("photo");
    const occasionRaw = form.get("occasion");
    const profileRaw = form.get("profile");
    const excludeIdsRaw = form.get("excludeIds");

    if (!(photo instanceof Blob) || photo.size === 0) {
      return NextResponse.json({ error: "A photo file is required." }, { status: 400 });
    }
    if (photo.size > MAX_PHOTO_BYTES) {
      return NextResponse.json({ error: "Photo is too large (max 8MB)." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(photo.type)) {
      return NextResponse.json({ error: "Photo must be a JPEG, PNG, or WEBP image." }, { status: 400 });
    }

    if (typeof occasionRaw !== "string" || !OCCASIONS.includes(occasionRaw as Occasion)) {
      return NextResponse.json({ error: "A valid occasion is required." }, { status: 400 });
    }
    const occasion = occasionRaw as Occasion;

    if (typeof profileRaw !== "string") {
      return NextResponse.json({ error: "A skin profile is required." }, { status: 400 });
    }
    const parsedProfile = skinProfileSchema.safeParse(JSON.parse(profileRaw));
    if (!parsedProfile.success) {
      return NextResponse.json({ error: "Skin profile was malformed." }, { status: 400 });
    }
    const profile = parsedProfile.data;

    let excludeIds: string[] = [];
    if (typeof excludeIdsRaw === "string" && excludeIdsRaw.length > 0) {
      const parsedExclude = z.array(z.string()).safeParse(JSON.parse(excludeIdsRaw));
      if (parsedExclude.success) excludeIds = parsedExclude.data;
    }

    const buffer = Buffer.from(await photo.arrayBuffer());
    const fileName = photo instanceof File ? photo.name : "photo.jpg";
    const userFileId = await uploadFile("apparel-vto", { buffer, contentType: photo.type, fileName });

    const picks = pickLooks(profile, occasion, 3, excludeIds);

    const looks: Look[] = await Promise.all(
      picks.map(async ({ garment, matchReasons, matchPercent }) => {
        // If this garment has color siblings, pre-render every one of them
        // on the same photo too, so the color-swatch picker can show real
        // thumbnails and swap instantly with no further API call — at the
        // cost of one real Apparel VTO render per sibling, upfront, whether
        // or not the user ever picks it. Deliberate tradeoff, not an
        // oversight: the user explicitly asked for real rendered previews
        // over flat color swatches, accepting that cost.
        const siblings = garment.colorwayGroup
          ? GARMENTS.filter((g) => g.colorwayGroup === garment.colorwayGroup && g.id !== garment.id)
          : [];

        const [renderedImageUrl, rationale, siblingRenders] = await Promise.all([
          runApparelVto(userFileId, garment),
          generateRationale(profile, garment, matchReasons, occasion),
          Promise.all(
            siblings.map(async (sib): Promise<ColorwayRender> => ({
              garment: sib,
              renderedImageUrl: await runApparelVto(userFileId, sib),
            }))
          ),
        ]);

        const colorwayRenders: ColorwayRender[] | undefined = garment.colorwayGroup
          ? [{ garment, renderedImageUrl }, ...siblingRenders]
          : undefined;

        return { garment, renderedImageUrl, rationale, matchReasons, matchPercent, colorwayRenders };
      })
    );

    return NextResponse.json({ looks });
  } catch (err) {
    return handleError(err);
  }
}

function handleError(err: unknown) {
  if (err instanceof YouCamApiError) {
    console.error("[style] YouCam API error:", err.message, JSON.stringify(err.body, null, 2));
    return NextResponse.json({ error: err.message }, { status: err.status ?? 502 });
  }
  console.error("[style] Unexpected error:", err);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
