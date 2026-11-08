export const CONTOUR_TARGETS = {
  area: "map.area",
  background: "appearance.background",
  includeBackground: "export.includeBackground",
  interval: "map.interval",
  latitude: "place.latitude",
  longitude: "place.longitude",
  peakPreset: "place.peak",
  style: "map.style",
} as const;

export const AREAS = [
  { label: "Wide", value: "10", zoom: 10 },
  { label: "Broad", value: "11", zoom: 11 },
  { label: "Medium", value: "12", zoom: 12 },
  { label: "Close", value: "13", zoom: 13 },
] as const;
export type AreaValue = (typeof AREAS)[number]["value"];

export const STYLES = [
  { label: "Tinted", value: "tinted" },
  { label: "Relief", value: "relief" },
  { label: "Lines", value: "lines" },
] as const;
export type MapStyle = (typeof STYLES)[number]["value"];

export const CONTOUR_DEFAULTS = { area: "12" as AreaValue, background: "#F3EEE3", interval: 50, latitude: 45.976, longitude: 7.659, style: "tinted" as MapStyle } as const;

export const PEAK_PRESETS = [
  { area: "12", interval: 50, label: "Matterhorn", latitude: 45.976, longitude: 7.659, region: "Pennine Alps · Switzerland and Italy", value: "peak-matterhorn" },
  { area: "11", interval: 100, label: "Mount Fuji", latitude: 35.361, longitude: 138.727, region: "Honshu · Japan", value: "peak-fuji" },
  { area: "13", interval: 20, label: "Half Dome", latitude: 37.746, longitude: -119.533, region: "Yosemite · California", value: "peak-half-dome" },
  { area: "11", interval: 100, label: "Mount Rainier", latitude: 46.853, longitude: -121.76, region: "Cascade Range · Washington", value: "peak-rainier" },
  { area: "11", interval: 100, label: "Kilimanjaro", latitude: -3.067, longitude: 37.356, region: "Kilimanjaro Region · Tanzania", value: "peak-kilimanjaro" },
  { area: "12", interval: 100, label: "Everest", latitude: 27.988, longitude: 86.925, region: "Mahalangur Himal · Nepal and China", value: "peak-everest" },
  { area: "13", interval: 20, label: "Table Mountain", latitude: -33.963, longitude: 18.41, region: "Cape Town · South Africa", value: "peak-table-mountain" },
  { area: "12", interval: 50, label: "Grand Canyon", latitude: 36.1, longitude: -112.113, region: "Arizona · United States", value: "peak-grand-canyon" },
] as const;

export type ContourSettings = {
  area: AreaValue;
  background: string;
  includeBackground: boolean;
  interval: number;
  latitude: number;
  longitude: number;
  place: { label: string; region: string } | null;
  style: MapStyle;
  zoom: number;
};

const num = (value: unknown, fallback: number) => (typeof value === "number" && Number.isFinite(value) ? value : fallback);

function colorValue(value: unknown, fallback: string): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof (value as { hex?: unknown }).hex === "string") return (value as { hex: string }).hex;
  return fallback;
}

export function readContourSettings(values: Readonly<Record<string, unknown>>): ContourSettings {
  const latitude = num(values[CONTOUR_TARGETS.latitude], CONTOUR_DEFAULTS.latitude);
  const longitude = num(values[CONTOUR_TARGETS.longitude], CONTOUR_DEFAULTS.longitude);
  const area = AREAS.find((entry) => entry.value === values[CONTOUR_TARGETS.area]) ?? AREAS.find((entry) => entry.value === CONTOUR_DEFAULTS.area)!;
  const style = STYLES.find((entry) => entry.value === values[CONTOUR_TARGETS.style])?.value ?? CONTOUR_DEFAULTS.style;
  const peak = PEAK_PRESETS.find((preset) => Math.abs(preset.latitude - latitude) < 0.0005 && Math.abs(preset.longitude - longitude) < 0.0005);
  return {
    area: area.value,
    background: colorValue(values[CONTOUR_TARGETS.background], CONTOUR_DEFAULTS.background),
    includeBackground: values[CONTOUR_TARGETS.includeBackground] !== false,
    interval: Math.max(10, num(values[CONTOUR_TARGETS.interval], CONTOUR_DEFAULTS.interval)),
    latitude,
    longitude,
    place: peak ? { label: peak.label, region: peak.region } : null,
    style,
    zoom: area.zoom,
  };
}
