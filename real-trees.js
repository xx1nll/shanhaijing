/**
 * GLB trees — 柏 real_bai, 桑 real_sang, 松 real_song, 柳 real_liu
 *
 * Quality (set via setRealTreeQuality):
 *   simple — procedural proxy (基本)
 *   normal — procedural proxy (正常 · no mesh)
 *   ultra  — real GLB + wind sway (真實 · with mesh)
 */

/** Game `height` prop → world metres. */
const HEIGHT_WORLD_FACTOR = 1.15;

export const REAL_TREE_SPECS = [
  {
    type: 'real_song',
    label: '松',
    icon: '🌲',
    url: './models/real_song.glb',
    defaultHeight: 1.7,
    color: '#3a5538',
    trunkColor: '#5a4030',
    color2: '#6a5030',
    bootPriority: 1,
  },
  {
    type: 'real_liu',
    label: '柳',
    icon: '🌿',
    url: './models/real_liu.glb',
    defaultHeight: 1.55,
    color: '#4a6a40',
    trunkColor: '#5a5040',
    color2: '#a8c0a0',
    bootPriority: 2,
  },
  {
    type: 'real_sang',
    label: '桑',
    icon: '🌳',
    url: './models/real_sang.glb',
    defaultHeight: 1.35,
    color: '#3a4a28',
    trunkColor: '#5a5040',
    color2: '#4a2040',
    bootPriority: 3,
  },
  {
    type: 'real_bai',
    label: '柏',
    icon: '🌲',
    url: './models/real_bai.glb',
    defaultHeight: 1.8,
    color: '#2a4a3a',
    trunkColor: '#6a4030',
    color2: '#5a4a30',
    bootPriority: 4,
  },
];

const templates = new Map();
const naturalHeights = new Map();
const loadState = new Map();
const sharedMatCache = new Map();
let preloadPromise = null;

/** @type {'simple'|'normal'|'ultra'} */
let qualityMode = 'ultra';

const LOAD_TIMEOUT_MS = 120_000;

const LEGACY_TREE_MAP = {
  tree: 'real_song', bamboo: 'real_song',
  竹: 'real_song', 松: 'real_song', 柏: 'real_bai', 桑: 'real_sang', 柳: 'real_liu',
  槐: 'real_sang', 榆: 'real_song', 桐: 'real_sang',
  桂: 'real_bai', 棠: 'real_sang', 棕: 'real_bai', 栗: 'real_sang',
  栎: 'real_song', 漆: 'real_sang', 梓: 'real_sang', 柞: 'real_song',
  檀: 'real_bai', 楝: 'real_sang', 柘: 'real_sang', 榛: 'real_song',
  荆: 'real_sang', 棘: 'real_sang',
};

export function isRealTreeType(type) {
  return type === 'real_bai' || type === 'real_sang' || type === 'real_song' || type === 'real_liu';
}

export function setRealTreeQuality(q) {
  qualityMode = q === 'simple' || q === 'normal' || q === 'ultra' ? q : 'ultra';
}

export function getRealTreeQuality() {
  return qualityMode;
}

export function migrateRealTreeType(o) {
  if (!o?.type) return;
  if (o.type === 'tree') {
    const v = o.props?.variant;
    o.type = v === 'plum' ? 'real_sang' : 'real_song';
    delete o.props?.variant;
    return;
  }
  if (o.type === 'bamboo') {
    o.type = 'real_song';
    return;
  }
  const mapped = LEGACY_TREE_MAP[o.type];
  if (mapped) o.type = mapped;
}

function meshVertCount(mesh) {
  return mesh.geometry?.attributes?.position?.count || 0;
}

/**
 * Keep GLB materials intact — only mute Physical clearcoat and fill missing bark.
 */
function hardenTreeMaterial(THREE, mat) {
  if (!mat || mat.isMeshBasicMaterial) return mat;
  mat.userData = mat.userData || {};
  mat.userData.shared = true;
  mat.userData.realTreeMat = true;

  const name = (mat.name || '').toLowerCase();
  const isBark = /bark|wood|trunk|limb|幹|皮/.test(name);
  if (!mat.map && mat.color && mat.color.r > 0.92 && mat.color.g > 0.92 && mat.color.b > 0.92 && isBark) {
    mat.color.set('#6a5340');
  }

  if (mat.isMeshPhysicalMaterial) {
    mat.clearcoat = 0;
    mat.clearcoatRoughness = 1;
    mat.sheen = 0;
    mat.transmission = 0;
    mat.specularIntensity = 0.15;
    mat.metalness = 0;
    mat.roughness = Math.max(mat.roughness ?? 0.7, 0.72);
  } else if (mat.isMeshStandardMaterial) {
    mat.metalness = Math.min(mat.metalness ?? 0, 0.04);
    mat.roughness = Math.max(mat.roughness ?? 0.75, 0.7);
  }
  if (mat.flatShading) mat.flatShading = false;
  mat.needsUpdate = true;
  return mat;
}

