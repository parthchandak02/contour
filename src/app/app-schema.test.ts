import { describe, expect, it } from "vitest";

import {
  appAcceptance,
  validateProductAcceptanceCoverage,
} from "./app-acceptance";
import { appPerformance } from "./app-performance";
import { appSchema } from "./app-schema";

describe("appSchema", () => {
  it("keeps runtime Settings first, then Contour's Place and Map sections", () => {
    const titles = appSchema.panels.controls?.sections.map((section) => section.title) ?? [];
    expect(titles.indexOf("Settings")).toBeLessThan(titles.indexOf("Place"));
    expect(titles.indexOf("Place")).toBeLessThan(titles.indexOf("Map"));
    expect(titles).toContain("Image Export");
  });

  it("uses an editable 1920x1080 still output with render scale and no uploads or timeline", () => {
    expect(appSchema.canvas.sizing).toMatchObject({ mode: "editable-output" });
    expect(appSchema.canvas.upload).toBe(false);
    expect(appSchema.canvas.renderScale.enabled).toBe(true);
    expect(appSchema.canvas.size).toMatchObject({ height: 1080, width: 1920 });
    expect(appSchema.assembly.capabilities).not.toContain("timeline.playback");
  });

  it("derives one performance scenario per canonical path", () => {
    expect(appPerformance.scenarios.length).toBeGreaterThan(0);
    expect(new Set(appPerformance.scenarios.map((scenario) => scenario.pathId)).size).toBe(appPerformance.scenarios.length);
  });

  it("declares production reload coverage for the starter schema", () => {
    expect(appSchema.persistence.storage).toBe("localStorage");
    if (appSchema.persistence.storage !== "localStorage") {
      throw new Error(
        "The starter must persist user settings in localStorage.",
      );
    }
    expect(appSchema.persistence.include).toContain("canvas");
    expect(
      appAcceptance.find((entry) => entry.id === "persistence.reload"),
    ).toMatchObject({
      automated: true,
      browser: {
        budget: "extended-io",
        file: "e2e/product-contour-persistence.spec.ts",
      },
      evidence: "persistence-state",
      kind: "runtime",
      persistenceCoverage: "reload",
      persistenceSlices: appSchema.persistence.include,
      target: "canvas.size.width",
    });
    expect(validateProductAcceptanceCoverage()).toEqual([]);
  });
});
