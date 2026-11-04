import Link from "next/link";
import { db } from "@/db";
import { investigations } from "@/db/schema";
export default async function AdminHome() {
  const rows = await db
    .select()
    .from(investigations)
    .orderBy(investigations.createdAt)
    .limit(20);
  return (
    <section>
      <h2>Research overview</h2>
      <p>
        Review current investigations and keep evidence-backed publication on
        track.
      </p>
      {rows.map((row) => (
        <article className="finding" key={row.id}>
          <Link href={`/admin/investigations/${row.id}`}>
            <strong>{row.status.replaceAll("_", " ")}</strong>
          </Link>
          <p className="muted">{row.stageDetail ?? "No stage details yet."}</p>
        </article>
      ))}
    </section>
  );
}
