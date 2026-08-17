import { createTask, pollTask, YouCamApiError } from "./client";
import { deriveToneFromHex } from "@/lib/agent/colorScience";
import type { SkinToneBucket, Undertone } from "@/types/youcam";

export interface ToneResult {
  toneBucket: SkinToneBucket;
  undertone: Undertone;
}

/**
 * Runs the real `skin-tone-analysis` task and derives a tone bucket +
 * undertone from its raw skin-color hex (see lib/agent/colorScience.ts).
 *
 * Confirmed against a live account: this task needs a more strictly
 * forward-facing photo than skin-analysis/cloth do — a photo that works
 * fine for the main skin-concern analysis can still fail here with
 * `error_face_not_forward_facing`. That's treated as a soft failure: this
 * is an enrichment, not core functionality, so a failure here returns
 * `null` rather than failing the whole /api/analyze call — the app already
 * works fully without it (mock-only tone/undertone, same as before this
 * was added).
 */
export async function runSkinToneAnalysis(fileId: string): Promise<ToneResult | null> {
  try {
    const taskId = await createTask("skin-tone-analysis", { src_file_id: fileId });
    const polled = await pollTask("skin-tone-analysis", taskId, { timeoutMs: 45_000 });
    const skinColorHex: string | undefined = polled?.data?.results?.color?.skin_color;
    if (!skinColorHex) return null;
    return deriveToneFromHex(skinColorHex);
  } catch (err) {
    if (err instanceof YouCamApiError) {
      console.error("[skin-tone-analysis] soft-failed, continuing without real tone data:", err.message);
      return null;
    }
    throw err;
  }
}
