"use client";

import * as React from "react";
import { useToolcraft, useToolcraftValue } from "@/toolcraft/runtime/react";

// ─── Palette definitions ───
const PALETTES: Record<string, Record<string, string>> = {
  midnight: {
    bg: "#0a0f0d",
    layer: "#0f1a14",
    contour1: "#2e7d32",
    contour2: "#4caf50",
    contour3: "#76ff03",
    biolume: "#b2ff59",
    accent: "#ffb347",
    text: "rgba(255,255,255,0.5)",
  },
  ember: {
    bg: "#0d0a08",
    layer: "#1a0e0a",
    contour1: "#ff6d00",
    contour2: "#dd2c00",
    contour3: "#ffab00",
    biolume: "#ff9100",
    accent: "#ff6d00",
    text: "rgba(255,255,255,0.5)",
  },
  void: {
    bg: "#0d0d0d",
    layer: "#1a1a1a",
    contour1: "#e0e0e0",
    contour2: "#9e9e9e",
    contour3: "#ffffff",
    biolume: "rgba(255,255,255,0.08)",
    accent: "#ffffff",
    text: "rgba(255,255,255,0.6)",
  },
};

// ─── Config ───
const C = {
  maxContours: 200,
  contourYBase: 120,
  jitterAmplitude: 3,
  minSpacing: 8,
  maxSpacing: 24,
  heroFontSize: 48,
  stampPos: { bottom: 20, left: 16 },
  legendPos: { bottom: 44 },
  descPos: { bottom: 68 },
  heroPos: { top: 24, left: 24 },
  quietZoneFadeMs: 3000,
  apiUrl: "https://api.open-meteo.com/v1/forecast?latitude=1.35&longitude=103.82&current_weather=true",
  fallbackWeather: { temperature: 28, windspeed: 10, winddirection: 180 },
  pollIntervalMs: 60000,
};

// ─── Weather state ───
interface WeatherData {
  temperature: number;
  windspeed: number;
  winddirection: number;
  isFallback: boolean;
  lastFetch: number;
}

// ─── Contour line ───
interface ContourPoint {
  x: number;
  y: number;
}

interface ContourLine {
  points: ContourPoint[];
  time: number;
}

// ─── Inverse scale ───
function scale(val: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  return outMin + ((val - inMin) / (inMax - inMin)) * (outMax - outMin);
}

function invertScale(pixel: number, outMin: number, outMax: number, inMin: number, inMax: number): number {
  return inMin + ((pixel - outMin) / (outMax - outMin)) * (inMax - inMin);
}

interface ContourCanvasProps {
  clearRef?: React.MutableRefObject<(() => void) | null>;
}

