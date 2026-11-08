import { openContour } from "./contour-test-helpers";
import { expect, test } from "./toolcraft-product-test";

test("browser: contour opens in the Toolcraft shell", async ({ page }) => {
  await openContour(page);
  await expect(page.getByRole("button", { exact: true, name: "Export PNG" })).toBeVisible();
  await expect(page.getByRole("button", { exact: true, name: "Matterhorn" })).toBeVisible();
  await expect(page.getByRole("application", { name: "Canvas viewport" })).toBeVisible();
});
