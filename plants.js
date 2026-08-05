import {
  REAL_TREE_SPECS,
  buildRealTreeFactories,
  migrateRealTreeType,
  isRealTreeType,
  preloadRealTrees,
  preloadRemainingRealTrees,
  realTreesReady,
  realTreeReady,
  setRealTreeQuality,
} from './real-trees.js?v=trees25';

export {
  REAL_TREE_SPECS,
  preloadRealTrees,
  preloadRemainingRealTrees,
  realTreesReady,
  realTreeReady,
  setRealTreeQuality,
  isRealTreeType,
};

/**
 * 蓬莱筑境 — GLB trees (松/柳/桑/柏) + low-poly flowers
 * Shared helpers keep flower mesh counts low for many instances.
 */
export function installPlants(THREE, { mat, cprop, hash2 }) {
  const H = Math.PI * 2;

  /** Soft shading but keep distinct silhouettes (cones / cards / stalks). */
  function pmat(color, opts = {}) {
    return mat(color, { flatShading: false, roughness: opts.roughness ?? 0.86, metalness: 0.02, ...opts });
  }


  /** Trunk/branch radius: grows slower than height (avoids fat columns). */
  function R(h, frac, ref = 1.7) {
    return frac * ref * Math.pow(Math.max(0.35, h) / ref, 0.55);
  }

  function trunk(g, y0, y1, r0, r1, col, segs = 8) {
    const h = Math.max(0.04, y1 - y0);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, h, segs), pmat(col));
    m.position.y = y0 + h * 0.5;
    m.castShadow = true;
    g.add(m);
    return m;
  }

  /** Cone with its BASE at (x, baseY, z); tip extends upward by h. */
  function coneAt(g, x, baseY, z, r, h, col, segs = 8) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, segs), pmat(col));
    m.position.set(x, baseY + h * 0.5, z);
    m.castShadow = true;
    g.add(m);
    return m;
  }

  function ball(g, x, y, z, r, col, w = 9, ht = 7) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, w, ht), pmat(col));
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
    return m;
  }

  /** Slightly subdivided icosa — still faceted character, less brutal. */
  function icosa(g, x, y, z, r, col) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, PLANT_LITE ? 0 : 1), pmat(col));
    m.position.set(x, y, z);
    m.castShadow = !PLANT_LITE;
    g.add(m);
    return m;
  }

  /** Shared unit plane — leaf cards only scale it (avoids N geometries). */
  const LEAF_GEO = new THREE.PlaneGeometry(1, 1);
  LEAF_GEO.userData.shared = true;
  const leafMatCache = new Map();
  function leafMat(col) {
    let m = leafMatCache.get(col);
    if (!m) {
      m = pmat(col, { side: THREE.DoubleSide });
      m.userData.shared = true;
      leafMatCache.set(col, m);
    }
    return m;
  }

  /** When building cluster siblings, drop most foliage detail. */
  let PLANT_LITE = false;

  /**
   * Leaf cards (flat planes) — kept small, fully opaque, nested in the crown
   * so they read as foliage detail rather than floating panels.
   */
  function leafCards(g, cx, cy, cz, n, spread, size, col, seed = 1) {
    if (PLANT_LITE) n = Math.min(2, Math.ceil(n * 0.25));
    else n = Math.min(n, 8);
    if (n <= 0) return;
    const mtl = leafMat(col);
    const sz = size * 0.62;
    const spr = spread * 0.55;
    for (let i = 0; i < n; i++) {
      const a = hash2(i + seed, seed * 3) * H;
      const r = spr * (0.05 + hash2(i, seed + 1) * 0.55);
      const aspect = 0.7 + hash2(i, 2) * 0.35;
      const plane = new THREE.Mesh(LEAF_GEO, mtl);
      plane.scale.set(sz, sz * aspect, 1);
      const y = cy + (hash2(i, 4) - 0.5) * spr * 0.1;
      plane.position.set(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r);
      plane.rotation.set(
        -0.2 + hash2(i, 5) * 0.35,
        a,
        (hash2(i, 6) - 0.5) * 0.22
      );
      plane.name = 'leafCard';
      plane.castShadow = false;
      plane.receiveShadow = false;
      g.add(plane);
    }
  }

  function stackedCones(g, baseY, h, leaf, layers = 4, open = 0.4) {
    if (PLANT_LITE) layers = Math.min(layers, 2);
    for (let i = 0; i < layers; i++) {
      const t = i / Math.max(1, layers - 1);
      const layerH = h * (0.3 - t * 0.03);
      const y = baseY + t * h * 0.48;
      coneAt(
        g,
        (hash2(i, 2) - 0.5) * h * 0.04,
        y,
        (hash2(i, 5) - 0.5) * h * 0.04,
        h * (open - t * (open * 0.55)),
        layerH,
        leaf,
        PLANT_LITE ? 5 : 7
      );
    }
  }

  function roundCanopy(g, y, r, leaf, chunks = 5) {
    if (PLANT_LITE) chunks = Math.min(chunks, 2);
    // center blob sits on trunk tip (y is crown mid)
    icosa(g, 0, y, 0, r * 0.55, leaf);
    for (let i = 0; i < chunks; i++) {
      const a = (i / chunks) * H;
      icosa(
        g,
        Math.cos(a) * r * 0.38,
        y + (hash2(i, 1) - 0.5) * r * 0.18,
        Math.sin(a) * r * 0.38,
        r * (0.4 + hash2(i, 2) * 0.1),
        leaf
      );
    }
  }

  function markAnim(g, kind, extra = {}) {
    g.userData.plantAnim = { kind, phase: Math.random() * H, ...extra };
    return g;
  }

  function finish(g, props, animKind = 'sway') {
    g.rotation.y = props.rotation || 0;
    // Wind leans this pivot — never the root (keeps gizmo / save rotation clean)
    const sway = new THREE.Group();
    sway.name = 'plantSway';
    [...g.children].forEach((c) => sway.add(c));
    g.add(sway);
    const extra = { sway };
    if (animKind === 'willow') {
      extra.strands = sway.getObjectByName('willowStrands') || g.getObjectByName('willowStrands');
    }
    markAnim(g, animKind, extra);
    return g;
  }

  // ─── Flowers / herbs ─────────────────────────────────────
  function herbBase(props, defaultScale = 0.55) {
    const g = new THREE.Group();
    const sc = props.scale ?? defaultScale;
    return { g, sc };
  }

  function makeHui(props) {
    const { g, sc } = herbBase(props, 0.32);
    const leaf = cprop(props, 'color', '#2a4a30');
    const fl = cprop(props, 'color2', '#d0d0a0');
    for (let i = 0; i < 5; i++) {
      const blade = new THREE.Mesh(new THREE.PlaneGeometry(sc * 0.08, sc * 0.9), pmat(leaf, { side: THREE.DoubleSide }));
      blade.position.set((i - 2) * sc * 0.06, sc * 0.4, (i % 2) * sc * 0.04);
      blade.rotation.z = (i - 2) * 0.12;
      blade.rotation.x = 0.15;
      g.add(blade);
    }
    const scape = new THREE.Mesh(new THREE.CylinderGeometry(sc * 0.015, sc * 0.02, sc * 0.7, 4), pmat(cprop(props, 'stemColor', '#4a5a40')));
    scape.position.y = sc * 0.4;
    g.add(scape);
    for (let i = 0; i < 3; i++) {
      ball(g, (i - 1) * sc * 0.08, sc * 0.75 + i * 0.04, 0, sc * 0.07, fl, 5, 4);
    }
    return finish(g, props, 'grass');
  }

  function makeZhi(props) {
    const { g, sc } = herbBase(props, 0.45);
    const leaf = cprop(props, 'color', '#3a5a30');
    const fl = cprop(props, 'color2', '#e8e8e0');
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(sc * 0.04, sc * 0.05, sc * 1.4, 5), pmat(cprop(props, 'stemColor', '#4a5a38')));
    stem.position.y = sc * 0.7;
    g.add(stem);
    leafCards(g, 0, sc * 0.6, 0, 8, sc * 0.45, sc * 0.28, leaf, 30);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * H;
      ball(g, Math.cos(a) * sc * 0.25, sc * 1.35, Math.sin(a) * sc * 0.25, sc * 0.05, fl, 4, 3);
    }
    return finish(g, props, 'grass');
  }

  function makeMiwu(props) {
    const { g, sc } = herbBase(props, 0.22);
    const leaf = cprop(props, 'color', '#4a6a40');
    leafCards(g, 0, sc * 0.25, 0, 12, sc * 0.4, sc * 0.2, leaf, 31);
    for (let i = 0; i < 5; i++) {
      ball(g, (hash2(i, 1) - 0.5) * sc * 0.3, sc * 0.45, (hash2(i, 2) - 0.5) * sc * 0.3, sc * 0.04, cprop(props, 'color2', '#f0f0e8'), 4, 3);
    }
    return finish(g, props, 'grass');
  }

  function makeDuheng(props) {
    const { g, sc } = herbBase(props, 0.16);
    const leaf = cprop(props, 'color', '#2a3a28');
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * H;
      const L = new THREE.Mesh(new THREE.CircleGeometry(sc * 0.28, 7), pmat(leaf, { side: THREE.DoubleSide }));
      L.position.set(Math.cos(a) * sc * 0.15, sc * 0.12, Math.sin(a) * sc * 0.15);
      L.rotation.x = -Math.PI / 2 + 0.2;
      g.add(L);
    }
    ball(g, 0, sc * 0.06, 0, sc * 0.07, cprop(props, 'color2', '#3a1820'), 5, 4);
    return finish(g, props, 'grass');
  }

  function makeChangpu(props) {
    const { g, sc } = herbBase(props, 0.5);
    const leaf = cprop(props, 'color', '#3a5a30');
    for (let i = 0; i < 6; i++) {
      const blade = new THREE.Mesh(new THREE.PlaneGeometry(sc * 0.1, sc * 1.2), pmat(leaf, { side: THREE.DoubleSide }));
      blade.position.set((i - 2.5) * sc * 0.05, sc * 0.55, (i % 2) * 0.02);
      blade.rotation.y = i * 0.2;
      g.add(blade);
    }
    const spadix = new THREE.Mesh(new THREE.CylinderGeometry(sc * 0.04, sc * 0.045, sc * 0.35, 5), pmat(cprop(props, 'color2', '#c8c070')));
    spadix.position.set(sc * 0.08, sc * 0.7, 0);
    g.add(spadix);
    return finish(g, props, 'grass');
  }

  function makeJiShepherd(props) {
    const { g, sc } = herbBase(props, 0.2);
    const leaf = cprop(props, 'color', '#4a5a38');
    leafCards(g, 0, sc * 0.1, 0, 6, sc * 0.25, sc * 0.14, leaf, 32);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(sc * 0.012, sc * 0.015, sc * 0.55, 3), pmat(cprop(props, 'stemColor', '#5a6a48')));
    stem.position.y = sc * 0.3;
    g.add(stem);
    for (let i = 0; i < 4; i++) {
      const pod = new THREE.Mesh(
        new THREE.PlaneGeometry(sc * 0.055, sc * 0.055),
        pmat(cprop(props, 'color2', '#d0d0c0'), { side: THREE.DoubleSide })
      );
      pod.position.set((i - 1.5) * sc * 0.05, sc * 0.48 + i * 0.03, 0);
      g.add(pod);
    }
    return finish(g, props, 'grass');
  }

  function makeQiMillet(props) {
    const { g, sc } = herbBase(props, 0.4);
    const leaf = cprop(props, 'color', '#5a6a38');
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(new THREE.PlaneGeometry(sc * 0.06, sc * 0.8), pmat(leaf, { side: THREE.DoubleSide }));
      blade.position.set((i - 1.5) * sc * 0.08, sc * 0.35, 0);
      blade.rotation.z = (i - 1.5) * 0.1;
      g.add(blade);
    }
    for (let i = 0; i < 6; i++) {
      ball(g, (hash2(i, 1) - 0.5) * sc * 0.15, sc * 0.75 + i * 0.02, (hash2(i, 2) - 0.5) * sc * 0.1, sc * 0.025, cprop(props, 'color2', '#c8b060'), 3, 3);
    }
    return finish(g, props, 'grass');
  }

  function makeAi(props) {
    const { g, sc } = herbBase(props, 0.35);
    const leaf = cprop(props, 'color', '#5a6a48');
    const under = cprop(props, 'color2', '#d0d0c8');
    leafCards(g, 0, sc * 0.35, 0, 10, sc * 0.35, sc * 0.2, leaf, 33);
    leafCards(g, 0, sc * 0.3, 0, 4, sc * 0.3, sc * 0.18, under, 34);
    for (let i = 0; i < 5; i++) {
      ball(g, (i - 2) * sc * 0.08, sc * 0.75, 0, sc * 0.03, '#c8c080', 3, 3);
    }
    return finish(g, props, 'grass');
  }

  function makeHao(props) {
    const { g, sc } = herbBase(props, 0.4);
    const leaf = cprop(props, 'color', '#6a7a58');
    leafCards(g, 0, sc * 0.4, 0, 14, sc * 0.4, sc * 0.12, leaf, 35);
    for (let i = 0; i < 8; i++) {
      ball(g, (hash2(i, 1) - 0.5) * sc * 0.35, sc * 0.7 + hash2(i, 2) * sc * 0.2, (hash2(i, 3) - 0.5) * sc * 0.35, sc * 0.025, cprop(props, 'color2', '#b0a060'), 3, 3);
    }
    return finish(g, props, 'grass');
  }

  function makeJu(props) {
    const { g, sc } = herbBase(props, 0.28);
    const leaf = cprop(props, 'color', '#3a4a28');
    const fl = cprop(props, 'color2', '#e8d040');
    leafCards(g, 0, sc * 0.25, 0, 5, sc * 0.3, sc * 0.16, leaf, 36);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(sc * 0.02, sc * 0.025, sc * 0.5, 4), pmat(cprop(props, 'stemColor', '#4a5a38')));
    stem.position.y = sc * 0.3;
    g.add(stem);
    // petal ring
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * H;
      const petal = new THREE.Mesh(new THREE.PlaneGeometry(sc * 0.08, sc * 0.18), pmat(fl, { side: THREE.DoubleSide }));
      petal.position.set(Math.cos(a) * sc * 0.1, sc * 0.58, Math.sin(a) * sc * 0.1);
      petal.rotation.y = a;
      petal.rotation.x = -0.5;
      g.add(petal);
    }
    ball(g, 0, sc * 0.58, 0, sc * 0.06, cprop(props, 'fruitColor', '#c09030'), 5, 4);
    return finish(g, props, 'grass');
  }

  function makeShaoyao(props) {
    const { g, sc } = herbBase(props, 0.38);
    const leaf = cprop(props, 'color', '#2a4a28');
    const fl = cprop(props, 'color2', '#d04060');
    leafCards(g, 0, sc * 0.3, 0, 6, sc * 0.35, sc * 0.22, leaf, 37);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(sc * 0.025, sc * 0.03, sc * 0.55, 4), pmat(cprop(props, 'stemColor', '#4a5a40')));
    stem.position.y = sc * 0.3;
    g.add(stem);
    for (let layer = 0; layer < 3; layer++) {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * H + layer * 0.3;
        const petal = new THREE.Mesh(new THREE.CircleGeometry(sc * (0.12 - layer * 0.02), 5), pmat(fl, { side: THREE.DoubleSide }));
        petal.position.set(Math.cos(a) * sc * (0.08 + layer * 0.02), sc * 0.6 + layer * 0.02, Math.sin(a) * sc * (0.08 + layer * 0.02));
        petal.rotation.x = -0.8;
        petal.rotation.z = a;
        g.add(petal);
      }
    }
    return finish(g, props, 'grass');
  }

  function makeShicao(props) {
    const { g, sc } = herbBase(props, 0.3);
    const leaf = cprop(props, 'color', '#4a5a38');
    leafCards(g, 0, sc * 0.25, 0, 12, sc * 0.35, sc * 0.1, leaf, 38);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * H;
      ball(g, Math.cos(a) * sc * 0.15, sc * 0.55, Math.sin(a) * sc * 0.15, sc * 0.035, cprop(props, 'color2', '#f0f0e8'), 4, 3);
    }
    return finish(g, props, 'grass');
  }

  function makeJuanbai(props) {
    const { g, sc } = herbBase(props, 0.14);
    const leaf = cprop(props, 'color', '#3a5a40');
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * H;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(sc * 0.06, sc * 0.12, 4), pmat(leaf));
      tip.position.set(Math.cos(a) * sc * 0.2, sc * 0.06, Math.sin(a) * sc * 0.2);
      tip.rotation.x = 1.1;
      tip.rotation.z = a;
      g.add(tip);
    }
    icosa(g, 0, sc * 0.05, 0, sc * 0.15, cprop(props, 'color2', '#2a4a30'));
    return finish(g, props, 'grass');
  }

  // Ordered most familiar → least (hotbar left-to-right)
  // ─── Trees (GLB: real_song / real_liu / real_sang / real_bai) ───────
  const realTreeFactories = buildRealTreeFactories(THREE, finish);
  const TREE_META = REAL_TREE_SPECS.map((spec) => ({
    type: spec.type,
    icon: spec.icon,
    label: spec.label,
    make: realTreeFactories[spec.type],
    height: spec.defaultHeight,
    color: spec.color,
    trunkColor: spec.trunkColor,
    color2: spec.color2,
  }));

  const FLOWER_META = [
    { type: '菊', icon: '🌼', label: '菊', make: makeJu, scale: 1, color: '#3a4a28', color2: '#e8d040', stemColor: '#4a5a38', fruitColor: '#c09030' },
    { type: '芍药', icon: '🌸', label: '芍药', make: makeShaoyao, scale: 1, color: '#2a4a28', color2: '#d04060', stemColor: '#4a5a40' },
    { type: '蕙', icon: '🌼', label: '蕙', make: makeHui, scale: 1, color: '#2a4a30', color2: '#d0d0a0', stemColor: '#4a5a40' },
    { type: '艾', icon: '🌿', label: '艾', make: makeAi, scale: 1, color: '#5a6a48', color2: '#d0d0c8' },
    { type: '蒿', icon: '🌿', label: '蒿', make: makeHao, scale: 1, color: '#6a7a58', color2: '#b0a060' },
    { type: '菖蒲', icon: '🌾', label: '菖蒲', make: makeChangpu, scale: 1, color: '#3a5a30', color2: '#c8c070' },
    { type: '芷', icon: '🌿', label: '芷', make: makeZhi, scale: 1, color: '#3a5a30', color2: '#e8e8e0', stemColor: '#4a5a38' },
    { type: '蓍草', icon: '🤍', label: '蓍草', make: makeShicao, scale: 1, color: '#4a5a38', color2: '#f0f0e8' },
    { type: '荠', icon: '🌱', label: '荠', make: makeJiShepherd, scale: 1, color: '#4a5a38', color2: '#d0d0c0', stemColor: '#5a6a48' },
    { type: '芑', icon: '🌾', label: '芑', make: makeQiMillet, scale: 1, color: '#5a6a38', color2: '#c8b060' },
    { type: '蘼芜', icon: '🌱', label: '蘼芜', make: makeMiwu, scale: 1, color: '#4a6a40', color2: '#f0f0e8' },
    { type: '杜衡', icon: '🍃', label: '杜衡', make: makeDuheng, scale: 1, color: '#2a3a28', color2: '#3a1820' },
    { type: '卷柏', icon: '🪴', label: '卷柏', make: makeJuanbai, scale: 1, color: '#3a5a40', color2: '#2a4a30' },
  ];

  const TREE_TYPES = new Set(TREE_META.map((t) => t.type));
  const FLOWER_TYPES = new Set(FLOWER_META.map((t) => t.type));

  const TREE_PRESETS = TREE_META.map((t) => ({
    type: t.type, icon: t.icon, label: t.label, terrain: false, tab: 'trees', plant: 'tree',
  }));
  const FLOWER_PRESETS = FLOWER_META.map((t) => ({
    type: t.type, icon: t.icon, label: t.label, terrain: false, tab: 'flowers', plant: 'flower',
  }));

  const DEFAULTS = {};
  const FACTORIES = {};

  /** One placed object can represent a patch: N stems inside a radius. */
  function withCluster(makeOne, kind) {
    const maxN = kind === 'flower' ? 24 : kind === 'realTree' ? 3 : 16;
    return (props) => {
      const count = Math.max(1, Math.min(maxN, Math.round(props.clusterCount ?? 1)));
      const radius = Math.max(0, +(props.clusterRadius ?? 0));

      if (count <= 1) {
        const one = makeOne({ ...props, clusterCount: 1, clusterRadius: 0 });
        if (one.userData?.plantAnim) one.userData._animList = [one];
        return one;
      }

      const root = new THREE.Group();
      const yaw = props.rotation || 0;
      const animList = [];

      for (let i = 0; i < count; i++) {
        const childProps = {
          ...props,
          rotation: 0,
          clusterCount: 1,
          clusterRadius: 0,
        };
        if ((kind === 'tree' || kind === 'realTree') && childProps.height != null) {
          childProps.height = childProps.height * (0.88 + hash2(i, 11) * 0.24);
        }
        if (kind === 'flower' && childProps.scale != null) {
          childProps.scale = childProps.scale * (0.82 + hash2(i, 12) * 0.36);
        }
        // First stem keeps full detail; siblings use lite meshes (procedural only)
        PLANT_LITE = i > 0 && kind !== 'realTree';
        let one;
        try {
          one = makeOne(childProps);
        } finally {
          PLANT_LITE = false;
        }
        const a = hash2(i, 21) * H;
        const r = Math.sqrt(hash2(i, 22)) * radius;
        one.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
        one.rotation.y = hash2(i, 23) * H;
        if (one.userData?.plantAnim) animList.push(one);
        root.add(one);
      }

      root.rotation.y = yaw;
      root.userData.plantCluster = true;
      root.userData._animList = animList;
      return root;
    };
  }

  TREE_META.forEach((t) => {
    const isReal = isRealTreeType(t.type);
    DEFAULTS[t.type] = {
      height: t.height, rotation: 0,
      color: t.color, trunkColor: t.trunkColor, color2: t.color2,
      fruitColor: t.fruitColor, hitbox: true,
      // Heavy GLBs: keep clusters tiny (each clone is still 0.1–1.6M tris up close)
      clusterCount: 1, clusterRadius: isReal ? 1.5 : 2.5,
    };
    FACTORIES[t.type] = withCluster(t.make, isReal ? 'realTree' : 'tree');
  });
  FLOWER_META.forEach((t) => {
    DEFAULTS[t.type] = {
      scale: t.scale, rotation: 0,
      color: t.color, color2: t.color2,
      stemColor: t.stemColor, fruitColor: t.fruitColor,
      hitbox: false,
      clusterCount: 1, clusterRadius: 1.2,
    };
    FACTORIES[t.type] = withCluster(t.make, 'flower');
  });

  // Legacy aliases → real_song
  FACTORIES.tree = withCluster(realTreeFactories.real_song, 'tree');
  FACTORIES.bamboo = withCluster(realTreeFactories.real_song, 'tree');
  DEFAULTS.tree = { ...DEFAULTS.real_song };
  DEFAULTS.bamboo = { ...DEFAULTS.real_song };

  function migratePlantType(o) {
    migrateRealTreeType(o);
  }

  function isTreeType(type) {
    return TREE_TYPES.has(type) || type === 'tree' || type === 'bamboo';
  }
  function isFlowerType(type) { return FLOWER_TYPES.has(type); }

  /**
   * Wind sway — willow strands + light lean for trees/grass.
   * Uses cached anim roots (no per-frame full-scene traverse).
   */
  function ensureAnimList(mesh) {
    let list = mesh.userData._animList;
    if (list && list.length) return list;
    list = [];
    if (mesh.userData.plantAnim) {
      list.push(mesh);
    } else {
      for (let i = 0; i < mesh.children.length; i++) {
        const c = mesh.children[i];
        if (c.userData?.plantAnim) list.push(c);
      }
      if (!list.length) {
        mesh.traverse((n) => {
          if (n.userData?.plantAnim) list.push(n);
        });
      }
    }
    // Re-bind sway/strands if missing (after userData restamp)
    for (let i = 0; i < list.length; i++) {
      const anim = list[i].userData.plantAnim;
      if (!anim) continue;
      if (!anim.sway || !anim.sway.parent) {
        anim.sway = list[i].getObjectByName('plantSway') || list[i];
      }
      if (anim.kind === 'willow' && (!anim.strands || !anim.strands.parent)) {
        anim.strands = anim.sway.getObjectByName?.('willowStrands')
          || list[i].getObjectByName('willowStrands');
      }
    }
    mesh.userData._animList = list;
    return list;
  }

  function updatePlantAnims(objects, t) {
    for (const o of objects) {
      if (!isTreeType(o.type) && !isFlowerType(o.type)) continue;
      const mesh = o.mesh;
      if (!mesh) continue;
      // Host sets freezeAnim while selected so gizmo bounds stay put
      if (mesh.userData?.freezeAnim) continue;
      const list = ensureAnimList(mesh);
      for (let i = 0; i < list.length; i++) {
        const node = list[i];
        const anim = node.userData.plantAnim;
        if (!anim) continue;
        const ph = anim.phase || 0;
        const sway = anim.sway || node;
        if (anim.kind === 'willow') {
          const strands = anim.strands;
          if (strands) {
            const kids = strands.children;
            for (let j = 0; j < kids.length; j++) {
              const pivot = kids[j];
              const base = pivot.userData.baseOut || 0.4;
              const w = Math.sin(t * 1.35 + ph + (pivot.userData.phase || j)) * 0.22;
              pivot.rotation.z = base * 0.5 + w;
              pivot.rotation.x = Math.sin(t * 1.1 + ph + j) * 0.12;
            }
          }
          sway.rotation.z = Math.sin(t * 0.7 + ph) * 0.04;
          sway.rotation.x = Math.cos(t * 0.55 + ph) * 0.02;
        } else if (anim.kind === 'bamboo') {
          sway.rotation.z = Math.sin(t * 1.6 + ph) * 0.055;
          sway.rotation.x = Math.cos(t * 1.25 + ph) * 0.025;
        } else if (anim.kind === 'grass') {
          sway.rotation.z = Math.sin(t * 2.1 + ph) * 0.1;
          sway.rotation.x = Math.cos(t * 1.8 + ph * 1.3) * 0.05;
        } else {
          sway.rotation.z = Math.sin(t * 0.85 + ph) * 0.035;
          sway.rotation.x = Math.cos(t * 0.7 + ph) * 0.018;
        }
      }
    }
  }

  return {
    TREE_PRESETS,
    FLOWER_PRESETS,
    DEFAULTS,
    FACTORIES,
    TREE_TYPES,
    FLOWER_TYPES,
    isTreeType,
    isRealTreeType,
    isFlowerType,
    migratePlantType,
    updatePlantAnims,
  };
}
