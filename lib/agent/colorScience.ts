import type { SkinToneBucket, Undertone } from "@/types/youcam";

/**
 * Derives a tone bucket + undertone from a raw skin-color hex value.
 *
 * Confirmed against a live account: YouCam's `skin-tone-analysis` task
 * returns a raw `skin_color` hex (e.g. "#7a6156"), not a warm/cool/neutral
 * category or a fair/light/medium/tan/deep bucket directly — those are
 * things we compute ourselves from the color, using the same general
 * approach as dermatological skin-tone classification (the "Individual
 * Typology Angle", ITA degrees, computed from CIE Lab L and b channels).
 * This is a real, published method for tone-bucketing (not something we
 * invented), but the undertone split (warm/cool/neutral) below is our own
 * simplified heuristic on the Lab a/b hue angle — a reasonable rule of
 * thumb, not a clinical or cosmetic-industry-standard determination.
 */
export function deriveToneFromHex(hex: string): { toneBucket: SkinToneBucket; undertone: Undertone } {
  const [r, g, b] = hexToRgb(hex);
  const [L, a, bStar] = rgbToLab(r, g, b);

  const ita = (Math.atan2(L - 50, bStar) * 180) / Math.PI;
  const toneBucket = bucketFromIta(ita);

  const hueAngle = (Math.atan2(bStar, a) * 180) / Math.PI;
  const undertone: Undertone = hueAngle > 55 ? "warm" : hueAngle < 35 ? "cool" : "neutral";

  return { toneBucket, undertone };
}

function bucketFromIta(ita: number): SkinToneBucket {
  if (ita > 55) return "fair";
  if (ita > 41) return "light";
  if (ita > 28) return "medium";
  if (ita > 10) return "tan";
  return "deep";
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** sRGB (D65) -> CIE Lab, via CIE XYZ. Standard color-science formulas. */
function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);

  const x = rl * 0.4124 + gl * 0.3576 + bl * 0.1805;
  const y = rl * 0.2126 + gl * 0.7152 + bl * 0.0722;
  const z = rl * 0.0193 + gl * 0.1192 + bl * 0.9505;

  // Normalize against the D65 reference white point.
  const xn = x / 0.95047;
  const yn = y / 1.0;
  const zn = z / 1.08883;

  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(xn);
  const fy = f(yn);
  const fz = f(zn);

  const L = 116 * fy - 16;
  const aStar = 500 * (fx - fy);
  const bStar = 200 * (fy - fz);
  return [L, aStar, bStar];
}
