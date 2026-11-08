import type { ToolcraftProductExportRenderer } from "@/toolcraft/runtime";

import { drawContour } from "./contour-draw";
import { exportPass } from "./contour-pipeline";
import { readContourSettings } from "./contour-settings";
import { loadTerrain } from "./terrain";

export const contourExport: ToolcraftProductExportRenderer = {
  baseFileName: "contour",
  async renderFrame({ context, frame, rendererPipeline, signal, state }) {
    const settings = readContourSettings(state.values);
    const terrain = await loadTerrain({ latitude: settings.latitude, longitude: settings.longitude, zoom: settings.zoom });
    const render = () => {
      signal.throwIfAborted();
      context.save();
      context.translate(frame.x, frame.y);
      drawContour(context, frame.width, frame.height, settings, terrain);
      context.restore();
      signal.throwIfAborted();
    };
    if (rendererPipeline) await rendererPipeline.runPass(exportPass, undefined, render);
    else render();
  },
};