/** Authored wood/trunk mesh — not needles/leaves/fruit/twigs. */
function isAuthoredTrunkMesh(m) {
  const name = (m.name || '').toLowerCase();
  if (/needle|leaf|fruit|spray|cone|twig|foliage|canopy|card|叶|針|针|果|枝条/.test(name)) {
    return false;
  }
  // Blender exports: MulberryTrunk_*, CypressTrunk_*, Limb_*_c, …
  if (/trunk|bark|wood|stem|limb|幹|树干|树幹/.test(name)) return true;
  return false;
}

function stemOf(m) {
  if (!m.geometry) return false;
  if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
  const bb = m.geometry.boundingBox;
  if (!bb) return false;
  const sx = bb.max.x - bb.min.x;
  const sy = bb.max.y - bb.min.y;
  const sz = bb.max.z - bb.min.z;
  const xz = Math.max(sx, sz, 1e-6);
  return sy > xz * 2.8 && xz < sy * 0.35;
}

/**
 * Play collision = authored trunk meshes only.
 * Editor click = real meshes + full-canopy pick proxy (raycastable; material.visible=false is skipped by Three).
 */
function prepTemplate(root, THREE) {
  const meshes = [];
  root.traverse((o) => { if (o.isMesh) meshes.push(o); });

  let namedTrunk = null;
  for (const m of meshes) {
    if (isAuthoredTrunkMesh(m)) {
      namedTrunk = m;
      break;
    }
  }

  const trunkMeshes = [];
  for (const m of meshes) {
    if (m.geometry) {
      m.geometry.userData.shared = true;
      if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    }
    if (Array.isArray(m.material)) {
      m.material = m.material.map((mat) => hardenTreeMaterial(THREE, mat));
    } else {
      m.material = hardenTreeMaterial(THREE, m.material);
    }
    const isTrunk = m === namedTrunk || isAuthoredTrunkMesh(m) || (!namedTrunk && stemOf(m));
    m.castShadow = isTrunk;
    m.receiveShadow = false;
    m.frustumCulled = true;
    m.userData.noCastShadow = !isTrunk;
    m.userData.realTreeMesh = true;
    m.userData.isTrunk = isTrunk;
    if (isTrunk) trunkMeshes.push(m);
  }

  root.updateMatrixWorld(true);

  // Cache authored trunk bounds (template space) for play hitboxes
  if (trunkMeshes.length) {
    const trunkBox = new THREE.Box3();
    for (const m of trunkMeshes) {
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      const b = m.geometry.boundingBox.clone();
      b.applyMatrix4(m.matrixWorld);
      trunkBox.union(b);
    }
    if (!trunkBox.isEmpty()) {
      root.userData.trunkLocalBox = {
        min: trunkBox.min.toArray(),
        max: trunkBox.max.toArray(),
      };
    }
  }

  // Full visual bounds for editor picking — invisible but raycastable
  const full = new THREE.Box3().setFromObject(root);
  if (!full.isEmpty()) {
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    full.getSize(size);
    full.getCenter(center);
    const pickMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false,
      side: THREE.DoubleSide,
    });
    pickMat.userData.shared = true;
    const pick = new THREE.Mesh(
      new THREE.BoxGeometry(
        Math.max(0.35, size.x * 1.02),
        Math.max(0.35, size.y * 1.02),
        Math.max(0.35, size.z * 1.02),
      ),
      pickMat,
    );
    pick.position.copy(center);
    pick.name = 'TreeEditorPick';
    pick.userData.realTreeMesh = true;
    pick.userData.isTrunk = false;
    pick.userData.editorPick = true;
    pick.userData.noCastShadow = true;
    pick.castShadow = false;
    pick.receiveShadow = false;
    pick.frustumCulled = true;
    root.add(pick);
  }
}

