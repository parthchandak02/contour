import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { useToolcraftPipelinePass, useToolcraftProductSceneFrame, useToolcraftSelector, useToolcraftValue } from "@/toolcraft/runtime/react";

import styles from "./contour.module.css";
import { rasterPass } from "./contour-pipeline";
import { ContourRasterClient } from "./contour-raster-client";
import { readContourSettings } from "./contour-settings";
import { getCachedTerrain, loadTerrain, type TerrainData } from "./terrain";

export function ContourCanvas() {
  const frame = useToolcraftProductSceneFrame();
  const values = useToolcraftSelector((state) => state.values);
  const zoom = useToolcraftSelector((state) => state.canvas.zoom);
  const renderScale = Number(useToolcraftValue("canvas.renderScale") ?? 2);
  const [dpr, setDpr] = useState(() => window.devicePixelRatio || 1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settings = useMemo(() => readContourSettings(values), [values]);
  const { latitude, longitude, zoom: area } = settings;
  const [terrain, setTerrain] = useState<TerrainData | null>(() => getCachedTerrain({ latitude, longitude, zoom: area }));
  useEffect(() => {
    let current = true;
    setTerrain(getCachedTerrain({ latitude, longitude, zoom: area }));
    void loadTerrain({ latitude, longitude, zoom: area }).then((loaded) => {
      if (current) setTerrain(loaded);
    });
    return () => {
      current = false;
    };
  }, [latitude, longitude, area]);

  const rect = frame.kind === "ready" ? frame.rect : null;
  const backingWidth = Math.max(1, Math.round(((rect?.width ?? 1) * zoom) / 100 * dpr * renderScale));
  const backingHeight = Math.max(1, Math.round(((rect?.height ?? 1) * zoom) / 100 * dpr * renderScale));
  const request = JSON.stringify({ backingHeight, backingWidth, height: rect?.height, settings, terrain: terrain ? `${terrain.key}|${terrain.source}` : null, width: rect?.width });
  const currentRequest = useRef(request);
  useLayoutEffect(() => {
    currentRequest.current = request;
  }, [request]);

  const pixels = useToolcraftPipelinePass(rasterPass, { request }, async (execution) => {
    // Wait for terrain so a "ready" frame always shows the real map
    if (!rect || !terrain) return null;
    const worker = await execution.getOrCreateResource(["contour"], () => new ContourRasterClient(), (client) => client.dispose());
    const bitmap = await worker.render({ backingHeight, backingWidth, height: rect.height, settings, terrain, width: rect.width });
    if (!bitmap) return null;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    try {
      if (!canvas || !context || currentRequest.current !== request) return null;
      if (canvas.width !== backingWidth) canvas.width = backingWidth;
      if (canvas.height !== backingHeight) canvas.height = backingHeight;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, backingWidth, backingHeight);
      context.drawImage(bitmap, 0, 0);
      return request;
    } finally {
      bitmap.close();
    }
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => setDpr(window.devicePixelRatio || 1));
    observer.observe(canvas, { box: "device-pixel-content-box" });
    return () => observer.disconnect();
  }, [Boolean(rect)]);

  if (!rect) return null;
  return (
    <div className={styles.scene}>
      <canvas
        aria-label="Air quality poster"
        className={styles.output}
        data-terrain-source={terrain?.source ?? "loading"}
        data-frame-ready={pixels.status === "success" && pixels.result === request ? "true" : "false"}
        data-render-status={pixels.status}
        data-testid="contour-output"
        data-toolcraft-product-output=""
        ref={canvasRef}
      />
    </div>
  );
}
