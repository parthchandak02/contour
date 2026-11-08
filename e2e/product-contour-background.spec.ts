import { expectToolcraftReferenceParity } from "./browser-acceptance-outcome-helpers";
import { expectToolcraftBackgroundOutputSemantics } from "./browser-background-output-evidence";
import { expectToolcraftInfinityCanvasBackgroundEvidence, observeInfinityCanvasBackground } from "./browser-infinity-canvas-evidence";
import { inspectToolcraftImageDownload } from "./image-artifact-inspection";
import { expectToolcraftProductObservableToChange } from "./product-observable-helpers";
import { downloadImage, fieldValue, openContour, outputSelector, selectValue } from "./contour-test-helpers";
import { expect, test } from "./toolcraft-product-test";

test("browser: contour background output follows runtime semantics", async ({ page }) => {
  const session = await openContour(page);
  await selectValue(page, "export.image.resolution", "2K");
  const observe = session.observe((root) => {
    const background = root.querySelector<HTMLElement>("[data-toolcraft-finite-background-layer]");
    return { backgroundVisible: background !== null, outputSignature: background ? getComputedStyle(background).backgroundColor : "transparent" };
  });
  await expectToolcraftBackgroundOutputSemantics(
    observe,
    session.controlAction("export.includeBackground", async (field) => field.getByRole("switch").uncheck()),
    { backgroundVisible: false, outputSignature: "transparent" },
    session.targetAction("actions.output", () => downloadImage(page)),
    async (download) => {
      const result = await inspectToolcraftImageDownload({ backgroundRgba: [0, 0, 0, 0], download, page });
      return { ...result.inspection, backgroundAlpha: result.observation.normalizedPixels[3] };
    },
    { requirementId: "background.output" },
  );
  await page.getByRole("switch", { exact: true, name: "Background" }).check();
  await page.getByRole("switch", { exact: true, name: "Infinity canvas" }).check();
  const infinite = await observeInfinityCanvasBackground(page);
  await page.getByRole("switch", { exact: true, name: "Background" }).uncheck();
  const backgroundExcluded = await observeInfinityCanvasBackground(page);
  await page.getByRole("switch", { exact: true, name: "Background" }).check();
  const backgroundRestored = await observeInfinityCanvasBackground(page);
  await expectToolcraftInfinityCanvasBackgroundEvidence(
    { backgroundExcluded, backgroundRestored, infinite },
    { expectedBackgroundColor: "#F3EEE3", requirementId: "background.output", target: "export.includeBackground" },
  );
  await page.getByRole("switch", { exact: true, name: "Infinity canvas" }).uncheck();
  await expect(page.getByRole("switch", { exact: true, name: "Infinity canvas" })).not.toBeChecked();
});
