import type { Page } from "@playwright/test";

import { observeInfinityCanvas, expectToolcraftInfinityCanvasModeEvidence } from "./browser-infinity-canvas-evidence";
import { expectToolcraftDiscreteSliderMarkers } from "./performance-control-layout-helpers";
import { expectToolcraftProductObservableToChange } from "./product-observable-helpers";
import { fieldValue, fitScene, openContour, outputSelector, setSlider, waitForFrame } from "./contour-test-helpers";
import { expect, expectToolcraftCanvasRenderScaleEvidence, expectToolcraftReferenceParity, test } from "./toolcraft-product-test";

test("browser: contour canvas sizing changes output", async ({ page }) => {
  const session = await openContour(page);
  await expectToolcraftProductObservableToChange(session, session.controlAction("canvas.size.width", () => fieldValue(page, "canvas.size.width", "960")), {
    requirementId: "canvas.size",
    selector: outputSelector,
  });
  await expectToolcraftReferenceParity(async () => page.locator(outputSelector).evaluate((canvas: HTMLCanvasElement) => canvas.width > 0 && canvas.height > 0), true, {
    requirementId: "canvas.size",
    target: "canvas.size.width",
  });
});

test("browser: contour backing preserves selected render scale", async ({ page }) => {
  const session = await openContour(page);
  await fitScene(page);
  await expectToolcraftProductObservableToChange(session, session.controlAction("canvas.renderScale", () => setSlider(page, "canvas.renderScale", 1)), {
    requirementId: "canvas.scale",
    selector: outputSelector,
  });
  await setSlider(page, "canvas.renderScale", 2);
  await expectToolcraftDiscreteSliderMarkers(page, "canvas.renderScale", "canvas.scale");
  await expectToolcraftCanvasRenderScaleEvidence(page, {
    canvasSelector: outputSelector,
    requirementId: "canvas.scale",
    selectedScale: 2,
    stateTransitions: [
      { run: async () => setSlider(page, "place.latitude", 20), state: "interaction" },
      { run: async () => waitForFrame(page), state: "steady" },
    ],
    target: "canvas.renderScale",
  });
});

async function continuity(page: Page, action: () => Promise<void>) {
  const host = await page.locator("[data-toolcraft-product-scene]").elementHandle();
  const output = await page.locator(outputSelector).elementHandle();
  await action();
  return {
    productHostPreserved: await host!.evaluate((node) => node.isConnected && node === document.querySelector("[data-toolcraft-product-scene]")),
    productOutputPreserved: await output!.evaluate((node) => node.isConnected && node === document.querySelector('[data-testid="contour-output"]')),
  };
}

test("browser: contour infinity preserves scene and viewport", async ({ page }) => {
  await openContour(page);
  const toggle = page.getByRole("switch", { exact: true, name: "Infinity canvas" });
  await fitScene(page);
  const before = await observeInfinityCanvas(page);
  const beforeToEnabled = await continuity(page, () => toggle.check());
  const enabled = await observeInfinityCanvas(page);
  await page.mouse.move(180, 200);
  await page.keyboard.down("Space");
  await page.mouse.down();
  await page.mouse.move(224, 228, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.up("Space");
  const afterPan = await observeInfinityCanvas(page);
  await expect(page.locator('[data-slot="toolcraft-runtime-app"]')).toHaveAttribute("data-toolcraft-persistence-status", "success");
  await page.reload();
  await waitForFrame(page);
  const afterReload = await observeInfinityCanvas(page);
  const afterReloadToRestored = await continuity(page, () => toggle.uncheck());
  const restored = await observeInfinityCanvas(page);
  const restoredToUndone = await continuity(page, () => page.getByRole("button", { exact: true, name: "Undo" }).click());
  const undone = await observeInfinityCanvas(page);
  const undoneToRedone = await continuity(page, () => page.getByRole("button", { exact: true, name: "Redo" }).click());
  const redone = await observeInfinityCanvas(page);
  await expectToolcraftInfinityCanvasModeEvidence(
    { afterPan, afterReload, before, enabled, redone, restored, undone },
    { afterReloadToRestored, beforeToEnabled, restoredToUndone, undoneToRedone },
    { expectedFiniteSize: { height: 540, width: 960 }, expectedSceneRect: { height: 540, width: 960, x: -480, y: -270 }, requirementId: "canvas.infinity", target: "canvas.infinity" },
  );
});
