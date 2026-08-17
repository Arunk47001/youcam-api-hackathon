import { createTask, pollTask, YouCamApiError } from "./client";

/**
 * Runs the real `face-attr-analysis` task and returns just the face shape.
 *
 * Confirmed against a live account: `features` accepts `age`/`gender` too,
 * but this app deliberately only requests `faceShape` — an AI-inferred age
 * or gender guess is the kind of thing that feels invasive or awkward when
 * shown to a user (more so when it's wrong), and neither is needed for
 * styling, so there's no reason to request or store them.
 *
 * Same soft-failure pattern as skin-tone-analysis: this task needs a
 * strictly forward-facing photo, so a pose that works for skin-analysis/
 * cloth can still fail here. This is an enrichment, not core functionality
 * — a failure returns `null` rather than failing the whole analyze call.
 */
export async function runFaceAttrAnalysis(fileId: string): Promise<string | null> {
  try {
    const taskId = await createTask("face-attr-analysis", { src_file_id: fileId, features: ["faceShape"] });
    const polled = await pollTask("face-attr-analysis", taskId, { timeoutMs: 45_000 });
    const faceShape: string | undefined = polled?.data?.results?.faceshape;
    return faceShape ?? null;
  } catch (err) {
    if (err instanceof YouCamApiError) {
      console.error("[face-attr-analysis] soft-failed, continuing without face shape:", err.message);
      return null;
    }
    throw err;
  }
}
