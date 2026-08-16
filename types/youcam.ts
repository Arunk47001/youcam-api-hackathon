/**
 * Shared types for the Glow & Fit Concierge flow.
 *
 * SkinProfile deliberately stays generic rather than mirroring the raw
 * YouCam Skin AI payload field-for-field. That mapping happens once, in
 * lib/youcam/skinAnalysis.ts.
 *
 * Confirmed against a live account: the `skin-analysis` task's `dst_actions`
 * (redness, acne, eye_bag, radiance, wrinkle, pore, skin_type, ...) report
 * skin *condition*, not a color/undertone classification — there is no
 * tone/undertone field anywhere in the response. `toneBucket`/`undertone`
 * are kept optional here (populated by the mock profiles for a richer demo,
 * left undefined on real calls) so the style engine's undertone-based
 * matching degrades gracefully to its concern-based matching alone, which
 * is fully driven by real API data.
 */

export type SkinToneBucket = "fair" | "light" | "medium" | "tan" | "deep";

export type Undertone = "warm" | "cool" | "neutral";

export interface SkinConcern {
  /** Machine-readable key, e.g. "redness", "acne", "radiance". */
  name: string;
  /** Human-readable label, e.g. "Redness". */
  label: string;
  /** 0-100, higher = more pronounced. */
  severity: number;
}

export interface SkinProfile {
  /** Not exposed by the real Skin AI skin-analysis task; mock-only. */
  toneBucket?: SkinToneBucket;
  /** Not exposed by the real Skin AI skin-analysis task; mock-only. */
  undertone?: Undertone;
  concerns: SkinConcern[];
  /** From the real `skin_type` dst_action, e.g. "Normal"/"Oily"/"Dry"/"Combination". */
  skinType?: string;
  /** URL to an annotated/visualized result image, if YouCam returns one. */
  annotatedImageUrl?: string;
  /** The YouCam file_id the photo was uploaded as, for potential reuse. */
  sourceFileId: string;
}

export type GarmentCategory = "top" | "dress" | "outerwear";

export type ColorFamily = "earth" | "jewel" | "pastel" | "neutral" | "bold";

export type Occasion = "work" | "casual" | "date-night" | "event";

export interface Garment {
  id: string;
  name: string;
  category: GarmentCategory;
  colorFamily: ColorFamily;
  hexSwatch: string;
  /** Which undertones this color family flatters. */
  undertoneFit: Undertone[];
  occasion: Occasion[];
  /** Local placeholder product image, also used as the VTO garment reference. */
  imageUrl: string;
  description: string;
}

export interface Look {
  garment: Garment;
  renderedImageUrl: string;
  rationale: string;
  matchReasons: string[];
  /** 0-100, honestly normalized against this profile — see lib/agent/styleEngine.ts. */
  matchPercent: number;
}

/** Generic shape for a YouCam async task while it's in flight or done. */
export interface YouCamTaskStatus {
  taskId: string;
  status: "queued" | "running" | "success" | "error";
  resultUrl?: string;
  errorMessage?: string;
}
