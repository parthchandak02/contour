import { registerToolcraftRendererPipeline, type ToolcraftRendererPipelinePassContract } from "@/toolcraft/runtime";

import type { ContourRasterClient } from "./contour-raster-client";
import { CONTOUR_TARGETS } from "./contour-settings";

const productTargets = [CONTOUR_TARGETS.latitude, CONTOUR_TARGETS.longitude, CONTOUR_TARGETS.area, CONTOUR_TARGETS.interval, CONTOUR_TARGETS.style, CONTOUR_TARGETS.background, CONTOUR_TARGETS.includeBackground];
const rasterInputs = [...productTargets, "canvas.size.width", "canvas.size.height", "canvas.renderScale", "canvas.zoom"];

export const contourPipeline = registerToolcraftRendererPipeline<{
  export: ToolcraftRendererPipelinePassContract<void>;
  raster: ToolcraftRendererPipelinePassContract<string | null, ContourRasterClient, readonly ["contour"]>;
}>()({
  interactionInvalidation: [
    { interaction: "initial-render", invalidates: ["raster"], targets: ["canvas"] },
    { interaction: "control-drag", invalidates: ["raster"], targets: [CONTOUR_TARGETS.latitude, CONTOUR_TARGETS.longitude, CONTOUR_TARGETS.interval, "canvas.renderScale"] },
    { interaction: "control-change", invalidates: ["raster"], targets: [CONTOUR_TARGETS.peakPreset, CONTOUR_TARGETS.area, CONTOUR_TARGETS.style, CONTOUR_TARGETS.background, CONTOUR_TARGETS.includeBackground, "canvas.size.width", "canvas.size.height"] },
    { interaction: "control-change", invalidates: [], mustNotInvalidate: ["raster"], targets: ["canvas.infinity", "canvas.workspaceBackground", "export.image.format", "export.image.resolution"] },
    { interaction: "viewport-drag", invalidates: [], mustNotInvalidate: ["raster"], targets: ["canvas"] },
    { interaction: "viewport-zoom", invalidates: ["raster"], targets: ["canvas"] },
    { interaction: "export", invalidates: ["export"], mustNotInvalidate: ["raster"], targets: ["export.image"] },
  ],
  passes: [
    {
      cacheKey: ["request"],
      cost: { dimensions: ["width", "height", "scale", "zoom"], frequency: "interaction", relationship: "product" },
      id: "raster",
      inputs: rasterInputs,
      invalidatedBy: rasterInputs,
      kind: "rasterize",
      lifecycle: { cache: "retained-resource", resourceScope: "renderer" },
      output: "preview",
      quality: "retina",
      runsOn: "worker",
      sceneBounds: { kind: "intrinsic", reason: "Contour is a map poster laid out inside its artboard; the map is clipped to its frame and every element is positioned from the frame size, so nothing is drawn outside it." },
    },
    {
      cost: { dimensions: ["resolution"], frequency: "batch", relationship: "product" },
      id: "export",
      inputs: [...productTargets, "export.image.resolution"],
      invalidatedBy: ["export.image"],
      kind: "export",
      lifecycle: { cache: "none", resourceScope: "call" },
      output: "export",
      quality: "export",
      runsOn: "export-only",
    },
  ],
  runtimeId: "contour-topo-poster-v1",
});

export const rasterPass = contourPipeline.getPass("raster");
export const exportPass = contourPipeline.getPass("export");
