import { NextRequest, NextResponse } from "next/server";
import { runSkinAnalysis } from "@/lib/youcam/skinAnalysis";
import { YouCamApiError } from "@/lib/youcam/client";

export const runtime = "nodejs";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const photo = form.get("photo");
    const consent = form.get("consent");

    if (consent !== "true") {
      return NextResponse.json({ error: "Consent to analyze the photo is required." }, { status: 400 });
    }

    if (!(photo instanceof Blob)) {
      return NextResponse.json({ error: "A photo file is required." }, { status: 400 });
    }
    if (photo.size === 0) {
      return NextResponse.json({ error: "The uploaded photo appears to be empty." }, { status: 400 });
    }
    if (photo.size > MAX_PHOTO_BYTES) {
      return NextResponse.json({ error: "Photo is too large (max 8MB)." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(photo.type)) {
      return NextResponse.json({ error: "Photo must be a JPEG, PNG, or WEBP image." }, { status: 400 });
    }

    const buffer = Buffer.from(await photo.arrayBuffer());
    const fileName = photo instanceof File ? photo.name : "photo.jpg";

    const profile = await runSkinAnalysis({ buffer, contentType: photo.type, fileName });

    return NextResponse.json({ profile });
  } catch (err) {
    return handleError(err, "analyze");
  }
}

function handleError(err: unknown, stage: string) {
  if (err instanceof YouCamApiError) {
    console.error(`[${stage}] YouCam API error:`, err.message, JSON.stringify(err.body, null, 2));
    return NextResponse.json({ error: err.message }, { status: err.status ?? 502 });
  }
  console.error(`[${stage}] Unexpected error:`, err);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
