import { cn } from "@/lib/utils";

const TIER_COLOR: Record<string, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-red-500",
  none: "bg-muted-foreground/40",
};

/** Horizontal budget bar. Fills to pct (clamped 0..100), colored by tier. */
export function Progress({
  pct,
  tier,
  className,
}: {
  pct: number;
  tier: "green" | "yellow" | "red" | "none";
  className?: string;
}) {
  const width = Math.max(0, Math.min(100, pct));
  return (
    <div className={cn("h-2.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className={cn("h-full rounded-full transition-all", TIER_COLOR[tier])} style={{ width: `${width}%` }} />
    </div>
  );
}
