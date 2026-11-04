export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
      <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-800">
        HalalCheck · Demo
      </p>
      <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-6xl">
        Community research for confident food choices.
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-8 text-stone-600">
        Research findings are evidence-backed, reviewed before publication, and
        clear about what remains unknown.
      </p>
      <div className="mt-10 rounded-2xl border border-emerald-900/10 bg-white p-6 shadow-sm">
        <p className="font-medium">Backend foundation is running locally.</p>
        <p className="mt-2 text-sm text-stone-600">
          Discovery and account interfaces are coming in the next build phase.
          Demo listings are fictional and are not religious rulings.
        </p>
      </div>
    </main>
  );
}
