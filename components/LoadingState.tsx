interface LoadingStateProps {
  status: string;
}

export default function LoadingState({ status }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 border border-ink bg-panel py-16">
      <div className="h-8 w-8 animate-spin border-2 border-ink border-t-accent" />
      <p className="text-xs font-extrabold uppercase tracking-wide text-ink">{status}</p>
    </div>
  );
}
