import { describe, it, expect } from "vitest";
import { computeDecimalHours, isProductiveCode, fmtHours, productiveCodeWhere, workWeekProgress } from "./utils";

describe("computeDecimalHours", () => {
  it("computes whole and fractional hours", () => {
    expect(computeDecimalHours("07:00", "11:00")).toBe(4);
    expect(computeDecimalHours("13:30", "15:00")).toBe(1.5);
    expect(computeDecimalHours("09:15", "12:00")).toBe(2.75);
  });
  it("returns 0 for invalid or empty input", () => {
    expect(computeDecimalHours("", "")).toBe(0);
    expect(computeDecimalHours("abc", "11:00")).toBe(0);
  });
});

describe("isProductiveCode", () => {
  it("counts 1xx fab codes as productive", () => {
    expect(isProductiveCode("110 Weld/Fab")).toBe(true);
    expect(isProductiveCode("140 Labor Decking")).toBe(true);
    expect(isProductiveCode("280 Fit-Up/Install")).toBe(true);
  });
  it("counts 2xx support codes as non-productive", () => {
    expect(isProductiveCode("230 Load/Unload Trucks")).toBe(false);
    expect(isProductiveCode("240 Welding Machine Repair")).toBe(false);
    expect(isProductiveCode("999 Other")).toBe(false);
    expect(isProductiveCode("")).toBe(false);
  });
  it("exposes a Prisma where fragment", () => {
    expect(productiveCodeWhere.OR.length).toBeGreaterThan(0);
  });
});

describe("fmtHours", () => {
  it("formats to two decimals", () => {
    expect(fmtHours(4)).toBe("4.00");
    expect(fmtHours(1.5)).toBe("1.50");
    expect(fmtHours(0)).toBe("0.00");
  });
});

describe("workWeekProgress (Mon-Sat work week, Sun is rest/collection)", () => {
  const dow = (d: Date) => d.getDay();

  it("anchors the week to Monday on a weekday", () => {
    const wed = new Date(2026, 5, 3); // Wed Jun 3, 2026
    const r = workWeekProgress(wed);
    expect(dow(r.weekStart)).toBe(1); // Monday
    expect(r.onWeekend).toBe(false);
    expect(r.daysRemaining).toBe(3); // Wed=3 (Wed, Thu, Fri remaining)
  });

  it("treats Saturday as part of THIS week (OT day), not the next one", () => {
    const sat = new Date(2026, 5, 6); // Sat Jun 6, 2026
    const r = workWeekProgress(sat);
    expect(dow(r.weekStart)).toBe(1); // still this week's Monday
    expect(r.onWeekend).toBe(false); // Saturday is workable
    expect(r.daysRemaining).toBe(0); // standard Mon-Fri target days are done
    // weekEnd is the exclusive Sunday boundary, so the Saturday date sits inside.
    expect(sat >= r.weekStart && sat < r.weekEnd).toBe(true);
  });

  it("treats Sunday as the work week being over", () => {
    const sun = new Date(2026, 5, 7); // Sun Jun 7, 2026
    const r = workWeekProgress(sun);
    expect(r.onWeekend).toBe(true);
    expect(dow(r.weekStart)).toBe(1);
    expect(r.daysRemaining).toBe(5); // next week's full Mon-Fri ahead
  });

  it("daysRemaining counts Mon-Fri standard days on weekdays", () => {
    const mon = new Date(2026, 5, 1); // Mon Jun 1, 2026
    expect(workWeekProgress(mon).daysRemaining).toBe(5);
    const fri = new Date(2026, 5, 5); // Fri Jun 5, 2026
    expect(workWeekProgress(fri).daysRemaining).toBe(1);
  });
});
