/**
 * Shared types for the Glow & Fit Concierge flow.
 *
 * SkinProfile deliberately stays generic rather than mirroring the raw
 * YouCam Skin AI payload field-for-field. That mapping happens once, in
 * lib/youcam/skinAnalysis.ts.
 *
 * Confirmed against a live account: the `skin-analysis` task's `dst_actions`
 * (redness, acne, eye_bag, radiance, wrinkle, pore, skin_type, ...) report
 * skin *condition*, not a color/undertone classification. Real tone/undertone
 * instead comes from the separate `skin-tone-analysis` task (see
 * lib/youcam/skinToneAnalysis.ts) — it returns a raw skin-color hex, which
 * we bucket ourselves via lib/agent/colorScience.ts. That task needs a
 * stricter forward-facing pose than skin-analysis/cloth do, so it soft-fails
 * to `undefined` rather than blocking the whole flow when it can't — the
 * style engine's undertone-based matching already degrades gracefully to
 * its concern-based matching alone in that case. `toneBucket`/`undertone`
 * stay optional here for that reason (real when available, mock-populated
 * in MOCK_YOUCAM mode either way).
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
  /** From the real `skin-tone-analysis` task (bucketed by us); undefined if that task couldn't run (e.g. non-forward-facing photo) or in MOCK_YOUCAM mode's absence. */
  toneBucket?: SkinToneBucket;
  /** From the real `skin-tone-analysis` task (bucketed by us); same caveats as toneBucket. */
  undertone?: Undertone;
  concerns: SkinConcern[];
  /** From the real `skin_type` dst_action, e.g. "Normal"/"Oily"/"Dry"/"Combination". */
  skinType?: string;
  /** From the real `face-attr-analysis` task; undefined if it couldn't run. */
  faceShape?: string;
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
  /**
   * Groups this garment with its same-cut, different-color siblings (e.g.
   * "sunset-silk-blouse" links the terracotta/navy/sage versions) so the UI
   * can offer a color-swatch picker that re-renders the SAME photo in a
   * different colorway. Undefined for garments with no color siblings.
   */
  colorwayGroup?: string;
  /** Which undertones this color family flatters. */
  undertoneFit: Undertone[];
  occasion: Occasion[];
  /** Local placeholder product image, also used as the VTO garment reference. */
  imageUrl: string;
  description: string;
}

export interface ColorwayRender {
  garment: Garment;
  renderedImageUrl: string;
}

export interface Look {
  garment: Garment;
  renderedImageUrl: string;
  rationale: string;
  matchReasons: string[];
  /** 0-100, honestly normalized against this profile — see lib/agent/styleEngine.ts. */
  matchPercent: number;
  /**
   * Every member of this garment's colorwayGroup (including itself),
   * pre-rendered on the same uploaded photo — so the color-swatch picker
   * shows real thumbnails of you in each color, not flat swatches, and
   * clicking one is an instant local swap (no further API call). Undefined
   * for garments with no colorway siblings. Costs one real Apparel VTO
   * render per sibling, upfront, whether or not the user ever picks it —
   * see the note in app/api/style/route.ts.
   */
  colorwayRenders?: ColorwayRender[];
}

/** Generic shape for a YouCam async task while it's in flight or done. */
export interface YouCamTaskStatus {
  taskId: string;
  status: "queued" | "running" | "success" | "error";
  resultUrl?: string;
  errorMessage?: string;
}
