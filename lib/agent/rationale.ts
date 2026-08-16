import type { Garment, Occasion, SkinProfile } from "@/types/youcam";

/**
 * Turns a scored garment pick into a short, plain-language explanation.
 * Uses Claude if ANTHROPIC_API_KEY is set for a more natural voice; falls
 * back to a templated sentence otherwise so the app fully works with only
 * a YouCam key.
 */
export async function generateRationale(
  profile: SkinProfile,
  garment: Garment,
  matchReasons: string[],
  occasion: Occasion
): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await generateWithClaude(profile, garment, matchReasons, occasion);
    } catch (err) {
      console.error("Claude rationale generation failed, falling back to template:", err);
    }
  }
  return templatedRationale(garment, matchReasons, occasion);
}

function templatedRationale(garment: Garment, matchReasons: string[], occasion: Occasion): string {
  const reasonClause = matchReasons.length > 0 ? matchReasons.join(", and ") : "a versatile fit for your look";
  return `The ${garment.name.toLowerCase()} is a strong pick for ${occasionPhrase(occasion)} — ${reasonClause}.`;
}

function occasionPhrase(occasion: Occasion): string {
  switch (occasion) {
    case "work":
      return "a work day";
    case "casual":
      return "everyday casual wear";
    case "date-night":
      return "date night";
    case "event":
      return "a special event";
    default:
      return "this occasion";
  }
}

async function generateWithClaude(
  profile: SkinProfile,
  garment: Garment,
  matchReasons: string[],
  occasion: Occasion
): Promise<string> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();

  const topConcern = [...profile.concerns].sort((a, b) => b.severity - a.severity)[0];

  const prompt = [
    "You are a friendly personal stylist writing a one-sentence recommendation.",
    `Skin profile: skin type=${profile.skinType ?? "unspecified"}, tone=${profile.toneBucket ?? "unspecified"}, undertone=${profile.undertone ?? "unspecified"}, top concern=${topConcern?.label ?? "none"}.`,
    `Occasion: ${occasion}.`,
    `Garment: ${garment.name} (${garment.colorFamily} color family, ${garment.category}).`,
    `Style-engine match reasons: ${matchReasons.join("; ") || "general versatility"}.`,
    "Write ONE short, warm, confident sentence (max 30 words) explaining why this garment works for this person, referencing whichever of those skin details are specified (skip any marked 'unspecified') and the occasion. No hashtags, no emoji, no preamble.",
  ].join("\n");

  const response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 100,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((block): block is { type: "text"; text: string } => block.type === "text")
    .map((block) => block.text)
    .join(" ")
    .trim();

  return text || templatedRationale(garment, matchReasons, occasion);
}
