"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, CalendarDays, Download, FileText, CalendarRange, X } from "lucide-react";

function mondayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00.000Z`);
  const dow = (d.getUTCDay() + 6) % 7; // 0=Mon
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}
function shift(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function ProductionControls({
  weekStart,
  start,
  end,
  query,
  rangeMode,
}: {
  weekStart: string; // Monday of the (first) shown week
  start: string; // custom range start, or ""
  end: string; // custom range end, or ""
  query: string; // current querystring for export links
  rangeMode: boolean;
}) {
  const router = useRouter();
  const [showRange, setShowRange] = useState(rangeMode);
  const [from, setFrom] = useState(start || weekStart);
  const [to, setTo] = useState(end || shift(weekStart, 6));

  function goWeek(monday: string) {
    router.push(`/production?week=${monday}`);
  }
  function applyRange() {
    if (!from || !to) return;
    const s = from <= to ? from : to;
    const e = from <= to ? to : from;
    router.push(`/production?start=${s}&end=${e}`);
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-end justify-between gap-4 pt-5">
        <div className="flex flex-wrap items-end gap-3">
          {!showRange ? (
            <>
              <div className="flex items-center gap-1">
                <Button type="button" variant="outline" size="icon" aria-label="Previous week" onClick={() => goWeek(shift(weekStart, -7))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" onClick={() => router.push("/production")}>
                  This week
                </Button>
                <Button type="button" variant="outline" size="icon" aria-label="Next week" onClick={() => goWeek(shift(weekStart, 7))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <label className="space-y-1">
                <span className="block text-xs text-muted-foreground">Jump to any week</span>
                <Input
                  type="date"
                  value={weekStart}
                  onChange={(e) => e.target.value && goWeek(mondayOf(e.target.value))}
                  className="w-44"
                />
              </label>
              <Button type="button" variant="ghost" onClick={() => setShowRange(true)}>
                <CalendarRange className="h-4 w-4" /> Custom range
              </Button>
            </>
          ) : (
            <>
              <label className="space-y-1">
                <span className="block text-xs text-muted-foreground">From</span>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
              </label>
              <label className="space-y-1">
                <span className="block text-xs text-muted-foreground">To</span>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
              </label>
              <Button type="button" onClick={applyRange}>
                <CalendarDays className="h-4 w-4" /> Apply
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowRange(false);
                  router.push("/production");
                }}
              >
                <X className="h-4 w-4" /> Single week
              </Button>
            </>
          )}
        </div>

        <div className="flex gap-2">
          <Button asChild variant="outline">
            <a href={`/api/production/pdf?${query}`}>
              <FileText className="h-4 w-4" /> PDF
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={`/api/production/csv?${query}`}>
              <Download className="h-4 w-4" /> CSV
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
