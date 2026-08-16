"use client";

interface ConsentNoteProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export default function ConsentNote({ checked, onChange }: ConsentNoteProps) {
  return (
    <label className="flex items-start gap-2 text-xs text-muted">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-accent"
      />
      <span>
        I consent to my photo being sent to the YouCam API for skin analysis and virtual try-on. It
        is not stored by this app beyond generating my results.
      </span>
    </label>
  );
}
