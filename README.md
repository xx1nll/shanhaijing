# 蓬莱筑境 · Penglai Realm

Kid-friendly 3D island editor inspired by Tinkercad, themed around 《山海經》(Classic of Mountains and Seas).

## Run

Open `index.html` in a modern browser, or serve locally:

```bash
python3 -m http.server 8765
# then visit http://127.0.0.1:8765/
```

A local server is required for ES modules.

## World size

Editable terrain is **72 × 72** (original path/sculpt resolution). A larger visual ocean plane surrounds it.

## Features

| Mode | What it does |
|------|----------------|
| **建造 Build** | Hotbar drag-place; 島/山/穴 stamp the **heightmap**; 塑/路 paint tools |
| **密文 Code** | Paste a shared map string to restore an island |
| **遊歷 Play** | Fullscreen FPS: WASD, mouse, Space, F flight |
| **畫風** | 山水淡墨 / 翰墨丹青 / 自然寫實 |

UI is Minecraft-style: fullscreen canvas + HUD overlays + bottom hotbar.

## Stack

Single HTML app: Three.js + LZ-String (CDN).
