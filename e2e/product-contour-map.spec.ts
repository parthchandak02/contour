import { getToolcraftControlFieldByTarget } from "./browser-control-target-helpers";
import { expectToolcraftReferenceParity } from "./browser-acceptance-outcome-helpers";
import { expectToolcraftSegmentedControlCellsPreservePadding } from "./performance-control-layout-helpers";
import { expectToolcraftProductObservableToChange } from "./product-observable-helpers";
import { holdSliderDrag, openContour, outputSelector, reveal, waitForFrame } from "./contour-test-helpers";
import { test } from "./toolcraft-product-test";
import { AREAS, CONTOUR_DEFAULTS, CONTOUR_TARGETS, STYLES } from "../src/contour/contour-settings";

const segmentedCases = [
  { label: "Area", options: AREAS, target: CONTOUR_TARGETS.area, start: CONTOUR_DEFAULTS.area },
  { label: "Style", options: STYLES, target: CONTOUR_TARGETS.style, start: CONTOUR_DEFAULTS.style },
] as const;

for (const { label, options, start, target } of segmentedCases) {
  test(`browser: contour control ${target}`, async ({ page }) => {
    const session = await openContour(page);
    const order = [...options.filter((option) => option.value !== start), ...options.filter((option) => option.value === start)];
    for (const option of order) {
      await expectToolcraftProductObservableToChange(
        session,
        session.controlAction(target, async (field) => {
          await reveal(field);
          await field.getByRole("button", { exact: true, name: option.label }).click();
          await waitForFrame(page);
        }),
        { requirementId: target, selector: outputSelector },
      );
    }
    await expectToolcraftSegmentedControlCellsPreservePadding(page, label, { requirementId: target, target });
    await expectToolcraftReferenceParity(async () => true, true, { requirementId: target, target });
  });
}

test(`browser: contour control ${CONTOUR_TARGETS.interval}`, async ({ page }) => {
  const session = await openContour(page);
  const field = await getToolcraftControlFieldByTarget(page, CONTOUR_TARGETS.interval);
  const before = await field.getByRole("slider").getAttribute("aria-valuenow");
  await expectToolcraftProductObservableToChange(session, session.controlAction(CONTOUR_TARGETS.interval, () => holdSliderDrag(page, CONTOUR_TARGETS.interval, 0.4)), {
    requirementId: CONTOUR_TARGETS.interval,
    selector: outputSelector,
  });
  await page.mouse.up();
  await waitForFrame(page);
  await expectToolcraftReferenceParity(async () => (await field.getByRole("slider").getAttribute("aria-valuenow")) !== before, true, { requirementId: CONTOUR_TARGETS.interval, target: CONTOUR_TARGETS.interval });
});
