/**
 * Ornate archer — pure Three.js geometry.
 *
 * Clothing layers (outside → in):
 *   1. Red cape — long, pinned at shoulders, hangs over everything
 *   2. Black robe — closed only on the BACK; front open with one center strip
 *   3. Black shirt / armor — fully worn torso; gold is decoration on this layer
 *   4. Black pants — under the open robe (legs visible from both sides)
 *
 * Face is blank. Arms/legs use overlapping joints so nothing floats.
 */
export function createArcherCharacter(THREE, matFn) {
  function baseMat(color, opts = {}) {
    const m = matFn(color, { ...opts, flatShading: false });
    m.flatShading = false;
    return m;
  }
  const gold = (hex = 0xc9a44a, opts = {}) =>
    baseMat(hex, { metalness: 0.72, roughness: 0.32, ...opts });
  const cloth = (hex, opts = {}) =>
    baseMat(hex, { metalness: 0.02, roughness: 0.88, ...opts });
  const armor = (hex = 0x2a2826, opts = {}) =>
    baseMat(hex, { metalness: 0.18, roughness: 0.55, ...opts });
  const skinM = (opts = {}) =>
    baseMat(0xe8d0b8, { metalness: 0.0, roughness: 0.62, ...opts });

  function gradTex(c0, c1, w = 64, h = 128) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, c0);
    g.addColorStop(1, c1);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }

  function capeTex() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 512;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#3a0a0a');
    g.addColorStop(0.25, '#7a1c1c');
    g.addColorStop(0.6, '#a02828');
    g.addColorStop(0.88, '#b83830');
    g.addColorStop(1, '#c9a44a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 10; i++) {
      const x = 6 + i * 25;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x, 0, 7, 450);
      ctx.fillStyle = 'rgba(255,190,140,0.12)';
      ctx.fillRect(x + 7, 0, 4, 450);
    }
    ctx.fillStyle = '#c9a44a';
    ctx.fillRect(0, 455, 256, 57);
    ctx.fillStyle = '#e0c060';
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.ellipse(18 + i * 30, 482, 12, 9, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  const capeMap = capeTex();
  const capeMat = cloth(0xffffff, { side: THREE.DoubleSide, roughness: 0.85 });
  capeMat.map = capeMap;
  capeMat.emissiveMap = capeMap;
  capeMat.emissive = new THREE.Color(0xffffff);
  capeMat.emissiveIntensity = 0.18;
  capeMat.needsUpdate = true;

  const blackTex = gradTex('#0e0c0c', '#2a2826');
  const pantTex = gradTex('#121010', '#2a2624');
  const clothGrad = (tex, opts = {}) => {
    const m = cloth(0xffffff, opts);
    m.map = tex;
    m.needsUpdate = true;
    return m;
  };

  const C = {
    black: 0x1a1816,
    charcoal: 0x2a2826,
    grey: 0x3a3632,
    crimson: 0x8b2828,
    crimsonDeep: 0x5a1414,
    gold: 0xc9a44a,
    goldBright: 0xe0c060,
    goldDark: 0x9a7830,
    brown: 0x5a3a22,
    brownDark: 0x3a2818,
    white: 0xe8e4dc,
    hair: 0x0e0c0c,
  };

  const root = new THREE.Group();
  root.name = 'playCharacter';
  const hips = new THREE.Group();
  hips.position.y = 0.78;
  root.add(hips);

  function mesh(parent, geo, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  function sashTube(parent, pts, radius, material, tubular = 48) {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, tubular, radius, 8, false), material);
    m.castShadow = true;
    parent.add(m);
    return m;
  }

  // ══════════════════════════════════════════════════════════
  // BLACK SHIRT — fully worn torso; gold = decoration on shirt/armor
  // ══════════════════════════════════════════════════════════
  const shirtMat = clothGrad(blackTex);
  // Main shirt body (shoulders → waist)
  mesh(hips, new THREE.CylinderGeometry(0.16, 0.19, 0.46, 28), shirtMat, 0, 0.34, 0);
  // Soft shoulder width on the shirt itself
  mesh(hips, new THREE.SphereGeometry(0.1, 16, 12), shirtMat, 0, 0.52, 0).scale.set(1.55, 0.55, 0.95);
  // Collar
  mesh(hips, new THREE.TorusGeometry(0.09, 0.018, 8, 24), armor(C.black), 0, 0.55, 0.01).rotation.x = Math.PI / 2;
  mesh(hips, new THREE.TorusGeometry(0.095, 0.006, 8, 24), gold(C.gold), 0, 0.56, 0.01).rotation.x = Math.PI / 2;

  // Gold trim decorations ON the black shirt
  mesh(hips, new THREE.BoxGeometry(0.014, 0.28, 0.008), gold(C.goldBright), -0.04, 0.36, 0.175);
  mesh(hips, new THREE.BoxGeometry(0.014, 0.28, 0.008), gold(C.goldBright), 0.04, 0.36, 0.175);
  // Chest filigree (left / armored side)
  for (let i = 0; i < 4; i++) {
    const t = mesh(hips, new THREE.TorusGeometry(0.014 + i * 0.005, 0.0035, 6, 14),
      gold(C.gold), 0.07 + (i % 2) * 0.025, 0.32 + Math.floor(i / 2) * 0.07, 0.17);
    t.rotation.x = Math.PI / 2;
    t.scale.set(1, 0.55, 1);
  }
  // Small gold studs along shirt placket
  for (let i = 0; i < 5; i++) {
    mesh(hips, new THREE.SphereGeometry(0.008, 8, 6), gold(C.goldBright), 0, 0.48 - i * 0.06, 0.185);
  }

  // Soft midsection blending shirt into robe
  mesh(hips, new THREE.CylinderGeometry(0.185, 0.21, 0.1, 28), shirtMat, 0, 0.16, 0);

  // ══════════════════════════════════════════════════════════
  // BLACK ROBE — closed ONLY on the BACK; front open except
  // one long center strip. Both legs visible from either side.
  // ══════════════════════════════════════════════════════════
  const robeMat = clothGrad(blackTex, { side: THREE.DoubleSide });

  // Hip sash — tight to body
  mesh(hips, new THREE.CylinderGeometry(0.175, 0.19, 0.09, 28), robeMat, 0, 0.1, 0);

  // Back panel ONLY — flat against the back, no side wrap.
  // Front + both flanks stay open so both legs read from either side.
  const robeBack = mesh(hips,
    new THREE.BoxGeometry(0.26, 0.68, 0.03),
    robeMat,
    0, -0.26, -0.155,
  );
  robeBack.rotation.x = -0.04;

  // Singular long front strip down the middle (only front covering)
  const frontPanel = mesh(hips,
    new THREE.BoxGeometry(0.085, 0.7, 0.016),
    robeMat,
    0, -0.28, 0.13,
  );
  frontPanel.rotation.x = 0.03;
  mesh(frontPanel, new THREE.BoxGeometry(0.01, 0.68, 0.018), gold(C.goldDark), 0, 0, 0.002);

  // Waist belt — snug
  mesh(hips, new THREE.CylinderGeometry(0.185, 0.19, 0.06, 28), armor(C.black), 0, 0.12, 0);
  mesh(hips, new THREE.TorusGeometry(0.19, 0.01, 8, 28), gold(C.gold), 0, 0.12, 0).rotation.x = Math.PI / 2;
  mesh(hips, new THREE.TorusGeometry(0.19, 0.004, 8, 28), gold(C.goldDark), 0, 0.15, 0).rotation.x = Math.PI / 2;
  const buckle = mesh(hips, new THREE.CylinderGeometry(0.038, 0.038, 0.024, 18), gold(C.goldBright), 0, 0.12, 0.185);
  buckle.rotation.x = Math.PI / 2;
  mesh(hips, new THREE.CircleGeometry(0.026, 18), gold(C.gold), 0, 0.12, 0.2);
  for (const sx of [-0.055, 0, 0.055]) {
    mesh(hips, new THREE.SphereGeometry(0.008, 8, 6), cloth(C.white), sx, 0.04, 0.175);
  }

  // Sun seal on the long front strip
  const sun = new THREE.Group();
  sun.position.set(0, -0.5, 0.14);
  mesh(sun, new THREE.CircleGeometry(0.026, 18), gold(C.goldBright));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const ray = mesh(sun, new THREE.ConeGeometry(0.005, 0.016, 5), gold(C.gold));
    ray.position.set(Math.cos(a) * 0.032, Math.sin(a) * 0.032, 0.004);
    ray.rotation.z = a - Math.PI / 2;
  }
  hips.add(sun);

  // ══════════════════════════════════════════════════════════
  // RED CAPE — OUTSIDE the body (behind shirt/robe), long
  // Front: only peeks at sides. Back: fills the silhouette. Side: thin behind.
  // ══════════════════════════════════════════════════════════
  function makeCapeGeo(w, h, segsW, segsH) {
    const geo = new THREE.PlaneGeometry(w, h, segsW, segsH);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const nx = x / (w * 0.5);
      const ny = y / (h * 0.5);
      const drop = (1 - ny) * 0.5;
      const edge = Math.abs(nx);
      const topPinch = Math.max(0, ny) * 0.25;
      pos.setX(i, x * (1 - topPinch + drop * 0.4));
      pos.setY(i, y - edge * edge * Math.max(0, ny) * 0.1);
      // Gentle cup — stay close to the back (less air gap for gear)
      pos.setZ(i, edge * edge * 0.02 + drop * drop * 0.05);
    }
    geo.computeVertexNormals();
    return geo;
  }

  const cape = new THREE.Mesh(makeCapeGeo(0.7, 1.15, 18, 28), capeMat);
  cape.rotation.y = Math.PI;
  // Shirt/robe back ≈ −0.165…−0.19; cape snug outside
  cape.position.set(0, 0.02, -0.185);
  cape.castShadow = true;
  cape.receiveShadow = true;
  hips.add(cape);

  // Shoulder pins + short back straps so side view shows cape attached
  for (const side of [-1, 1]) {
    const drape = mesh(hips,
      new THREE.SphereGeometry(0.055, 12, 10),
      cloth(C.crimson, { side: THREE.DoubleSide }),
      side * 0.13, 0.52, -0.1,
    );
    drape.scale.set(1.1, 0.38, 1.15);
    mesh(hips, new THREE.SphereGeometry(0.015, 10, 8), gold(C.gold), side * 0.13, 0.53, -0.04);
    sashTube(hips, [
      [side * 0.13, 0.52, -0.06],
      [side * 0.1, 0.4, -0.14],
      [side * 0.06, 0.28, -0.2],
    ], 0.006, cloth(C.crimsonDeep), 8);
  }
  // Thin back collar linking cape to shirt (back only)
  mesh(hips,
    new THREE.CylinderGeometry(0.13, 0.14, 0.05, 16, 1, true, Math.PI * 0.9, Math.PI * 1.2),
    cloth(C.crimsonDeep, { side: THREE.DoubleSide }),
    0, 0.52, -0.06,
  );

  // Gold hem studs — parented to cape so they sit on the bottom edge
  const capePos = cape.geometry.attributes.position;
  const hemY = -0.575; // bottom row of PlaneGeometry height 1.15
  const hemVerts = [];
  for (let i = 0; i < capePos.count; i++) {
    if (Math.abs(capePos.getY(i) - hemY) < 0.02) {
      hemVerts.push({
        x: capePos.getX(i),
        y: capePos.getY(i),
        z: capePos.getZ(i),
      });
    }
  }
  // Evenly pick along the hem (skip duplicates from shared verts)
  hemVerts.sort((a, b) => a.x - b.x);
  const step = Math.max(1, Math.floor(hemVerts.length / 13));
  for (let i = 0; i < hemVerts.length; i += step) {
    const v = hemVerts[i];
    const stud = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), gold(C.gold));
    stud.position.set(v.x, v.y - 0.005, v.z + 0.01);
    stud.castShadow = true;
    cape.add(stud);
  }

  // ══════════════════════════════════════════════════════════
  // HEAD — blank face, topknot, gold crown, long back hair
  // ══════════════════════════════════════════════════════════
  const headGroup = new THREE.Group();
  headGroup.position.y = 0.78;
  hips.add(headGroup);

  mesh(headGroup, new THREE.CylinderGeometry(0.05, 0.06, 0.08, 16), skinM(), 0, -0.17, 0);
  const skull = mesh(headGroup, new THREE.SphereGeometry(0.13, 24, 20), skinM());
  skull.scale.set(0.98, 1.12, 0.95);
  mesh(headGroup, new THREE.SphereGeometry(0.085, 18, 14), skinM(), 0, -0.065, 0.025).scale.set(0.95, 0.7, 0.88);

  const hairCap = mesh(headGroup, new THREE.SphereGeometry(0.135, 20, 16), cloth(C.hair), 0, 0.04, -0.025);
  hairCap.scale.set(1.05, 0.78, 1.0);
  mesh(headGroup, new THREE.TorusGeometry(0.1, 0.02, 8, 20, Math.PI), cloth(C.hair), 0, 0.06, 0.04).rotation.set(0.4, 0, 0);

  for (let i = 0; i < 9; i++) {
    const strand = mesh(headGroup,
      new THREE.CapsuleGeometry(0.02 - i * 0.001, 0.42 + (i % 3) * 0.05, 4, 10),
      cloth(C.hair),
      (i - 4) * 0.028, -0.28, -0.1 - (i % 3) * 0.012,
    );
    strand.rotation.x = 0.08 + (i % 3) * 0.03;
    strand.rotation.z = (i - 4) * 0.03;
  }
  for (const side of [-1, 1]) {
    const lock = mesh(headGroup, new THREE.CapsuleGeometry(0.018, 0.18, 4, 10), cloth(C.hair), side * 0.1, -0.1, 0.01);
    lock.rotation.z = side * 0.35;
    lock.rotation.x = 0.12;
  }

  mesh(headGroup, new THREE.SphereGeometry(0.055, 16, 12), cloth(C.hair), 0, 0.2, -0.02);
  mesh(headGroup, new THREE.SphereGeometry(0.032, 12, 10), cloth(C.hair), 0, 0.255, -0.02);

  const crown = new THREE.Group();
  crown.position.set(0, 0.175, -0.01);
  mesh(crown, new THREE.TorusGeometry(0.058, 0.014, 8, 20), gold(C.gold)).rotation.x = Math.PI / 2;
  mesh(crown, new THREE.CylinderGeometry(0.03, 0.04, 0.03, 12), gold(C.goldBright), 0, 0.012, 0);
  const crest = mesh(crown, new THREE.ConeGeometry(0.035, 0.1, 6), gold(C.gold), 0, 0.04, 0.05);
  crest.rotation.x = 1.0;
  crest.scale.set(0.5, 1, 1.2);
  for (const side of [-1, 1]) {
    const wing = mesh(crown, new THREE.SphereGeometry(0.04, 10, 8), gold(C.goldDark), side * 0.06, 0.01, 0.01);
    wing.scale.set(1.3, 0.45, 0.7);
    wing.rotation.z = side * -0.5;
  }
  mesh(crown, new THREE.CylinderGeometry(0.006, 0.006, 0.14, 8), gold(C.goldBright), 0, 0.01, 0).rotation.z = Math.PI / 2;
  headGroup.add(crown);

  sashTube(headGroup, [
    [0.02, 0.18, -0.04], [0.04, 0.05, -0.08], [0.03, -0.15, -0.1], [0.02, -0.35, -0.08],
  ], 0.008, cloth(C.white), 24);
  sashTube(headGroup, [
    [-0.02, 0.18, -0.04], [-0.03, 0.02, -0.09], [-0.02, -0.2, -0.11],
  ], 0.007, cloth(C.white), 20);

  // ══════════════════════════════════════════════════════════
  // ARMS — continuous joints; gold rings decorate black sleeves
  // −X = bare right, +X = armored left
  // ══════════════════════════════════════════════════════════
  function makeArm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.175, 0.48, 0.02);
    hips.add(shoulder);
    const armored = side > 0;

    // Large joint ball fused into shirt shoulder
    mesh(shoulder, new THREE.SphereGeometry(0.05, 12, 10), armored ? shirtMat : skinM());

    const upper = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.042, 0.14, 6, 12),
      armored ? shirtMat : skinM(),
    );
    upper.geometry.translate(0, -0.1, 0);
    upper.castShadow = true;
    shoulder.add(upper);

    if (armored) {
      // Modest gold decoration on black sleeve — not a giant pauldron
      const paul = mesh(shoulder, new THREE.SphereGeometry(0.038, 12, 10), gold(C.gold), side * 0.015, 0.008, 0.01);
      paul.scale.set(1.0, 0.4, 0.85);
      mesh(shoulder, new THREE.CylinderGeometry(0.04, 0.044, 0.1, 14), shirtMat, 0, -0.09, 0);
      mesh(shoulder, new THREE.TorusGeometry(0.044, 0.004, 8, 14), gold(C.gold), 0, -0.14, 0).rotation.x = Math.PI / 2;
    } else {
      mesh(shoulder, new THREE.TorusGeometry(0.044, 0.007, 8, 12), armor(C.black), 0, 0.008, 0).rotation.x = Math.PI / 2;
    }

    const elbow = new THREE.Group();
    elbow.position.y = -0.22; // overlap upper capsule
    shoulder.add(elbow);
    mesh(elbow, new THREE.SphereGeometry(0.038, 10, 8), skinM());

    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.034, 0.11, 6, 12), skinM());
    forearm.geometry.translate(0, -0.085, 0);
    forearm.castShadow = true;
    elbow.add(forearm);

    mesh(elbow, new THREE.CylinderGeometry(0.038, 0.042, 0.12, 12), armor(C.charcoal), 0, -0.095, 0);
    for (let i = 0; i < 2; i++) {
      mesh(elbow, new THREE.TorusGeometry(0.042, 0.004, 6, 12), gold(C.gold), 0, -0.05 - i * 0.035, 0).rotation.x = Math.PI / 2;
    }

    const hand = new THREE.Group();
    // Wrist tucked into bracer bottom
    hand.position.set(0, -0.155, 0);
    mesh(hand, new THREE.SphereGeometry(0.02, 8, 6), skinM(), 0, 0.01, 0); // wrist fill
    const palm = mesh(hand, new THREE.SphereGeometry(0.028, 10, 8), skinM(), 0, -0.012, 0.004);
    palm.scale.set(0.8, 1.05, 0.55);
    for (let i = 0; i < 4; i++) {
      mesh(hand, new THREE.CapsuleGeometry(0.005, 0.024, 3, 5), skinM(), -0.012 + i * 0.008, -0.038, 0.006);
    }
    const thumb = mesh(hand, new THREE.CapsuleGeometry(0.0055, 0.016, 3, 5), skinM(), side * 0.016, -0.016, 0.012);
    thumb.rotation.z = side * -0.65;
    hand.rotation.set(0.08, 0, 0);
    elbow.add(hand);

    return { shoulder, elbow, upper, forearm, hand };
  }

  // ══════════════════════════════════════════════════════════
  // LEGS / BLACK PANTS — under the open robe; continuous joints
  // ══════════════════════════════════════════════════════════
  function makeLeg(side) {
    const hip = new THREE.Group();
    // Slightly forward so pants read clearly through the open robe
    hip.position.set(side * 0.09, 0.02, 0.04);
    hips.add(hip);

    mesh(hip, new THREE.SphereGeometry(0.058, 12, 10), clothGrad(pantTex));

    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.22, 6, 12), clothGrad(pantTex));
    thigh.geometry.translate(0, -0.15, 0);
    thigh.castShadow = true;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.y = -0.32;
    hip.add(knee);
    mesh(knee, new THREE.SphereGeometry(0.048, 10, 8), clothGrad(pantTex));

    const calf = new THREE.Mesh(new THREE.CapsuleGeometry(0.044, 0.18, 6, 12), armor(C.charcoal));
    calf.geometry.translate(0, -0.125, 0);
    calf.castShadow = true;
    knee.add(calf);

    mesh(knee, new THREE.CylinderGeometry(0.05, 0.055, 0.18, 14), armor(C.black), 0, -0.125, 0);
    for (let i = 0; i < 2; i++) {
      mesh(knee, new THREE.TorusGeometry(0.054, 0.005, 8, 14), gold(C.gold), 0, -0.055 - i * 0.06, 0).rotation.x = Math.PI / 2;
    }
    mesh(knee, new THREE.CircleGeometry(0.02, 12), gold(C.goldBright), 0, -0.125, 0.052);

    mesh(knee, new THREE.CapsuleGeometry(0.04, 0.05, 4, 10), armor(C.black), 0, -0.31, 0.02).scale.set(1.1, 0.7, 1.45);
    mesh(knee, new THREE.SphereGeometry(0.032, 10, 8), gold(C.gold), 0, -0.33, 0.095).scale.set(1.15, 0.55, 0.95);
    mesh(knee, new THREE.TorusGeometry(0.042, 0.006, 8, 12), gold(C.goldBright), 0, -0.27, 0.02).rotation.x = Math.PI / 2;

    return { hip, knee, thigh, calf };
  }

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);
  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);

  // Rest pose — arms hang at sides, slight forward elbow bend
  leftArm.shoulder.rotation.set(0.08, 0, -0.22);
  rightArm.shoulder.rotation.set(0.08, 0, 0.22);
  leftArm.elbow.rotation.set(-0.3, 0, 0);
  rightArm.elbow.rotation.set(-0.3, 0, 0);

  // ══════════════════════════════════════════════════════════
  // BACK GEAR — clean recurve bow + straight vertical string
  // Side: D-shaped gold limb. String = one vertical line tip→tip.
  // ══════════════════════════════════════════════════════════
  const gear = new THREE.Group();
  // Pressed onto cape outer face (cape ≈ −0.185). Intersect slightly so no air gap.
  gear.position.set(0.02, 0.28, -0.188);
  gear.rotation.set(0.02, 0.04, -0.02);
  hips.add(gear);

  const bowPts = [];
  for (let i = 0; i <= 36; i++) {
    const u = i / 36;
    const t = u * 2 - 1;
    const y = t * 0.58;
    // Almost flat against the back
    const z = -(1 - t * t) * 0.035;
    bowPts.push([0, y, z]);
  }
  sashTube(gear, bowPts, 0.013, gold(C.gold), 48);
  mesh(gear, new THREE.CylinderGeometry(0.016, 0.018, 0.08, 10), armor(C.brownDark), 0, 0, -0.035);

  // String = straight vertical line exactly tip→tip
  const tipY = 0.58;
  mesh(gear, new THREE.CylinderGeometry(0.0025, 0.0025, tipY * 2, 6), armor(C.black), 0, 0, 0);
  gear.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, tipY, 0),
      new THREE.Vector3(0, -tipY, 0),
    ]),
    new THREE.LineBasicMaterial({ color: 0x111111 }),
  ));

  const quiver = new THREE.Group();
  // Radius ≈0.04; nest into cape so the near face contacts
  quiver.position.set(0.1, 0.28, -0.21);
  quiver.rotation.set(0.1, -0.05, -0.28);
  hips.add(quiver);
  mesh(quiver, new THREE.CylinderGeometry(0.038, 0.044, 0.34, 14), armor(C.brown));
  mesh(quiver, new THREE.TorusGeometry(0.042, 0.006, 8, 14), gold(C.gold), 0, 0.1, 0).rotation.x = Math.PI / 2;
  mesh(quiver, new THREE.TorusGeometry(0.042, 0.006, 8, 14), gold(C.gold), 0, -0.1, 0).rotation.x = Math.PI / 2;
  mesh(quiver, new THREE.CylinderGeometry(0.044, 0.034, 0.024, 12), armor(C.brownDark), 0, 0.17, 0);

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const arrow = new THREE.Group();
    arrow.position.set(Math.cos(a) * 0.012, 0.1, Math.sin(a) * 0.012);
    mesh(arrow, new THREE.CylinderGeometry(0.004, 0.004, 0.24, 6), armor(C.brownDark), 0, 0.05, 0);
    mesh(arrow, new THREE.ConeGeometry(0.007, 0.022, 5), gold(C.goldDark), 0, 0.18, 0);
    quiver.add(arrow);
  }

  sashTube(hips, [
    [-0.1, 0.52, 0.06],
    [0.02, 0.4, -0.14],
    [0.09, 0.3, -0.2],
    [0.1, 0.2, -0.21],
  ], 0.009, armor(C.brownDark), 24);

  root.visible = false;
  return {
    root,
    hips,
    head: headGroup,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    eyeL: null,
    eyeR: null,
    lipLower: null,
  };
}
