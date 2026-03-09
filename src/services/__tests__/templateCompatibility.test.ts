import { describe, expect, it } from "vitest";
import {
  isTemplateCompatibleWithDomain,
  scopeTemplateIdsByDomain,
} from "@/src/services/domains/planning/templateCompatibility";

describe("template compatibility", () => {
  it("accepts explicit domain templates and rejects incompatible scoped templates", () => {
    const domainTemplateIds = new Set(["football_standard_template"]);

    expect(
      isTemplateCompatibleWithDomain("football_standard_template", "football", {
        domainTemplateIds,
        allowUnscopedFallback: false,
      }),
    ).toBe(true);

    expect(
      isTemplateCompatibleWithDomain("stocks_breakout_template", "football", {
        domainTemplateIds,
        allowUnscopedFallback: false,
      }),
    ).toBe(false);
  });

  it("scopes template list by domain compatibility", () => {
    const domainTemplateIds = new Set(["football_standard_template"]);
    const scoped = scopeTemplateIdsByDomain(
      [
        "football_standard_template",
        "stocks_breakout_template",
        "unscoped_template",
      ],
      "football",
      {
        domainTemplateIds,
        allowUnscopedFallback: false,
      },
    );

    expect(scoped).toEqual(["football_standard_template"]);
  });
});
