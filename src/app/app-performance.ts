import { defineToolcraftPerformance, deriveToolcraftPerformancePaths, type ToolcraftPerformanceScenario } from "@/toolcraft/runtime";

import { contourPerformanceModel } from "../contour/contour-performance-model";
import { appSchema } from "./app-schema";

export const contourPerformancePaths = deriveToolcraftPerformancePaths(appSchema, contourPerformanceModel);

export const appPerformance = defineToolcraftPerformance({
  ...contourPerformanceModel,
  scenarios: contourPerformancePaths.map(
    (path, index): ToolcraftPerformanceScenario =>
      ({
        automated: true,
        automatedTestName: "contour render plan has valid derived paths and fixtures",
        browser: true,
        browserTestName: `browser perf: toolcraft path ${path.id}`,
        coversTargets: path.targets,
        expectedObservable: "The map poster, viewport or decoded artifact reflects the exact applied operation.",
        fixture: "Compiled reachable contour workload",
        id: `contour-path-${index}`,
        interaction: path.interaction,
        pathId: path.id,
        uiSelector: '[data-testid="contour-output"]',
        ...(path.interaction === "export" ? { actionValue: "export.png", completionEvidence: "download" as const, controlLabel: "Export PNG" } : {}),
      }) as ToolcraftPerformanceScenario,
  ),
});
