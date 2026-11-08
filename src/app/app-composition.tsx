import { getToolcraftFiniteArtboardRect } from "@/toolcraft/runtime";
import { composeToolcraftApp } from "@/toolcraft/runtime/react";

import { handleContourAction } from "../contour/contour-actions";
import { ContourCanvas } from "../contour/ContourCanvas";
import { contourExport } from "../contour/contour-export";
import { contourPipeline } from "../contour/contour-pipeline";
import { appSchema } from "./app-schema";

export const appComposition = composeToolcraftApp(appSchema, {
  actions: { onPanelAction: handleContourAction },
  renderer: { pipelineRegistration: contourPipeline },
  scene: {
    canvasContent: <ContourCanvas />,
    rasterFrameRenderer: contourExport,
    renderDefaultCanvasMedia: false,
    sceneBoundsProvider: ({ state }) => [getToolcraftFiniteArtboardRect(state.canvas.size)],
  },
});
