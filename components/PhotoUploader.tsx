"use client";

import { useRef, useState } from "react";

interface PhotoUploaderProps {
  onSelect: (file: File | null) => void;
}

export default function PhotoUploader({ onSelect }: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  function handleFile(file: File | undefined | null) {
    if (!file) {
      onSelect(null);
      setPreviewUrl(null);
      return;
    }
    onSelect(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  return (
    <div
      className="flex border border-ink"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        handleFile(e.dataTransfer.files?.[0]);
      }}
    >
      <div className="flex h-40 w-40 shrink-0 items-center justify-center border-r border-ink bg-paper/60 sm:h-44 sm:w-44">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Your uploaded photo" className="h-full w-full object-cover" />
        ) : (
          <span className="px-4 text-center text-xs uppercase tracking-wide text-muted">No photo yet</span>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-center gap-3 p-5">
        <div>
          <h3 className="text-lg font-extrabold text-ink">
            {previewUrl ? "Photo selected" : "Drag a photo here"}
          </h3>
          <p className="mt-1 text-xs text-muted">JPEG, PNG, or WEBP · up to 8MB · well-lit, face and shoulders visible</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-2 bg-accent px-5 py-2 text-xs font-extrabold uppercase tracking-wide text-white transition hover:opacity-90"
          >
            {previewUrl ? "Choose a different photo" : "Browse files"}
            <span aria-hidden>&rarr;</span>
          </button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
