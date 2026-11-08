import { expectToolcraftReferenceParity } from "./browser-acceptance-outcome-helpers";
import { expectToolcraftBackgroundOutputSemantics } from "./browser-background-output-evidence";
import { expectToolcraftInfinityCanvasBackgroundEvidence, observeInfinityCanvasBackground } from "./browser-infinity-canvas-evidence";
import { inspectToolcraftImageDownload } from "./image-artifact-inspection";
import { expectToolcraftProductObservableToChange } from "./product-observable-helpers";
import { downloadImage, fieldValue, openContour, outputSelector, selectValue } from "./contour-test-helpers";
import { expect, test } from "./toolcraft-product-test";

test("browser: contour background color changes output", async ({ page }) => {
  const session = await openContour(page);
    await expectToolcraftProductObservableToChange(session, session.controlAction("appearance.background", () => fieldValue(page, "appearance.background", "#1B2027")), {
    requirementId: "appearance.background",
    selector: outputSelector,
  });
  await expectToolcraftReferenceParity(() => page.getByRole("textbox", { name: "Background color hex" }).inputValue(), "#1B2027", {
    requirementId: "appearance.background",
    target: "appearance.background",
  });
});
