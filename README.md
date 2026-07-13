# contour

Draw topographic contour lines on a dark forest canvas. Live Singapore weather data shapes the terrain: temperature controls elevation height, wind controls roughness and spacing.

**Visual Style:** Dark — Midnight (forest bioluminescence, deep green contour lines on near-black background, warm gold hero number)

**Data Source:** Open-Meteo Singapore weather API

**How it works:**
- Draw on the canvas with your finger or mouse — each stroke creates a topographic contour line
- Singapore temperature determines contour elevation (warm = higher elevation)
- Wind speed controls contour roughness and spacing (more wind = rougher terrain)
- Three color schemes: Midnight (green glow), Ember (orange-red), Void (monochrome)
- Sliders adjust stroke width, elevation scale, roughness, wind effect
- Tap a contour to reveal its data detail panel
- Hero number shows live temperature as "peak elevation"

**GitHub:** https://github.com/parthchandak02/contour

**Live:** https://contour.parthchandak.info

**Tech:** Pixel Point Toolcraft + Vite. Canvas 2D rendering. Hosted on Cloudflare Pages.
