import type { SkinProfile } from "@/types/youcam";

/**
 * Canned Skin AI results used when MOCK_YOUCAM=1, so the full app flow can
 * be built and demoed before real API field names are confirmed. Picked
 * deterministically from the uploaded file's byte length so repeated runs
 * with the same photo are stable, but different photos vary the demo.
 */
const MOCK_PROFILES: Omit<SkinProfile, "sourceFileId">[] = [
  {
    // toneBucket/undertone are mock-only enrichments — the real Skin AI
    // skin-analysis task doesn't expose them (see types/youcam.ts).
    toneBucket: "tan",
    undertone: "warm",
    skinType: "Combination",
    concerns: [
      { name: "radiance", label: "Radiance", severity: 62 },
      { name: "eye_bag", label: "Eye Bags", severity: 41 },
      { name: "pore", label: "Pores", severity: 35 },
      { name: "redness", label: "Redness", severity: 18 },
    ],
  },
  {
    toneBucket: "fair",
    undertone: "cool",
    skinType: "Dry",
    concerns: [
      { name: "redness", label: "Redness", severity: 58 },
      { name: "wrinkle", label: "Fine Lines", severity: 33 },
      { name: "radiance", label: "Radiance", severity: 29 },
      { name: "acne", label: "Blemishes", severity: 15 },
    ],
  },
  {
    toneBucket: "medium",
    undertone: "neutral",
    skinType: "Normal",
    concerns: [
      { name: "acne", label: "Blemishes", severity: 47 },
      { name: "pore", label: "Pores", severity: 44 },
      { name: "radiance", label: "Radiance", severity: 40 },
      { name: "eye_bag", label: "Eye Bags", severity: 22 },
    ],
  },
];

export function pickMockProfile(seed: number): Omit<SkinProfile, "sourceFileId"> {
  const profile = MOCK_PROFILES[Math.abs(seed) % MOCK_PROFILES.length];
  return profile ?? MOCK_PROFILES[0]!;
}
