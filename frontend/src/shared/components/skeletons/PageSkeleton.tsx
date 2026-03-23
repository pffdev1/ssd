function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-3xl border border-[#d7e4f2] bg-[#f5faff] ${className}`} />;
}

export function PageSkeleton({ showSidebar = true }: { showSidebar?: boolean }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-8 px-4 py-5 lg:px-8 lg:py-8">
      <SkeletonBlock className="h-[220px] border border-transparent" />
      <div className={`grid gap-6 ${showSidebar ? "xl:grid-cols-[0.95fr_1.2fr_0.85fr]" : "xl:grid-cols-[1.2fr_0.8fr]"}`}>
        {showSidebar ? <SkeletonBlock className="min-h-[520px]" /> : null}
        <SkeletonBlock className="min-h-[520px]" />
        <SkeletonBlock className="min-h-[520px]" />
      </div>
      <SkeletonBlock className="h-20" />
    </div>
  );
}
