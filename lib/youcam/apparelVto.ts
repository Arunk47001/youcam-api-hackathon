import { readFile } from "node:fs/promises";
import path from "node:path";
import { MOCK_YOUCAM, createTask, pollTask, uploadFile, type UploadableFile } from "./client";
import { mockApparelVtoResult } from "@/lib/mock/apparelVto.mock";
import type { Garment, GarmentCategory } from "@/types/youcam";

// Garment reference images rarely change across requests, so cache their
// uploaded file_id in-process for the life of the server instead of
// re-uploading the same swatch on every look generated.
const garmentFileIdCache = new Map<string, string>();

/**
 * Confirmed against a live account: the real task/param names are
 * `src_file_id` (person photo), `ref_file_id` (garment reference), and
 * `garment_category` from a closed enum. Only "upper_body"/"full_body"/
 * "lower_body" are confirmed valid — "dress"/"outerwear"/"one_piece" all
 * reject with `garment_category is not one of the accepted values.`.
 * "outerwear" has no confirmed dedicated value, so it's mapped to
 * "upper_body" (same region a top occupies) as a reasonable best guess.
 */
const GARMENT_CATEGORY_MAP: Record<GarmentCategory, string> = {
  top: "upper_body",
  dress: "full_body",
  outerwear: "upper_body", // best guess — not confirmed against a live account
};

function contentTypeFor(imageUrl: string): string {
  if (imageUrl.endsWith(".png")) return "image/png";
  if (imageUrl.endsWith(".jpg") || imageUrl.endsWith(".jpeg")) return "image/jpeg";
  if (imageUrl.endsWith(".webp")) return "image/webp";
  // SVG placeholders (see lib/catalog/garments.ts) are fine for MOCK_YOUCAM
  // demos but are NOT confirmed to be an accepted upload format for real
  // calls, and even if accepted, a flat silhouette reads as "not a garment"
  // to the generative model (confirmed: a solid-color swatch produced
  // error_editing_failed / "Output too similar to source"). Swap catalog
  // images for real JPEG/PNG product photography before a real demo.
  return "image/svg+xml";
}

async function garmentFileId(garment: Garment): Promise<string> {
  const cached = garmentFileIdCache.get(garment.id);
  if (cached) return cached;

  const filePath = path.join(process.cwd(), "public", garment.imageUrl.replace(/^\//, ""));
  const buffer = await readFile(filePath);
  const file: UploadableFile = {
    buffer,
    contentType: contentTypeFor(garment.imageUrl),
    fileName: path.basename(garment.imageUrl),
  };
  const fileId = await uploadFile("apparel-vto", file);
  garmentFileIdCache.set(garment.id, fileId);
  return fileId;
}

/**
 * Runs the generative Apparel VTO ("cloth") task for one garment against
 * the user's uploaded photo, returning a URL to the rendered result.
 */
export async function runApparelVto(userFileId: string, garment: Garment): Promise<string> {
  if (MOCK_YOUCAM) {
    return mockApparelVtoResult(garment);
  }

  const garmentId = await garmentFileId(garment);

  const taskId = await createTask("apparel-vto", {
    src_file_id: userFileId,
    ref_file_id: garmentId,
    garment_category: GARMENT_CATEGORY_MAP[garment.category],
  });

  // Generative rendering tends to run longer than skin analysis.
  const raw = await pollTask("apparel-vto", taskId, { timeoutMs: 90_000 });
  if (process.env.YOUCAM_DEBUG === "1") {
    console.log("[apparel-vto raw poll result]", JSON.stringify(raw, null, 2));
  }

  // Confirmed against a live account: unlike skin-analysis (a ZIP archive),
  // a successful cloth task's `results.url` is a direct rendered JPEG URL.
  const resultUrl: string | undefined = raw?.data?.results?.url;

  if (!resultUrl) {
    throw new Error(`Apparel VTO task ${taskId} succeeded but returned no result URL`);
  }
  return resultUrl;
}
