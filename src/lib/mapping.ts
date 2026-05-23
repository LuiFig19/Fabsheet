import type { ExtractedTimesheet } from "@/lib/extractors/types";
import { computeDecimalHours } from "@/lib/utils";

export type EntryDraft = {
  workOrderNumber: string;
  customerName: string;
  partId: string;
  description: string;
  laborCode: string;
  startTime: string;
  endTime: string;
  decimalHours: number;
  confidenceByField: Record<string, number>;
};

/**
 * Convert the extractor's {value, confidence} shape into flat entry drafts plus
 * a per-field confidence map (the only thing the Review UI needs to flag cells).
 * Fully blank rows (no times and no work order) are dropped.
 */
export function entriesFromExtraction(ex: ExtractedTimesheet): EntryDraft[] {
  return ex.rows
    .filter((r) => r.workOrder.value || r.startTime.value || r.description.value || r.code.value)
    .map((r) => {
      const hours =
        r.decimalHours.value && r.decimalHours.value > 0
          ? r.decimalHours.value
          : computeDecimalHours(r.startTime.value, r.endTime.value);
      return {
        workOrderNumber: r.workOrder.value,
        customerName: r.customerName.value,
        partId: r.partId.value,
        description: r.description.value,
        laborCode: r.code.value,
        startTime: r.startTime.value,
        endTime: r.endTime.value,
        decimalHours: hours,
        confidenceByField: {
          workOrderNumber: r.workOrder.confidence,
          customerName: r.customerName.confidence,
          partId: r.partId.confidence,
          description: r.description.confidence,
          laborCode: r.code.confidence,
          startTime: r.startTime.confidence,
          endTime: r.endTime.confidence,
          decimalHours: r.decimalHours.confidence,
        },
      };
    });
}

/** Match a work order string to a known job id. Exact WO match only. */
export function matchJobId(
  workOrderNumber: string,
  jobs: { id: string; workOrderNumber: string }[],
): string | null {
  const wo = workOrderNumber.trim();
  return jobs.find((j) => j.workOrderNumber === wo)?.id ?? null;
}
