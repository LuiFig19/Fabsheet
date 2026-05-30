import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtHours } from "@/lib/utils";
import { ArrowRight, Target } from "lucide-react";

/**
 * Shared by the dashboard and the Needs Attention page. The visual tier
 * (red/yellow/green) mirrors the job-progress color rule. The right-hand
 * "Per-employee breakdown" affordance is decorative — the calling page wraps
 * the card in a Link to /production.
 */
export function ProductionGoalCard({
  target,
  productive,
  support,
  pct,
  remaining,
  perDay,
  daysRemaining,
  onWeekend,
  onTrack,
}: {
  target: number;
  productive: number;
  support: number;
  pct: number;
  remaining: number;
  perDay: number;
  daysRemaining: number;
  onWeekend: boolean;
  onTrack: boolean;
}) {
  const tier: "green" | "yellow" | "red" =
    onTrack ? "green" : pct >= 75 ? "yellow" : daysRemaining <= 2 ? "red" : "yellow";
  const bar = tier === "green" ? "bg-emerald-500" : tier === "yellow" ? "bg-amber-500" : "bg-red-500";
  const headline = onTrack
    ? `Target hit - ${fmtHours(productive - target)} h over the line.`
    : onWeekend
      ? `Work week is over. ${remaining > 0 ? `Missed by ${fmtHours(remaining)} h.` : "Goal hit."} Next week starts Monday at 0 / ${target}.`
      : daysRemaining === 0
        ? `End of Friday. ${remaining > 0 ? `Short ${fmtHours(remaining)} h on this week.` : "Goal hit."}`
        : `Need ${fmtHours(remaining)} more production hours by Friday - ${fmtHours(perDay)} h/day across ${daysRemaining} working day${daysRemaining === 1 ? "" : "s"} left.`;

  return (
    <Card
      className={`transition-shadow hover:shadow-md ${
        tier === "red" ? "border-red-300" : tier === "yellow" ? "border-amber-300" : "border-emerald-300"
      }`}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-foreground">
          <span className="flex items-center gap-2">
            <Target className="h-4 w-4" /> Weekly production goal
          </span>
          <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
            Per-employee breakdown <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-2xl font-bold tabular-nums sm:text-3xl">
            {fmtHours(productive)}
            <span className="text-base font-normal text-muted-foreground"> / {target} h</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {fmtHours(support)} h non-production this week (machine repair, forklift, wash, admin)
          </div>
        </div>

        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${bar} transition-all`}
            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant={tier === "green" ? "success" : tier === "yellow" ? "warning" : "danger"}>
            {Math.round(pct)}%
          </Badge>
          <span className={tier === "red" ? "font-medium text-red-700" : "text-foreground"}>{headline}</span>
        </div>
      </CardContent>
    </Card>
  );
}
