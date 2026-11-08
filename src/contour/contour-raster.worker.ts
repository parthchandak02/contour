/// <reference lib="webworker" />
import { drawContour } from "./contour-draw";
import type { ContourRasterRequest, ContourRasterResponse } from "./contour-raster-protocol";

declare const self: DedicatedWorkerGlobalScope;
const canvas = new OffscreenCanvas(1, 1);

self.onmessage = (event: MessageEvent<ContourRasterRequest>) => {
  const { backingHeight, backingWidth, height, id, settings, terrain, width } = event.data;
  try {
    canvas.width = backingWidth;
    canvas.height = backingHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D is unavailable");
    context.setTransform(backingWidth / width, 0, 0, backingHeight / height, 0, 0);
    drawContour(context, width, height, settings, terrain);
    const bitmap = canvas.transferToImageBitmap();
    self.postMessage({ bitmap, id } satisfies ContourRasterResponse, [bitmap]);
  } catch (error) {
    self.postMessage({ error: String(error), id } satisfies ContourRasterResponse);
  }
};
