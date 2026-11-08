import { expectToolcraftReferenceParity } from "./browser-acceptance-outcome-helpers";
import { getToolcraftControlFieldByTarget } from "./browser-control-target-helpers";
import { expectToolcraftPersistenceState } from "./browser-state-evidence-helpers";
import { getToolcraftProductObservableSnapshot } from "./product-observable-helpers";
import { fieldValue, openContour, outputSelector, reveal, waitForFrame } from "./contour-test-helpers";
import { expect, test } from "./toolcraft-product-test";

test("browser: contour restores poster and workspace after reload", async ({ page }) => {
  const session = await openContour(page);
  const workspace = session.observe((root) => {
    const scene = root.querySelector<HTMLElement>("[data-toolcraft-editable-canvas]");
    const panel = root.querySelector<HTMLElement>('[data-panel-type="controls"]');
    const toolbar = root.querySelector('[data-toolcraft-inspect-toolbar="true"]');
    return {
      collapsed: !!root.querySelector('[aria-label="Expand controls"]'),
      offsetX: Number(panel?.dataset.panelOffsetX),
      offsetY: Number(panel?.dataset.panelOffsetY),
      width: scene?.style.width,
      zoom: [...(toolbar?.querySelectorAll("span") ?? [])].map((node) => node.textContent?.trim()).find((text) => /^\d+%$/.test(text ?? "")),
    };
  });
  let signature = "";
  const probe = { selector: outputSelector };
  await expectToolcraftPersistenceState(
    workspace,
    session.controlAction("canvas.size.width", async () => {
      await fieldValue(page, "canvas.size.width", "960");
      const peaks = await getToolcraftControlFieldByTarget(page, "place.peak");
      await reveal(peaks);
      await peaks.getByRole("button", { exact: true, name: "Mount Fuji" }).click();
      await page.getByRole("button", { exact: true, name: "Zoom in" }).click();
      const handle = page.locator('[data-panel-type="controls"] [data-panel-drag-handle=""]').first();
      const box = await handle.boundingBox();
      expect(box).not.toBeNull();
      await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
      await page.mouse.down();
      await page.mouse.move(box!.x + box!.width / 2 - 48, box!.y + box!.height / 2 + 24, { steps: 4 });
      await page.mouse.up();
      await page.getByRole("button", { exact: true, name: "Collapse controls" }).click();
      await waitForFrame(page);
      await expect(page.locator('[data-slot="toolcraft-runtime-app"]')).toHaveAttribute("data-toolcraft-persistence-status", "success");
      signature = await getToolcraftProductObservableSnapshot(page, probe);
    }),
    session.reload(),
    { collapsed: true, offsetX: -48, offsetY: 24, width: "960px", zoom: "60%" },
    {
      assertRestoredOutput: async () => {
        await waitForFrame(page);
        await expect.poll(() => getToolcraftProductObservableSnapshot(page, probe)).toBe(signature);
      },
      requirementId: "persistence.reload",
      stabilityIntervalMs: 0,
    },
  );
  await page.getByRole("button", { exact: true, name: "Expand controls" }).click();
  await expectToolcraftReferenceParity(
    async () => (await getToolcraftControlFieldByTarget(page, "place.latitude")).getByRole("slider").getAttribute("aria-valuenow"),
    "35.361",
    { requirementId: "persistence.reload", target: "canvas.size.width" },
  );
});
