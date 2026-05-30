import { describe, it, expect } from "vitest";
import { buildDailySummaryCsv, buildQuickbooksCsv, type DailyEntry } from "./daily-report";

function entry(over: Partial<DailyEntry> = {}): DailyEntry {
  return {
    date: "2026-05-30",
    employee: "Glenn Swinger",
    workOrder: "4354",
    customer: "Acme Marine",
    laborCode: "110 Weld/Fab",
    description: "Frame",
    startTime: "07:00",
    endTime: "11:00",
    hours: 4,
    status: "approved",
    notes: "",
    ...over,
  };
}

describe("buildQuickbooksCsv", () => {
  it("emits approved entries only, in QuickBooks column order", () => {
    const csv = buildQuickbooksCsv([
      entry({ employee: "Glenn", hours: 4 }),
      entry({ employee: "Carlos", hours: 2, status: "needs_review" }),
    ]);
    const [header, ...rows] = csv.split("\r\n");
    expect(header).toBe("Date,Employee,Customer:Job,Service Item,Class,Hours,Description,Billable");
    expect(rows).toHaveLength(1); // needs_review filtered out
    expect(rows[0]).toContain("Glenn");
    expect(rows[0]).toContain("4354:Acme Marine");
    expect(rows[0]).toContain("110 Weld/Fab");
    expect(rows[0]).toContain("4.00");
    expect(rows[0]).toContain("Yes");
  });

  it("uses M/D/YYYY date format", () => {
    const csv = buildQuickbooksCsv([entry({ date: "2026-05-30" })]);
    expect(csv).toContain("5/30/2026");
  });

  it("quotes fields containing commas/quotes/newlines", () => {
    const csv = buildQuickbooksCsv([entry({ notes: 'has, a "comma"', description: "" })]);
    expect(csv).toContain('"has, a ""comma"""');
  });
});

describe("buildDailySummaryCsv", () => {
  it("splits productive vs non-productive per employee", () => {
    const csv = buildDailySummaryCsv(
      [
        entry({ employee: "Glenn", laborCode: "110 Weld/Fab", hours: 4 }),
        entry({ employee: "Glenn", laborCode: "240 Welding Machine Repair", hours: 2 }),
        entry({ employee: "Carlos", laborCode: "230 Load/Unload Trucks", hours: 3 }),
      ],
      "2026-05-30",
      "Raven's Marine",
    );
    expect(csv).toContain("PER-EMPLOYEE TOTALS");
    // Glenn: 4 productive + 2 non-productive = 6 total
    expect(csv).toMatch(/Glenn,4\.00,2\.00,6\.00,2/);
    // Carlos: 0 productive + 3 non-productive = 3 total
    expect(csv).toMatch(/Carlos,0\.00,3\.00,3\.00,1/);
    // Grand total: 4 productive, 5 non-productive, 9 total, 3 entries
    expect(csv).toMatch(/GRAND TOTAL,4\.00,5\.00,9\.00,3/);
  });

  it("includes a DETAIL section with every entry", () => {
    const csv = buildDailySummaryCsv(
      [entry({ employee: "Glenn", hours: 4 }), entry({ employee: "Carlos", hours: 2 })],
      "2026-05-30",
      "Raven's Marine",
    );
    expect(csv).toContain("DETAIL");
    expect(csv).toContain("Glenn");
    expect(csv).toContain("Carlos");
  });

  it("escapes the company name when it contains a comma or apostrophe", () => {
    const csv = buildDailySummaryCsv([entry()], "2026-05-30", "Raven's Marine, Inc.");
    expect(csv).toContain('"Raven\'s Marine, Inc."');
  });
});
