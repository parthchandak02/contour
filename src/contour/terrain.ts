// Elevation for Contour: AWS Terrain Tiles (Mapzen Terrarium PNG), stitched into one grid per view.

export const TERRAIN_TILE_URL = "https://elevation-tiles-prod.s3.amazonaws.com/terrarium";
export const GRID_COLS = 512;
export const GRID_ROWS = 384;
const TILE = 256;
const EARTH_CIRCUMFERENCE = 40_075_016.686;

export type TerrainData = {
  cols: number;
  /** Smoothed elevations in metres, row-major, north at row 0. */
  elevations: number[];
  key: string;
  max: number;
  metresPerCell: number;
  min: number;
  peak: { col: number; elevation: number; row: number };
  rows: number;
  source: "fallback" | "live";
  zoom: number;
};

export type TerrainView = { latitude: number; longitude: number; zoom: number };

export function terrainKey({ latitude, longitude, zoom }: TerrainView): string {
  return `${latitude.toFixed(3)},${longitude.toFixed(3)},${zoom}`;
}

/** Global Web Mercator pixel of a coordinate at a zoom level. */
export function mercatorPixel(latitude: number, longitude: number, zoom: number): { x: number; y: number } {
  const size = TILE * 2 ** zoom;
  const lat = (Math.max(-85, Math.min(85, latitude)) * Math.PI) / 180;
  return { x: ((longitude + 180) / 360) * size, y: ((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) * size };
}

export function metresPerPixel(latitude: number, zoom: number): number {
  return (EARTH_CIRCUMFERENCE * Math.cos((latitude * Math.PI) / 180)) / (TILE * 2 ** zoom);
}

/** Terrarium encoding: (R × 256 + G + B / 256) − 32768 metres. */
export function decodeTerrarium(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

export type TileRequest = { url: string; x: number; y: number };

/** Top-left global pixel of the view window and the tiles it touches. */
export function viewTiles(view: TerrainView): { left: number; tiles: TileRequest[]; top: number } {
  const centre = mercatorPixel(view.latitude, view.longitude, view.zoom);
  const left = Math.round(centre.x - GRID_COLS / 2);
  const top = Math.round(centre.y - GRID_ROWS / 2);
  const n = 2 ** view.zoom;
  const tiles: TileRequest[] = [];
  for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + GRID_ROWS - 1) / TILE); ty += 1) {
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + GRID_COLS - 1) / TILE); tx += 1) {
      const wrappedX = ((tx % n) + n) % n;
      const clampedY = Math.max(0, Math.min(n - 1, ty));
      tiles.push({ url: `${TERRAIN_TILE_URL}/${view.zoom}/${wrappedX}/${clampedY}.png`, x: tx, y: ty });
    }
  }
  return { left, tiles, top };
}

/** One 3x3 box blur pass: removes single-sample noise so lines read as smooth contours. */
export function smooth(values: readonly number[], cols: number, rows: number): number[] {
  const out: number[] = new Array(values.length).fill(0);
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        const y = row + dy;
        if (y < 0 || y >= rows) continue;
        for (let dx = -1; dx <= 1; dx += 1) {
          const x = col + dx;
          if (x < 0 || x >= cols) continue;
          sum += values[y * cols + x];
          count += 1;
        }
      }
      out[row * cols + col] = sum / count;
    }
  }
  return out;
}

export function buildTerrain(raw: readonly number[], view: TerrainView, source: TerrainData["source"]): TerrainData {
  const elevations = smooth(raw, GRID_COLS, GRID_ROWS);
  let min = Infinity;
  let max = -Infinity;
  let peakIndex = 0;
  // Extremes come from the raw samples: smoothing would shave summits
  for (let i = 0; i < raw.length; i += 1) {
    const value = raw[i];
    if (value < min) min = value;
    if (value > max) {
      max = value;
      peakIndex = i;
    }
  }
  return {
    cols: GRID_COLS,
    elevations,
    key: terrainKey(view),
    max,
    metresPerCell: metresPerPixel(view.latitude, view.zoom),
    min,
    peak: { col: peakIndex % GRID_COLS, elevation: max, row: Math.floor(peakIndex / GRID_COLS) },
    rows: GRID_ROWS,
    source,
    zoom: view.zoom,
  };
}

/** Smooth synthetic massif in global pixel space, used offline (and labelled as such). */
export function syntheticElevation(globalX: number, globalY: number, zoom: number): number {
  const scale = 2 ** (zoom - 12);
  const x = globalX / (scale * 180);
  const y = globalY / (scale * 180);
  const ridge = Math.sin(x * 1.7 + Math.sin(y * 0.9) * 1.3) * Math.cos(y * 1.3 - Math.cos(x * 0.7));
  const swell = Math.sin(x * 0.45 + 1.1) * Math.cos(y * 0.38 - 0.4);
  return 1400 + ridge * 650 + swell * 900 + Math.sin(x * 4.1) * Math.cos(y * 3.7) * 60;
}

export function syntheticTerrain(view: TerrainView): TerrainData {
  const { left, top } = viewTiles(view);
  const raw: number[] = new Array(GRID_COLS * GRID_ROWS).fill(0);
  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let col = 0; col < GRID_COLS; col += 1) raw[row * GRID_COLS + col] = syntheticElevation(left + col, top + row, view.zoom);
  }
  return buildTerrain(raw, view, "fallback");
}

type TilePixels = (url: string) => Promise<Uint8ClampedArray>;

async function browserTilePixels(url: string): Promise<Uint8ClampedArray> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Tile ${response.status}`);
  const bitmap = await createImageBitmap(await response.blob(), { colorSpaceConversion: "none", premultiplyAlpha: "none" });
  const canvas = new OffscreenCanvas(TILE, TILE);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas 2D is unavailable");
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return context.getImageData(0, 0, TILE, TILE).data;
}

export async function fetchTerrain(view: TerrainView, tilePixels: TilePixels = browserTilePixels): Promise<TerrainData> {
  const { left, tiles, top } = viewTiles(view);
  const pixels = await Promise.all(tiles.map((tile) => tilePixels(tile.url)));
  const raw: number[] = new Array(GRID_COLS * GRID_ROWS).fill(0);
  tiles.forEach((tile, index) => {
    const data = pixels[index];
    const x0 = tile.x * TILE - left;
    const y0 = tile.y * TILE - top;
    for (let ty = 0; ty < TILE; ty += 1) {
      const row = y0 + ty;
      if (row < 0 || row >= GRID_ROWS) continue;
      for (let tx = 0; tx < TILE; tx += 1) {
        const col = x0 + tx;
        if (col < 0 || col >= GRID_COLS) continue;
        const p = (ty * TILE + tx) * 4;
        raw[row * GRID_COLS + col] = decodeTerrarium(data[p], data[p + 1], data[p + 2]);
      }
    }
  });
  return buildTerrain(raw, view, "live");
}

const cache = new Map<string, TerrainData>();
const pending = new Map<string, Promise<TerrainData>>();

export function getCachedTerrain(view: TerrainView): TerrainData | null {
  return cache.get(terrainKey(view)) ?? null;
}

export function loadTerrain(view: TerrainView, tilePixels?: TilePixels): Promise<TerrainData> {
  const key = terrainKey(view);
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;
  const request = fetchTerrain(view, tilePixels)
    .catch(() => syntheticTerrain(view))
    .then((data) => {
      if (cache.size > 12) cache.delete(cache.keys().next().value!);
      cache.set(key, data);
      pending.delete(key);
      return data;
    });
  pending.set(key, request);
  return request;
}

export function clearTerrainCache(): void {
  cache.clear();
  pending.clear();
}
