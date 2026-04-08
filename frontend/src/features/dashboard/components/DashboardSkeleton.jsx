function SkeletonCard({ className = '' }) {
  return <div className={`animate-pulse rounded-3xl bg-muted ${className}`.trim()} />;
}

export default function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonCard className="h-40" />
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonCard key={index} className="h-40" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <SkeletonCard className="h-96" />
        <SkeletonCard className="h-96" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <SkeletonCard className="h-80" />
        <SkeletonCard className="h-80" />
      </div>
    </div>
  );
}
