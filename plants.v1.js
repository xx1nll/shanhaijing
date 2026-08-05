/**
 * 蓬莱筑境 — trees & flowers (低面數、可調色)
 * Shared helpers keep mesh counts low so many instances stay playable.
 */
export function installPlants(THREE, { mat, cprop, hash2 }) {
  const H = Math.PI * 2;

  function trunk(g, y0, y1, r0, r1, col, segs = 5) {
    const h = y1 - y0;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, h, segs), mat(col));
    m.position.y = (y0 + y1) * 0.5;
    m.castShadow = true;
    g.add(m);
    return m;
  }

  function coneAt(g, x, y, z, r, h, col, segs = 6) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, segs), mat(col));
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
    return m;
  }

  function ball(g, x, y, z, r, col, w = 5, ht = 4) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, w, ht), mat(col));
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
    return m;
  }

  function icosa(g, x, y, z, r, col) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat(col));
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
    return m;
  }

  /** Few alpha leaf cards — cheap foliage detail */
  function leafCards(g, cx, cy, cz, n, spread, size, col, seed = 1) {
    const mtl = mat(col, { side: THREE.DoubleSide, transparent: true, opacity: 0.92, depthWrite: false });
    for (let i = 0; i < n; i++) {
      const a = hash2(i + seed, seed * 3) * H;
      const r = spread * (0.25 + hash2(i, seed + 1) * 0.75);
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(size, size * (0.6 + hash2(i, 2) * 0.8)), mtl);
      plane.position.set(cx + Math.cos(a) * r, cy + (hash2(i, 4) - 0.3) * spread * 0.5, cz + Math.sin(a) * r);
      plane.rotation.set(hash2(i, 5) * 0.8 - 0.2, a, hash2(i, 6) * 0.5 - 0.25);
      g.add(plane);
    }
  }

  function stackedCones(g, baseY, h, leaf, layers = 4, open = 0.4) {
    for (let i = 0; i < layers; i++) {
      const t = i / Math.max(1, layers - 1);
      coneAt(
        g,
        (hash2(i, 2) - 0.5) * h * 0.08,
        baseY + t * h * 0.72,
        (hash2(i, 5) - 0.5) * h * 0.08,
        h * (open - t * (open * 0.55)),
        h * 0.28,
        leaf,
        6
      );
    }
  }

  function roundCanopy(g, y, r, leaf, chunks = 5) {
    for (let i = 0; i < chunks; i++) {
      const a = (i / chunks) * H;
      icosa(g, Math.cos(a) * r * 0.35, y + (hash2(i, 1) - 0.5) * r * 0.25, Math.sin(a) * r * 0.35, r * (0.42 + hash2(i, 2) * 0.12), leaf);
    }
    icosa(g, 0, y + r * 0.15, 0, r * 0.5, leaf);
  }

  function finish(g, props) {
    g.rotation.y = props.rotation || 0;
    return g;
  }

  // ─── Trees ───────────────────────────────────────────────
  function makeBai(props) {
    const g = new THREE.Group();
    const h = props.height ?? 1.8;
    const leaf = cprop(props, 'color', '#2a4a3a');
    const bark = cprop(props, 'trunkColor', '#6a4030');
    trunk(g, 0, h * 0.72, h * 0.07, h * 0.035, bark, 6);
    // pyramidal scale sprays as stacked cones + tight cards
    stackedCones(g, h * 0.28, h * 0.75, leaf, 5, 0.32);
    leafCards(g, 0, h * 0.7, 0, 6, h * 0.28, h * 0.12, leaf, 11);
    // small woody cones
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * H;
      ball(g, Math.cos(a) * h * 0.12, h * (0.45 + i * 0.08), Math.sin(a) * h * 0.12, h * 0.025, cprop(props, 'color2', '#5a4a30'), 4, 3);
    }
    return finish(g, props);
  }

  function makeSong(props) {
    const g = new THREE.Group();
    const h = props.height ?? 1.7;
    const leaf = cprop(props, 'color', '#3a5538');
    const bark = cprop(props, 'trunkColor', '#5a4030');
    trunk(g, 0, h * 0.55, h * 0.09, h * 0.05, bark, 5);
    // open airy whorls
    for (let i = 0; i < 4; i++) {
      const y = h * (0.35 + i * 0.16);
      const R = h * (0.38 - i * 0.06);
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * H + i * 0.4;
        coneAt(g, Math.cos(a) * R * 0.35, y, Math.sin(a) * R * 0.35, R * 0.45, h * 0.22, leaf, 5);
      }
    }
    leafCards(g, 0, h * 0.65, 0, 8, h * 0.4, h * 0.18, leaf, 3); // needle cards
    // ovoid cones
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1;
      const c = new THREE.Mesh(new THREE.ConeGeometry(h * 0.04, h * 0.1, 5), mat(cprop(props, 'color2', '#6a5030')));
      c.position.set(Math.cos(a) * h * 0.15, h * 0.5, Math.sin(a) * h * 0.15);
      g.add(c);
    }
    return finish(g, props);
  }

  function makeHuai(props) {
    const g = new THREE.Group();
    const h = props.height ?? 1.5;
    const leaf = cprop(props, 'color', '#3a5030');
    const bark = cprop(props, 'trunkColor', '#5a5548');
    trunk(g, 0, h * 0.4, h * 0.1, h * 0.07, bark, 5);
    // zigzag branches
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * H;
      const br = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.02, h * 0.04, h * 0.35, 4), mat(bark));
      br.position.set(Math.cos(a) * h * 0.12, h * 0.5, Math.sin(a) * h * 0.12);
      br.rotation.z = Math.cos(a) * 0.7;
      br.rotation.x = Math.sin(a) * 0.5;
      g.add(br);
    }
    roundCanopy(g, h * 0.72, h * 0.55, leaf, 6);
    // cream panicles
    const fl = cprop(props, 'color2', '#e8e0c0');
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * H;
      ball(g, Math.cos(a) * h * 0.25, h * 0.85, Math.sin(a) * h * 0.25, h * 0.06, fl, 4, 3);
    }
    return finish(g, props);
  }

  function makeSang(props) {
    const g = new THREE.Group();
    const h = props.height ?? 1.35;
    const leaf = cprop(props, 'color', '#3a4a28');
    const bark = cprop(props, 'trunkColor', '#5a5040');
    trunk(g, 0, h * 0.45, h * 0.08, h * 0.06, bark, 5);
    trunk(g, 0, h * 0.38, h * 0.05, h * 0.04, bark, 4).position.x = h * 0.08; // multi-stem
    roundCanopy(g, h * 0.7, h * 0.5, leaf, 5);
    leafCards(g, 0, h * 0.65, 0, 5, h * 0.35, h * 0.16, leaf, 7);
    const fruit = cprop(props, 'color2', '#4a2040');
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * H;
      const m = ball(g, Math.cos(a) * h * 0.28, h * 0.55, Math.sin(a) * h * 0.28, h * 0.04, fruit, 4, 3);
      m.scale.set(1, 1.4, 1);
      m.material = mat(fruit, { roughness: 0.35 });
    }
    return finish(g, props);
  }

  function makeYu(props) {
    const g = new THREE.Group();
    const h = props.height ?? 1.65;
    const leaf = cprop(props, 'color', '#3a4a32');
    const bark = cprop(props, 'trunkColor', '#4a453c');
    trunk(g, 0, h * 0.5, h * 0.11, h * 0.06, bark, 6);
    // umbrella canopy
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * H;
      icosa(g, Math.cos(a) * h * 0.32, h * 0.78, Math.sin(a) * h * 0.32, h * 0.28, leaf);
    }
    icosa(g, 0, h * 0.88, 0, h * 0.3, leaf);
    // samaras — thin discs
    const sam = cprop(props, 'color2', '#c8b070');
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3;
      const d = new THREE.Mesh(new THREE.CircleGeometry(h * 0.04, 6), mat(sam, { side: THREE.DoubleSide, transparent: true, opacity: 0.75 }));
      d.position.set(Math.cos(a) * h * 0.2, h * 0.55 + i * 0.04, Math.sin(a) * h * 0.2);
      d.rotation.x = -0.4;
      g.add(d);
    }
    return finish(g, props);
  }

  function makeLiu(props) {
    const g = new THREE.Group();
    const h = props.height ?? 1.5;
    const leaf = cprop(props, 'color', '#4a6a40');
    const bark = cprop(props, 'trunkColor', '#5a5040');
    const under = cprop(props, 'color2', '#a8c0a0');
    trunk(g, 0, h * 0.55, h * 0.08, h * 0.05, bark, 5);
    // drooping strands as tapered cylinders + leaf cards
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * H;
      const len = h * (0.45 + hash2(i, 1) * 0.2);
      const strand = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.008, h * 0.015, len, 3), mat(leaf));
      strand.position.set(Math.cos(a) * h * 0.2, h * 0.55 - len * 0.35, Math.sin(a) * h * 0.2);
      strand.rotation.z = Math.cos(a) * 0.35;
      strand.rotation.x = Math.sin(a) * 0.35;
      g.add(strand);
    }
    leafCards(g, 0, h * 0.4, 0, 10, h * 0.4, h * 0.14, leaf, 9);
    // catkins
    for (let i = 0; i < 4; i++) {
      const a = i * 1.5;
      const cat = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.015, h * 0.02, h * 0.1, 4), mat(under));
      cat.position.set(Math.cos(a) * h * 0.15, h * 0.5, Math.sin(a) * h * 0.15);
      g.add(cat);
    }
    return finish(g, props);
  }

  function makeTong(props) {
    const g = new THREE.Group();
    const h = props.height ?? 1.55;
    const leaf = cprop(props, 'color', '#3a5528');
    const bark = cprop(props, 'trunkColor', '#6a6558');
    const fl = cprop(props, 'color2', '#c8a8e0');
    trunk(g, 0, h * 0.55, h * 0.09, h * 0.06, bark, 5);
    // huge heart-ish leaves as large cards
    leafCards(g, 0, h * 0.75, 0, 7, h * 0.45, h * 0.32, leaf, 2);
    icosa(g, 0, h * 0.7, 0, h * 0.25, leaf);
    // trumpet panicles
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * H;
      const bell = new THREE.Mesh(new THREE.ConeGeometry(h * 0.05, h * 0.1, 5), mat(fl));
      bell.position.set(Math.cos(a) * h * 0.12, h * 0.95, Math.sin(a) * h * 0.12);
      bell.rotation.x = Math.PI;
      g.add(bell);
    }
    return finish(g, props);
  }

  function makeZi(props) {
    const g = new THREE.Group();
    const h = props.height ?? 1.4;
    const leaf = cprop(props, 'color', '#3a4a30');
    const bark = cprop(props, 'trunkColor', '#5a5048');
    const fl = cprop(props, 'color2', '#e8e0d0');
    trunk(g, 0, h * 0.5, h * 0.08, h * 0.05, bark, 5);
    roundCanopy(g, h * 0.72, h * 0.48, leaf, 5);
    leafCards(g, 0, h * 0.7, 0, 4, h * 0.35, h * 0.22, leaf, 4);
    // hanging bean pods
    for (let i = 0; i < 5; i++) {
      const a = i * 1.2;
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.012, h * 0.015, h * 0.35, 4), mat(cprop(props, 'fruitColor', '#5a4a30')));
      pod.position.set(Math.cos(a) * h * 0.2, h * 0.45, Math.sin(a) * h * 0.2);
      pod.rotation.z = 0.25;
      g.add(pod);
    }
    ball(g, 0, h * 0.9, 0, h * 0.08, fl, 4, 3);
    return finish(g, props);
  }

  function makeZuo(props) {
    const g = new THREE.Group();
    const h = props.height ?? 1.55;
    const leaf = cprop(props, 'color', '#3a4a28');
    const bark = cprop(props, 'trunkColor', '#3a3830');
    trunk(g, 0, h * 0.5, h * 0.1, h * 0.06, bark, 6);
    roundCanopy(g, h * 0.75, h * 0.5, leaf, 6);
    // lobed leaf cards
    leafCards(g, 0, h * 0.7, 0, 6, h * 0.4, h * 0.18, leaf, 5);
    // acorns
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * H;
      ball(g, Math.cos(a) * h * 0.22, h * 0.55, Math.sin(a) * h * 0.22, h * 0.035, cprop(props, 'color2', '#6a5030'), 4, 3);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(h * 0.04, h * 0.03, 5), mat('#4a4030'));
      cap.position.set(Math.cos(a) * h * 0.22, h * 0.58, Math.sin(a) * h * 0.22);
      cap.rotation.x = Math.PI;
      g.add(cap);
    }
    return finish(g, props);
  }

  function makeTan(props) {
    const g = new THREE.Group();
    const h = props.height ?? 1.35;
    const leaf = cprop(props, 'color', '#3a4a34');
    const bark = cprop(props, 'trunkColor', '#5a5548');
    trunk(g, 0, h * 0.5, h * 0.08, h * 0.05, bark, 5);
    roundCanopy(g, h * 0.72, h * 0.42, leaf, 4);
    leafCards(g, 0, h * 0.68, 0, 5, h * 0.32, h * 0.14, leaf, 6);
    for (let i = 0; i < 4; i++) {
      const a = i * 1.5;
      const d = new THREE.Mesh(new THREE.CircleGeometry(h * 0.05, 6), mat(cprop(props, 'color2', '#c0a860'), { side: THREE.DoubleSide, transparent: true, opacity: 0.7 }));
      d.position.set(Math.cos(a) * h * 0.18, h * 0.55, Math.sin(a) * h * 0.18);
      g.add(d);
    }
    return finish(g, props);
  }

  function makeGui(props) {
    const g = new THREE.Group();
    const h = props.height ?? 1.4;
    const leaf = cprop(props, 'color', '#2a4a30');
    const bark = cprop(props, 'trunkColor', '#6a6558');
    trunk(g, 0, h * 0.55, h * 0.07, h * 0.045, bark, 5);
    stackedCones(g, h * 0.35, h * 0.6, leaf, 4, 0.36);
    leafCards(g, 0, h * 0.7, 0, 6, h * 0.3, h * 0.16, leaf, 8);
    for (let i = 0; i < 5; i++) {
      ball(g, Math.cos(i) * h * 0.15, h * 0.5 + i * 0.05, Math.sin(i) * h * 0.15, h * 0.03, cprop(props, 'color2', '#3a2040'), 4, 3);
    }
    return finish(g, props);
  }

  function makeTang(props) {
    const g = new THREE.Group();
    const h = props.height ?? 1.1;
    const leaf = cprop(props, 'color', '#3a5528');
    const bark = cprop(props, 'trunkColor', '#5a4a38');
    const fl = cprop(props, 'color2', '#e8b0c0');
    trunk(g, 0, h * 0.45, h * 0.06, h * 0.04, bark, 5);
    roundCanopy(g, h * 0.7, h * 0.4, leaf, 4);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * H;
      ball(g, Math.cos(a) * h * 0.28, h * 0.75, Math.sin(a) * h * 0.28, h * 0.05, fl, 4, 3);
    }
    for (let i = 0; i < 4; i++) {
      ball(g, Math.cos(i * 1.7) * h * 0.2, h * 0.55, Math.sin(i * 1.7) * h * 0.2, h * 0.045, cprop(props, 'fruitColor', '#c04040'), 4, 3);
    }
    return finish(g, props);
  }

  function makeZhe(props) {
    const g = new THREE.Group();
    const h = props.height ?? 0.95;
    const leaf = cprop(props, 'color', '#3a5030');
    const bark = cprop(props, 'trunkColor', '#7a6a40');
    trunk(g, 0, h * 0.5, h * 0.05, h * 0.04, bark, 4);
    // zigzag + thorns
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * H;
      const br = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.012, h * 0.02, h * 0.3, 3), mat(bark));
      br.position.set(Math.cos(a) * h * 0.1, h * 0.55, Math.sin(a) * h * 0.1);
      br.rotation.z = (i % 2 ? 1 : -1) * 0.8;
      g.add(br);
      const th = new THREE.Mesh(new THREE.ConeGeometry(h * 0.015, h * 0.08, 3), mat('#4a4030'));
      th.position.set(Math.cos(a) * h * 0.18, h * 0.5, Math.sin(a) * h * 0.18);
      th.rotation.z = 1.2;
      g.add(th);
    }
    roundCanopy(g, h * 0.75, h * 0.35, leaf, 4);
    for (let i = 0; i < 5; i++) {
      ball(g, Math.cos(i) * h * 0.2, h * 0.55, Math.sin(i) * h * 0.2, h * 0.05, cprop(props, 'color2', '#c04828'), 4, 3);
    }
    return finish(g, props);
  }

  function makeLian(props) {
    const g = new THREE.Group();
    const h = props.height ?? 1.4;
    const leaf = cprop(props, 'color', '#3a4a30');
    const bark = cprop(props, 'trunkColor', '#6a6558');
    const fl = cprop(props, 'color2', '#8a68b0');
    trunk(g, 0, h * 0.5, h * 0.08, h * 0.05, bark, 5);
    // bipinnate suggested by many small canopy bits
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * H;
      icosa(g, Math.cos(a) * h * 0.3, h * 0.7 + (i % 2) * 0.08, Math.sin(a) * h * 0.3, h * 0.18, leaf);
    }
    for (let i = 0; i < 6; i++) {
      ball(g, Math.cos(i * 1.1) * h * 0.2, h * 0.9, Math.sin(i * 1.1) * h * 0.2, h * 0.04, fl, 4, 3);
    }
    for (let i = 0; i < 5; i++) {
      ball(g, Math.cos(i * 1.4) * h * 0.22, h * 0.5, Math.sin(i * 1.4) * h * 0.22, h * 0.035, cprop(props, 'fruitColor', '#b89040'), 4, 3);
    }
    return finish(g, props);
  }

  function makeLiEver(props) {
    // 栎 — evergreen oak, leathery leaves
    const g = new THREE.Group();
    const h = props.height ?? 1.5;
    const leaf = cprop(props, 'color', '#2a3a28');
    const bark = cprop(props, 'trunkColor', '#4a453c');
    const under = cprop(props, 'color2', '#6a4a30');
    trunk(g, 0, h * 0.5, h * 0.09, h * 0.055, bark, 5);
    stackedCones(g, h * 0.35, h * 0.65, leaf, 4, 0.4);
    leafCards(g, 0, h * 0.65, 0, 5, h * 0.35, h * 0.15, under, 12);
    for (let i = 0; i < 3; i++) {
      ball(g, Math.cos(i * 2) * h * 0.18, h * 0.5, Math.sin(i * 2) * h * 0.18, h * 0.03, '#5a4030', 4, 3);
    }
    return finish(g, props);
  }

  function makeQi(props) {
    const g = new THREE.Group();
    const h = props.height ?? 1.35;
    const leaf = cprop(props, 'color', '#4a3020'); // autumn lean default
    const bark = cprop(props, 'trunkColor', '#6a6558');
    trunk(g, 0, h * 0.5, h * 0.07, h * 0.05, bark, 5);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * H;
      icosa(g, Math.cos(a) * h * 0.25, h * 0.72, Math.sin(a) * h * 0.25, h * 0.2, leaf);
    }
    leafCards(g, 0, h * 0.7, 0, 5, h * 0.35, h * 0.14, cprop(props, 'color2', '#c05028'), 13);
    return finish(g, props);
  }

  function makeZong(props) {
    const g = new THREE.Group();
    const h = props.height ?? 1.6;
    const leaf = cprop(props, 'color', '#3a5a30');
    const bark = cprop(props, 'trunkColor', '#5a4a38');
    // fibrous trunk
    trunk(g, 0, h * 0.7, h * 0.08, h * 0.09, bark, 6);
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(h * 0.09, h * 0.015, 4, 8), mat(cprop(props, 'color2', '#6a5a48')));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = h * (0.25 + i * 0.18);
      g.add(ring);
    }
    // fan leaves
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * H;
      const fan = new THREE.Mesh(new THREE.PlaneGeometry(h * 0.55, h * 0.45), mat(leaf, { side: THREE.DoubleSide }));
      fan.position.set(Math.cos(a) * h * 0.15, h * 0.85, Math.sin(a) * h * 0.15);
      fan.rotation.set(0.9, a, 0.15);
      g.add(fan);
    }
    return finish(g, props);
  }

  function makeZhen(props) {
    const g = new THREE.Group();
    const h = props.height ?? 0.9;
    const leaf = cprop(props, 'color', '#3a4a30');
    const bark = cprop(props, 'trunkColor', '#5a5548');
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * H;
      trunk(g, 0, h * 0.45, h * 0.035, h * 0.025, bark, 4).position.set(Math.cos(a) * h * 0.08, 0, Math.sin(a) * h * 0.08);
    }
    roundCanopy(g, h * 0.65, h * 0.4, leaf, 5);
    for (let i = 0; i < 4; i++) {
      ball(g, Math.cos(i) * h * 0.2, h * 0.5, Math.sin(i) * h * 0.2, h * 0.04, cprop(props, 'color2', '#6a5030'), 4, 3);
    }
    return finish(g, props);
  }

  function makeLiChest(props) {
    const g = new THREE.Group();
    const h = props.height ?? 1.55;
    const leaf = cprop(props, 'color', '#3a4a28');
    const bark = cprop(props, 'trunkColor', '#3a3830');
    trunk(g, 0, h * 0.5, h * 0.1, h * 0.06, bark, 6);
    roundCanopy(g, h * 0.75, h * 0.52, leaf, 6);
    leafCards(g, 0, h * 0.7, 0, 5, h * 0.4, h * 0.2, leaf, 14);
    // spiky burs
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * H;
      const bur = icosa(g, Math.cos(a) * h * 0.22, h * 0.5, Math.sin(a) * h * 0.22, h * 0.06, cprop(props, 'color2', '#4a6030'));
      bur.scale.set(1, 0.9, 1);
    }
    return finish(g, props);
  }

  function makeJing(props) {
    const g = new THREE.Group();
    const h = props.height ?? 0.85;
    const leaf = cprop(props, 'color', '#3a4a34');
    const bark = cprop(props, 'trunkColor', '#5a5048');
    const fl = cprop(props, 'color2', '#6870b0');
    for (let i = 0; i < 3; i++) {
      trunk(g, 0, h * 0.55, h * 0.03, h * 0.02, bark, 4).position.x = (i - 1) * h * 0.08;
    }
    leafCards(g, 0, h * 0.65, 0, 8, h * 0.35, h * 0.18, leaf, 15);
    for (let i = 0; i < 5; i++) {
      ball(g, (hash2(i, 1) - 0.5) * h * 0.25, h * 0.85, (hash2(i, 2) - 0.5) * h * 0.25, h * 0.04, fl, 4, 3);
    }
    return finish(g, props);
  }

  function makeJi(props) {
    const g = new THREE.Group();
    const h = props.height ?? 0.9;
    const leaf = cprop(props, 'color', '#3a5028');
    const bark = cprop(props, 'trunkColor', '#5a5040');
    trunk(g, 0, h * 0.5, h * 0.045, h * 0.035, bark, 4);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * H;
      const th = new THREE.Mesh(new THREE.ConeGeometry(h * 0.012, h * 0.1, 3), mat('#4a4030'));
      th.position.set(Math.cos(a) * h * 0.08, h * (0.35 + (i % 3) * 0.1), Math.sin(a) * h * 0.08);
      th.rotation.z = Math.cos(a) * 1.1;
      g.add(th);
    }
    roundCanopy(g, h * 0.7, h * 0.32, leaf, 4);
    for (let i = 0; i < 5; i++) {
      ball(g, Math.cos(i * 1.3) * h * 0.18, h * 0.55, Math.sin(i * 1.3) * h * 0.18, h * 0.04, cprop(props, 'color2', '#8a3020'), 4, 3);
    }
    return finish(g, props);
  }

  function makeZhu(props) {
    const g = new THREE.Group();
    const h = props.height ?? 1.8;
    const leaf = cprop(props, 'color', '#4a6040');
    const culm = cprop(props, 'trunkColor', '#3a5030');
    const node = cprop(props, 'color2', '#2a3a28');
    for (let i = 0; i < 5; i++) {
      const hh = h * (0.7 + hash2(i, 1) * 0.35);
      const x = (hash2(i, 3) - 0.5) * h * 0.45;
      const z = (hash2(i, 7) - 0.5) * h * 0.45;
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.028, h * 0.035, hh, 5), mat(culm, { roughness: 0.45 }));
      stalk.position.set(x, hh * 0.5, z);
      stalk.castShadow = true;
      g.add(stalk);
      for (let n = 1; n <= 3; n++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(h * 0.038, h * 0.008, 3, 6), mat(node));
        ring.rotation.x = Math.PI / 2;
        ring.position.set(x, hh * n * 0.22, z);
        g.add(ring);
      }
      // leaf sprays near top only (few cards)
      leafCards(g, x, hh * 0.85, z, 3, h * 0.2, h * 0.16, leaf, 20 + i);
    }
    return finish(g, props);
  }

  // ─── Flowers / herbs ─────────────────────────────────────
  function herbBase(props, scaleKey = 'scale') {
    const g = new THREE.Group();
    const sc = props[scaleKey] ?? props.scale ?? 0.55;
    return { g, sc };
  }

  function makeHui(props) {
    const { g, sc } = herbBase(props);
    const leaf = cprop(props, 'color', '#2a4a30');
    const fl = cprop(props, 'color2', '#d0d0a0');
    for (let i = 0; i < 5; i++) {
      const blade = new THREE.Mesh(new THREE.PlaneGeometry(sc * 0.08, sc * 0.9), mat(leaf, { side: THREE.DoubleSide }));
      blade.position.set((i - 2) * sc * 0.06, sc * 0.4, (i % 2) * sc * 0.04);
      blade.rotation.z = (i - 2) * 0.12;
      blade.rotation.x = 0.15;
      g.add(blade);
    }
    const scape = new THREE.Mesh(new THREE.CylinderGeometry(sc * 0.015, sc * 0.02, sc * 0.7, 4), mat(cprop(props, 'stemColor', '#4a5a40')));
    scape.position.y = sc * 0.4;
    g.add(scape);
    for (let i = 0; i < 3; i++) {
      ball(g, (i - 1) * sc * 0.08, sc * 0.75 + i * 0.04, 0, sc * 0.07, fl, 5, 4);
    }
    return finish(g, props);
  }

  function makeZhi(props) {
    const { g, sc } = herbBase(props);
    const leaf = cprop(props, 'color', '#3a5a30');
    const fl = cprop(props, 'color2', '#e8e8e0');
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(sc * 0.04, sc * 0.05, sc * 1.4, 5), mat(cprop(props, 'stemColor', '#4a5a38')));
    stem.position.y = sc * 0.7;
    g.add(stem);
    leafCards(g, 0, sc * 0.6, 0, 8, sc * 0.45, sc * 0.28, leaf, 30);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * H;
      ball(g, Math.cos(a) * sc * 0.25, sc * 1.35, Math.sin(a) * sc * 0.25, sc * 0.05, fl, 4, 3);
    }
    return finish(g, props);
  }

  function makeMiwu(props) {
    const { g, sc } = herbBase(props);
    const leaf = cprop(props, 'color', '#4a6a40');
    leafCards(g, 0, sc * 0.25, 0, 12, sc * 0.4, sc * 0.2, leaf, 31);
    for (let i = 0; i < 5; i++) {
      ball(g, (hash2(i, 1) - 0.5) * sc * 0.3, sc * 0.45, (hash2(i, 2) - 0.5) * sc * 0.3, sc * 0.04, cprop(props, 'color2', '#f0f0e8'), 4, 3);
    }
    return finish(g, props);
  }

  function makeDuheng(props) {
    const { g, sc } = herbBase(props);
    const leaf = cprop(props, 'color', '#2a3a28');
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * H;
      const L = new THREE.Mesh(new THREE.CircleGeometry(sc * 0.28, 7), mat(leaf, { side: THREE.DoubleSide }));
      L.position.set(Math.cos(a) * sc * 0.15, sc * 0.12, Math.sin(a) * sc * 0.15);
      L.rotation.x = -Math.PI / 2 + 0.2;
      g.add(L);
    }
    ball(g, 0, sc * 0.06, 0, sc * 0.07, cprop(props, 'color2', '#3a1820'), 5, 4);
    return finish(g, props);
  }

  function makeChangpu(props) {
    const { g, sc } = herbBase(props);
    const leaf = cprop(props, 'color', '#3a5a30');
    for (let i = 0; i < 6; i++) {
      const blade = new THREE.Mesh(new THREE.PlaneGeometry(sc * 0.1, sc * 1.2), mat(leaf, { side: THREE.DoubleSide }));
      blade.position.set((i - 2.5) * sc * 0.05, sc * 0.55, (i % 2) * 0.02);
      blade.rotation.y = i * 0.2;
      g.add(blade);
    }
    const spadix = new THREE.Mesh(new THREE.CylinderGeometry(sc * 0.04, sc * 0.045, sc * 0.35, 5), mat(cprop(props, 'color2', '#c8c070')));
    spadix.position.set(sc * 0.08, sc * 0.7, 0);
    g.add(spadix);
    return finish(g, props);
  }

  function makeJiShepherd(props) {
    const { g, sc } = herbBase(props);
    const leaf = cprop(props, 'color', '#4a5a38');
    leafCards(g, 0, sc * 0.1, 0, 6, sc * 0.25, sc * 0.14, leaf, 32);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(sc * 0.012, sc * 0.015, sc * 0.55, 3), mat(cprop(props, 'stemColor', '#5a6a48')));
    stem.position.y = sc * 0.3;
    g.add(stem);
    for (let i = 0; i < 4; i++) {
      const pod = new THREE.Mesh(new THREE.PlaneGeometry(sc * 0.08, sc * 0.08), mat(cprop(props, 'color2', '#d0d0c0'), { side: THREE.DoubleSide }));
      pod.position.set((i - 1.5) * sc * 0.06, sc * 0.5 + i * 0.03, 0);
      g.add(pod);
    }
    return finish(g, props);
  }

  function makeQiMillet(props) {
    const { g, sc } = herbBase(props);
    const leaf = cprop(props, 'color', '#5a6a38');
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(new THREE.PlaneGeometry(sc * 0.06, sc * 0.8), mat(leaf, { side: THREE.DoubleSide }));
      blade.position.set((i - 1.5) * sc * 0.08, sc * 0.35, 0);
      blade.rotation.z = (i - 1.5) * 0.1;
      g.add(blade);
    }
    for (let i = 0; i < 6; i++) {
      ball(g, (hash2(i, 1) - 0.5) * sc * 0.15, sc * 0.75 + i * 0.02, (hash2(i, 2) - 0.5) * sc * 0.1, sc * 0.025, cprop(props, 'color2', '#c8b060'), 3, 3);
    }
    return finish(g, props);
  }

  function makeAi(props) {
    const { g, sc } = herbBase(props);
    const leaf = cprop(props, 'color', '#5a6a48');
    const under = cprop(props, 'color2', '#d0d0c8');
    leafCards(g, 0, sc * 0.35, 0, 10, sc * 0.35, sc * 0.2, leaf, 33);
    leafCards(g, 0, sc * 0.3, 0, 4, sc * 0.3, sc * 0.18, under, 34);
    for (let i = 0; i < 5; i++) {
      ball(g, (i - 2) * sc * 0.08, sc * 0.75, 0, sc * 0.03, '#c8c080', 3, 3);
    }
    return finish(g, props);
  }

  function makeHao(props) {
    const { g, sc } = herbBase(props);
    const leaf = cprop(props, 'color', '#6a7a58');
    leafCards(g, 0, sc * 0.4, 0, 14, sc * 0.4, sc * 0.12, leaf, 35);
    for (let i = 0; i < 8; i++) {
      ball(g, (hash2(i, 1) - 0.5) * sc * 0.35, sc * 0.7 + hash2(i, 2) * sc * 0.2, (hash2(i, 3) - 0.5) * sc * 0.35, sc * 0.025, cprop(props, 'color2', '#b0a060'), 3, 3);
    }
    return finish(g, props);
  }

  function makeJu(props) {
    const { g, sc } = herbBase(props);
    const leaf = cprop(props, 'color', '#3a4a28');
    const fl = cprop(props, 'color2', '#e8d040');
    leafCards(g, 0, sc * 0.25, 0, 5, sc * 0.3, sc * 0.16, leaf, 36);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(sc * 0.02, sc * 0.025, sc * 0.5, 4), mat(cprop(props, 'stemColor', '#4a5a38')));
    stem.position.y = sc * 0.3;
    g.add(stem);
    // petal ring
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * H;
      const petal = new THREE.Mesh(new THREE.PlaneGeometry(sc * 0.08, sc * 0.18), mat(fl, { side: THREE.DoubleSide }));
      petal.position.set(Math.cos(a) * sc * 0.1, sc * 0.58, Math.sin(a) * sc * 0.1);
      petal.rotation.y = a;
      petal.rotation.x = -0.5;
      g.add(petal);
    }
    ball(g, 0, sc * 0.58, 0, sc * 0.06, cprop(props, 'fruitColor', '#c09030'), 5, 4);
    return finish(g, props);
  }

  function makeShaoyao(props) {
    const { g, sc } = herbBase(props);
    const leaf = cprop(props, 'color', '#2a4a28');
    const fl = cprop(props, 'color2', '#d04060');
    leafCards(g, 0, sc * 0.3, 0, 6, sc * 0.35, sc * 0.22, leaf, 37);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(sc * 0.025, sc * 0.03, sc * 0.55, 4), mat(cprop(props, 'stemColor', '#4a5a40')));
    stem.position.y = sc * 0.3;
    g.add(stem);
    for (let layer = 0; layer < 3; layer++) {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * H + layer * 0.3;
        const petal = new THREE.Mesh(new THREE.CircleGeometry(sc * (0.12 - layer * 0.02), 5), mat(fl, { side: THREE.DoubleSide }));
        petal.position.set(Math.cos(a) * sc * (0.08 + layer * 0.02), sc * 0.6 + layer * 0.02, Math.sin(a) * sc * (0.08 + layer * 0.02));
        petal.rotation.x = -0.8;
        petal.rotation.z = a;
        g.add(petal);
      }
    }
    return finish(g, props);
  }

  function makeShicao(props) {
    const { g, sc } = herbBase(props);
    const leaf = cprop(props, 'color', '#4a5a38');
    leafCards(g, 0, sc * 0.25, 0, 12, sc * 0.35, sc * 0.1, leaf, 38);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * H;
      ball(g, Math.cos(a) * sc * 0.15, sc * 0.55, Math.sin(a) * sc * 0.15, sc * 0.035, cprop(props, 'color2', '#f0f0e8'), 4, 3);
    }
    return finish(g, props);
  }

  function makeJuanbai(props) {
    const { g, sc } = herbBase(props);
    const leaf = cprop(props, 'color', '#3a5a40');
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * H;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(sc * 0.06, sc * 0.12, 4), mat(leaf));
      tip.position.set(Math.cos(a) * sc * 0.2, sc * 0.06, Math.sin(a) * sc * 0.2);
      tip.rotation.x = 1.1;
      tip.rotation.z = a;
      g.add(tip);
    }
    icosa(g, 0, sc * 0.05, 0, sc * 0.15, cprop(props, 'color2', '#2a4a30'));
    return finish(g, props);
  }

  const TREE_META = [
    { type: '柏', icon: '🌲', label: '柏', make: makeBai, height: 1.8, color: '#2a4a3a', trunkColor: '#6a4030', color2: '#5a4a30' },
    { type: '松', icon: '🌳', label: '松', make: makeSong, height: 1.7, color: '#3a5538', trunkColor: '#5a4030', color2: '#6a5030' },
    { type: '槐', icon: '🌳', label: '槐', make: makeHuai, height: 1.5, color: '#3a5030', trunkColor: '#5a5548', color2: '#e8e0c0' },
    { type: '桑', icon: '🌳', label: '桑', make: makeSang, height: 1.35, color: '#3a4a28', trunkColor: '#5a5040', color2: '#4a2040' },
    { type: '榆', icon: '🌳', label: '榆', make: makeYu, height: 1.65, color: '#3a4a32', trunkColor: '#4a453c', color2: '#c8b070' },
    { type: '柳', icon: '🌿', label: '柳', make: makeLiu, height: 1.5, color: '#4a6a40', trunkColor: '#5a5040', color2: '#a8c0a0' },
    { type: '桐', icon: '🌳', label: '桐', make: makeTong, height: 1.55, color: '#3a5528', trunkColor: '#6a6558', color2: '#c8a8e0' },
    { type: '梓', icon: '🌳', label: '梓', make: makeZi, height: 1.4, color: '#3a4a30', trunkColor: '#5a5048', color2: '#e8e0d0', fruitColor: '#5a4a30' },
    { type: '柞', icon: '🌳', label: '柞', make: makeZuo, height: 1.55, color: '#3a4a28', trunkColor: '#3a3830', color2: '#6a5030' },
    { type: '檀', icon: '🌳', label: '檀', make: makeTan, height: 1.35, color: '#3a4a34', trunkColor: '#5a5548', color2: '#c0a860' },
    { type: '桂', icon: '🌲', label: '桂', make: makeGui, height: 1.4, color: '#2a4a30', trunkColor: '#6a6558', color2: '#3a2040' },
    { type: '棠', icon: '🌸', label: '棠', make: makeTang, height: 1.1, color: '#3a5528', trunkColor: '#5a4a38', color2: '#e8b0c0', fruitColor: '#c04040' },
    { type: '柘', icon: '🌳', label: '柘', make: makeZhe, height: 0.95, color: '#3a5030', trunkColor: '#7a6a40', color2: '#c04828' },
    { type: '楝', icon: '🌳', label: '楝', make: makeLian, height: 1.4, color: '#3a4a30', trunkColor: '#6a6558', color2: '#8a68b0', fruitColor: '#b89040' },
    { type: '栎', icon: '🌲', label: '栎', make: makeLiEver, height: 1.5, color: '#2a3a28', trunkColor: '#4a453c', color2: '#6a4a30' },
    { type: '漆', icon: '🌳', label: '漆', make: makeQi, height: 1.35, color: '#4a3020', trunkColor: '#6a6558', color2: '#c05028' },
    { type: '棕', icon: '🌴', label: '棕', make: makeZong, height: 1.6, color: '#3a5a30', trunkColor: '#5a4a38', color2: '#6a5a48' },
    { type: '榛', icon: '🌳', label: '榛', make: makeZhen, height: 0.9, color: '#3a4a30', trunkColor: '#5a5548', color2: '#6a5030' },
    { type: '栗', icon: '🌳', label: '栗', make: makeLiChest, height: 1.55, color: '#3a4a28', trunkColor: '#3a3830', color2: '#4a6030' },
    { type: '荆', icon: '🌿', label: '荆', make: makeJing, height: 0.85, color: '#3a4a34', trunkColor: '#5a5048', color2: '#6870b0' },
    { type: '棘', icon: '🌳', label: '棘', make: makeJi, height: 0.9, color: '#3a5028', trunkColor: '#5a5040', color2: '#8a3020' },
    { type: '竹', icon: '🎋', label: '竹', make: makeZhu, height: 1.8, color: '#4a6040', trunkColor: '#3a5030', color2: '#2a3a28' },
  ];

  const FLOWER_META = [
    { type: '蕙', icon: '🌼', label: '蕙', make: makeHui, scale: 0.55, color: '#2a4a30', color2: '#d0d0a0', stemColor: '#4a5a40' },
    { type: '芷', icon: '🌿', label: '芷', make: makeZhi, scale: 0.7, color: '#3a5a30', color2: '#e8e8e0', stemColor: '#4a5a38' },
    { type: '蘼芜', icon: '🌱', label: '蘼芜', make: makeMiwu, scale: 0.45, color: '#4a6a40', color2: '#f0f0e8' },
    { type: '杜衡', icon: '🍃', label: '杜衡', make: makeDuheng, scale: 0.4, color: '#2a3a28', color2: '#3a1820' },
    { type: '菖蒲', icon: '🌾', label: '菖蒲', make: makeChangpu, scale: 0.65, color: '#3a5a30', color2: '#c8c070' },
    { type: '荠', icon: '🌱', label: '荠', make: makeJiShepherd, scale: 0.4, color: '#4a5a38', color2: '#d0d0c0', stemColor: '#5a6a48' },
    { type: '芑', icon: '🌾', label: '芑', make: makeQiMillet, scale: 0.55, color: '#5a6a38', color2: '#c8b060' },
    { type: '艾', icon: '🌿', label: '艾', make: makeAi, scale: 0.55, color: '#5a6a48', color2: '#d0d0c8' },
    { type: '蒿', icon: '🌿', label: '蒿', make: makeHao, scale: 0.6, color: '#6a7a58', color2: '#b0a060' },
    { type: '菊', icon: '🌼', label: '菊', make: makeJu, scale: 0.5, color: '#3a4a28', color2: '#e8d040', stemColor: '#4a5a38', fruitColor: '#c09030' },
    { type: '芍药', icon: '🌸', label: '芍药', make: makeShaoyao, scale: 0.55, color: '#2a4a28', color2: '#d04060', stemColor: '#4a5a40' },
    { type: '蓍草', icon: '🤍', label: '蓍草', make: makeShicao, scale: 0.5, color: '#4a5a38', color2: '#f0f0e8' },
    { type: '卷柏', icon: '🪴', label: '卷柏', make: makeJuanbai, scale: 0.35, color: '#3a5a40', color2: '#2a4a30' },
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
  TREE_META.forEach((t) => {
    DEFAULTS[t.type] = {
      height: t.height, rotation: 0,
      color: t.color, trunkColor: t.trunkColor, color2: t.color2,
      fruitColor: t.fruitColor, hitbox: true,
    };
    FACTORIES[t.type] = t.make;
  });
  FLOWER_META.forEach((t) => {
    DEFAULTS[t.type] = {
      scale: t.scale, rotation: 0,
      color: t.color, color2: t.color2,
      stemColor: t.stemColor, fruitColor: t.fruitColor,
      hitbox: false,
    };
    FACTORIES[t.type] = t.make;
  });

  // Legacy aliases
  FACTORIES.tree = (p) => makeSong({ ...p, height: p.height ?? 1.55 });
  FACTORIES.bamboo = (p) => makeZhu({ ...p, height: p.height ?? 1.8 });
  DEFAULTS.tree = { ...DEFAULTS['松'], variant: 'pine' };
  DEFAULTS.bamboo = { ...DEFAULTS['竹'], variant: 'bamboo' };

  function migratePlantType(o) {
    if (!o) return;
    if (o.type === 'bamboo') {
      o.type = '竹';
      return;
    }
    if (o.type === 'tree') {
      const v = o.props?.variant;
      if (v === 'bamboo') o.type = '竹';
      else if (v === 'plum') o.type = '棠';
      else o.type = '松';
    }
  }

  function isTreeType(type) { return TREE_TYPES.has(type) || type === 'tree' || type === 'bamboo'; }
  function isFlowerType(type) { return FLOWER_TYPES.has(type); }

  return {
    TREE_PRESETS,
    FLOWER_PRESETS,
    DEFAULTS,
    FACTORIES,
    TREE_TYPES,
    FLOWER_TYPES,
    isTreeType,
    isFlowerType,
    migratePlantType,
  };
}
