export function DemoModeBanner() {
  if (process.env.DEMO_MODE !== "true") return null;
  return <div className="demo-banner">Demo mode — all businesses and findings shown are fictional.</div>;
}