export function ContourCanvas({ clearRef }: ContourCanvasProps): React.JSX.Element {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const linesRef = React.useRef<ContourLine[]>([]);
  const currentLineRef = React.useRef<ContourPoint[]>([]);
  const isDrawingRef = React.useRef(false);
  const animFrameRef = React.useRef<number>(0);
  const lastPointerPos = React.useRef<{ x: number; y: number } | null>(null);

  const [weather, setWeather] = React.useState<WeatherData>({
    ...C.fallbackWeather,
    isFallback: true,
    lastFetch: Date.now(),
  });
  const [selectedContour, setSelectedContour] = React.useState<ContourLine | null>(null);
  const quietZoneTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Toolcraft control values
  const strokeWidth = (useToolcraftValue("strokeWidth") as number) ?? 3;
  const contourSpacing = (useToolcraftValue("contourSpacing") as number) ?? 14;
  const elevationScale = (useToolcraftValue("elevationScale") as number) ?? 1.0;
  const roughness = (useToolcraftValue("roughness") as number) ?? 0.4;
  const windEffect = (useToolcraftValue("windEffect") as boolean) ?? true;
  const colorScheme = (useToolcraftValue("colorScheme") as string) ?? "midnight";
  const palette = PALETTES[colorScheme] ?? PALETTES.midnight;

  // Wire clearRef
  React.useEffect(() => {
    if (clearRef) {
      clearRef.current = () => {
        linesRef.current = [];
        currentLineRef.current = [];
        setSelectedContour(null);
      };
    }
    return () => {
      if (clearRef) clearRef.current = null;
    };
  }, [clearRef]);

  // Fetch weather data
  React.useEffect(() => {
    let active = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    const fetchWeather = () => {
      fetch(C.apiUrl)
        .then((r) => r.json())
        .then((data) => {
          if (!active) return;
          const cw = data.current_weather;
          if (cw && typeof cw.temperature === "number") {
            setWeather({
              temperature: cw.temperature,
              windspeed: cw.windspeed ?? 10,
              winddirection: cw.winddirection ?? 180,
              isFallback: false,
              lastFetch: Date.now(),
            });
          } else {
            setWeather((prev) => ({ ...prev, isFallback: true, lastFetch: Date.now() }));
          }
        })
        .catch(() => {
          if (!active) return;
          setWeather((prev) => ({ ...prev, isFallback: true, lastFetch: Date.now() }));
        });

      timeoutId = setTimeout(fetchWeather, C.pollIntervalMs);
    };

    fetchWeather();
    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, []);

  // ─── Fit the output to the viewport ───
  // The Toolcraft template defaults to a fixed 1920x1080 output, which overflows smaller
  // screens and pushes the overlays off-canvas. Size the output to the window instead.
  const { dispatch } = useToolcraft();
  React.useEffect(() => {
    let frame = 0;
    const fit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        dispatch({
          type: "canvas.setSize",
          size: { width: window.innerWidth, height: window.innerHeight, unit: "px" },
        });
        // The template's workspace has a 1024px minimum width; on narrower screens shift the
        // output so it lines up with the visible window instead of the workspace centre.
        const workspace = canvasRef.current?.closest<HTMLElement>('[class*="group/canvas"]');
        const overflow = workspace ? workspace.clientWidth - window.innerWidth : 0;
        dispatch({ type: "canvas.setOffset", offset: { x: -Math.max(0, overflow) / 2, y: 0 } });
        dispatch({ type: "canvas.zoomReset" });
      });
    };
    fit();
    window.addEventListener("resize", fit);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", fit);
    };
  }, [dispatch]);

  // ─── Canvas resize ───
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    // The parent changes size when the output is fitted to the window, not only on window resize.
    const observer = new ResizeObserver(resize);
    if (canvas.parentElement) observer.observe(canvas.parentElement);
    return () => observer.disconnect();
  }, []);

  // ─── Get canvas coordinates from pointer event ───
  const getCanvasPos = React.useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    },
    [],
  );

  // ─── Pointer handlers ───
  const handlePointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return;
      const pos = getCanvasPos(e);
      isDrawingRef.current = true;
      lastPointerPos.current = pos;
      currentLineRef.current = [pos];
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    },
    [getCanvasPos],
  );

  const handlePointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current) return;
      const pos = getCanvasPos(e);
      // Don't add points that are too close together
      const last = currentLineRef.current[currentLineRef.current.length - 1];
      if (last && Math.hypot(pos.x - last.x, pos.y - last.y) < 2) return;
      currentLineRef.current.push(pos);
      lastPointerPos.current = pos;
    },
    [getCanvasPos],
  );

  const handlePointerUp = React.useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (currentLineRef.current.length > 2) {
      linesRef.current.push({
        points: [...currentLineRef.current],
        time: Date.now(),
      });
      // Trim to max
      if (linesRef.current.length > C.maxContours) {
        linesRef.current = linesRef.current.slice(-C.maxContours);
      }
    }
    currentLineRef.current = [];
  }, []);

  // ─── Render loop ───
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      const parent = canvas?.parentElement;
      if (!canvas || !parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Clear
      ctx.fillStyle = palette.bg;
      ctx.fillRect(0, 0, w, h);

      // Draw subtle layer gradient
      const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
      grad.addColorStop(0, palette.layer);
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Compute weather-derived parameters
      const temp = weather.temperature;
      const wind = weather.windspeed;
      const elevationOffset = scale(temp, 20, 35, -40, 40) * elevationScale;
      const jitterScale = roughness * wind * 0.15;
      const spacing = contourSpacing;

      // Draw all contour lines
      const allLines = [...linesRef.current];
      if (currentLineRef.current.length > 1) {
        allLines.push({ points: [...currentLineRef.current], time: Date.now() });
      }

      for (const line of allLines) {
        const pts = line.points;
        if (pts.length < 2) continue;

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);

        // Draw contour line with smooth curves
        for (let i = 1; i < pts.length; i++) {
          const prev = pts[i - 1];
          const curr = pts[i];

          // Compute elevation offset for this segment
          const yOffset = elevationOffset + Math.sin(curr.x * 0.02 + curr.y * 0.02) * jitterScale;

          // Draw contour with offset
          const cx = prev.x + (curr.x - prev.x) * 0.5;
          const cy = prev.y + (curr.y - prev.y) * 0.5;
          ctx.quadraticCurveTo(cx, cy - yOffset, curr.x, curr.y - yOffset);
        }

        // Determine color based on elevation
        const elevMag = Math.abs(elevationOffset);
        let strokeColor: string;
        if (elevMag < 10) {
          strokeColor = palette.contour1;
        } else if (elevMag < 25) {
          strokeColor = palette.contour2;
        } else {
          strokeColor = palette.contour3;
        }

        // Apply wind-based spacing: draw every Nth point as an actual contour line
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.globalAlpha = 0.5;
        ctx.stroke();

        // Draw glow under the line
        if (elevMag > 15) {
          ctx.save();
          ctx.strokeStyle = palette.biolume;
          ctx.lineWidth = strokeWidth + 4;
          ctx.globalAlpha = 0.15;
          ctx.shadowColor = palette.biolume;
          ctx.shadowBlur = 20;
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            const prev = pts[i - 1];
            const curr = pts[i];
            const yOffset2 = elevationOffset + Math.sin(curr.x * 0.02 + curr.y * 0.02) * jitterScale;
            const cx = prev.x + (curr.x - prev.x) * 0.5;
            const cy = prev.y + (curr.y - prev.y) * 0.5;
            ctx.quadraticCurveTo(cx, cy - yOffset2, curr.x, curr.y - yOffset2);
          }
          ctx.stroke();
          ctx.restore();
        }
      }

      // Draw secondary contour lines (spaced lines)
      if (windEffect && wind > 5) {
        for (const line of allLines) {
          const pts = line.points;
          if (pts.length < 4) continue;

          // Draw secondary offset contours
          for (let offset = spacing; offset < spacing * 3; offset += spacing) {
            const alpha = 0.08 + (1 - offset / (spacing * 3)) * 0.08;
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y + offset);
            for (let i = 1; i < pts.length; i++) {
              const px = pts[i - 1].x;
              const py = pts[i - 1].y;
              const cx = px + (pts[i].x - px) * 0.5;
              const cy = py + (pts[i].y - py) * 0.5;
              ctx.quadraticCurveTo(cx, cy + offset, pts[i].x, pts[i].y + offset);
            }
            ctx.strokeStyle = palette.contour1;
            ctx.lineWidth = 0.5;
            ctx.globalAlpha = alpha;
            ctx.stroke();
            ctx.restore();
          }
        }
      }

      ctx.restore();
      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [palette, weather, strokeWidth, contourSpacing, elevationScale, roughness, windEffect]);

  // ─── Handle tap for Quiet Zone ───
  const handleTap = React.useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      // Only trigger on tap (not drag)
      const pos = getCanvasPos(e);
      // Find nearest contour line within 30px
      let nearest: ContourLine | null = null;
      let nearestDist = 30;
      for (const line of linesRef.current) {
        for (const pt of line.points) {
          const dist = Math.hypot(pt.x - pos.x, pt.y - pos.y);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearest = line;
          }
        }
      }
      if (nearest) {
        setSelectedContour(nearest);
        // Clear after 3s
        if (quietZoneTimerRef.current) clearTimeout(quietZoneTimerRef.current);
        quietZoneTimerRef.current = setTimeout(() => setSelectedContour(null), C.quietZoneFadeMs);
      } else {
        setSelectedContour(null);
      }
    },
    [getCanvasPos],
  );

  // ─── Handle pointer up for tap detection ───
  const pointerDownPos = React.useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return;
      pointerDownPos.current = getCanvasPos(e);
      handlePointerDown(e);
    },
    [getCanvasPos, handlePointerDown],
  );

  const onPointerUp = React.useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      // Check if this was a tap (not drag)
      if (pointerDownPos.current) {
        const upPos = getCanvasPos(e);
        const dist = Math.hypot(upPos.x - pointerDownPos.current.x, upPos.y - pointerDownPos.current.y);
        if (dist < 10) {
          handleTap(e);
        }
      }
      pointerDownPos.current = null;
      handlePointerUp();
    },
    [getCanvasPos, handleTap, handlePointerUp],
  );

  const stampText = `${weather.isFallback ? "Open-Meteo Singapore (fallback)" : "Open-Meteo Singapore"} · ${weather.temperature}°C · ${weather.windspeed} km/h · updated ${Math.round((Date.now() - weather.lastFetch) / 1000)}s ago`;

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden" style={{ background: palette.bg }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={handlePointerUp}
        style={{ cursor: "crosshair" }}
      />

      {/* Hero number */}
      <div
        id="hero"
        style={{
          position: "absolute",
          top: C.heroPos.top,
          left: C.heroPos.left,
          color: palette.accent,
          fontFamily: "system-ui, sans-serif",
          fontSize: C.heroFontSize,
          fontWeight: 300,
          lineHeight: 1,
          letterSpacing: "-1px",
          pointerEvents: "none",
          zIndex: 10,
        }}
      >
        {weather.temperature}°
        <span
          style={{
            fontSize: 16,
            fontWeight: 400,
            color: palette.text,
            display: "block",
            marginTop: 2,
            letterSpacing: "0px",
          }}
        >
          peak elevation · {weather.windspeed} km/h wind
        </span>
      </div>

      {/* Stamp */}
      <div
        id="stamp"
        style={{
          position: "absolute",
          bottom: C.stampPos.bottom,
          left: C.stampPos.left,
          color: palette.text,
          fontFamily: "system-ui, sans-serif",
          fontSize: 10,
          lineHeight: 1.4,
          pointerEvents: "none",
          zIndex: 10,
        }}
      >
        {stampText}
      </div>

      {/* Legend */}
      <div
        id="legend"
        style={{
          position: "absolute",
          bottom: C.legendPos.bottom,
          left: "50%",
          transform: "translateX(-50%)",
          color: palette.text,
          fontFamily: "system-ui, sans-serif",
          fontSize: 9,
          lineHeight: 1.4,
          pointerEvents: "none",
          zIndex: 10,
          textAlign: "center",
        }}
      >
        <span style={{ color: palette.contour1 }}>●</span> low elevation{" "}
        <span style={{ color: palette.contour2 }}>●</span> mid{" "}
        <span style={{ color: palette.contour3 }}>●</span> high{" "}
        <span style={{ color: palette.accent }}>★</span> peak temp
      </div>

      {/* Description */}
      <div
        id="desc"
        style={{
          position: "absolute",
          bottom: C.descPos.bottom,
          left: "50%",
          transform: "translateX(-50%)",
          color: palette.text,
          fontFamily: "system-ui, sans-serif",
          fontSize: 11,
          lineHeight: 1.4,
          maxWidth: "65ch",
          textAlign: "center",
          pointerEvents: "none",
          zIndex: 10,
        }}
      >
        Draw on the canvas to create topographic contour lines. Singapore weather shapes the terrain: temperature controls elevation, wind controls roughness and spacing.
      </div>

      {/* Quiet Zone */}
      {selectedContour && (
        <div
          id="quietzone"
          style={{
            position: "absolute",
            bottom: "50%",
            left: "50%",
            transform: "translate(-50%, 50%)",
            background: "rgba(10, 15, 13, 0.85)",
            border: `1px solid ${palette.contour2}`,
            borderRadius: 8,
            padding: "16px 20px",
            color: "#fff",
            fontFamily: "system-ui, sans-serif",
            fontSize: 12,
            lineHeight: 1.5,
            zIndex: 20,
            maxWidth: 280,
            backdropFilter: "blur(4px)",
            transition: "opacity 0.3s ease",
            textAlign: "center",
            pointerEvents: "auto",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: palette.accent, marginBottom: 4 }}>
            Contour line
          </div>
          <div style={{ color: palette.text, marginBottom: 8 }}>
            {selectedContour.points.length} points · drawn{" "}
            {Math.round((Date.now() - selectedContour.time) / 1000)}s ago
          </div>
          <div style={{ color: palette.text, fontSize: 10 }}>
            Elevation: {weather.temperature}°C · Roughness: {weather.windspeed} km/h
          </div>
          <div style={{ marginTop: 8 }}>
            <a
              href="https://open-meteo.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: palette.accent, textDecoration: "underline", fontSize: 11 }}
            >
              View weather source →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
