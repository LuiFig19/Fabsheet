import { describe, it, expect } from "vitest";
import { codeFromBubble, validateUnit, matchEmployee, parseHeaderDate, normalizeShopTime } from "./mapping";

describe("codeFromBubble (Task/Action -> labor code)", () => {
  it("maps component tasks to 110 except Decking", () => {
    expect(codeFromBubble("Frame", null)).toBe("110 Weld/Fab");
    expect(codeFromBubble("Rails", null)).toBe("110 Weld/Fab");
    expect(codeFromBubble("Decking", null)).toBe("140 Labor Decking");
  });
  it("maps action bubbles to their codes and prefers action over task", () => {
    expect(codeFromBubble(null, "Cutting")).toBe("120 Cut");
    expect(codeFromBubble(null, "Forklift")).toBe("230 Load/Unload Trucks");
    expect(codeFromBubble(null, "Machine Repair")).toBe("240 Welding Machine Repair");
    expect(codeFromBubble("Frame", "Rework")).toBe("130 Repair/Reworking"); // action wins
  });
  it("returns empty string when nothing is bubbled", () => {
    expect(codeFromBubble(null, null)).toBe("");
  });
});

describe("validateUnit (UNIT __ of __ against job quantity)", () => {
  it("single-unit job: blank UNIT is fine, a number is a mistake", () => {
    expect(validateUnit(null, null, 1, "4354")).toBeNull();
    expect(validateUnit(2, null, 1, "4354")).toContain("only 1 unit");
  });
  it("multi-unit job: blank UNIT flags, out-of-range flags", () => {
    expect(validateUnit(null, null, 2, "4571")).toContain("did not specify");
    expect(validateUnit(3, null, 2, "4571")).toContain("only has 2 units");
    expect(validateUnit(1, 2, 2, "4571")).toBeNull();
  });
  it("multi-unit job: mismatched total is a soft warning, not a block", () => {
    expect(validateUnit(1, 3, 2, "4571")).toContain("Saving as 2");
  });
});

describe("matchEmployee", () => {
  const roster = [
    { id: "1", name: "Glenn Swinger", active: true },
    { id: "2", name: "Luis Figueroa", active: true },
    { id: "3", name: "Luis Sanchez", active: true },
  ];
  it("matches a unique first name alone", () => {
    expect(matchEmployee("Glenn", roster)?.id).toBe("1");
  });
  it("returns null for an ambiguous first name", () => {
    expect(matchEmployee("Luis", roster)).toBeNull();
  });
  it("matches first + last-initial style", () => {
    expect(matchEmployee("Luis F", roster)?.id).toBe("2");
    expect(matchEmployee("Glenn Sw", roster)?.id).toBe("1");
  });
  it("returns null for an unknown name", () => {
    expect(matchEmployee("Bob", roster)).toBeNull();
  });
});

describe("parseHeaderDate", () => {
  it("parses short US dates with 2-digit years", () => {
    expect(parseHeaderDate("1/1/26")?.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(parseHeaderDate("01/01/26")?.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(parseHeaderDate("5/28/2026")?.toISOString().slice(0, 10)).toBe("2026-05-28");
  });
  it("parses ISO dates", () => {
    expect(parseHeaderDate("2026-05-28")?.toISOString().slice(0, 10)).toBe("2026-05-28");
  });
  it("returns null for garbage", () => {
    expect(parseHeaderDate("not a date")).toBeNull();
    expect(parseHeaderDate("")).toBeNull();
  });
});

describe("normalizeShopTime (Raven's day-shift inference)", () => {
  it("expands bare hours to HH:00", () => {
    expect(normalizeShopTime("5")).toBe("05:00");
    expect(normalizeShopTime("7")).toBe("07:00");
    expect(normalizeShopTime("12")).toBe("12:00");
  });
  it("treats 1-4 as PM (no night shift)", () => {
    expect(normalizeShopTime("1")).toBe("13:00");
    expect(normalizeShopTime("4")).toBe("16:00");
    expect(normalizeShopTime("1:30")).toBe("13:30");
  });
  it("keeps AM hours and minutes", () => {
    expect(normalizeShopTime("7:15")).toBe("07:15");
    expect(normalizeShopTime("9:15")).toBe("09:15");
  });
  it("handles explicit am/pm", () => {
    expect(normalizeShopTime("5pm")).toBe("17:00");
    expect(normalizeShopTime("12am")).toBe("00:00");
  });
  it("returns empty for unparseable", () => {
    expect(normalizeShopTime("abc")).toBe("");
    expect(normalizeShopTime("")).toBe("");
  });
});
