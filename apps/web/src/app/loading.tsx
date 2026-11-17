export default function AppLoading() {
  return (
    <div
      aria-label="กำลังโหลดหน้า"
      className="space-y-6 animate-pulse motion-reduce:animate-none"
    >
      {/* Hero Skeleton */}
      <div className="h-44 rounded-3xl border border-[#E8DCE0] bg-white/80 p-6 shadow-sm">
        <div className="h-4 w-36 rounded-full bg-[#F3E6EB]" />
        <div className="mt-4 h-7 w-2/3 rounded-xl bg-[#F3E6EB]" />
        <div className="mt-3 h-4 w-1/2 rounded-full bg-[#FAF6F7]" />
      </div>

      {/* 3 Mode Cards Skeleton */}
      <div className="grid gap-3.5 sm:grid-cols-3">
        <div className="h-48 rounded-3xl border border-[#E8DCE0] bg-white/80 shadow-sm" />
        <div className="h-48 rounded-3xl border border-[#F5C6D4] bg-white/80 shadow-sm" />
        <div className="h-48 rounded-3xl border border-[#E8DCE0] bg-white/80 shadow-sm" />
      </div>

      {/* Activity Sheet Skeleton */}
      <div className="h-60 rounded-3xl border border-[#E8DCE0] bg-white/80 shadow-sm" />
    </div>
  );
}
