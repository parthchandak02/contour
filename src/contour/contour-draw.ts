// Draws one Contour frame in scene coordinates. The runtime paints the Background; this is foreground.

import type { ContourSettings } from "./contour-settings";
import type { TerrainData } from "./terrain";

const SERIF = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif";
const SANS = "'Avenir Next', 'Helvetica Neue', Arial, sans-serif";

/** Hypsometric stops from lowest to highest ground in view. */
export const TINT_STOPS = ["#B7C8A0", "#DAD8A6", "#E7CB9C", "#D3A982", "#B89D8E", "#F6F4F0"] as const;
const MAX_LEVELS = 320;

type Rgb = [number, number, number];

function rgb(hex: string): Rgb {
  const v = hex.replace("#", "");
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

function luminance(hex: string): number {
  if (!/^#?[0-9a-f]{6}$/i.test(hex.trim())) return 1;
  const [r, g, b] = rgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function isDark(settings: Pick<ContourSettings, "background" | "includeBackground">): boolean {
  return settings.includeBackground && luminance(settings.background) < 0.45;
}

export function contourInk(settings: Pick<ContourSettings, "background" | "includeBackground">): string {
  return isDark(settings) ? "#ECE6D9" : "#5E3B22";
}

export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Tint stop colours, dimmed on dark backgrounds so the lines stay readable. */
export function tintStops(dark: boolean): string[] {
  if (!dark) return [...TINT_STOPS];
  return TINT_STOPS.map((hex) => `#${rgb(hex).map((c) => Math.round(c * 0.42).toString(16).padStart(2, "0")).join("")}`);
}

function tintAt(stops: Rgb[], t: number): Rgb {
  const x = Math.max(0, Math.min(0.9999, t)) * (stops.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const a = stops[i];
  const b = stops[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

/** Contour levels for the terrain at an interval; widened so a map never has more than MAX_LEVELS lines. */
export function contourLevels(terrain: Pick<TerrainData, "max" | "min">, interval: number): { index: number; levels: number[]; step: number } {
  let step = interval;
  while ((terrain.max - terrain.min) / step > MAX_LEVELS) step *= 2;
  const levels: number[] = [];
  for (let level = Math.ceil(terrain.min / step) * step; level <= terrain.max; level += step) levels.push(level);
  return { index: step * 5, levels, step };
}

/** Marching squares: line segments [x0, y0, x1, y1, ...] in grid units for each level. */
export function traceContours(values: readonly number[], cols: number, rows: number, levels: readonly number[]): number[][] {
  const out: number[][] = levels.map(() => []);
  if (!levels.length) return [];
  const first = levels[0];
  const step = levels.length > 1 ? levels[1] - levels[0] : 1;
  for (let row = 0; row < rows - 1; row += 1) {
    for (let col = 0; col < cols - 1; col += 1) {
      const a = values[row * cols + col];
      const b = values[row * cols + col + 1];
      const c = values[(row + 1) * cols + col + 1];
      const d = values[(row + 1) * cols + col];
      const lo = Math.min(a, b, c, d);
      const hi = Math.max(a, b, c, d);
      const startIndex = Math.max(0, Math.ceil((lo - first) / step));
      for (let li = startIndex; li < levels.length && levels[li] <= hi; li += 1) {
        const level = levels[li];
        const points: number[] = [];
        const edge = (v0: number, v1: number, x0: number, y0: number, x1: number, y1: number) => {
          if ((v0 < level) !== (v1 < level)) {
            const t = (level - v0) / (v1 - v0);
            points.push(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
          }
        };
        edge(a, b, col, row, col + 1, row);
        edge(b, c, col + 1, row, col + 1, row + 1);
        edge(c, d, col + 1, row + 1, col, row + 1);
        edge(d, a, col, row + 1, col, row);
        if (points.length === 4) out[li].push(...points);
        else if (points.length === 8) out[li].push(...points);
      }
    }
  }
  return out;
}

/** RGBA pixels (one per grid cell) for the shaded or tinted underlay. */
export function reliefPixels(terrain: TerrainData, style: ContourSettings["style"], dark: boolean, ink: string): Uint8ClampedArray {
  const { cols, elevations, metresPerCell, rows } = terrain;
  const pixels = new Uint8ClampedArray(cols * rows * 4);
  if (style === "lines") return pixels;
  const exaggeration = Math.max(1, 1 + (13 - terrain.zoom) * 0.6);
  const stops = tintStops(dark).map(rgb);
  const inkRgb = rgb(ink);
  const shadow: Rgb = dark ? [0, 0, 0] : inkRgb;
  const range = Math.max(1, terrain.max - terrain.min);
  for (let row = 0; row < rows; row += 1) {
    const up = Math.max(0, row - 1);
    const down = Math.min(rows - 1, row + 1);
    for (let col = 0; col < cols; col += 1) {
      const left = Math.max(0, col - 1);
      const right = Math.min(cols - 1, col + 1);
      const dzdx = ((elevations[row * cols + right] - elevations[row * cols + left]) / ((right - left) * metresPerCell)) * exaggeration;
      const dzdy = ((elevations[down * cols + col] - elevations[up * cols + col]) / ((down - up) * metresPerCell)) * exaggeration;
      const length = Math.hypot(dzdx, dzdy, 1);
      // Light from the north-west, 45° above the horizon
      const shade = Math.max(0, (dzdx * 0.5 + dzdy * 0.5 + 0.7071) / length);
      const p = (row * cols + col) * 4;
      if (style === "tinted") {
        const tint = tintAt(stops, (elevations[row * cols + col] - terrain.min) / range);
        const light = 0.62 + 0.5 * shade;
        pixels[p] = tint[0] * light;
        pixels[p + 1] = tint[1] * light;
        pixels[p + 2] = tint[2] * light;
        pixels[p + 3] = 255;
      } else {
        pixels[p] = shadow[0];
        pixels[p + 1] = shadow[1];
        pixels[p + 2] = shadow[2];
        pixels[p + 3] = Math.round(Math.max(0, 0.85 - shade) * (dark ? 300 : 210));
      }
    }
  }
  return pixels;
}

type Prepared = { contours: number[][]; index: number; levels: number[]; relief: OffscreenCanvas | null; step: number };
const prepared = new Map<string, Prepared>();

function reliefImage(pixels: Uint8ClampedArray, cols: number, rows: number): OffscreenCanvas | null {
  if (typeof OffscreenCanvas === "undefined") return null;
  const canvas = new OffscreenCanvas(cols, rows);
  const context = canvas.getContext("2d");
  if (!context) return null;
  const image = context.createImageData(cols, rows);
  image.data.set(pixels);
  context.putImageData(image, 0, 0);
  return canvas;
}

function prepare(terrain: TerrainData, settings: ContourSettings, dark: boolean, ink: string): Prepared {
  const key = `${terrain.key}|${terrain.source}|${settings.interval}|${settings.style}|${dark}|${ink}`;
  const hit = prepared.get(key);
  if (hit) return hit;
  const { index, levels, step } = contourLevels(terrain, settings.interval);
  const contours = traceContours(terrain.elevations, terrain.cols, terrain.rows, levels);
  const relief = settings.style === "lines" ? null : reliefImage(reliefPixels(terrain, settings.style, dark, ink), terrain.cols, terrain.rows);
  const result = { contours, index, levels, relief, step };
  if (prepared.size > 6) prepared.delete(prepared.keys().next().value!);
  prepared.set(key, result);
  return result;
}

/** Scene-unit layout shared with tests. */
export function contourLayout(width: number, height: number) {
  const u = Math.min(width / 1920, height / 1080);
  const offsetX = (width - 1920 * u) / 2;
  const offsetY = (height - 1080 * u) / 2;
  const map = { height: 888 * u, width: 1184 * u, x: offsetX + 640 * u, y: offsetY + 96 * u };
  const left = offsetX + 96 * u;
  const legend = { swatchHeight: 64 * u, swatchWidth: 72 * u, x: left, y: offsetY + 676 * u };
  return { left, legend, map, offsetY, u };
}

function formatMetres(value: number): string {
  return `${Math.round(value).toLocaleString("en-US")} m`;
}

function formatCoordinate(value: number, positive: string, negative: string): string {
  return `${Math.abs(value).toFixed(3)}°${value >= 0 ? positive : negative}`;
}

function niceDistance(metres: number): number {
  const power = 10 ** Math.floor(Math.log10(metres));
  for (const step of [5, 2, 1]) if (step * power <= metres) return step * power;
  return power;
}

function tracked(context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, text: string, x: number, y: number, spacing: number): void {
  let cursor = x;
  for (const char of text) {
    context.fillText(char, cursor, y);
    cursor += context.measureText(char).width + spacing;
  }
}

type Frame = { dark: boolean; ink: string; layout: ReturnType<typeof contourLayout>; muted: string; scene: Prepared; settings: ContourSettings; terrain: TerrainData };

function drawLines(context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, frame: Frame): void {
  const { ink, scene, settings, terrain } = frame;
  const { map, u } = frame.layout;
  const cell = map.width / (terrain.cols - 1);
  // ── Map: relief underlay, contour lines, frame, summit ──
  if (scene.relief) {
    context.imageSmoothingEnabled = true;
    context.drawImage(scene.relief, map.x, map.y, map.width, map.height);
  }
  context.save();
  context.beginPath();
  context.rect(map.x, map.y, map.width, map.height);
  context.clip();
  context.lineCap = "round";
  context.lineJoin = "round";
  const lineAlpha = settings.style === "tinted" ? 0.5 : 0.62;
  for (const bold of [false, true]) {
    context.beginPath();
    scene.levels.forEach((level, li) => {
      const isIndex = Math.abs(level % scene.index) < 1e-6;
      if (isIndex !== bold) return;
      const segments = scene.contours[li];
      for (let i = 0; i < segments.length; i += 4) {
        context.moveTo(map.x + segments[i] * cell, map.y + segments[i + 1] * cell);
        context.lineTo(map.x + segments[i + 2] * cell, map.y + segments[i + 3] * cell);
      }
    });
    context.strokeStyle = withAlpha(ink, bold ? Math.min(1, lineAlpha + 0.32) : lineAlpha);
    context.lineWidth = (bold ? 1.7 : 0.8) * u;
    context.stroke();
  }
  context.restore();
}

function drawSummit(context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, frame: Frame): void {
  const { ink, settings, terrain } = frame;
  const { map, u } = frame.layout;
  const cell = map.width / (terrain.cols - 1);
  // Summit marker and height
  const peakX = map.x + terrain.peak.col * cell;
  const peakY = map.y + terrain.peak.row * cell;
  context.save();
  context.fillStyle = ink;
  context.beginPath();
  context.moveTo(peakX, peakY - 9 * u);
  context.lineTo(peakX + 8 * u, peakY + 6 * u);
  context.lineTo(peakX - 8 * u, peakY + 6 * u);
  context.closePath();
  context.fill();
  context.font = `italic 600 ${20 * u}px ${SERIF}`;
  const peakLabel = formatMetres(terrain.peak.elevation);
  const labelRight = peakX + 14 * u + context.measureText(peakLabel).width > map.x + map.width - 8 * u;
  context.textAlign = labelRight ? "right" : "left";
  context.strokeStyle = settings.includeBackground ? settings.background : withAlpha("#FFFFFF", 0.8);
  context.lineWidth = 5 * u;
  context.lineJoin = "round";
  context.strokeText(peakLabel, peakX + (labelRight ? -14 : 14) * u, peakY + 6 * u);
  context.fillText(peakLabel, peakX + (labelRight ? -14 : 14) * u, peakY + 6 * u);
  context.restore();
}

function drawFrame(context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, frame: Frame): void {
  const { ink, muted, settings, terrain } = frame;
  const { map, u } = frame.layout;
  context.strokeStyle = ink;
  context.lineWidth = 1.5 * u;
  context.strokeRect(map.x, map.y, map.width, map.height);

  // Corner coordinates of the map
  const halfWidthDeg = ((terrain.cols / 2) * terrain.metresPerCell) / (111_320 * Math.cos((settings.latitude * Math.PI) / 180));
  const halfHeightDeg = ((terrain.rows / 2) * terrain.metresPerCell) / 110_574;
  context.fillStyle = muted;
  context.font = `${14 * u}px ${SANS}`;
  context.textAlign = "left";
  context.fillText(`${formatCoordinate(settings.latitude + halfHeightDeg, "N", "S")}  ${formatCoordinate(settings.longitude - halfWidthDeg, "E", "W")}`, map.x, map.y - 10 * u);
  context.textAlign = "right";
  context.fillText(`${formatCoordinate(settings.latitude - halfHeightDeg, "N", "S")}  ${formatCoordinate(settings.longitude + halfWidthDeg, "E", "W")}`, map.x + map.width, map.y + map.height + 22 * u);
  context.textAlign = "left";

}

function drawColumn(context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, frame: Frame): void {
  const { ink, muted, scene, settings, terrain } = frame;
  const { left, offsetY, u } = frame.layout;
  // ── Left column: title, figures, legend, scale ──
  context.fillStyle = muted;
  context.font = `600 ${17 * u}px ${SANS}`;
  tracked(context, "CONTOUR STUDY", left, offsetY + 118 * u, 3.4 * u);
  const title = settings.place?.label ?? "Survey";
  let titleSize = 78;
  context.font = `italic ${titleSize * u}px ${SERIF}`;
  while (context.measureText(title).width > 470 * u && titleSize > 40) {
    titleSize -= 4;
    context.font = `italic ${titleSize * u}px ${SERIF}`;
  }
  context.fillStyle = ink;
  context.fillText(title, left - 4 * u, offsetY + 206 * u);
  context.fillStyle = muted;
  context.font = `${20 * u}px ${SANS}`;
  context.fillText(settings.place?.region ?? "Custom location", left, offsetY + 248 * u);
  context.fillText(`${formatCoordinate(settings.latitude, "N", "S")}   ${formatCoordinate(settings.longitude, "E", "W")}`, left, offsetY + 278 * u);

  const widthKm = (terrain.cols * terrain.metresPerCell) / 1000;
  const heightKm = (terrain.rows * terrain.metresPerCell) / 1000;
  const rows: [string, string][] = [
    ["Highest in view", formatMetres(terrain.max)],
    ["Lowest in view", formatMetres(terrain.min)],
    ["Relief", formatMetres(terrain.max - terrain.min)],
    ["Contour interval", `${scene.step} m · index ${scene.index} m`],
    ["Area", `${widthKm.toFixed(1)} × ${heightKm.toFixed(1)} km`],
  ];
  let y = offsetY + 360 * u;
  for (const [label, value] of rows) {
    context.fillStyle = muted;
    context.font = `${19 * u}px ${SANS}`;
    context.fillText(label, left, y);
    context.fillStyle = ink;
    context.font = `600 ${21 * u}px ${SANS}`;
    context.textAlign = "right";
    context.fillText(value, left + 464 * u, y);
    context.textAlign = "left";
    context.fillStyle = withAlpha(ink, 0.16);
    context.fillRect(left, y + 14 * u, 464 * u, 1 * u);
    y += 50 * u;
  }

}

function drawLegend(context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, frame: Frame): void {
  const { dark, ink, muted, scene, settings, terrain } = frame;
  const { left, legend, u } = frame.layout;
  context.fillStyle = muted;
  context.font = `600 ${15 * u}px ${SANS}`;
  if (settings.style === "tinted") {
    tracked(context, "ELEVATION", left, legend.y - 16 * u, 2.6 * u);
    const stops = tintStops(dark);
    stops.forEach((color, i) => {
      context.fillStyle = color;
      context.fillRect(legend.x + i * (legend.swatchWidth + 6.4 * u), legend.y, legend.swatchWidth, legend.swatchHeight);
      context.strokeStyle = withAlpha(ink, 0.25);
      context.lineWidth = 1 * u;
      context.strokeRect(legend.x + i * (legend.swatchWidth + 6.4 * u), legend.y, legend.swatchWidth, legend.swatchHeight);
      context.fillStyle = muted;
      context.font = `${14 * u}px ${SANS}`;
      const value = terrain.min + ((terrain.max - terrain.min) * i) / (stops.length - 1);
      context.fillText(Math.round(value).toLocaleString("en-US"), legend.x + i * (legend.swatchWidth + 6.4 * u), legend.y + legend.swatchHeight + 22 * u);
    });
  } else {
    tracked(context, settings.style === "relief" ? "SHADED RELIEF, LIT FROM THE NORTH-WEST" : "CONTOURS ONLY", left, legend.y - 16 * u, 2.6 * u);
    context.fillStyle = withAlpha(ink, 0.62);
    context.fillRect(left, legend.y + 20 * u, 120 * u, 1 * u);
    context.fillStyle = ink;
    context.fillRect(left, legend.y + 50 * u, 120 * u, 2 * u);
    context.font = `${15 * u}px ${SANS}`;
    context.fillStyle = muted;
    context.fillText(`every ${scene.step} m`, left + 140 * u, legend.y + 25 * u);
    context.fillText(`index, every ${scene.index} m`, left + 140 * u, legend.y + 56 * u);
  }

}

function drawScale(context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, frame: Frame): void {
  const { ink, muted, terrain } = frame;
  const { left, map, offsetY, u } = frame.layout;
  const cell = map.width / (terrain.cols - 1);
  // Scale bar: alternating filled and open segments
  const mapMetresPerUnit = terrain.metresPerCell / cell;
  const total = niceDistance(320 * u * mapMetresPerUnit);
  const barWidth = total / mapMetresPerUnit;
  const barY = offsetY + 868 * u;
  context.strokeStyle = ink;
  context.lineWidth = 1.2 * u;
  for (let i = 0; i < 4; i += 1) {
    const x = left + (barWidth / 4) * i;
    if (i % 2 === 0) {
      context.fillStyle = ink;
      context.fillRect(x, barY, barWidth / 4, 9 * u);
    }
    context.strokeRect(x, barY, barWidth / 4, 9 * u);
  }
  context.fillStyle = muted;
  context.font = `${15 * u}px ${SANS}`;
  context.fillText("0", left - 3 * u, barY + 32 * u);
  context.textAlign = "right";
  context.fillText(total >= 1000 ? `${total / 1000} km` : `${total} m`, left + barWidth + 8 * u, barY + 32 * u);
  context.textAlign = "left";
  // North arrow
  const arrowX = left + 440 * u;
  context.fillStyle = ink;
  context.beginPath();
  context.moveTo(arrowX, barY - 30 * u);
  context.lineTo(arrowX + 10 * u, barY + 10 * u);
  context.lineTo(arrowX, barY + 2 * u);
  context.lineTo(arrowX - 10 * u, barY + 10 * u);
  context.closePath();
  context.fill();
  context.font = `600 ${16 * u}px ${SANS}`;
  context.textAlign = "center";
  context.fillText("N", arrowX, barY + 32 * u);
  context.textAlign = "left";

  context.fillStyle = withAlpha(ink, 0.45);
  context.font = `${14 * u}px ${SANS}`;
  context.fillText(`Elevation: AWS Terrain Tiles (Mapzen Terrarium), averaged per map cell · ${terrain.source === "live" ? "live" : "offline sample terrain"}`, left, offsetY + 984 * u);
}

export function drawContour(context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, width: number, height: number, settings: ContourSettings, terrain: TerrainData): void {
  const dark = isDark(settings);
  const ink = contourInk(settings);
  const frame: Frame = { dark, ink, layout: contourLayout(width, height), muted: withAlpha(ink, 0.62), scene: prepare(terrain, settings, dark, ink), settings, terrain };
  context.save();
  context.textBaseline = "alphabetic";
  context.textAlign = "left";
  drawLines(context, frame);
  drawSummit(context, frame);
  drawFrame(context, frame);
  drawColumn(context, frame);
  drawLegend(context, frame);
  drawScale(context, frame);
  context.restore();
}
