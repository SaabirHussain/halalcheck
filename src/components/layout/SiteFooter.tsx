export function SiteFooter() {
  return (
    <footer className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-8 text-center text-xs text-muted sm:px-6">
      <p>
        HalalCheck organises evidence; it does not issue religious rulings.
        Unknown information is not a negative finding.
      </p>
      <p>
        Map data ©{" "}
        <a
          className="underline underline-offset-2 hover:text-accent"
          href="https://www.openstreetmap.org/copyright"
          rel="noreferrer"
          target="_blank"
        >
          OpenStreetMap contributors
        </a>
        .
      </p>
    </footer>
  );
}
