/**
 * Skeleton grid shown while `GET /api/listings` is in flight.
 * Mirrors the ExploreCard layout so nothing jumps on load.
 */
export function LoadingSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 gap-5 lg:grid-cols-2"
      aria-hidden="true"
      role="presentation"
    >
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="card animate-pulse p-6">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-lavender" />
            <div className="h-4 w-28 rounded-full bg-lavender" />
            <div className="ml-auto h-5 w-16 rounded-full bg-lavender" />
          </div>
          <div className="mt-4 space-y-2.5">
            <div className="h-4 w-full rounded-full bg-lavender" />
            <div className="h-4 w-11/12 rounded-full bg-lavender" />
            <div className="h-4 w-2/3 rounded-full bg-lavender" />
          </div>
          <div className="mt-5 flex gap-2">
            <div className="h-6 w-16 rounded-full bg-lavender" />
            <div className="h-6 w-20 rounded-full bg-lavender" />
            <div className="h-6 w-14 rounded-full bg-lavender" />
          </div>
          <div className="mt-6 h-9 w-full rounded-xl bg-lavender" />
        </div>
      ))}
    </div>
  );
}
