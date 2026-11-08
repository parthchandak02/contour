import type { ToolcraftControlSchema } from "@/toolcraft/runtime";

import { AREAS, CONTOUR_DEFAULTS, CONTOUR_TARGETS, PEAK_PRESETS, STYLES } from "./contour-settings";

const live = {
  applicability: { mode: "always" },
  keyframeable: false,
  performanceReason: "Redraws one still map in a worker; terrain loads once per view and contours are cached per interval.",
  performanceRole: "responsiveness",
} as const;

export const placeControls = {
  peak: {
    actions: PEAK_PRESETS.map((peak) => ({ label: peak.label, value: peak.value, variant: "outline" as const })),
    applicability: { mode: "always" },
    description: "Centres the map on the landmark and picks an area and contour interval that suit it.",
    label: "Landmarks",
    performanceReason: "Sets four controls at once; one terrain load and redraw.",
    performanceRole: "responsiveness",
    target: CONTOUR_TARGETS.peakPreset,
    type: "actions",
  },
  latitude: { ...live, defaultValue: CONTOUR_DEFAULTS.latitude, description: "Centre of the map; north is positive.", label: "Latitude", max: 80, min: -80, sliderValueKind: "continuous", step: 0.001, target: CONTOUR_TARGETS.latitude, type: "slider", unit: "°" },
  longitude: { ...live, defaultValue: CONTOUR_DEFAULTS.longitude, description: "Centre of the map; east is positive.", label: "Longitude", max: 180, min: -180, sliderValueKind: "continuous", step: 0.001, target: CONTOUR_TARGETS.longitude, type: "slider", unit: "°" },
} as const satisfies Record<string, ToolcraftControlSchema>;

export const mapControls = {
  area: {
    ...live,
    defaultValue: CONTOUR_DEFAULTS.area,
    description: "How much ground the map covers, from a whole range (Wide) to a single face (Close).",
    label: "Area",
    options: AREAS.map((area) => ({ label: area.label, value: area.value })),
    target: CONTOUR_TARGETS.area,
    type: "segmented",
  },
  interval: { ...live, defaultValue: CONTOUR_DEFAULTS.interval, description: "Height between contour lines; every fifth line is a bolder index line.", label: "Contour interval", max: 500, min: 10, sliderValueKind: "continuous", step: 10, target: CONTOUR_TARGETS.interval, type: "slider", unit: "m" },
  style: {
    ...live,
    defaultValue: CONTOUR_DEFAULTS.style,
    description: "Tinted adds elevation colours and shading, Relief adds shading only, Lines draws contours alone.",
    label: "Style",
    options: STYLES.map((style) => ({ label: style.label, value: style.value })),
    target: CONTOUR_TARGETS.style,
    type: "segmented",
  },
} as const satisfies Record<string, ToolcraftControlSchema>;

export const backgroundControls = {
  include: { ...live, defaultValue: true, label: "Background", target: CONTOUR_TARGETS.includeBackground, type: "switch" },
  color: { ...live, defaultValue: CONTOUR_DEFAULTS.background, label: "Background color", target: CONTOUR_TARGETS.background, type: "color" },
} as const satisfies Record<string, ToolcraftControlSchema>;
