import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { assessToolcraftRenderPlan, compileToolcraftPerformanceFixturePlan } from "@/toolcraft/runtime";

import { contourPerformancePaths, appPerformance } from "../app/app-performance";
import { appSchema } from "../app/app-schema";
import { handleContourAction } from "./contour-actions";
import { contourInk, contourLevels, drawContour, traceContours, TINT_STOPS } from "./contour-draw";
import { contourExport } from "./contour-export";
import { contourPerformanceModel } from "./contour-performance-model";
import { contourPipeline } from "./contour-pipeline";
import { AREAS, CONTOUR_TARGETS, PEAK_PRESETS, readContourSettings, STYLES } from "./contour-settings";
import { clearTerrainCache, decodeTerrarium, fetchTerrain, loadTerrain, mercatorPixel, syntheticTerrain, viewTiles, type TerrainData } from "./terrain";

type Call = unknown[];

function recordingContext(calls: Call[]): CanvasRenderingContext2D {
  let font = "10px sans-serif";
  return new Proxy({}, {
    get: (_target, key) => {
      if (key === "font") return font;
      if (key === "measureText") return (text: string) => ({ width: text.length * parseFloat(/(\d+(\.\d+)?)px/.exec(font)?.[1] ?? "10") * 0.55 });
      return (...args: unknown[]) => calls.push([key, ...args]);
    },
    set: (_target, key, value) => {
      if (key === "font") font = value;
      calls.push([key, value]);
      return true;
    },
  }) as CanvasRenderingContext2D;
}

const terrainFor = (values: Record<string, unknown>): TerrainData => {
  const settings = readContourSettings(values);
  return syntheticTerrain({ latitude: settings.latitude, longitude: settings.longitude, zoom: settings.zoom });
};

function draw(values: Record<string, unknown> = {}, width = 1920, height = 1080): Call[] {
  const calls: Call[] = [];
  drawContour(recordingContext(calls), width, height, readContourSettings(values), terrainFor(values));
  return calls;
}
const signature = (calls: Call[]) => createHash("sha256").update(JSON.stringify(calls)).digest("hex");
const texts = (calls: Call[]) => calls.filter((call) => call[0] === "fillText").map((call) => String(call[1]));
const DEFAULT = signature(draw());

describe("terrain", () => {
  it("decodes Terrarium pixels", () => {
    expect(decodeTerrarium(128, 0, 0)).toBe(0);
    expect(decodeTerrarium(145, 126, 128)).toBeCloseTo(4478.5, 1);
  });

  it("projects to Web Mercator and covers the view with tiles", () => {
    expect(mercatorPixel(0, 0, 1)).toEqual({ x: 256, y: 256 });
    const { tiles } = viewTiles({ latitude: 45.976, longitude: 7.659, zoom: 12 });
    expect(tiles.length).toBeGreaterThanOrEqual(6);
    expect(tiles.length).toBeLessThanOrEqual(9);
    expect(tiles[0].url).toMatch(/^https:\/\/elevation-tiles-prod\.s3\.amazonaws\.com\/terrarium\/12\/\d+\/\d+\.png$/);
  });

  it("stitches tiles into one grid and finds the summit", async () => {
    // Every tile encodes 1000 m, except the tile holding the map centre, which encodes 1512 m
    const centre = mercatorPixel(45.976, 7.659, 12);
    const centreTile = `/12/${Math.floor(centre.x / 256)}/${Math.floor(centre.y / 256)}.png`;
    const terrain = await fetchTerrain({ latitude: 45.976, longitude: 7.659, zoom: 12 }, async (url) => {
      const data = new Uint8ClampedArray(256 * 256 * 4);
      const [r, g] = url.endsWith(centreTile) ? [133, 232] : [131, 232];
      for (let i = 0; i < data.length; i += 4) [data[i], data[i + 1], data[i + 2], data[i + 3]] = [r, g, 0, 255];
      return data;
    });
    expect(terrain.source).toBe("live");
    expect(terrain.min).toBeCloseTo(1000, 3);
    expect(terrain.max).toBeCloseTo(1512, 3);
    expect(Math.abs(terrain.peak.col - 256)).toBeLessThan(256);
  });

  it("falls back to labelled sample terrain when tiles fail", async () => {
    clearTerrainCache();
    const terrain = await loadTerrain({ latitude: 10, longitude: 10, zoom: 12 }, async () => {
      throw new Error("offline");
    });
    expect(terrain.source).toBe("fallback");
    const calls: Call[] = [];
    drawContour(recordingContext(calls), 1920, 1080, readContourSettings({}), terrain);
    expect(texts(calls).join("")).toContain("offline sample terrain");
  });

  it("traces a closed ring around a single bump", () => {
    const values: number[] = new Array(25).fill(0);
    values[12] = 10;
    const [segments] = traceContours(values, 5, 5, [5]);
    expect(segments.length / 4).toBe(4);
  });

  it("widens the interval when lines would be too dense", () => {
    expect(contourLevels({ max: 8000, min: 0 }, 10).step).toBe(40);
    expect(contourLevels({ max: 1000, min: 0 }, 50).index).toBe(250);
  });
});

