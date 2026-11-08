import zlib from "node:zlib";

import { expect, type Locator, type Page } from "@playwright/test";

import { getToolcraftControlFieldByTarget } from "./browser-control-target-helpers";
import { createToolcraftBrowserProofSession } from "./browser-proof-session";
import { syntheticElevation } from "../src/contour/terrain";

export const outputSelector = '[data-testid="contour-output"]';

export async function waitForFrame(page: Page): Promise<void> {
  await expect(page.locator(outputSelector)).toHaveAttribute("data-frame-ready", "true", { timeout: 15_000 });
}

const tileCache = new Map<string, Buffer>();

function crcChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(body) >>> 0);
  return Buffer.concat([length, body, crc]);
}

/** A Terrarium-encoded 256x256 PNG of the synthetic massif, so the real decode path runs in tests. */
export function stubTilePng(zoom: number, x: number, y: number): Buffer {
  const key = `${zoom}/${x}/${y}`;
  const hit = tileCache.get(key);
  if (hit) return hit;
  const raw = Buffer.alloc(256 * (1 + 256 * 3));
  for (let row = 0; row < 256; row += 1) {
    const offset = row * (1 + 256 * 3);
    for (let col = 0; col < 256; col += 1) {
      const value = syntheticElevation(x * 256 + col, y * 256 + row, zoom) + 32768;
      const p = offset + 1 + col * 3;
      raw[p] = Math.floor(value / 256);
      raw[p + 1] = Math.floor(value % 256);
      raw[p + 2] = Math.floor((value % 1) * 256);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(256, 0);
  header.writeUInt32BE(256, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), crcChunk("IHDR", header), crcChunk("IDAT", zlib.deflateSync(raw)), crcChunk("IEND", Buffer.alloc(0))]);
  tileCache.set(key, png);
  return png;
}

export async function stubTerrainTiles(page: Page): Promise<void> {
  await page.route("https://elevation-tiles-prod.s3.amazonaws.com/**", async (route) => {
    const match = /terrarium\/(\d+)\/(\d+)\/(\d+)\.png/.exec(route.request().url());
    if (!match) return route.abort();
    await route.fulfill({ body: stubTilePng(Number(match[1]), Number(match[2]), Number(match[3])), contentType: "image/png", headers: { "access-control-allow-origin": "*" } });
  });
}

export async function openContour(page: Page) {
  await stubTerrainTiles(page);
  await page.goto("/");
  // A cold dev server may optimize dependencies and reload the page once; wait for a finished frame first
  await page.waitForLoadState("networkidle");
  await expect(page.locator(outputSelector)).toHaveAttribute("data-frame-ready", "true", { timeout: 30_000 });
  await expect(page.locator(outputSelector)).toHaveAttribute("data-terrain-source", "live");
  const session = await createToolcraftBrowserProofSession(page);
  await waitForFrame(page);
  return session;
}

export async function reveal(field: Locator): Promise<void> {
  await field.evaluate((element) => element.scrollIntoView({ block: "center" }));
}

export async function fieldValue(page: Page, target: string, value: string): Promise<void> {
  const field = await getToolcraftControlFieldByTarget(page, target);
  await reveal(field);
  const input = field.getByRole("textbox");
  await input.fill(value);
  await input.press("Enter");
}

export async function selectValue(page: Page, target: string, label: string): Promise<void> {
  const field = await getToolcraftControlFieldByTarget(page, target);
  await reveal(field);
  await field.getByRole("combobox").click();
  await page.getByRole("option", { exact: true, name: label }).click();
}

export async function setSlider(page: Page, target: string, value: number): Promise<void> {
  const field = await getToolcraftControlFieldByTarget(page, target);
  await reveal(field);
  await field.getByRole("button", { name: /^Edit .* value$/ }).click();
  const input = field.getByRole("textbox");
  await expect(input).toBeFocused();
  await input.fill(String(value));
  await input.press("Enter");
  await expect(field.getByRole("button", { name: /^Edit .* value$/ })).toContainText(String(value));
}

/** Press a slider thumb and drag it toward `ratio` of the track while the pointer stays down. */
export async function holdSliderDrag(page: Page, target: string, ratio: number): Promise<void> {
  const field = await getToolcraftControlFieldByTarget(page, target);
  await reveal(field);
  const slider = field.getByRole("slider");
  const thumb = await slider.boundingBox();
  const track = await field.locator('[data-slot="slider"]').first().boundingBox();
  expect(thumb).not.toBeNull();
  expect(track).not.toBeNull();
  await page.mouse.move(thumb!.x + thumb!.width / 2, thumb!.y + thumb!.height / 2);
  await page.mouse.down();
  await page.mouse.move(track!.x + track!.width * ratio, track!.y + track!.height / 2, { steps: 8 });
}

export async function downloadImage(page: Page) {
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /^Export (PNG|JPG)$/ }).click();
  return download;
}

export async function fitScene(page: Page): Promise<void> {
  await page.getByRole("switch", { exact: true, name: "Infinity canvas" }).uncheck();
  await fieldValue(page, "canvas.size.width", "960");
  await page.getByRole("button", { exact: true, name: "Center canvas" }).click();
  await waitForFrame(page);
}
