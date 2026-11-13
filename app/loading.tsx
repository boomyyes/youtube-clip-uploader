import { Skeleton } from "@/components/ui/skeleton";

// Shown instantly while any page's server data loads: same shape as a page (index strip, headline, panels).
export default function Loading() {
  return (
    <div className="content-page page-skeleton" role="status" aria-label="Loading page">
      <div className="page-index"><Skeleton className="h-3 w-40" /><Skeleton className="h-3 w-48" /></div>
      <Skeleton className="mb-4 h-[clamp(48px,8vw,140px)] w-[min(80%,760px)] rounded-2xl" />
      <Skeleton className="mb-14 h-[clamp(48px,8vw,140px)] w-[min(55%,520px)] rounded-2xl" />
      <div className="grid gap-4 md:grid-cols-[1.5fr_1fr]">
        <Skeleton className="h-80 rounded-[22px]" />
        <Skeleton className="h-80 rounded-[22px]" />
      </div>
    </div>
  );
}
