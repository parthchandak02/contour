import { expect, type Page } from "@playwright/test";

import { getToolcraftControlFieldByTarget } from "./browser-control-target-helpers";
import type { ToolcraftCompiledFixtureApplications } from "./performance-compiled-fixture-runtime";
import { fieldValue, selectValue, setSlider } from "./contour-test-helpers";

async function sliderValue(page: Page, target: string): Promise<number> {
  const field = await getToolcraftControlFieldByTarget(page, target);
  return Number((await field.getByRole("button", { name: /^Edit .* value$/ }).innerText()).replace(/[^\d.-]/g, ""));
}

export async function readContourZoom(page: Page): Promise<number> {
  const toolbar = page.locator('[data-toolcraft-inspect-toolbar="true"]');
  return Number((await toolbar.innerText()).match(/(\d+)%/)?.[1]);
}

async function setZoom(page: Page, value: number): Promise<void> {
  const current = await readContourZoom(page);
  if ((value - current) % 10 !== 0) throw new Error(`Zoom ${value} is not reachable through the runtime toolbar.`);
  const button = page.getByRole("button", { exact: true, name: value > current ? "Zoom in" : "Zoom out" });
  for (let i = 0; i < Math.abs(value - current) / 10; i += 1) await button.click();
  await expect.poll(() => readContourZoom(page)).toBe(value);
}

export function contourFixtureApplications(page: Page, dimensions: readonly string[]): ToolcraftCompiledFixtureApplications {
  const applications: ToolcraftCompiledFixtureApplications = {};
  for (const id of dimensions) {
    if (id === "zoom") applications[id] = { applyValue: (value) => setZoom(page, Number(value)), observeValue: () => readContourZoom(page) };
    else if (id === "resolution")
      applications[id] = {
        applyValue: (value) => selectValue(page, "export.image.resolution", String(value).toUpperCase()),
        observeValue: async () => (await (await getToolcraftControlFieldByTarget(page, "export.image.resolution")).getByRole("combobox").innerText()).toLowerCase(),
      };
    else if (id === "width" || id === "height") {
      const target = `canvas.size.${id}`;
      applications[id] = {
        applyValue: async (value) => {
          await page.getByRole("switch", { exact: true, name: "Infinity canvas" }).uncheck();
          await fieldValue(page, target, String(value));
        },
        observeValue: async () => Number(await (await getToolcraftControlFieldByTarget(page, target)).getByRole("textbox").inputValue()),
      };
    } else applications[id] = { applyValue: (value) => setSlider(page, "canvas.renderScale", Number(value)), observeValue: () => sliderValue(page, "canvas.renderScale") };
  }
  return applications;
}