function snapToGround(root, THREE) {
  root.position.set(0, 0, 0);
  root.updateMatrixWorld(true);
  const _v = new THREE.Vector3();
  const _box = new THREE.Box3();
  let minY = Infinity;

  root.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const geo = o.geometry;
    if (!geo.boundingBox) geo.computeBoundingBox();
    if (!geo.boundingBox) return;
    _box.copy(geo.boundingBox);
    for (let i = 0; i < 8; i++) {
      _v.copy(_box.min);
      if (i & 1) _v.x = _box.max.x;
      if (i & 2) _v.y = _box.max.y;
      if (i & 4) _v.z = _box.max.z;
      _v.applyMatrix4(o.matrixWorld);
      if (_v.y < minY) minY = _v.y;
    }
  });

  if (Number.isFinite(minY)) root.position.y -= minY;
  root.updateMatrixWorld(true);

  let maxY = -Infinity;
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const geo = o.geometry;
    if (!geo.boundingBox) geo.computeBoundingBox();
    if (!geo.boundingBox) return;
    _box.copy(geo.boundingBox);
    for (let i = 0; i < 8; i++) {
      _v.copy(_box.min);
      if (i & 1) _v.x = _box.max.x;
      if (i & 2) _v.y = _box.max.y;
      if (i & 4) _v.z = _box.max.z;
      _v.applyMatrix4(o.matrixWorld);
      if (_v.y > maxY) maxY = _v.y;
    }
  });

  return Math.max(0.01, maxY - root.position.y);
}

function sharedMat(THREE, hex, opts = {}) {
  const key = `${hex}|${opts.roughness ?? 0.88}`;
  let m = sharedMatCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: hex,
      roughness: opts.roughness ?? 0.88,
      metalness: 0.02,
      flatShading: false,
      side: THREE.FrontSide,
    });
    m.userData.shared = true;
    m.userData.realTreeMat = true;
    sharedMatCache.set(key, m);
  }
  return m;
}

/** Low-poly stand-in for 基本渲染. */
function buildProxy(THREE, spec, height) {
  const g = new THREE.Group();
  g.name = 'treeProxy';
  const bark = sharedMat(THREE, spec.trunkColor || '#5a4030', { roughness: 0.92 });
  const leaf = sharedMat(THREE, spec.color || '#3a5538', { roughness: 0.9 });

  const trunkH = height * 0.5;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(height * 0.035, height * 0.055, trunkH, 5),
    bark,
  );
  trunk.position.y = trunkH * 0.5;
  trunk.castShadow = true;
  trunk.receiveShadow = false;
  trunk.userData.realTreeMesh = true;
  trunk.userData.isTrunk = true;
  g.add(trunk);

  for (let i = 0; i < 2; i++) {
    const r = height * (0.32 - i * 0.08);
    const ch = height * 0.32;
    const crown = new THREE.Mesh(new THREE.ConeGeometry(r, ch, 6), leaf);
    crown.position.y = trunkH * 0.85 + i * height * 0.28;
    crown.castShadow = false;
    crown.receiveShadow = false;
    crown.userData.realTreeMesh = true;
    crown.userData.noCastShadow = true;
    crown.userData.isTrunk = false;
    crown.raycast = () => {};
    g.add(crown);
  }
  return g;
}

