import { expectToolcraftReferenceParity } from "./browser-acceptance-outcome-helpers";
import { expectToolcraftInfinityCanvasImageExportEvidence } from "./browser-infinity-canvas-evidence";
import { expectToolcraftImageExportArtifact } from "./browser-media-export-evidence";
import { inspectToolcraftImageDownload } from "./image-artifact-inspection";
import { downloadImage, openContour, selectValue } from "./contour-test-helpers";
import { test } from "./toolcraft-product-test";
import { contourLayout, TINT_STOPS } from "../src/contour/contour-draw";
import { CONTOUR_DEFAULTS } from "../src/contour/contour-settings";

const hex = (color: string) => [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16), 255] as const;
const backgroundRgba = hex(CONTOUR_DEFAULTS.background);
const { legend } = contourLayout(1920, 1080);

const posterArtifact = {
  backgroundRgba,
  // Measured from a real export of the default map with stubbed terrain tiles
  expectedBounds: { height: 0.84375, width: 0.90625, x: 0.046875, y: 0.09375 },
  expectedPixels: [
    { rgba: hex(TINT_STOPS[0]), xRatio: (legend.x + legend.swatchWidth / 2) / 1920, yRatio: (legend.y + legend.swatchHeight / 2) / 1080 },
    { rgba: backgroundRgba, xRatio: 0.02, yRatio: 0.02 },
  ],
};

test("browser: contour image export delivers every format and size", async ({ page }) => {
  const session = await openContour(page);
  const artifact = posterArtifact;
  for (const [format, mediaType] of [["PNG", "image/png"], ["JPG", "image/jpeg"]] as const) {
    await selectValue(page, "export.image.format", format);
    for (const [resolution, width] of [["2K", 2048], ["4K", 4096], ["8K", 8192]] as const) {
      await selectValue(page, "export.image.resolution", resolution);
      await expectToolcraftImageExportArtifact(session.targetAction("actions.output", () => downloadImage(page)), {
        ...artifact,
        additionalArtifactRequirements: [
          { requirementId: "export.image.format", target: "export.image.format" },
          { requirementId: "export.image.resolution", target: "export.image.resolution" },
        ],
        expectedHeight: (width * 9) / 16,
        expectedMediaType: mediaType,
        expectedWidth: width,
        page,
        requirementId: "export.image",
      });
    }
  }
  await selectValue(page, "export.image.format", "PNG");
  await selectValue(page, "export.image.resolution", "2K");
  await page.getByRole("switch", { exact: true, name: "Infinity canvas" }).uncheck();
  const finite = (await inspectToolcraftImageDownload({ backgroundRgba, download: await downloadImage(page), page })).inspection;
  await page.getByRole("switch", { exact: true, name: "Infinity canvas" }).check();
  const infinite = (await inspectToolcraftImageDownload({ backgroundRgba, download: await downloadImage(page), page })).inspection;
  await expectToolcraftInfinityCanvasImageExportEvidence({ finite, infinite }, { expectedSize: { height: 1152, width: 2048 }, requirementId: "export.infinity", target: "actions.output" });
  await expectToolcraftReferenceParity(async () => [infinite.width / infinite.height, infinite.decodedPixelHash === finite.decodedPixelHash], [16 / 9, true], { requirementId: "export.infinity", target: "actions.output" });
});
