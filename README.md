# 山海島 · Shanhai Island Editor

Kid-friendly 3D island editor inspired by Tinkercad, themed around 《山海經》(Classic of Mountains and Seas).

## Run

Open `index.html` in a modern browser, or serve locally:

```bash
python3 -m http.server 8765
# then visit http://127.0.0.1:8765/
```

A local server is required for ES modules and `supabase-config.js`.

## World size

Editable terrain is **72 × 72** (original path/sculpt resolution). A larger visual ocean plane surrounds it.

## Cloud save (Supabase)

1. Create a Supabase project (or use an existing one).
2. Run `supabase/schema.sql` in the SQL Editor (creates `worlds` + seeds `main`).
3. Put your project URL + anon key in `supabase-config.js`.
4. Use **☁ 存雲** / **☁ 載雲** in the HUD to update / load that single world.

## Features

| Mode | What it does |
|------|----------------|
| **建造 Build** | Hotbar drag-place; 島/山/穴 stamp the **heightmap**; 塑/路 paint tools |
| **密文 Code** | Paste a shared map string to restore an island |
| **存雲 / 載雲** | Sync the `main` 1000×1000 world to Supabase |
| **遊歷 Play** | Fullscreen FPS: WASD, mouse, Space, F flight |

UI is Minecraft-style: fullscreen canvas + HUD overlays + bottom hotbar.

## Stack

Single HTML app: Three.js + LZ-String + Supabase JS (CDN).
