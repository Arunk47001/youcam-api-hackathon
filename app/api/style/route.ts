import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pickLooks } from "@/lib/agent/styleEngine";
import { generateRationale } from "@/lib/agent/rationale";
import { runApparelVto } from "@/lib/youcam/apparelVto";
import { uploadFile, YouCamApiError } from "@/lib/youcam/client";
import type { Look, Occasion } from "@/types/youcam";

export const runtime = "nodejs";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const OCCASIONS: Occasion[] = ["work", "casual", "date-night", "event"];

const skinProfileSchema = z.object({
  // Not exposed by the real Skin AI skin-analysis task; mock-only.
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
  annotatedImageUrl: z.string().optional(),
  sourceFileId: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const photo = form.get("photo");
    const occasionRaw = form.get("occasion");
    const profileRaw = form.get("profile");

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

    const buffer = Buffer.from(await photo.arrayBuffer());
    const fileName = photo instanceof File ? photo.name : "photo.jpg";
    const userFileId = await uploadFile("apparel-vto", { buffer, contentType: photo.type, fileName });

    const picks = pickLooks(profile, occasion, 3);

    const looks: Look[] = await Promise.all(
      picks.map(async ({ garment, matchReasons, matchPercent }) => {
        const [renderedImageUrl, rationale] = await Promise.all([
          runApparelVto(userFileId, garment),
          generateRationale(profile, garment, matchReasons, occasion),
        ]);
        return { garment, renderedImageUrl, rationale, matchReasons, matchPercent };
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
