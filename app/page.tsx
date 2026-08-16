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
import type { Look, Occasion, SkinProfile } from "@/types/youcam";

type Stage = "collecting" | "analyzing" | "styling" | "done" | "error";

const STEP_LABEL: Record<Stage, string> = {
  collecting: "Step 1 of 2",
  error: "Step 1 of 2",
  analyzing: "Step 1 of 2",
  styling: "Step 2 of 2",
  done: "Step 2 of 2",
};

export default function HomePage() {
  const [stage, setStage] = useState<Stage>("collecting");
  const [photo, setPhoto] = useState<File | null>(null);
  const [occasion, setOccasion] = useState<Occasion | null>(null);
  const [consent, setConsent] = useState(false);
  const [profile, setProfile] = useState<SkinProfile | null>(null);
  const [looks, setLooks] = useState<Look[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSubmit = photo !== null && occasion !== null && consent;

  function reset() {
    setStage("collecting");
    setPhoto(null);
    setOccasion(null);
    setConsent(false);
    setProfile(null);
    setLooks(null);
    setErrorMessage(null);
  }

  async function handleSubmit() {
    if (!photo || !occasion) return;
    setErrorMessage(null);

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
                  Three looks, matched to you.
                </h1>
              </div>

              <AnalysisSummary profile={profile} />

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                {looks.map((look) => (
                  <LookCard key={look.garment.id} look={look} />
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-ink pt-6">
                <span className="text-xs text-muted">Want a different occasion or photo?</span>
                <button
                  type="button"
                  onClick={reset}
                  className="border border-ink bg-white px-6 py-3 text-xs font-extrabold uppercase tracking-wide text-ink transition hover:bg-paper"
                >
                  Start over
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
