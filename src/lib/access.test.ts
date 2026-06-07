import { describe, expect, it, vi } from "vitest";

vi.mock("react", () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }));

import { canAccess, isOwnerEmail, normalizeRole, visibleModulesForRole } from "./access";

describe("role access", () => {
  it("normalizes leadership aliases to owner", () => {
    expect(normalizeRole("President")).toBe("owner");
    expect(normalizeRole("Executive Admin")).toBe("owner");
    expect(canAccess("President", "admin.users")).toBe(true);
  });

  it("keeps the platform owner email on owner access", () => {
    expect(isOwnerEmail("Luifig19@gmail.com")).toBe(true);
  });

  it("keeps foremen out of HR and admin controls", () => {
    expect(canAccess("foreman", "timesheets.upload")).toBe(true);
    expect(canAccess("foreman", "hr.view")).toBe(false);
    expect(canAccess("foreman", "admin.users")).toBe(false);
  });

  it("keeps HR focused on payroll/reporting instead of company settings", () => {
    expect(canAccess("hr", "reports.export")).toBe(true);
    expect(canAccess("hr", "settings.manage")).toBe(false);
  });

  it("filters visible modules from the same permissions table", () => {
    const foremanHrefs = visibleModulesForRole("foreman").map((m) => m.href);
    expect(foremanHrefs).toContain("/foreman");
    expect(foremanHrefs).not.toContain("/admin");
    expect(foremanHrefs).not.toContain("/hr");
  });
});
