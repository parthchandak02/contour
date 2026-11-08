import type {
  ToolcraftComponentAcceptance,
  ToolcraftControlSectionInventoryEntry,
  ToolcraftProductReadiness,
  ToolcraftTransferMode,
} from "./acceptance/types";
import { appSchema } from "./app-schema";
import { contourReadiness, contourSectionInventory } from "../contour/contour-inventory";
import { AREAS, CONTOUR_TARGETS, PEAK_PRESETS, STYLES } from "../contour/contour-settings";

export const appTransferMode: ToolcraftTransferMode = {
  animationIntent: { mode: "none" },
  mode: "new-toolcraft-app",
  referenceInputs: [],
};

export const appProductReadiness: ToolcraftProductReadiness = contourReadiness;

export const appControlSectionInventory: readonly ToolcraftControlSectionInventoryEntry[] = contourSectionInventory;

type Budget = "extended-io" | "standard";
const browser = (testName: string, file: `e2e/${string}.spec.ts`, budget: Budget = "standard") => ({ budget, file, testName });

const domainFile = (id: string) => `e2e/product-contour-${id.split(".")[0]}.spec.ts` as const;

const sliderRow = (id: string, target: string, label: string, observable: string, interactionId: string): ToolcraftComponentAcceptance => ({
  automated: true,
  automatedTestName: `contour control ${target}`,
  browser: browser(`browser: contour control ${target}`, domainFile(id)),
  componentType: "slider",
  evidence: "product-output",
  expectedObservable: observable,
  fixture: "Default Matterhorn with stubbed elevation tiles",
  id,
  interactionId,
  kind: "control",
  target,
  userAction: `Drag the ${label} slider.`,
});

const actionRow = (id: string, target: string, values: readonly string[], observable: string, interactionId: string): ToolcraftComponentAcceptance => ({
  actionCoverage: values,
  automated: true,
  automatedTestName: `contour control ${target}`,
  browser: browser(`browser: contour control ${target}`, domainFile(id)),
  componentType: "actions",
  evidence: "product-output",
  expectedObservable: observable,
  fixture: "Default Matterhorn with stubbed elevation tiles",
  id,
  interactionId,
  kind: "control",
  target,
  userAction: "Click every button.",
});

const runtimeRow = (id: string, target: string, evidence: ToolcraftComponentAcceptance["evidence"], testName: string, file: `e2e/${string}.spec.ts`, budget: Budget = "standard"): ToolcraftComponentAcceptance => ({
  automated: true,
  automatedTestName: `contour contract ${id}`,
  browser: browser(testName, file, budget),
  componentType: id,
  evidence,
  expectedObservable: `The real product output and runtime workspace implement ${id}.`,
  fixture: "Default settings and real Toolcraft controls",
  id,
  kind: "runtime",
  target,
  userAction: `Exercise ${id} through its visible controls.`,
});

const exportTest = "browser: contour image export delivers every format and size";

export const appAcceptance: readonly ToolcraftComponentAcceptance[] = [
  actionRow("place.peak", CONTOUR_TARGETS.peakPreset, PEAK_PRESETS.map((peak) => peak.value), "Each landmark recentres the map, names it on the poster and sets a suitable area and interval.", "peak-command"),
  sliderRow("place.latitude", CONTOUR_TARGETS.latitude, "Latitude", "The map recentres: new terrain loads and the contour lines, summit and figures change.", "latitude-property"),
  sliderRow("place.longitude", CONTOUR_TARGETS.longitude, "Longitude", "The map recentres: new terrain loads and the poster changes.", "longitude-property"),
  {
    ...sliderRow("map.area", CONTOUR_TARGETS.area, "Area", "Each area loads terrain at another scale; the lines, area figure and scale bar change.", "area-property"),
    componentType: "segmented",
    optionCoverage: AREAS.map((area) => area.value),
    userAction: "Choose every Area option.",
  },
  sliderRow("map.interval", CONTOUR_TARGETS.interval, "Contour interval", "Lines get denser or sparser and the interval figure changes.", "interval-property"),
  {
    ...sliderRow("map.style", CONTOUR_TARGETS.style, "Style", "Tinted adds elevation colours and a legend, Relief shading only, Lines no underlay.", "style-property"),
    componentType: "segmented",
    optionCoverage: STYLES.map((style) => style.value),
    userAction: "Choose every Style option.",
  },
  {
    ...runtimeRow("appearance.background", CONTOUR_TARGETS.background, "product-output", "browser: contour background color changes output", "e2e/product-contour-appearance.spec.ts"),
    componentType: "color",
    interactionId: "background-color-property",
    kind: "control",
  },
  {
    ...runtimeRow("background.output", CONTOUR_TARGETS.includeBackground, "product-output", "browser: contour background output follows runtime semantics", "e2e/product-contour-background.spec.ts"),
    backgroundOutputCoverage: "all-required-background-output",
    componentType: "switch",
    interactionId: "background-include-property",
    kind: "control",
  },
  ...(["format", "resolution"] as const).map(
    (key): ToolcraftComponentAcceptance => ({
      ...runtimeRow(`export.image.${key}`, `export.image.${key}`, "exported-bytes", exportTest, "e2e/product-contour-export.spec.ts", "extended-io"),
      componentType: "select",
      kind: "control",
      optionCoverage: key === "format" ? ["png", "jpg"] : ["2k", "4k", "8k"],
    }),
  ),
  {
    ...runtimeRow("export.image", "actions.output", "exported-bytes", exportTest, "e2e/product-contour-export.spec.ts", "extended-io"),
    actionCoverage: ["export.png"],
    componentType: "panelActions",
    kind: "control",
    exportArtifactCoverage: "all-required-image-export-behavior",
  },
  {
    ...runtimeRow("export.infinity", "actions.output", "exported-bytes", exportTest, "e2e/product-contour-export.spec.ts", "extended-io"),
    infinityCanvasCoverage: "scene-bounds-image-export",
  },
  {
    ...runtimeRow("canvas.size", "canvas.size.width", "product-output", "browser: contour canvas sizing changes output", "e2e/product-contour-canvas.spec.ts"),
  },
  {
    ...runtimeRow("canvas.scale", "canvas.renderScale", "product-output", "browser: contour backing preserves selected render scale", "e2e/product-contour-canvas.spec.ts"),
    renderScaleCoverage: { kind: "selected-backing-pixels", states: ["interaction", "steady"] },
  },
  {
    ...runtimeRow("canvas.infinity", "canvas.infinity", "viewport-side-effect", "browser: contour infinity preserves scene and viewport", "e2e/product-contour-canvas.spec.ts"),
    infinityCanvasCoverage: "mode-continuity-and-restoration",
  },
  {
    automated: true,
    automatedTestName: "declares production reload coverage for the starter schema",
    browser: {
      budget: "extended-io",
      file: "e2e/product-contour-persistence.spec.ts",
      testName: "browser: contour restores poster and workspace after reload",
    },
    componentType: "persistence",
    evidence: "persistence-state",
    expectedObservable: "Canvas size, zoom, the chosen landmark and the moved, collapsed Controls panel are restored after a real reload, and the poster matches its pre-reload pixels.",
    fixture: "Contour persisted workspace",
    id: "persistence.reload",
    kind: "runtime",
    persistenceCoverage: "reload",
    persistenceSlices: appSchema.persistence.storage === "localStorage" ? appSchema.persistence.include : [],
    target: "canvas.size.width",
    userAction: "Change Canvas width, pick Mount Fuji, zoom in, move and collapse Controls, wait for persistence, and reload the page.",
  },
];
