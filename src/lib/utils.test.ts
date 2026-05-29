import { describe, it, expect } from "vitest";
import { computeDecimalHours, isProductiveCode, fmtHours, productiveCodeWhere } from "./utils";

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
