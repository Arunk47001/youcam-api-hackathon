/**
 * Original abstract composition — no photography, no real or synthetic
 * human likeness. A minimalist fashion-croquis figure (headless of any
 * specific identity — no facial features, generic elongated proportions)
 * stands in for "a model" in the editorial sense, layered over flat
 * "draped fabric" panels in the catalog's own palette. Built this way
 * deliberately: any photo pulled from the web can't be rights-cleared on
 * the spot, and this app's whole premise is generatively altering a
 * person's clothing — so a real photo of a real (let alone identifiable)
 * person doesn't belong in marketing imagery here. An original illustration
 * sidesteps the problem entirely.
 */
export default function HeroGraphic() {
  return (
    <div className="relative hidden h-full min-h-[320px] w-full overflow-hidden border-l border-ink bg-ink sm:block">
      {/*
        preserveAspectRatio="meet" (not "slice"): this panel's real aspect
        ratio is much taller/narrower than the viewBox below, and "slice"
        was cropping most of the composition to fill it. "meet" letterboxes
        instead — safe here because the container's own bg-ink matches the
        SVG's background rect, so the letterbox bars are invisible.
      */}
      <svg viewBox="0 0 320 480" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet" aria-hidden>
        <rect width="320" height="480" fill="#201e1d" />

        {/* Draped/folded panels, each a flat angular shape */}
        <polygon points="0,480 0,120 100,50 130,110 40,170 90,210 10,290 80,330 20,480" fill="#ec3013" opacity="0.85" />
        <polygon points="320,0 320,480 250,480 225,330 300,290 240,230 305,160 250,110 320,0" fill="#f2e9d8" opacity="0.12" />
        <polygon points="320,230 240,230 305,160" fill="#1e4e8c" opacity="0.5" />
        <polygon points="320,480 250,480 225,330 300,290" fill="#c1613b" opacity="0.45" />

        {/* Fashion-croquis figure: no face, no identity, purely iconographic */}
        <g>
          <ellipse cx="160" cy="70" rx="13" ry="16" fill="#f2e9d8" />
          <rect x="153" y="85" width="14" height="11" fill="#f2e9d8" />
          <path d="M128,100 L192,100 L202,168 L188,172 L179,120 L181,172 L139,172 L141,120 L132,172 L118,168 Z" fill="#f2e9d8" />
          <path d="M139,172 L181,172 L228,430 L92,430 Z" fill="#f2e9d8" opacity="0.92" />
          <line x1="160" y1="172" x2="150" y2="430" stroke="#201e1d" strokeOpacity="0.18" strokeWidth="1.5" />
          <line x1="160" y1="172" x2="170" y2="430" stroke="#201e1d" strokeOpacity="0.18" strokeWidth="1.5" />
          <line x1="146" y1="172" x2="118" y2="430" stroke="#201e1d" strokeOpacity="0.12" strokeWidth="1.5" />
          <line x1="174" y1="172" x2="202" y2="430" stroke="#201e1d" strokeOpacity="0.12" strokeWidth="1.5" />
        </g>

        {/* Hairline rules for editorial texture */}
        <line x1="0" y1="120" x2="320" y2="120" stroke="#f2e9d8" strokeOpacity="0.15" strokeWidth="1" />
        <line x1="0" y1="360" x2="320" y2="360" stroke="#f2e9d8" strokeOpacity="0.15" strokeWidth="1" />
      </svg>

      <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between border-t border-white/15 p-5">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-white/70">Glow &amp; Fit</span>
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-white/70">Skin AI &times; Apparel VTO</span>
      </div>
    </div>
  );
}
