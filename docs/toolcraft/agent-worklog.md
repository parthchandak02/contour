# Toolcraft App Agent Worklog

## Status

Mode: product

Contour is a topographic map poster of any place on Earth from real elevation data: contour lines with bold index lines, an optional hypsometric tint and hillshade, the summit and its height, figures (highest and lowest ground in view, relief, interval, area), a legend, a scale bar and a north arrow. Detailed requests and results belong in `docs/agent-journal/changes`; command attempts live in `.toolcraft/journal/runs`.

Active change: contour-rebuild-0026

## Decision Trail

### Change contour-rebuild-0026 — Rebuild Contour on Toolcraft 0.0.26 with a new design

- Change ID: contour-rebuild-0026
- Request: "Yes do it for those and all others to make it consistent and the sites are too old and not well designed so we want to avoid that in the future make it much better ok?" The user then chose: all seven Toolcraft apps; each keeps its own look; rethink freely; no check-ins.
- Task type: Generated app porting plus substantial product redesign (renderer, data source, controls, export).
- User-visible result: Instead of drawing freehand strokes tinted by Singapore's weather, Contour now draws real contour maps: pick a landmark (Matterhorn, Mount Fuji, Half Dome, Mount Rainier, Kilimanjaro, Everest, Table Mountain, Grand Canyon) or any latitude and longitude, an area from Wide to Close, a contour interval and a style. The poster shows an italic serif title, region and coordinates, figures, an elevation legend, a scale bar, a north arrow and corner coordinates. Opens fitted beside the controls.
- Source/reference checked: The previous Contour (github.com/parthchandak02/contour, Toolcraft template from July 2026); AWS Terrain Tiles (Terrarium encoding, CORS allowed); the Sol and Aria rebuilds on 0.0.26 for wiring.
- Reference inputs: None (no motion, video, Figma or screenshot reference).
- Docs/contracts read: AGENTS.md, workflow.md, core/runtime-boundary.md, assembly-workflow.md, core/control-selection.md, core/layout.md, core/performance.md, core/setup-export.md, core/media-upload.md, core/development-files.md, core/app-cover.md, core/slider-ranges.md, decision-contract.md, schema-reference.md, component-rules.md, renderer-technique.md, performance.md, acceptance-testing.md (read for the Sol rebuild in the same session on the same 0.0.26 contract).
- Contract rules applied: runtime-shell-required, canvas-no-app-ui, canvas-surface-preserved, infinity-canvas-scene-bounds (intrinsic poster bounds; the map is clipped to its frame), output-export-required (image only), controls-section-inventory-required, acceptance-product-observable, persistence-policy-explicit (default local persistence).
- View interaction intent: non-spatial; a flat map poster with no pan or rotate of its own.
- Interaction ownership: panel only; latitude, longitude, area, interval, style and background are global property edits, landmarks are panel commands.
- Decision: Replace freehand drawing with real terrain from AWS Terrain Tiles: fetch the 6 to 9 Terrarium tiles around the centre, decode them into a 512x384 elevation grid, smooth once, trace contours with marching squares, and shade with a north-west hillshade; cache terrain per view and contours per interval and style. Landmarks set an area and interval that suit them.
- Alternatives rejected: Keeping freehand strokes (the user asked for a much better product; contour lines only mean something on real terrain); Open-Meteo's elevation API (point samples, far too many requests for a grid); canvas gradients for the tint (product code health rejects them; per-cell colour is computed instead).
- State/output mapping: `place.latitude`, `place.longitude` and `map.area` choose the tile view and trigger a cached load; `place.peak` dispatches values for latitude, longitude, area and interval; `map.interval` sets contour levels (index every fifth); `map.style` chooses tint plus shading, shading only, or lines; `appearance.background` sets the runtime background and flips the ink for dark colours; `export.includeBackground` removes the runtime fill; `canvas.size.*`, `canvas.renderScale` and `canvas.zoom` set the worker raster backing; the runtime image export calls the same `drawContour` after loading the same terrain.
- Verification: Unit tests in `src/contour/contour.test.ts` (22 passed: Terrarium decoding, Mercator tiles, tile stitching, offline fallback, marching squares, every control). Product browser specs passed with stubbed Terrarium PNG tiles generated from a synthetic massif, so the real decode path runs. Agent screenshots of the Matterhorn, Mount Fuji, Half Dome and Everest (Lines) with live tiles inspected. The first-delivery gate result is recorded by its protected receipt.
- Risks: See Risks.

## Decisions

### Renderer

- Decision: Canvas 2D in a worker through one `raster` pipeline pass; export reuses `drawContour`.
- Reason: A few thousand line segments, one relief image and some text; one drawing function keeps preview and export identical.
- Evidence: `src/contour/contour-pipeline.ts`, `src/contour/ContourCanvas.tsx`, `src/contour/contour-export.ts`; `browser: contour backing preserves selected render scale`.

### View Interaction

- Decision: Mode `non-spatial`.
- Reason: The map is a flat poster; place and area are panel values.
- Evidence: `src/contour/contour-inventory.ts`.

### Interaction Ownership

- Decision: Panel only, eight entries.
- Reason: Every input is a global value or shortcut.
- Evidence: `src/contour/contour-inventory.ts` `interactionOwnership`.

### Timeline

- Decision: No timeline.
- Reason: A still map; video was not requested.
- Evidence: No timeline module; `animationIntent: none`.

### Layers

- Decision: No layers.
- Reason: No layer workflow was requested.
- Evidence: No layers module.

### Controls

- Decision: Settings (runtime background), Place (Landmarks, Latitude, Longitude), Map (Area, Contour interval, Style), Image Export (runtime).
- Reason: Where the map is and how it is drawn are the two product choices.
- Evidence: `src/contour/contour-controls.ts`, `appControlSectionInventory`; browser specs click every landmark, drag the sliders while held and choose every Area and Style.

### Export

- Decision: Image export only (PNG/JPG, 2K/4K/8K) via `imageExportModule()` and `scene.rasterFrameRenderer`.
- Reason: Toolcraft default; SVG and video were not requested.
- Evidence: `browser: contour image export delivers every format and size` decodes every format and size and checks a legend swatch colour and content bounds.

### Performance

- Decision: Workload envelope from runtime state (canvas width/height, render scale, zoom) plus export resolution; derived paths; adapters stub the tiles.
- Reason: Terrain size is fixed at 512x384 cells; contours and relief are cached, so cost follows the backing size.
- Evidence: `src/contour/contour-performance-model.ts`; `contour render plan has valid derived paths and fixtures`. First delivery runs no measured performance by contract.

Canonical control values and selected-entity isolation follow runtime representations; render scale has functional `renderScaleCoverage` with backing-pixel proof.

## Evidence

- Source reviewed: previous Contour, AWS Terrain Tiles, Sol and Aria 0.0.26 rebuilds.
- Contract applied: product modules under `src/contour`, registered browser scenarios in `e2e/product-contour-*.spec.ts`, cover at `public/toolcraft/cover.png` with `app-cover.json` and `app-cover-state.json`.

## Verification

Protected receipts own initial proof. Development checks: `src/contour/contour.test.ts` 22 passed; 14 product browser specs passed (two Playwright workers on the dev server); screenshots inspected. Cover captured with the app's own Export PNG at 4K.

## Risks

- Risk: Terrain tiles are about 30 m per sample at the Medium area, and each cell averages the ground under it, so sharp summits read low (Matterhorn 4,352 m in view against its surveyed 4,478 m). The poster labels these as heights in view and names the data source.
- Risk: When the tiles cannot be reached the map shows a labelled synthetic sample terrain instead.
