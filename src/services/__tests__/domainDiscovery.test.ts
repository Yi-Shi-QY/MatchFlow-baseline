import { describe, expect, it } from "vitest";
import {
  getAnalysisDomainById,
  listAnalysisDomains,
} from "@/src/services/domains/registry";

describe("domain discovery contracts", () => {
  it("lists at least one unique domain", () => {
    const domains = listAnalysisDomains();
    expect(domains.length).toBeGreaterThan(0);

    const ids = domains.map((domain) => domain.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("resolves football baseline domain with resources", () => {
    const football = getAnalysisDomainById("football");
    expect(football).not.toBeNull();
    expect(Array.isArray(football?.resources?.agents || [])).toBe(true);
    expect(Array.isArray(football?.resources?.templates || [])).toBe(true);
  });
});
