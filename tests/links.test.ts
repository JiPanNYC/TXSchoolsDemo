import { describe, expect, it } from "vitest";
import { isHttpUrl, normalizeHref } from "../src/lib/links";

describe("link utilities", () => {
  it("normalizes protocol-less public website URLs", () => {
    expect(normalizeHref("www.austinisd.org/schools/lasa")).toBe(
      "https://www.austinisd.org/schools/lasa"
    );
    expect(normalizeHref("nisd.net")).toBe("https://nisd.net");
  });

  it("preserves supported explicit protocols and local anchors", () => {
    expect(normalizeHref("https://txschools.gov")).toBe("https://txschools.gov");
    expect(normalizeHref("tel:5125550100")).toBe("tel:5125550100");
    expect(normalizeHref("#results")).toBe("#results");
  });

  it("only opens HTTP URLs in a new browser tab", () => {
    expect(isHttpUrl("https://www.pisd.edu")).toBe(true);
    expect(isHttpUrl("tel:4697523210")).toBe(false);
  });
});
