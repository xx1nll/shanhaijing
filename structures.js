/**
 * 山海島 — 建築 & 神異景物（低面數）
 *
 * Scale convention: props.scale === 1 is the natural / life-size in world units
 * (player ≈ 0.75 tall ≈ 3 blocks; 1 block = 0.25).
 */
export function installStructures(THREE, { mat, cprop }) {
  /** scale 1 ≈ prop scale next to trees (~1.5–2) / player (~0.75) */
  const BUILD_UNIT = 0.36;
  const MYTH_UNIT = 0.4;

  function finish(g, props) {
    g.rotation.y = props.rotation || 0;
    return g;
  }

  function box(g, w, h, d, col, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(col));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  }

  function cyl(g, rTop, rBot, h, col, x, y, z, segs = 8) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, segs), mat(col));
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
    return m;
  }

  function cone(g, r, h, col, x, y, z, segs = 6) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, segs), mat(col));
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
    return m;
  }

  function ballTip(g, r, col, x, y, z) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 6, 5), mat(col));
    m.position.set(x, y, z);
    g.add(m);
    return m;
  }

  /**
   * Pitched roof whose eaves sit on wallTopY (no floating slabs).
   * w/d = wall outer size; rise = ridge height above eaves.
   */
  function pitchedRoof(g, w, d, rise, col, wallTopY, overhang = 0.15) {
    const thick = Math.max(0.06, Math.min(w, d) * 0.035);
    const half = w * 0.5 + overhang;
    const len = Math.hypot(half, rise);
    const ang = Math.atan2(rise, half);
    for (const side of [-1, 1]) {
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(len, thick, d + overhang * 2),
        mat(col)
      );
      // center of slab lies on the slope midline from eave to ridge
      slab.position.set(side * (half * 0.5), wallTopY + rise * 0.5, 0);
      slab.rotation.z = side * -ang;
      slab.castShadow = true;
      g.add(slab);
    }
    // ridge beam
    box(g, thick * 1.2, thick * 1.2, d + overhang, col, 0, wallTopY + rise, 0);
  }

  /** Corner posts + optional top plate. */
  function framePosts(g, hw, hd, wallH, postR, wood) {
    const corners = [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]];
    for (const [x, z] of corners) {
      cyl(g, postR * 0.85, postR, wallH, wood, x, wallH * 0.5, z, 5);
    }
    // top plates
    box(g, hw * 2 + postR * 2, postR * 1.2, postR * 1.4, wood, 0, wallH, -hd);
    box(g, hw * 2 + postR * 2, postR * 1.2, postR * 1.4, wood, 0, wallH, hd);
    box(g, postR * 1.4, postR * 1.2, hd * 2, wood, -hw, wallH, 0);
    box(g, postR * 1.4, postR * 1.2, hd * 2, wood, hw, wallH, 0);
  }

  /** Vertical wood strips with gaps (primitive wall, not solid). Door gap on +Z. */
  function stripWalls(g, hw, hd, wallH, wood, { door = true, gap = 0.1, stripW = 0.09 } = {}) {
    const step = stripW + gap;
    // front (+Z) with door opening
    for (let x = -hw + 0.05; x <= hw - 0.05; x += step) {
      if (door && Math.abs(x) < 0.35) continue;
      box(g, stripW, wallH * 0.92, stripW * 0.7, wood, x, wallH * 0.46, hd);
    }
    // back (−Z)
    for (let x = -hw + 0.05; x <= hw - 0.05; x += step) {
      box(g, stripW, wallH * 0.92, stripW * 0.7, wood, x, wallH * 0.46, -hd);
    }
    // sides
    for (let z = -hd + 0.05; z <= hd - 0.05; z += step) {
      box(g, stripW * 0.7, wallH * 0.92, stripW, wood, -hw, wallH * 0.46, z);
      box(g, stripW * 0.7, wallH * 0.92, stripW, wood, hw, wallH * 0.46, z);
    }
    // mid rails
    for (const y of [wallH * 0.28, wallH * 0.62]) {
      box(g, hw * 2 - 0.05, 0.06, 0.06, wood, 0, y, hd);
      box(g, hw * 2 - 0.05, 0.06, 0.06, wood, 0, y, -hd);
      box(g, 0.06, 0.06, hd * 2 - 0.05, wood, -hw, y, 0);
      box(g, 0.06, 0.06, hd * 2 - 0.05, wood, hw, y, 0);
    }
  }

  /** Horizontal straw / reed thatch bands on open frame. */
  function strawBands(g, hw, hd, wallH, straw, { door = true } = {}) {
    const layers = 7;
    for (let i = 0; i < layers; i++) {
      const y = 0.12 + (i / (layers - 1)) * (wallH * 0.85);
      const thick = 0.07 + (i % 2) * 0.02;
      // skip door bay on front
      if (door) {
        box(g, hw - 0.4, thick, 0.08, straw, -hw * 0.55, y, hd);
        box(g, hw - 0.4, thick, 0.08, straw, hw * 0.55, y, hd);
      } else {
        box(g, hw * 2 - 0.1, thick, 0.08, straw, 0, y, hd);
      }
      box(g, hw * 2 - 0.1, thick, 0.08, straw, 0, y, -hd);
      box(g, 0.08, thick, hd * 2 - 0.1, straw, -hw, y, 0);
      box(g, 0.08, thick, hd * 2 - 0.1, straw, hw, y, 0);
    }
  }

  /** Thatch fringe hanging slightly past eaves. */
  function thatchFringe(g, w, d, wallTopY, rise, straw) {
    const n = 9;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const x = (t - 0.5) * w * 0.95;
      // hang from near eaves front/back
      for (const z of [d * 0.52, -d * 0.52]) {
        const tip = new THREE.Mesh(
          new THREE.ConeGeometry(0.07, 0.28, 4),
          mat(straw)
        );
        tip.position.set(x, wallTopY + rise * 0.15, z);
        tip.rotation.x = z > 0 ? 0.9 : -0.9;
        g.add(tip);
      }
    }
  }

  // ─── Buildings (scale 1 = life-size vs player ~0.75) ──────
  function makeStrawHut(props) {
    const g = new THREE.Group();
    const sc = (props.scale ?? 1) * BUILD_UNIT;
    const straw = cprop(props, 'color', '#c8b070');
    const wood = cprop(props, 'accent', '#5a4030');
    const roof = cprop(props, 'color2', '#8a7040');
    // ~4×3.5 m footprint, wall ~2.1 m — enters taller than player
    const hw = 2.0 * sc;
    const hd = 1.7 * sc;
    const wallH = 2.1 * sc;
    const postR = 0.09 * sc;
    framePosts(g, hw, hd, wallH, postR, wood);
    strawBands(g, hw, hd, wallH, straw, { door: true });
    // door posts
    cyl(g, 0.05 * sc, 0.06 * sc, wallH * 0.95, wood, -0.38 * sc, wallH * 0.48, hd, 5);
    cyl(g, 0.05 * sc, 0.06 * sc, wallH * 0.95, wood, 0.38 * sc, wallH * 0.48, hd, 5);
    box(g, 0.85 * sc, 0.07 * sc, 0.07 * sc, wood, 0, wallH * 0.95, hd);
    const rise = 1.1 * sc;
    pitchedRoof(g, hw * 2, hd * 2, rise, roof, wallH, 0.28 * sc);
    thatchFringe(g, hw * 2, hd * 2, wallH, rise, straw);
    // floor mat
    box(g, hw * 1.7, 0.06 * sc, hd * 1.7, straw, 0, 0.03 * sc, 0);
    return finish(g, props);
  }

  function makeWoodHut(props) {
    const g = new THREE.Group();
    const sc = (props.scale ?? 1) * BUILD_UNIT;
    const wood = cprop(props, 'color', '#6a5038');
    const dark = cprop(props, 'accent', '#3a2818');
    const roof = cprop(props, 'color2', '#4a3830');
    const hw = 2.2 * sc;
    const hd = 1.9 * sc;
    const wallH = 2.25 * sc;
    const postR = 0.1 * sc;
    framePosts(g, hw, hd, wallH, postR, dark);
    stripWalls(g, hw, hd, wallH, wood, { door: true, gap: 0.08 * sc, stripW: 0.11 * sc });
    // door lintel + jambs
    cyl(g, 0.055 * sc, 0.06 * sc, wallH * 0.95, dark, -0.4 * sc, wallH * 0.48, hd, 5);
    cyl(g, 0.055 * sc, 0.06 * sc, wallH * 0.95, dark, 0.4 * sc, wallH * 0.48, hd, 5);
    box(g, 0.9 * sc, 0.08 * sc, 0.08 * sc, dark, 0, wallH * 0.95, hd);
    const rise = 1.15 * sc;
    pitchedRoof(g, hw * 2, hd * 2, rise, roof, wallH, 0.3 * sc);
    // bark shingle rows on roof face (optional detail near ridge)
    for (let i = 0; i < 5; i++) {
      const y = wallH + rise * (0.25 + i * 0.12);
      box(g, 0.5 * sc, 0.04 * sc, hd * 2.1, dark, 0.55 * sc, y, 0);
      box(g, 0.5 * sc, 0.04 * sc, hd * 2.1, dark, -0.55 * sc, y, 0);
    }
    box(g, hw * 1.8, 0.05 * sc, hd * 1.8, dark, 0, 0.025 * sc, 0);
    return finish(g, props);
  }

  function makePavilion(props) {
    const g = new THREE.Group();
    const sc = (props.scale ?? 1) * BUILD_UNIT;
    const wood = cprop(props, 'color', '#6a4030');
    const roof = cprop(props, 'color2', '#3a5040');
    const accent = cprop(props, 'accent', '#c8a050');
    // open hall ~4×4, pillars ~2.4 tall
    const hw = 1.9 * sc;
    box(g, hw * 2.1, 0.12 * sc, hw * 2.1, wood, 0, 0.06 * sc, 0);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      cyl(g, 0.1 * sc, 0.12 * sc, 2.4 * sc, wood, x * hw * 0.85, 1.2 * sc, z * hw * 0.85, 7);
    }
    box(g, hw * 1.9, 0.12 * sc, 0.14 * sc, wood, 0, 2.45 * sc, 0);
    box(g, 0.14 * sc, 0.12 * sc, hw * 1.9, wood, 0, 2.45 * sc, 0);
    cone(g, hw * 1.25, 0.55 * sc, roof, 0, 2.75 * sc, 0, 8);
    cone(g, hw * 0.65, 0.7 * sc, roof, 0, 3.25 * sc, 0, 8);
    cyl(g, 0.06 * sc, 0.07 * sc, 0.4 * sc, accent, 0, 3.7 * sc, 0, 5);
    ballTip(g, 0.12 * sc, accent, 0, 3.95 * sc, 0);
    return finish(g, props);
  }

  function makePagoda(props) {
    const g = new THREE.Group();
    const sc = (props.scale ?? 1) * BUILD_UNIT;
    const wall = cprop(props, 'color', '#c8b8a0');
    const roof = cprop(props, 'color2', '#3a5540');
    const wood = cprop(props, 'accent', '#5a4030');
    const tiers = 3;
    for (let i = 0; i < tiers; i++) {
      const t = 1 - i * 0.18;
      const storeyH = 1.1 * sc;
      const y0 = (0.55 + i * 1.25) * sc;
      box(g, 2.2 * t * sc, storeyH * 0.7, 2.2 * t * sc, wall, 0, y0, 0);
      cone(g, 1.6 * t * sc, 0.4 * sc, roof, 0, y0 + storeyH * 0.45, 0, 8);
      cyl(g, 1.65 * t * sc, 1.65 * t * sc, 0.07 * sc, wood, 0, y0 + storeyH * 0.28, 0, 8);
    }
    cyl(g, 0.07 * sc, 0.08 * sc, 0.7 * sc, wood, 0, (0.55 + tiers * 1.25) * sc, 0, 5);
    return finish(g, props);
  }

  function makePaifang(props) {
    const g = new THREE.Group();
    const sc = (props.scale ?? 1) * BUILD_UNIT;
    const stone = cprop(props, 'color', '#7a7568');
    const roof = cprop(props, 'color2', '#3a5040');
    const accent = cprop(props, 'accent', '#c04040');
    const postH = 3.6 * sc;
    for (const x of [-1.4, 1.4]) {
      box(g, 0.35 * sc, postH, 0.35 * sc, stone, x * sc, postH * 0.5, 0);
    }
    box(g, 3.4 * sc, 0.35 * sc, 0.4 * sc, stone, 0, postH * 0.82, 0);
    box(g, 3.8 * sc, 0.22 * sc, 0.5 * sc, roof, 0, postH * 0.92, 0);
    for (const x of [-1.9, 1.9]) {
      box(g, 0.7 * sc, 0.16 * sc, 0.35 * sc, roof, x * sc, postH * 0.88, 0);
    }
    box(g, 1.1 * sc, 0.4 * sc, 0.1 * sc, accent, 0, postH * 0.78, 0.22 * sc);
    return finish(g, props);
  }

  function makeWatchtower(props) {
    const g = new THREE.Group();
    const sc = (props.scale ?? 1) * BUILD_UNIT;
    const wood = cprop(props, 'color', '#5a4535');
    const roof = cprop(props, 'color2', '#3a4030');
    const stilts = 2.8 * sc;
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      cyl(g, 0.09 * sc, 0.11 * sc, stilts, wood, x * 1.0 * sc, stilts * 0.5, z * 1.0 * sc, 5);
    }
    // open platform — strip deck, not solid cabin
    box(g, 2.4 * sc, 0.12 * sc, 2.4 * sc, wood, 0, stilts, 0);
    for (let i = -3; i <= 3; i++) {
      box(g, 2.3 * sc, 0.05 * sc, 0.12 * sc, wood, 0, stilts + 0.08 * sc, i * 0.32 * sc);
    }
    // railing strips
    for (const [x, z, alongX] of [
      [0, 1.15, true], [0, -1.15, true], [1.15, 0, false], [-1.15, 0, false],
    ]) {
      if (alongX) box(g, 2.2 * sc, 0.08 * sc, 0.08 * sc, wood, x * sc, stilts + 0.55 * sc, z * sc);
      else box(g, 0.08 * sc, 0.08 * sc, 2.2 * sc, wood, x * sc, stilts + 0.55 * sc, z * sc);
      for (let i = -2; i <= 2; i++) {
        const px = alongX ? i * 0.45 * sc : x * sc;
        const pz = alongX ? z * sc : i * 0.45 * sc;
        cyl(g, 0.04 * sc, 0.045 * sc, 0.55 * sc, wood, px, stilts + 0.3 * sc, pz, 4);
      }
    }
    pitchedRoof(g, 2.5 * sc, 2.5 * sc, 0.85 * sc, roof, stilts + 0.7 * sc, 0.2 * sc);
    return finish(g, props);
  }

  function makeCiHall(props) {
    const g = new THREE.Group();
    const sc = (props.scale ?? 1) * BUILD_UNIT;
    const wall = cprop(props, 'color', '#e8dcc8');
    const roof = cprop(props, 'color2', '#3a5548');
    const wood = cprop(props, 'accent', '#6a4030');
    const hw = 2.6 * sc;
    const hd = 1.8 * sc;
    const wallH = 2.4 * sc;
    // mythical hall — still open-front with columns, light panel walls (not sealed brick)
    framePosts(g, hw, hd, wallH, 0.11 * sc, wood);
    stripWalls(g, hw, hd, wallH, wall, { door: true, gap: 0.05 * sc, stripW: 0.16 * sc });
    for (const x of [-1.2, 1.2]) {
      cyl(g, 0.1 * sc, 0.12 * sc, wallH, wood, x * sc, wallH * 0.5, hd + 0.15 * sc, 6);
    }
    box(g, 0.7 * sc, wallH * 0.7, 0.08 * sc, wood, 0, wallH * 0.4, hd + 0.12 * sc);
    pitchedRoof(g, hw * 2.15, hd * 2.15, 1.3 * sc, roof, wallH, 0.35 * sc);
    for (const x of [-1.5, 1.5]) {
      cone(g, 0.1 * sc, 0.22 * sc, wood, x * sc, wallH + 1.35 * sc, 0, 4);
    }
    return finish(g, props);
  }

  function makeLanternPole(props) {
    const g = new THREE.Group();
    const sc = (props.scale ?? 1) * BUILD_UNIT;
    const wood = cprop(props, 'color', '#5a4030');
    const paper = cprop(props, 'color2', '#e8a040');
    const poleH = 3.2 * sc;
    cyl(g, 0.06 * sc, 0.08 * sc, poleH, wood, 0, poleH * 0.5, 0, 6);
    const lamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28 * sc, 0.28 * sc, 0.55 * sc, 8),
      mat(paper, { emissive: paper, emissiveIntensity: 0.25 })
    );
    lamp.position.y = poleH * 0.88;
    g.add(lamp);
    box(g, 0.6 * sc, 0.06 * sc, 0.6 * sc, wood, 0, poleH * 0.98, 0);
    box(g, 0.6 * sc, 0.06 * sc, 0.6 * sc, wood, 0, poleH * 0.78, 0);
    return finish(g, props);
  }

  // ─── Mythical (scale 1 = shrine-readable landmark size) ───
  function makeFusang(props) {
    const g = new THREE.Group();
    const sc = (props.scale ?? 1) * MYTH_UNIT;
    const bark = cprop(props, 'color', '#5a4030');
    const leaf = cprop(props, 'color2', '#3a6040');
    const sun = cprop(props, 'accent', '#e8a030');
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const trunk = cyl(g, 0.12 * sc, 0.2 * sc, 4.2 * sc, bark, Math.cos(a) * 0.25 * sc, 2.1 * sc, Math.sin(a) * 0.25 * sc, 6);
      trunk.rotation.z = Math.cos(a) * 0.1;
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 * sc, 0), mat(leaf));
      puff.position.set(Math.cos(a) * 0.7 * sc, 4.2 * sc, Math.sin(a) * 0.7 * sc);
      g.add(puff);
    }
    const disc = new THREE.Mesh(
      new THREE.SphereGeometry(0.55 * sc, 10, 8),
      mat(sun, { emissive: sun, emissiveIntensity: 0.45 })
    );
    disc.position.y = 5.2 * sc;
    g.add(disc);
    return finish(g, props);
  }

  function makeJianmu(props) {
    const g = new THREE.Group();
    const sc = (props.scale ?? 1) * MYTH_UNIT;
    const bark = cprop(props, 'color', '#4a4538');
    const ring = cprop(props, 'color2', '#c8b070');
    const leaf = cprop(props, 'accent', '#2a4a38');
    const H = 6.5 * sc;
    cyl(g, 0.22 * sc, 0.32 * sc, H, bark, 0, H * 0.5, 0, 8);
    for (let i = 0; i < 5; i++) {
      const y = (0.9 + i * 1.0) * sc;
      const tor = new THREE.Mesh(new THREE.TorusGeometry(0.4 * sc, 0.06 * sc, 4, 12), mat(ring));
      tor.rotation.x = Math.PI / 2;
      tor.position.y = y;
      g.add(tor);
    }
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7 * sc, 0), mat(leaf));
    crown.position.y = H + 0.3 * sc;
    g.add(crown);
    return finish(g, props);
  }

  function makePeachAltar(props) {
    const g = new THREE.Group();
    const sc = (props.scale ?? 1) * MYTH_UNIT;
    const stone = cprop(props, 'color', '#7a7568');
    const peach = cprop(props, 'color2', '#e07060');
    const leaf = cprop(props, 'accent', '#3a6040');
    cyl(g, 0.7 * sc, 0.8 * sc, 0.25 * sc, stone, 0, 0.12 * sc, 0, 8);
    cyl(g, 0.4 * sc, 0.48 * sc, 0.55 * sc, stone, 0, 0.5 * sc, 0, 8);
    box(g, 1.1 * sc, 0.12 * sc, 1.1 * sc, stone, 0, 0.85 * sc, 0);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.2 * sc, 7, 6), mat(peach));
      fruit.position.set(Math.cos(a) * 0.28 * sc, 1.15 * sc, Math.sin(a) * 0.28 * sc);
      fruit.scale.set(1, 1.15, 1);
      g.add(fruit);
      cone(g, 0.06 * sc, 0.12 * sc, leaf, Math.cos(a) * 0.28 * sc, 1.4 * sc, Math.sin(a) * 0.28 * sc, 4);
    }
    return finish(g, props);
  }

  function makeDing(props) {
    const g = new THREE.Group();
    const sc = (props.scale ?? 1) * MYTH_UNIT;
    const bronze = cprop(props, 'color', '#6a5a28');
    const dark = cprop(props, 'color2', '#3a3820');
    cyl(g, 0.55 * sc, 0.42 * sc, 0.7 * sc, bronze, 0, 0.85 * sc, 0, 10);
    cyl(g, 0.58 * sc, 0.58 * sc, 0.1 * sc, dark, 0, 1.22 * sc, 0, 10);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.3;
      cyl(g, 0.06 * sc, 0.09 * sc, 0.65 * sc, bronze, Math.cos(a) * 0.35 * sc, 0.32 * sc, Math.sin(a) * 0.35 * sc, 5);
    }
    for (const x of [-1, 1]) {
      const h = new THREE.Mesh(new THREE.TorusGeometry(0.16 * sc, 0.04 * sc, 4, 10), mat(bronze));
      h.position.set(x * 0.58 * sc, 1.15 * sc, 0);
      h.rotation.y = Math.PI / 2;
      g.add(h);
    }
    return finish(g, props);
  }

  function makeBiJade(props) {
    const g = new THREE.Group();
    const sc = (props.scale ?? 1) * MYTH_UNIT;
    const jade = cprop(props, 'color', '#6aaa88');
    const stand = cprop(props, 'color2', '#5a5040');
    box(g, 0.8 * sc, 0.18 * sc, 0.5 * sc, stand, 0, 0.09 * sc, 0);
    box(g, 0.12 * sc, 0.7 * sc, 0.12 * sc, stand, 0, 0.5 * sc, 0);
    const bi = new THREE.Mesh(new THREE.TorusGeometry(0.42 * sc, 0.12 * sc, 6, 18), mat(jade));
    bi.position.y = 1.15 * sc;
    bi.castShadow = true;
    g.add(bi);
    return finish(g, props);
  }

  function makeSpiritGate(props) {
    const g = new THREE.Group();
    const sc = (props.scale ?? 1) * MYTH_UNIT;
    const stone = cprop(props, 'color', '#6a6860');
    const glow = cprop(props, 'color2', '#68a0c8');
    const H = 4.2 * sc;
    for (const x of [-1.3, 1.3]) {
      box(g, 0.5 * sc, H, 0.5 * sc, stone, x * sc, H * 0.5, 0);
      cone(g, 0.35 * sc, 0.6 * sc, stone, x * sc, H + 0.3 * sc, 0, 4);
      const rune = new THREE.Mesh(
        new THREE.BoxGeometry(0.18 * sc, 0.7 * sc, 0.06 * sc),
        mat(glow, { emissive: glow, emissiveIntensity: 0.35 })
      );
      rune.position.set(x * sc, H * 0.55, 0.28 * sc);
      g.add(rune);
    }
    const mist = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2 * sc, 3.2 * sc),
      mat(glow, { transparent: true, opacity: 0.22, side: THREE.DoubleSide, emissive: glow, emissiveIntensity: 0.15 })
    );
    mist.position.set(0, 1.8 * sc, 0);
    g.add(mist);
    return finish(g, props);
  }

  function makeLingzhi(props) {
    const g = new THREE.Group();
    const sc = (props.scale ?? 1) * MYTH_UNIT;
    const stem = cprop(props, 'color', '#d0c0a0');
    const cap = cprop(props, 'color2', '#c05040');
    const stone = cprop(props, 'accent', '#5a5548');
    box(g, 0.9 * sc, 0.14 * sc, 0.9 * sc, stone, 0, 0.07 * sc, 0);
    cyl(g, 0.08 * sc, 0.1 * sc, 0.7 * sc, stem, 0, 0.45 * sc, 0, 6);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.45 * sc, 8, 6), mat(cap));
    top.scale.set(1.2, 0.45, 1.1);
    top.position.y = 0.9 * sc;
    g.add(top);
    cyl(g, 0.05 * sc, 0.06 * sc, 0.4 * sc, stem, 0.3 * sc, 0.35 * sc, 0.15 * sc, 5);
    const side = new THREE.Mesh(new THREE.SphereGeometry(0.22 * sc, 6, 5), mat(cap));
    side.scale.set(1.1, 0.4, 1);
    side.position.set(0.35 * sc, 0.65 * sc, 0.15 * sc);
    g.add(side);
    return finish(g, props);
  }

  function makeKunlunJade(props) {
    const g = new THREE.Group();
    const sc = (props.scale ?? 1) * MYTH_UNIT;
    const jade = cprop(props, 'color', '#5a8878');
    const glow = cprop(props, 'color2', '#a8e0d0');
    const layers = [
      { y: 0.35, s: 0.85 },
      { y: 0.95, s: 0.6 },
      { y: 1.45, s: 0.4 },
      { y: 1.85, s: 0.25 },
    ];
    layers.forEach((L, i) => {
      const m = new THREE.Mesh(
        new THREE.DodecahedronGeometry(L.s * sc, 0),
        mat(i % 2 ? jade : glow, i > 1 ? { emissive: glow, emissiveIntensity: 0.2 } : {})
      );
      m.position.y = L.y * sc;
      m.rotation.y = i * 0.4;
      m.castShadow = true;
      g.add(m);
    });
    return finish(g, props);
  }

  function makeFeatherBanner(props) {
    const g = new THREE.Group();
    const sc = (props.scale ?? 1) * MYTH_UNIT;
    const pole = cprop(props, 'color', '#5a4030');
    const cloth = cprop(props, 'color2', '#c04040');
    const feather = cprop(props, 'accent', '#e8d080');
    const H = 3.6 * sc;
    cyl(g, 0.055 * sc, 0.07 * sc, H, pole, 0, H * 0.5, 0, 5);
    box(g, 0.9 * sc, 1.2 * sc, 0.06 * sc, cloth, 0.55 * sc, H * 0.72, 0);
    for (let i = 0; i < 5; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.06 * sc, 0.55 * sc, 4), mat(feather));
      f.position.set(0.95 * sc, (H * 0.55 + i * 0.2) * 1, 0);
      f.position.y = H * 0.55 + i * 0.2 * sc;
      f.rotation.z = -1.1;
      g.add(f);
    }
    return finish(g, props);
  }

  function makeBronzeMirror(props) {
    const g = new THREE.Group();
    const sc = (props.scale ?? 1) * MYTH_UNIT;
    const bronze = cprop(props, 'color', '#8a7a40');
    const face = cprop(props, 'color2', '#c8d0d8');
    const stand = cprop(props, 'accent', '#5a5040');
    box(g, 0.7 * sc, 0.14 * sc, 0.45 * sc, stand, 0, 0.07 * sc, 0);
    cyl(g, 0.06 * sc, 0.08 * sc, 0.9 * sc, stand, 0, 0.55 * sc, 0, 5);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.5 * sc, 0.5 * sc, 0.08 * sc, 16), mat(bronze));
    disc.rotation.x = Math.PI / 2;
    disc.position.set(0, 1.2 * sc, 0);
    g.add(disc);
    const mir = new THREE.Mesh(
      new THREE.CircleGeometry(0.4 * sc, 16),
      mat(face, { metalness: 0.6, roughness: 0.25 })
    );
    mir.position.set(0, 1.2 * sc, 0.05 * sc);
    g.add(mir);
    return finish(g, props);
  }

  function makeYaoStone(props) {
    const g = new THREE.Group();
    const sc = (props.scale ?? 1) * MYTH_UNIT;
    const stone = cprop(props, 'color', '#4a5060');
    const glow = cprop(props, 'color2', '#70b0e0');
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.7 * sc, 0),
      mat(glow, { emissive: glow, emissiveIntensity: 0.4 })
    );
    core.position.y = 0.85 * sc;
    core.castShadow = true;
    g.add(core);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const shard = new THREE.Mesh(new THREE.ConeGeometry(0.15 * sc, 0.55 * sc, 4), mat(stone));
      shard.position.set(Math.cos(a) * 0.55 * sc, 0.35 * sc, Math.sin(a) * 0.55 * sc);
      shard.rotation.z = Math.cos(a) * 0.5;
      g.add(shard);
    }
    return finish(g, props);
  }

  const BUILD_META = [
    { type: 'straw_hut', icon: '🛖', label: '茅屋', make: makeStrawHut, scale: 1, color: '#c8b070', color2: '#8a7040', accent: '#5a4030' },
    { type: 'wood_hut', icon: '🏡', label: '木屋', make: makeWoodHut, scale: 1, color: '#6a5038', color2: '#4a3830', accent: '#3a2818' },
    { type: 'pavilion', icon: '🏯', label: '亭', make: makePavilion, scale: 1, color: '#6a4030', color2: '#3a5040', accent: '#c8a050' },
    { type: 'ci_hall', icon: '🛕', label: '祠', make: makeCiHall, scale: 1, color: '#e8dcc8', color2: '#3a5548', accent: '#6a4030' },
    { type: 'pagoda', icon: '🗼', label: '塔', make: makePagoda, scale: 1, color: '#c8b8a0', color2: '#3a5540', accent: '#5a4030' },
    { type: 'paifang', icon: '⛩️', label: '坊', make: makePaifang, scale: 1, color: '#7a7568', color2: '#3a5040', accent: '#c04040' },
    { type: 'watchtower', icon: '🏚️', label: '望樓', make: makeWatchtower, scale: 1, color: '#5a4535', color2: '#3a4030', accent: '#3a2818' },
    { type: 'lantern_pole', icon: '🏮', label: '燈', make: makeLanternPole, scale: 1, color: '#5a4030', color2: '#e8a040', accent: '#5a4030' },
  ];

  const MYTH_META = [
    { type: 'fusang', icon: '🌅', label: '扶桑', make: makeFusang, scale: 1, color: '#5a4030', color2: '#3a6040', accent: '#e8a030' },
    { type: 'jianmu', icon: '🪵', label: '建木', make: makeJianmu, scale: 1, color: '#4a4538', color2: '#c8b070', accent: '#2a4a38' },
    { type: 'peach_altar', icon: '🍑', label: '蟠桃', make: makePeachAltar, scale: 1, color: '#7a7568', color2: '#e07060', accent: '#3a6040' },
    { type: 'ding', icon: '🍲', label: '鼎', make: makeDing, scale: 1, color: '#6a5a28', color2: '#3a3820', accent: '#6a5a28' },
    { type: 'bi_jade', icon: '🟢', label: '璧', make: makeBiJade, scale: 1, color: '#6aaa88', color2: '#5a5040', accent: '#6aaa88' },
    { type: 'spirit_gate', icon: '🚪', label: '神闕', make: makeSpiritGate, scale: 1, color: '#6a6860', color2: '#68a0c8', accent: '#68a0c8' },
    { type: 'lingzhi', icon: '🍄', label: '靈芝', make: makeLingzhi, scale: 1, color: '#d0c0a0', color2: '#c05040', accent: '#5a5548' },
    { type: 'kunlun_jade', icon: '💎', label: '崑崙', make: makeKunlunJade, scale: 1, color: '#5a8878', color2: '#a8e0d0', accent: '#a8e0d0' },
    { type: 'feather_banner', icon: '🚩', label: '羽旌', make: makeFeatherBanner, scale: 1, color: '#5a4030', color2: '#c04040', accent: '#e8d080' },
    { type: 'bronze_mirror', icon: '🪞', label: '銅鏡', make: makeBronzeMirror, scale: 1, color: '#8a7a40', color2: '#c8d0d8', accent: '#5a5040' },
    { type: 'yao_stone', icon: '✨', label: '瑤石', make: makeYaoStone, scale: 1, color: '#4a5060', color2: '#70b0e0', accent: '#70b0e0' },
  ];

  const BUILD_TYPES = new Set(BUILD_META.map((t) => t.type));
  const MYTH_TYPES = new Set(MYTH_META.map((t) => t.type));

  const BUILD_PRESETS = BUILD_META.map((t) => ({
    type: t.type, icon: t.icon, label: t.label, terrain: false, tab: 'build', structure: 'build',
  }));
  const MYTH_PRESETS = MYTH_META.map((t) => ({
    type: t.type, icon: t.icon, label: t.label, terrain: false, tab: 'myth', structure: 'myth',
  }));

  const DEFAULTS = {};
  const FACTORIES = {};
  [...BUILD_META, ...MYTH_META].forEach((t) => {
    DEFAULTS[t.type] = {
      scale: t.scale, rotation: 0,
      color: t.color, color2: t.color2, accent: t.accent,
      hitbox: true,
    };
    FACTORIES[t.type] = t.make;
  });

  function isBuildType(type) { return BUILD_TYPES.has(type); }
  function isMythType(type) { return MYTH_TYPES.has(type); }
  function isStructureType(type) { return isBuildType(type) || isMythType(type); }

  return {
    BUILD_PRESETS,
    MYTH_PRESETS,
    DEFAULTS,
    FACTORIES,
    BUILD_TYPES,
    MYTH_TYPES,
    isBuildType,
    isMythType,
    isStructureType,
  };
}
