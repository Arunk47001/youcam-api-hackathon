"use client";

import { useState } from "react";
import PhotoUploader from "@/components/PhotoUploader";
import QuestionnaireForm from "@/components/QuestionnaireForm";
import ConsentNote from "@/components/ConsentNote";
import LoadingState from "@/components/LoadingState";
import AnalysisSummary from "@/components/AnalysisSummary";
import LookCard from "@/components/LookCard";
import HeroGraphic from "@/components/HeroGraphic";
import TrustStats from "@/components/TrustStats";
import { buildInstantDemo } from "@/lib/agent/instantDemo";
import type { Look, Occasion, SkinProfile } from "@/types/youcam";

type Stage = "collecting" | "analyzing" | "styling" | "done" | "error";

const STEP_LABEL: Record<Stage, string> = {
  collecting: "Step 1 of 2",
  error: "Step 1 of 2",
  analyzing: "Step 1 of 2",
  styling: "Step 2 of 2",
  done: "Step 2 of 2",
};

const EXAMPLE_OCCASIONS: { value: Occasion; label: string }[] = [
  { value: "work", label: "Work" },
  { value: "date-night", label: "Date Night" },
  { value: "casual", label: "Casual" },
];

export default function HomePage() {
  const [stage, setStage] = useState<Stage>("collecting");
  const [photo, setPhoto] = useState<File | null>(null);
  const [occasion, setOccasion] = useState<Occasion | null>(null);
  const [consent, setConsent] = useState(false);
  const [profile, setProfile] = useState<SkinProfile | null>(null);
  const [looks, setLooks] = useState<Look[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isExample, setIsExample] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [noMoreLooks, setNoMoreLooks] = useState(false);

  const canSubmit = photo !== null && occasion !== null && consent;

  function reset() {
    setStage("collecting");
    setPhoto(null);
    setOccasion(null);
    setConsent(false);
    setProfile(null);
    setLooks(null);
    setErrorMessage(null);
    setIsExample(false);
    setNoMoreLooks(false);
  }

  function handleSeeExample(exampleOccasion: Occasion) {
    const demo = buildInstantDemo(exampleOccasion);
    setOccasion(exampleOccasion);
    setProfile(demo.profile);
    setLooks(demo.looks);
    setIsExample(true);
    setNoMoreLooks(false);
    setErrorMessage(null);
    setStage("done");
  }

  async function handleSubmit() {
    if (!photo || !occasion) return;
    setErrorMessage(null);
    setIsExample(false);
    setNoMoreLooks(false);

    try {
      setStage("analyzing");
      const analyzeForm = new FormData();
      analyzeForm.set("photo", photo);
      analyzeForm.set("consent", "true");
      const analyzeResp = await fetch("/api/analyze", { method: "POST", body: analyzeForm });
      const analyzeData = await analyzeResp.json();
      if (!analyzeResp.ok || !analyzeData.profile) {
        throw new Error(analyzeData.error ?? "Skin analysis failed.");
      }
      const skinProfile: SkinProfile = analyzeData.profile;
      setProfile(skinProfile);

      setStage("styling");
      const styleForm = new FormData();
      styleForm.set("photo", photo);
      styleForm.set("occasion", occasion);
      styleForm.set("profile", JSON.stringify(skinProfile));
      const styleResp = await fetch("/api/style", { method: "POST", body: styleForm });
      const styleData = await styleResp.json();
      if (!styleResp.ok) throw new Error(styleData.error ?? "Styling failed.");
      setLooks(styleData.looks);

      setStage("done");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong.");
      setStage("error");
    }
  }

  async function handleSeeMore() {
    if (!photo || !occasion || !looks) return;
    setLoadingMore(true);
    try {
      const styleForm = new FormData();
      styleForm.set("photo", photo);
      styleForm.set("occasion", occasion);
      styleForm.set("profile", JSON.stringify(profile));
      styleForm.set("excludeIds", JSON.stringify(looks.map((l) => l.garment.id)));
      const styleResp = await fetch("/api/style", { method: "POST", body: styleForm });
      const styleData = await styleResp.json();
      if (!styleResp.ok) throw new Error(styleData.error ?? "Couldn't load more looks.");
      const moreLooks: Look[] = styleData.looks ?? [];
      if (moreLooks.length === 0) {
        setNoMoreLooks(true);
      } else {
        setLooks([...looks, ...moreLooks]);
        if (moreLooks.length < 3) setNoMoreLooks(true);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Couldn't load more looks.");
    } finally {
      setLoadingMore(false);
    }
  }

  // Every colorway option is already pre-rendered as part of the look (see
  // Look.colorwayRenders and the note in app/api/style/route.ts), so
  // picking a different swatch is just a local state swap — no API call,
  // no loading state.
  function handleColorwaySelect(index: number, next: Look) {
    if (!looks) return;
    const updated = [...looks];
    updated[index] = next;
    setLooks(updated);
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-5xl border border-ink bg-white">
        <nav className="flex items-center justify-between border-b border-ink px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-extrabold tracking-tight text-ink">GLOW &amp; FIT</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wide text-muted">{STEP_LABEL[stage]}</span>
            <span className="h-4 w-4 bg-ink" aria-hidden />
          </div>
        </nav>

        {(stage === "collecting" || stage === "error") && (
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_320px]">
            <section className="flex flex-col gap-8 p-6 sm:p-10">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wide text-accent">
                  Step 1 of 2 — Your Photo &amp; Occasion
                </span>
                <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl">
                  Upload one photo.
                  <br />
                  Get three looks that fit.
                </h1>
                <p className="mt-3 max-w-xl text-sm text-muted">
                  We read your skin with YouCam Skin AI, then render three complete outfits on you
                  with YouCam Apparel VTO — matched to your skin and the occasion, with the
                  reasoning shown for each pick.
                </p>
              </div>

              <TrustStats />

              <PhotoUploader onSelect={setPhoto} />
              <QuestionnaireForm occasion={occasion} onChangeOccasion={setOccasion} />
              <ConsentNote checked={consent} onChange={setConsent} />
              {errorMessage && <p className="text-xs font-bold text-accent">{errorMessage}</p>}

              <div className="flex items-center justify-between border-t border-ink pt-6">
                <span className="text-xs text-muted">Rendered on your photo — not a photograph of the garment.</span>
                <button
                  type="button"
                  disabled={!canSubmit}
                  onClick={handleSubmit}
                  className="flex items-center gap-2 bg-accent px-6 py-3 text-xs font-extrabold uppercase tracking-wide text-white transition disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Reveal my looks
                  <span aria-hidden>&rarr;</span>
                </button>
              </div>

              <div className="border-t border-ink pt-6">
                <span className="text-xs font-extrabold uppercase tracking-wide text-muted">
                  Don&apos;t want to upload yet? See an example first
                </span>
                <div className="mt-3 flex flex-wrap gap-2">
                  {EXAMPLE_OCCASIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSeeExample(opt.value)}
                      className="border border-ink bg-white px-4 py-2 text-xs font-extrabold uppercase tracking-wide text-ink transition hover:bg-paper"
                    >
                      {opt.label} example
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <HeroGraphic />
          </div>
        )}

        {(stage === "analyzing" || stage === "styling") && (
          <div className="p-6 sm:p-10">
            {stage === "analyzing" && <LoadingState status="Analyzing your skin with YouCam Skin AI…" />}
            {stage === "styling" && <LoadingState status="Styling your looks with YouCam Apparel VTO…" />}
          </div>
        )}

        {stage === "done" && profile && looks && (
          <div className="p-6 sm:p-10">
            <section className="flex flex-col gap-8">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wide text-accent">
                  Step 2 of 2 — Your Looks
                </span>
                <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl">
                  {isExample ? "Here's an example." : "Three looks, matched to you."}
                </h1>
                {isExample && (
                  <p className="mt-2 inline-block border border-ink bg-panel px-3 py-1 text-xs font-bold uppercase tracking-wide text-muted">
                    Example only — not your photo or a real analysis
                  </p>
                )}
              </div>

              <AnalysisSummary profile={profile} />

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                {looks.map((look, i) => (
                  <LookCard
                    key={`${look.garment.id}-${i}`}
                    look={look}
                    onColorwaySelect={(next) => handleColorwaySelect(i, next)}
                  />
                ))}
              </div>

              {errorMessage && <p className="text-xs font-bold text-accent">{errorMessage}</p>}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink pt-6">
                <span className="text-xs text-muted">
                  {isExample ? "Ready to try it with your own photo?" : "Want a different occasion or photo?"}
                </span>
                <div className="flex flex-wrap gap-3">
                  {!isExample && !noMoreLooks && (
                    <button
                      type="button"
                      onClick={handleSeeMore}
                      disabled={loadingMore}
                      className="border border-ink bg-white px-6 py-3 text-xs font-extrabold uppercase tracking-wide text-ink transition hover:bg-paper disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {loadingMore ? "Loading…" : "See 3 more looks"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={reset}
                    className="border border-ink bg-white px-6 py-3 text-xs font-extrabold uppercase tracking-wide text-ink transition hover:bg-paper"
                  >
                    {isExample ? "Upload my photo" : "Start over"}
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
