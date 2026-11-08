import { getToolcraftControlFieldByTarget } from "./browser-control-target-helpers";
import { expectToolcraftReferenceParity } from "./browser-acceptance-outcome-helpers";
import { expectToolcraftProductObservableToChange } from "./product-observable-helpers";
import { holdSliderDrag, openContour, outputSelector, reveal, waitForFrame } from "./contour-test-helpers";
import { expect, test } from "./toolcraft-product-test";
import { CONTOUR_TARGETS, PEAK_PRESETS } from "../src/contour/contour-settings";

for (const [target, ratio] of [[CONTOUR_TARGETS.latitude, 0.3], [CONTOUR_TARGETS.longitude, 0.8]] as const) {
  test(`browser: contour control ${target}`, async ({ page }) => {
    const session = await openContour(page);
    const field = await getToolcraftControlFieldByTarget(page, target);
    const before = await field.getByRole("slider").getAttribute("aria-valuenow");
    await expectToolcraftProductObservableToChange(session, session.controlAction(target, () => holdSliderDrag(page, target, ratio)), { requirementId: target, selector: outputSelector });
    await page.mouse.up();
    await waitForFrame(page);
    await expectToolcraftReferenceParity(async () => (await field.getByRole("slider").getAttribute("aria-valuenow")) !== before, true, { requirementId: target, target });
  });
}

test(`browser: contour control ${CONTOUR_TARGETS.peakPreset}`, async ({ page }) => {
  const session = await openContour(page);
  const order = [...PEAK_PRESETS.slice(1), PEAK_PRESETS[0]];
  for (const peak of order) {
    await expectToolcraftProductObservableToChange(
      session,
      session.controlAction(CONTOUR_TARGETS.peakPreset, async (field) => {
        await reveal(field);
        await field.getByRole("button", { exact: true, name: peak.label }).click();
        await waitForFrame(page);
      }),
      { requirementId: CONTOUR_TARGETS.peakPreset, selector: outputSelector },
    );
    await expect((await getToolcraftControlFieldByTarget(page, CONTOUR_TARGETS.latitude)).getByRole("slider")).toHaveAttribute("aria-valuenow", String(peak.latitude));
  }
  await expectToolcraftReferenceParity(
    async () => (await getToolcraftControlFieldByTarget(page, CONTOUR_TARGETS.longitude)).getByRole("slider").getAttribute("aria-valuenow"),
    String(PEAK_PRESETS[0].longitude),
    { requirementId: CONTOUR_TARGETS.peakPreset, target: CONTOUR_TARGETS.peakPreset },
  );
});
