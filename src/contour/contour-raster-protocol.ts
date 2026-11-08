import type { ContourSettings } from "./contour-settings";
import type { TerrainData } from "./terrain";

export type ContourRasterRequest = { backingHeight: number; backingWidth: number; height: number; id: number; settings: ContourSettings; terrain: TerrainData; width: number };
export type ContourRasterResponse = { bitmap?: ImageBitmap; error?: string; id: number };
