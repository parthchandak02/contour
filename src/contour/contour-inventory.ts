import type { ToolcraftControlSectionInventoryEntry, ToolcraftProductReadiness } from "../app/acceptance/types";
import { CONTOUR_TARGETS } from "./contour-settings";

export const contourSectionInventory = [
  {
    entity: "Output background", entityId: "background",
    finiteSelectors: [{ reason: "Shows or hides the background fill and PNG alpha; the color stays editable either way.", role: "parameter", target: CONTOUR_TARGETS.includeBackground }],
    groupingReason: "One output background; runtime relocates this source pair into Settings.",
    id: "runtime.setup", targets: [CONTOUR_TARGETS.includeBackground, CONTOUR_TARGETS.background], title: "Settings",
  },
  {
    entity: "Map centre", entityId: "place", finiteSelectors: [],
    groupingReason: "Landmarks, latitude and longitude choose where the map is centred; landmarks only set existing controls.",
    id: "place", targets: [CONTOUR_TARGETS.peakPreset, CONTOUR_TARGETS.latitude, CONTOUR_TARGETS.longitude], title: "Place",
  },
  {
    entity: "Map rendering", entityId: "map",
    finiteSelectors: [
      { reason: "Chooses how much ground the map covers; every other control stays relevant.", role: "parameter", target: CONTOUR_TARGETS.area },
      { reason: "Chooses the underlay drawn beneath the contour lines; every other control stays relevant.", role: "parameter", target: CONTOUR_TARGETS.style },
    ],
    groupingReason: "Area, contour interval and style decide how the same terrain is drawn.",
    id: "map", targets: [CONTOUR_TARGETS.area, CONTOUR_TARGETS.interval, CONTOUR_TARGETS.style], title: "Map",
  },
  {
    entity: "Raster image output", entityId: "image-export",
    finiteSelectors: [
      { reason: "Selects PNG alpha support or opaque JPEG encoding.", role: "parameter", target: "export.image.format" },
      { reason: "Selects the output long-edge pixel size.", role: "parameter", target: "export.image.resolution" },
    ],
    groupingReason: "Runtime-owned image format and resolution govern one exported artifact.",
    id: "runtime.image-export", targets: ["export.image.format", "export.image.resolution"], title: "Image Export",
  },
] as const satisfies readonly ToolcraftControlSectionInventoryEntry[];

const edit = (id: string, target: string, detail: string) => ({
  alternative: { reason: "Persistent value controls on the poster would cover it.", surface: "canvas" as const },
  capability: "property-edit" as const, evidence: { detail, source: "usability-analysis" as const }, id,
  reason: "A global setting of the whole poster with no spatial handle.", selectionScope: { mode: "global" as const }, surface: "panel" as const, target,
});

export const contourReadiness: ToolcraftProductReadiness = {
  exportIntent: { image: { mode: "toolcraft-default" }, svg: { mode: "not-requested" }, video: { mode: "not-requested" } },
  interactionOwnership: [
    edit("latitude-property", CONTOUR_TARGETS.latitude, "Latitude is the centre of the whole map."),
    edit("longitude-property", CONTOUR_TARGETS.longitude, "Longitude is the centre of the whole map."),
    edit("area-property", CONTOUR_TARGETS.area, "Area applies to the whole map."),
    edit("interval-property", CONTOUR_TARGETS.interval, "The contour interval applies to every line."),
    edit("style-property", CONTOUR_TARGETS.style, "Style applies to the whole map."),
    edit("background-color-property", CONTOUR_TARGETS.background, "Runtime places the background color in Settings."),
    edit("background-include-property", CONTOUR_TARGETS.includeBackground, "Runtime places the Background switch in Settings."),
    {
      alternative: { reason: "A shortcut command has no position on the poster.", surface: "canvas" },
      capability: "command", evidence: { detail: "Landmark buttons set latitude, longitude, area and interval.", source: "usability-analysis" },
      id: "peak-command", reason: "Shortcuts sit beside the sliders they set.", surface: "panel", target: CONTOUR_TARGETS.peakPreset,
    },
  ],
  mode: "product",
  productName: "Contour",
  productSummary: "A topographic contour map of any place on Earth, from real elevation tiles: contour lines with bold index lines, optional elevation tint and hillshade, the summit, figures, legend and scale bar.",
  requestedBehavior: "Rebuild Contour on the current Toolcraft with a much better design: choose a place (sliders or landmarks), an area, a contour interval and a style, see a real topographic map as a poster, and export it as an image.",
  viewInteraction: { mode: "non-spatial", reason: "The output is a two-dimensional poster, not a three-dimensional scene." },
};
