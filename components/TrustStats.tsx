const STATS = [
  { value: "6", label: "Skin signals read from one photo" },
  { value: "13", label: "Curated pieces in the style index" },
  { value: "0", label: "Photos stored after your session" },
];

export default function TrustStats() {
  return (
    <div className="grid grid-cols-3 divide-x divide-ink border-y border-ink">
      {STATS.map((stat) => (
        <div key={stat.label} className="p-4">
          <p className="text-2xl font-extrabold text-ink">{stat.value}</p>
          <p className="mt-0.5 text-[11px] leading-tight text-muted">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
