import type { Garment } from "@/types/youcam";

/**
 * When MOCK_YOUCAM=1 we don't have a real generative render, so we just
 * hand back the garment's own placeholder image — enough to build/demo the
 * "3 looks" grid UI. Swap MOCK_YOUCAM=0 with real credentials to see actual
 * on-model renders from the Apparel VTO API.
 */
export function mockApparelVtoResult(garment: Garment): string {
  return garment.imageUrl;
}
