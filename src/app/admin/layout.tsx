import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/sessions";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (user?.role !== "admin")
    return (
      <main className="page">
        <h1>403 · Forbidden</h1>
        <p>Administrator access is required for this area.</p>
        <Link className="button" href="/sign-in">
          Sign in as an administrator
        </Link>
      </main>
    );
  return (
    <>
      <main className="page">
        <span className="eyebrow">HalalCheck operations</span>
        <h1>Admin workspace</h1>
        <nav className="admin-tabs">
          <Link href="/admin">Overview</Link>
          <Link href="/admin/investigations">Investigations</Link>
          <Link href="/admin/outreach">Outreach</Link>
          <Link href="/admin/proposals">Proposals</Link>
          <Link href="/admin/certificates">Certificates</Link>
          <Link href="/admin/corrections">Corrections</Link>
          <Link href="/admin/refresh">Refresh</Link>
          <Link href="/admin/audit">Audit log</Link>
        </nav>
        {children}
      </main>
    </>
  );
}