function cloneShared(src) {
  const dst = src.clone(false);
  dst.position.copy(src.position);
  dst.quaternion.copy(src.quaternion);
  dst.scale.copy(src.scale);
  dst.name = src.name;
  dst.userData = { ...src.userData };

  if (src.isMesh) {
    dst.geometry = src.geometry;
    dst.material = src.material;
    dst.castShadow = src.castShadow;
    dst.receiveShadow = src.receiveShadow;
    dst.frustumCulled = src.frustumCulled;
    // Preserve disabled canopy raycast / custom pick behaviour
    dst.raycast = src.raycast;
  }

  for (let i = 0; i < src.children.length; i++) {
    dst.add(cloneShared(src.children[i]));
  }
  return dst;
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout: ${label}`)), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

function yieldFrame() {
  return new Promise((r) => requestAnimationFrame(r));
}

async function loadOneTree(THREE, GLTFLoader, spec) {
  if (templates.has(spec.type)) return spec.type;
  if (loadState.get(spec.type) === 'loading') {
    while (loadState.get(spec.type) === 'loading') await yieldFrame();
    return spec.type;
  }

  loadState.set(spec.type, 'loading');
  try {
    const loader = new GLTFLoader();
    const gltf = await withTimeout(loader.loadAsync(spec.url), LOAD_TIMEOUT_MS, spec.type);
    await yieldFrame();
    const root = gltf.scene;
    root.name = spec.type;
    await yieldFrame();
    let h = spec.defaultHeight * HEIGHT_WORLD_FACTOR;
    try { h = snapToGround(root, THREE); } catch (err) {
      console.warn(`snapToGround failed: ${spec.type}`, err);
    }
    prepTemplate(root, THREE);
    templates.set(spec.type, root);
    naturalHeights.set(spec.type, h);
    loadState.set(spec.type, 'ready');
    return spec.type;
  } catch (err) {
    console.warn(`real tree load failed: ${spec.type}`, err);
    loadState.set(spec.type, 'error');
    throw err;
  }
}

export function preloadRealTrees(THREE, GLTFLoader, opts = {}) {
  if (!GLTFLoader) {
    return Promise.reject(new Error('preloadRealTrees: pass GLTFLoader'));
  }

  const run = async () => {
    const sorted = [...REAL_TREE_SPECS].sort(
      (a, b) => (a.bootPriority ?? 99) - (b.bootPriority ?? 99),
    );
    const list = opts.bootOnly ? sorted.filter((s) => s.type === 'real_song') : sorted;

    for (let i = 0; i < list.length; i++) {
      const spec = list[i];
      opts.onProgress?.(
        18 + ((i + 0.2) / Math.max(1, list.length)) * 6,
        `載入林木 · ${spec.label}…`,
      );
      try { await loadOneTree(THREE, GLTFLoader, spec); } catch (err) {
        console.warn(`skipping ${spec.type}`, err);
      }
      opts.onProgress?.(
        18 + ((i + 1) / Math.max(1, list.length)) * 6,
        `載入林木 · ${spec.label}`,
      );
      await yieldFrame();
    }
  };

  if (opts.bootOnly) return run();
  if (!preloadPromise) preloadPromise = run();
  return preloadPromise;
}

export function preloadRemainingRealTrees(THREE, GLTFLoader, onProgress) {
  const pending = REAL_TREE_SPECS.filter(
    (s) => s.type !== 'real_song' && loadState.get(s.type) !== 'ready',
  );
  if (!pending.length) return Promise.resolve();

  return (async () => {
    for (let i = 0; i < pending.length; i++) {
      const spec = pending[i];
      onProgress?.(`載入林木 · ${spec.label}…`);
      try { await loadOneTree(THREE, GLTFLoader, spec); } catch (err) {
        console.warn(`background load failed: ${spec.type}`, err);
      }
      await yieldFrame();
    }
  })();
}

export function realTreesReady() {
  return REAL_TREE_SPECS.every((s) => templates.has(s.type));
}

export function realTreeReady(type) {
  return templates.has(type);
}

/**
 * @param {Function} finish — plants.js finish(g, props) for wind when quality=ultra
 */
export function buildRealTreeFactories(THREE, finish) {
  function makeProxyTree(props, spec) {
    const h = (props.height ?? spec.defaultHeight) * HEIGHT_WORLD_FACTOR;
    const g = new THREE.Group();
    g.add(buildProxy(THREE, spec, h));
    g.userData.realTree = spec.type;
    g.rotation.y = props.rotation || 0;
    return g;
  }

  function makeRealTree(spec) {
    return (props) => {
      // 基本／正常：proxy (no GLB). 真實：full mesh when loaded.
      if (qualityMode !== 'ultra') return makeProxyTree(props, spec);

      const tmpl = templates.get(spec.type);
      if (!tmpl) return makeProxyTree(props, spec);

      const model = cloneShared(tmpl);
      const targetH = (props.height ?? spec.defaultHeight) * HEIGHT_WORLD_FACTOR;
      const natural = naturalHeights.get(spec.type) || 1;
      model.scale.setScalar(targetH / natural);

      const g = new THREE.Group();
      g.add(model);
      g.userData.realTree = spec.type;

      return finish(g, props);
    };
  }

  const factories = {};
  for (const spec of REAL_TREE_SPECS) {
    factories[spec.type] = makeRealTree(spec);
  }
  return factories;
}
