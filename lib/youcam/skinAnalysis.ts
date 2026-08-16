import AdmZip from "adm-zip";
import { MOCK_YOUCAM, createTask, pollTask, uploadFile, type UploadableFile } from "./client";
import { pickMockProfile } from "@/lib/mock/skinAnalysis.mock";
import type { SkinConcern, SkinProfile } from "@/types/youcam";

/**
 * Concern actions requested from the Skin AI task, as `dst_actions`.
 * Confirmed valid against a live account: redness, acne, eye_bag, radiance,
 * wrinkle, pore. ("dark_circle" is not a valid action name — "eye_bag" is
 * the closest available concern.) `texture`/`firmness`/`moisture`/`oiliness`
 * are also valid action names but returned `CreditInsufficiency` on this
 * account's plan, so they're left out.
 */
const CONCERN_ACTIONS = ["redness", "acne", "eye_bag", "radiance", "wrinkle", "pore"] as const;

/** A real (non-severity) categorical action: "Normal"/"Oily"/"Dry"/"Combination". */
const SKIN_TYPE_ACTION = "skin_type";

export async function runSkinAnalysis(photo: UploadableFile): Promise<SkinProfile> {
  const fileId = await uploadFile("skin-analysis", photo);

  const taskId = await createTask("skin-analysis", {
    src_file_id: fileId,
    // Requesting all 6 concern actions together is confirmed working and
    // affordable on a live account. Adding SKIN_TYPE_ACTION on top of that
    // hit CreditInsufficiency during testing — unclear whether skin_type
    // itself costs more or the account was just low by that point, but
    // either way it's dropped from the default request to conserve units.
    // mapRawResultToProfile still reads scoreInfo.skin_type if present, so
    // adding it back here is a one-line change once budget/behavior is
    // confirmed.
    dst_actions: [...CONCERN_ACTIONS],
  });

  // Observed >45s on a live account for a pathological (faceless) test
  // image before the API's own retry/DLQ logic gave up, so a generous
  // margin is used for real photos too.
  const polled = await pollTask("skin-analysis", taskId, { timeoutMs: 60_000 });
  if (process.env.YOUCAM_DEBUG === "1") {
    console.log("[skin-analysis raw poll result]", JSON.stringify(polled, null, 2));
  }

  if (MOCK_YOUCAM) {
    const seed = fileId.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return { ...pickMockProfile(seed), sourceFileId: fileId };
  }

  return mapRawResultToProfile(polled, fileId);
}

/**
 * Maps the raw YouCam skin-analysis task response into our internal
 * SkinProfile shape.
 *
 * Confirmed against a live account: on success, the poll response is
 * `{ status, data: { error: null, results: { url }, task_status: "success" } }`
 * where `results.url` is a presigned S3 URL to a ZIP archive (NOT inline
 * JSON) containing `skinanalysisResult/score_info.json` plus a per-concern
 * mask PNG for each requested action. `score_info.json` is keyed by action
 * name:
 *   - concern actions: `{ raw_score, ui_score, output_mask_name }`, where
 *     `ui_score` (0-100) is a HEALTH score — HIGHER means LESS of the
 *     concern — so our `SkinConcern.severity` ("higher = more pronounced")
 *     is `100 - ui_score`.
 *   - `skin_type`: `{ whole: { skin_type: "Normal" | ... }, t_zone: {...}, u_zone: {...} }`.
 *   - plus `all.score` (overall skin score) and `skin_age`, both unused here.
 * There is no tone/undertone field anywhere in this payload.
 */
async function mapRawResultToProfile(raw: any, fileId: string): Promise<SkinProfile> {
  const resultsUrl: string | undefined = raw?.data?.results?.url;
  if (!resultsUrl) {
    throw new Error("YouCam skin-analysis task succeeded but returned no results URL");
  }

  const scoreInfo = await downloadScoreInfo(resultsUrl);

  const concerns: SkinConcern[] = CONCERN_ACTIONS.map((name) => {
    const uiScore = scoreInfo?.[name]?.ui_score;
    const severity = typeof uiScore === "number" ? clampSeverity(100 - uiScore) : 30;
    return { name, label: labelFor(name), severity };
  });

  const skinType: string | undefined = scoreInfo?.skin_type?.whole?.skin_type;

  return {
    concerns,
    skinType,
    sourceFileId: fileId,
  };
}

/** Downloads the presigned results ZIP and parses out score_info.json. */
async function downloadScoreInfo(resultsUrl: string): Promise<any> {
  const zipResp = await fetch(resultsUrl);
  if (!zipResp.ok) {
    throw new Error(`Failed to download YouCam skin-analysis results archive (${zipResp.status})`);
  }
  const zipBuffer = Buffer.from(await zipResp.arrayBuffer());
  const zip = new AdmZip(zipBuffer);
  const scoreEntry = zip.getEntries().find((entry) => entry.entryName.endsWith("score_info.json"));
  if (!scoreEntry) {
    throw new Error("YouCam skin-analysis results archive did not contain score_info.json");
  }
  return JSON.parse(scoreEntry.getData().toString("utf8"));
}

function clampSeverity(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function labelFor(name: string): string {
  const labels: Record<string, string> = {
    redness: "Redness",
    acne: "Blemishes",
    eye_bag: "Eye Bags",
    radiance: "Radiance",
    wrinkle: "Fine Lines",
    pore: "Pores",
  };
  return labels[name] ?? name;
}
