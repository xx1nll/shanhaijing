# 山海島 · Shanhai Island Editor

Kid-friendly 3D island editor inspired by Tinkercad, themed around 《山海經》(Classic of Mountains and Seas).

## Run

Open `index.html` in a modern browser, or serve locally:

```bash
python3 -m http.server 8765
# then visit http://127.0.0.1:8765/
```

A local server is recommended so ES module imports from the CDN work reliably.

## Features

| Mode | What it does |
|------|----------------|
| **建造 Build** | Hotbar drag-place; 山/穴 stamp the **heightmap** (steepness changes side profile only) |
| **塑形 Sculpt** | Raise / lower sculpt layer (Shift = dig) |
| **密文 Code** | Paste a shared map string to restore an island |
| **遊歷 Play** | Fullscreen FPS: WASD, mouse, Space, F flight; spawn on flat ground |

UI is Minecraft-style: fullscreen canvas + HUD overlays + bottom hotbar.

Props lean **pre-civilization** 山海經 (cairns, bone totems, monoliths, log crossings, firepits, nests) — not dynastic temples.


## Stack

Single self-contained HTML file: Three.js (OrbitControls, TransformControls) + LZ-String via CDN.
