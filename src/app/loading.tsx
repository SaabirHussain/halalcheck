export default function Loading() {
  return (
    <main
      aria-label="Loading HalalCheck"
      className="mx-auto max-w-7xl animate-pulse px-4 pb-28 pt-6 sm:px-6 md:pb-10"
      role="status"
    >
      <div className="mb-5 h-8 w-3/4 rounded-lg bg-surface-2 sm:w-1/2" />
      <div className="h-12 rounded-xl bg-surface-2" />
      <div className="my-5 flex gap-2">
        {[1, 2, 3, 4].map((item) => (
          <div className="h-11 w-24 rounded-full bg-surface-2" key={item} />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <div className="overflow-hidden rounded-card bg-surface" key={item}>
            <div className="h-40 bg-surface-2" />
            <div className="grid gap-3 p-4">
              <div className="h-5 w-2/3 rounded bg-surface-2" />
              <div className="h-4 w-1/2 rounded bg-surface-2" />
              <div className="h-8 w-3/4 rounded-full bg-surface-2" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
