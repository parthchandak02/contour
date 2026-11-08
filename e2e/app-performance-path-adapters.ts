import { expect, type Page } from "@playwright/test";

import { contourPerformancePaths } from "../src/app/app-performance";
import { resolveToolcraftProductRasterProbe } from "./browser-product-raster-snapshot";
import { getToolcraftControlFieldByTarget } from "./browser-control-target-helpers";
import type { ToolcraftPerformanceCanvasBacking, ToolcraftPerformancePathActionContext, ToolcraftPerformancePathAdapter } from "./performance-path-adapter-contract";
import { contourFixtureApplications } from "./contour-performance-fixtures";
import { fieldValue, outputSelector, reveal, selectValue, stubTerrainTiles, waitForFrame } from "./contour-test-helpers";

export const appPerformanceCanvasBacking = { canvasSelector: outputSelector } satisfies ToolcraftPerformanceCanvasBacking;

async function prepare(page: Page): Promise<void> {
  await stubTerrainTiles(page);
  await page.goto("/");
  await waitForFrame(page);
  await selectValue(page, "canvas.aspectRatio", "Custom");
}

async function action({ page, path, phase }: ToolcraftPerformancePathActionContext): Promise<void> {
  if (path.interaction === "initial-render") {
    await page.reload();
    await waitForFrame(page);
    return;
  }
  if (path.interaction === "viewport-drag") {
    await page.mouse.move(160, 160);
    await page.keyboard.down("Space");
    await page.mouse.down();
    await page.mouse.move(210, 195, { steps: 8 });
    await page.mouse.up();
    await page.keyboard.up("Space");
    return;
  }
  if (path.interaction === "viewport-zoom") {
    await page.getByRole("button", { exact: true, name: "Zoom out" }).click();
    await waitForFrame(page);
    return;
  }
  if (path.interaction === "control-drag") {
    const field = await getToolcraftControlFieldByTarget(page, "place.latitude");
    await reveal(field);
    const slider = field.getByRole("slider");
    const thumb = await slider.boundingBox();
    const track = await field.locator('[data-slot="slider"]').first().boundingBox();
    expect(thumb).not.toBeNull();
    expect(track).not.toBeNull();
    await page.mouse.move(thumb!.x + thumb!.width / 2, thumb!.y + thumb!.height / 2);
    await page.mouse.down();
    await page.mouse.move(track!.x + track!.width * (phase === "warm" ? 0.3 : 0.7), track!.y + track!.height / 2, { steps: 8 });
    await waitForFrame(page);
    await page.mouse.up();
    return;
  }
  if (path.invalidates.length) {
    const peaks = await getToolcraftControlFieldByTarget(page, "place.peak");
    await reveal(peaks);
    await peaks.getByRole("button", { exact: true, name: phase === "warm" ? "Everest" : "Mount Fuji" }).click();
    await waitForFrame(page);
    return;
  }
  await fieldValue(page, "appearance.background", phase === "warm" ? "#EDE6D6" : "#E8EDE4");
  await waitForFrame(page);
}

export const appPerformancePathAdapters = contourPerformancePaths.map((path): ToolcraftPerformancePathAdapter => {
  const common = {
    pathId: path.id,
    prepare,
    ...(path.workloadDimensions.length ? { fixtureApplications: (page: Page) => contourFixtureApplications(page, path.workloadDimensions) } : {}),
    settlePhase: ({ page }: ToolcraftPerformancePathActionContext) => waitForFrame(page),
  };
  if (path.interaction === "export")
    return {
      ...common,
      output: {
        kind: "download",
        label: "Export PNG",
        verify: async (download) => {
          const stream = await download.createReadStream();
          let size = 0;
          for await (const chunk of stream) size += chunk.length;
          expect(size).toBeGreaterThan(100);
        },
      },
    };
  return {
    ...common,
    action,
    observeOutcome: async ({ page }) =>
      (await resolveToolcraftProductRasterProbe(page, { region: { height: 160, width: 240, x: 200, y: 200 }, selector: path.invalidates.length ? outputSelector : "[data-toolcraft-editable-canvas]" })).capture(),
    verifyOutcome: ({ page }) => waitForFrame(page),
  };
});