describe("Contour controls", () => {
  it("contour control place.peak", () => {
    for (const peak of PEAK_PRESETS) {
      const dispatch = vi.fn();
      handleContourAction({ action: { value: peak.value }, dispatch });
      expect(dispatch.mock.calls.map(([command]) => command)).toEqual([
        expect.objectContaining({ target: CONTOUR_TARGETS.latitude, value: peak.latitude }),
        expect.objectContaining({ target: CONTOUR_TARGETS.longitude, value: peak.longitude }),
        expect.objectContaining({ target: CONTOUR_TARGETS.area, value: peak.area }),
        expect.objectContaining({ target: CONTOUR_TARGETS.interval, value: peak.interval }),
      ]);
      const values = { [CONTOUR_TARGETS.latitude]: peak.latitude, [CONTOUR_TARGETS.longitude]: peak.longitude };
      expect(readContourSettings(values).place?.label).toBe(peak.label);
      expect(texts(draw(values))).toContain(peak.label);
    }
  });

  it("contour control place.latitude", () => {
    expect(signature(draw({ [CONTOUR_TARGETS.latitude]: 46.5 }))).not.toBe(DEFAULT);
    expect(texts(draw({ [CONTOUR_TARGETS.latitude]: 46.5 })).join("")).toContain("46.500°N");
  });

  it("contour control place.longitude", () => {
    expect(texts(draw({ [CONTOUR_TARGETS.longitude]: -8.5 })).join("")).toContain("8.500°W");
  });

  it("contour control map.area", () => {
    const signatures = new Set(AREAS.map((area) => signature(draw({ [CONTOUR_TARGETS.area]: area.value }))));
    expect(signatures.size).toBe(AREAS.length);
  });

  it("contour control map.interval", () => {
    expect(signature(draw({ [CONTOUR_TARGETS.interval]: 200 }))).not.toBe(DEFAULT);
    expect(texts(draw({ [CONTOUR_TARGETS.interval]: 200 })).join("")).toContain("200 m · index 1000 m");
  });

  it("contour control map.style", () => {
    const signatures = new Set(STYLES.map((style) => signature(draw({ [CONTOUR_TARGETS.style]: style.value }))));
    expect(signatures.size).toBe(STYLES.length);
    const tinted = draw();
    expect(tinted.some((call) => call[0] === "fillStyle" && call[1] === TINT_STOPS[0])).toBe(true);
  });
});

describe("Contour contracts", () => {
  it("contour contract appearance.background", () => {
    expect(contourInk({ background: "#F3EEE3", includeBackground: true })).toBe("#5E3B22");
    expect(contourInk({ background: "#14181F", includeBackground: true })).toBe("#ECE6D9");
    expect(signature(draw({ [CONTOUR_TARGETS.background]: "#14181F" }))).not.toBe(DEFAULT);
  });

  it("contour contract background.output", () => {
    const fullFills = (calls: Call[]) => calls.filter((call) => call[0] === "fillRect" && call[3] === 1920 && call[4] === 1080);
    expect(fullFills(draw())).toHaveLength(0);
    expect(fullFills(draw({ [CONTOUR_TARGETS.includeBackground]: false }))).toHaveLength(0);
  });

  it("contour contract export.image.format", () => {
    const control = appSchema.panels.controls?.sections.flatMap((section) => Object.values(section.controls)).find((entry) => entry.target === "export.image.format");
    expect(control?.options?.map((option) => option.value)).toEqual(["png", "jpg"]);
  });

  it("contour contract export.image.resolution", () => {
    const control = appSchema.panels.controls?.sections.flatMap((section) => Object.values(section.controls)).find((entry) => entry.target === "export.image.resolution");
    expect(control?.options?.map((option) => option.value)).toEqual(["2k", "4k", "8k"]);
  });

  it("contour contract export.image", async () => {
    clearTerrainCache();
    vi.stubGlobal("fetch", async () => {
      throw new Error("offline");
    });
    const calls: Call[] = [];
    await contourExport.renderFrame({ context: recordingContext(calls), frame: { height: 1080, width: 1920, x: -960, y: -540 }, signal: new AbortController().signal, state: { values: {} } } as unknown as Parameters<typeof contourExport.renderFrame>[0]);
    vi.unstubAllGlobals();
    expect(calls[1]).toEqual(["translate", -960, -540]);
    expect(texts(calls)).toContain("Matterhorn");
  });

  it("contour contract export.infinity", () => {
    expect(contourPipeline.passes.find((pass) => pass.id === "raster")?.sceneBounds?.kind).toBe("intrinsic");
  });

  it("contour contract canvas.size", () => {
    expect(signature(draw({}, 960, 540))).not.toBe(DEFAULT);
  });

  it("contour contract canvas.scale", () => {
    const raster = contourPipeline.passes.find((pass) => pass.id === "raster");
    expect(raster?.invalidatedBy).toContain("canvas.renderScale");
    expect(appSchema.canvas.renderScale.enabled).toBe(true);
  });

  it("contour contract canvas.infinity", () => {
    expect(contourPipeline.interactionInvalidation.find((entry) => entry.targets.includes("canvas.infinity"))?.invalidates).toEqual([]);
  });

  it("contour render plan has valid derived paths and fixtures", () => {
    expect(assessToolcraftRenderPlan(appSchema, contourPerformanceModel).errors ?? []).toEqual([]);
    expect(contourPerformancePaths.length).toBe(appPerformance.scenarios.length);
    for (const path of contourPerformancePaths) {
      if (path.workloadDimensions.length) expect(() => compileToolcraftPerformanceFixturePlan(contourPerformanceModel, path)).not.toThrow();
    }
  });
});
