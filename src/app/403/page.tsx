import Link from "next/link";
export default function Forbidden() {
  return (
    <main className="page">
      <h1>403 · Forbidden</h1>
      <p>Administrator access is required for this page.</p>
      <Link href="/" className="button">
        Return to discovery
      </Link>
    </main>
  );
}
