function SkeletonLine({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-[#e3edf8] ${className}`} />;
}

export function LoginSkeleton() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(31,64,107,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(0,21,52,0.16),transparent_30%)]" />
      <div className="relative w-full max-w-6xl overflow-hidden rounded-[2.6rem] border border-[#c7d8ea] bg-white shadow-[0_32px_90px_rgba(0,21,52,0.12)]">
        <div className="grid lg:grid-cols-[1.08fr_0.92fr]">
          <section className="bg-[linear-gradient(145deg,#f8fbff_0%,#eef5fd_55%,#dde9f5_100%)] px-8 py-12 lg:px-12 lg:py-16">
            <SkeletonLine className="h-20 w-80 rounded-[1.8rem]" />
            <SkeletonLine className="mt-10 h-12 w-full max-w-[34rem]" />
            <SkeletonLine className="mt-4 h-12 w-full max-w-[28rem]" />
            <SkeletonLine className="mt-8 h-6 w-full max-w-[30rem]" />
          </section>
          <section className="flex items-center bg-[#f7fbff] px-6 py-10 sm:px-8 lg:px-10 lg:py-16">
            <div className="w-full rounded-[2rem] border border-[#7197bf] bg-white p-6 shadow-[0_18px_50px_rgba(0,21,52,0.08)] sm:p-8">
              <SkeletonLine className="h-4 w-40" />
              <SkeletonLine className="mt-4 h-10 w-56" />
              <SkeletonLine className="mt-5 h-6 w-72" />
              <SkeletonLine className="mt-8 h-14 w-full rounded-[1.5rem]" />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
