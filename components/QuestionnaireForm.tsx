"use client";

import type { Occasion } from "@/types/youcam";

const OCCASIONS: { value: Occasion; label: string }[] = [
  { value: "work", label: "Work" },
  { value: "casual", label: "Casual" },
  { value: "date-night", label: "Date Night" },
  { value: "event", label: "Special Event" },
];

interface QuestionnaireFormProps {
  occasion: Occasion | null;
  onChangeOccasion: (occasion: Occasion) => void;
}

export default function QuestionnaireForm({ occasion, onChangeOccasion }: QuestionnaireFormProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-extrabold uppercase tracking-wide text-muted">What are you dressing for?</span>
      <div className="flex flex-wrap gap-2">
        {OCCASIONS.map((opt) => {
          const active = occasion === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChangeOccasion(opt.value)}
              className={`border px-4 py-2 text-xs font-extrabold uppercase tracking-wide transition ${
                active ? "border-ink bg-ink text-white" : "border-ink bg-white text-ink hover:bg-paper"
              }`}
              aria-pressed={active}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
