# Contour — Creative Brief

## Concept
A generative terrain drawing instrument. Draw on the canvas with your finger or mouse — each stroke draws a topographic contour line. Live Singapore weather data from Open-Meteo determines the landscape: temperature maps to elevation height, humidity maps to terrain roughness, wind speed maps to contour line density. The canvas becomes an evolving topographic map colored by current weather.

**Narrative Pattern:** Annotation — every contour line, slider, and data element is annotated with its meaning. The data stamp shows live weather readings that drive the terrain.

**Tier 2 Patterns (pick 2):** Hero Number (current temperature as "peak elevation" 48px) + Quiet Zone (tap reveals weather data details + contour value)

## Data Source
- **API endpoint:** `https://api.open-meteo.com/v1/forecast?latitude=1.35&longitude=103.82&current_weather=true`
- **Response format:** JSON with `current_weather.temperature`, `current_weather.windspeed`, `current_weather.winddirection`
- **Fallback:** temperature=28, windspeed=10, winddirection=180 (typical Singapore)
- **Poll interval:** Every 60s

## Encoding Contract
| Data Field | Visual Channel | Range | Inverse Function | "Bigger means..." | Legend? |
|---|---|---|---|---|---|
| temperature_2m | contour line vertical offset (Y) | 0-40px | invertScale(offset, 0,40, 20,35) | higher elevation | yes (color bar) |
| humidity (from current_weather not available, use windspeed as proxy) | terrain roughness | 0-5px jitter | invertScale(jitter, 0,5, 0,30) | more rugged terrain | yes |
| windspeed_10m | contour line spacing density | 8-24px between lines | invertScale(spacing, 8,24, 0,30) | wider spaced = stronger wind | no (physical mapping) |

## Interaction
- **Draw:** Touch/mouse drag draws topographic contour lines on the canvas
- **Tap on contour:** Quiet Zone shows the contour's elevation value, weather data that influenced it
- **Clear button:** Reset all drawn contours
- **Auto-drift:** Subtle atmospheric drift of terrain elevation over time (weather data updates change the landscape gradually)

## Visual Style
- **Preset:** Dark — Midnight (forest bioluminescence)
- **Palette:**
  ```js
  const PALETTE = {
    bg: '#0a0f0d',         // dark forest green
    layer: '#0f1a14',      // slightly lighter for depth
    contour1: '#2e7d32',   // deep green — base contour
    contour2: '#4caf50',   // green — mid elevation
    contour3: '#76ff03',   // neon green — high elevation glow
    biolume: '#b2ff59',    // pale green glow — highlights
    accent: '#ffb347',     // warm gold — hero number, accent
    text: 'rgba(255,255,255,0.5)',
  };
  ```
- **Coherence tokens:**
  - strokeWeightScale: { fine: 1, contour: 2, thick: 4 }
  - alphaHierarchy: { bg: 0.08, field: 0.3, active: 0.7, label: 0.45 }
  - shapeLanguage: organic curves (bezier, quadraticCurveTo, no straight lines)
  - glowBudget: 1 glow color (biolume), blur <= 30px, <= 10 entities/frame
  - accent color: exactly one (biolume green + warm gold for hero)
- **Motion tokens:**
  - --motion-fast: 160ms; --motion-base: 240ms; --motion-slow: 360ms
  - --ease-out-expo: cubic-bezier(0.22, 1, 0.36, 1)

## Communication Requirements
**Tier 1 (mandatory):**
1. Persistent Data Stamp — "Open-Meteo Singapore · 28°C · 10 km/h · updated Xs ago"
2. Data Process Honesty — fallback labeled "fallback", never "live"
3. One-to-One Sensory Mapping — higher contour = warmer temp, rougher = more wind

**Tier 2 (pick 2):**
4. **Hero Number** — 48px current temperature display with "°C peak elevation" label
5. **Quiet Zone** — tap reveals: contour elevation value, weather data details, "View source" link

**Coherence:**
6. Generative-art axes: one strokeWeightScale, alphaHierarchy, motionGrammar, shapeLanguage (organic curves), glowBudget (1 glow color), accent color (1)
7. Motion tokens as CSS custom properties
8. AI Slop Score < 30 — system-ui font, no purple gradient, layered background (dark forest green with subtle radial glow), at least entry animation

## Canvas Code Requirements (MANDATORY)
1. Single HTML file, no external dependencies, no CDN libraries
2. Config object `C` at top with all tunable values
3. DPR-aware canvas setup: `Math.min(window.devicePixelRatio || 1, 2)`, `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`
4. Canvas CSS: `position:fixed;top:0;left:0;width:100%;height:100%;display:block`
5. Touch guard pattern — `let tapping=false; ontouchstart` gate
6. First frame never blank — pre-run warmup with initial terrain seed
7. Realistic fallback data if API fails (temperature=28, windspeed=10)
8. Short description text (`#desc` div, bottom:68px center, system-ui, muted opacity)
9. Full-viewport, mobile-responsive
10. Works offline after first load (no CDN deps)
11. `.nojekyll` file at project root
12. **No em-dashes** — use hyphens for all placeholder values
13. **Font: system-ui, sans-serif** for all text elements
14. **Stamp position:** bottom:20px left:16px
15. **Legend position:** bottom:44px center
16. **Desc position:** bottom:68px center
17. **Hero number position:** top:24px left:24px
18. **Quiet Zone position:** absolute overlay, fades after 3s idle

## Toolcraft Scene
- **Render tier:** toolcraft — npx @pixel-point/toolcraft create, Vite build, deploy dist/
- **Primary metaphor:** Topographic terrain map drawn by user on canvas
- **Canvas:** 2D Canvas drawing implementation (custom React component)
- **Controls (Toolcraft sidebar):**
  - Section: "Brush" — strokeWidth slider (1-8), contourSpacing slider (8-24), eraseToggle button
  - Section: "Terrain" — elevationScale slider (0.5-2.0), roughness slider (0-1), windEffectToggle
  - Section: "Palette" — colorScheme selector (midnight/ember/void — defaults to midnight)
  - Section: "Data" — dataDisplay toggle (show/hide contour values)
- **Interaction:** Draw on canvas with touch/mouse. Tap reveals quiet zone. Controls adjust drawing parameters.
- **Default view:** Canvas with initial terrain seed, hero number showing current temperature, stamp, desc, legend visible.

## Chromium/Performance Notes
- Canvas 2D drawing performance — limit max contour lines to 200 for mobile
- Use requestAnimationFrame for smooth drawing
- Debounce weather API fetch to every 60s
- No heavy shadows on mobile — use glows sparingly
- Toolcraft expected bundle size: ~1.6MB JS (440KB gzipped). This is normal.

## Deploy
- **Slug:** contour
- **URL:** https://contour.parthchandak.info
