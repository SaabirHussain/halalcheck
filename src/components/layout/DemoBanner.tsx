export function DemoBanner() {
  if (process.env.DEMO_MODE !== "true") return null;

  return (
    <div className="border-b border-accent/15 bg-accent-soft px-4 py-1.5 text-center text-xs text-accent-strong">
      Demo mode — all businesses and findings shown are fictional.
    </div>
  );
}
