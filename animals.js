/**
 * 蓬莱筑境 — beasts, birds, aquatic & creepy-crawlies (低面數)
 * Parametric makers keep draw calls low while silhouettes stay distinct.
 */
export function installAnimals(THREE, { mat, cprop, hash2 }) {
  const H = Math.PI * 2;

  function mcol(props, key, fallback) {
    return cprop(props, key, fallback);
  }

  function ball(g, x, y, z, r, col, w = 6, ht = 5) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, w, ht), mat(col));
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
    return m;
  }

  function cyl(g, x, y, z, r0, r1, h, col, segs = 5, rotX = 0, rotZ = 0, name) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, h, segs), mat(col));
    m.position.set(x, y, z);
    m.rotation.x = rotX;
    m.rotation.z = rotZ;
    if (name) m.name = name;
    m.castShadow = true;
    g.add(m);
    return m;
  }

  function cone(g, x, y, z, r, h, col, segs = 5, rotX = 0) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, segs), mat(col));
    m.position.set(x, y, z);
    m.rotation.x = rotX;
    m.castShadow = true;
    g.add(m);
    return m;
  }

  function finish(g, props) {
    g.rotation.y = props.rotation || 0;
    g.userData.isMob = true;
    return g;
  }

  /** Quadruped: body along Z, legs named for walk cycle. */
  function makeQuad(props, cfg) {
    const g = new THREE.Group();
    const sc = (props.scale ?? 1) * (cfg.unit || 0.5);
    const fur = mcol(props, 'color', cfg.color);
    const soft = mcol(props, 'color2', cfg.color2 || '#e8e0d0');
    const dark = cfg.dark || '#2a2018';
    const by = cfg.bodyY ?? 0.38;
    const bl = cfg.bodyLen ?? 0.55;
    const br = cfg.bodyR ?? 0.18;

    cyl(g, 0, by * sc, 0, br * sc, br * 0.9 * sc, bl * sc, fur, 6, Math.PI / 2);
    if (cfg.belly) {
      cone(g, 0, (by - 0.08) * sc, bl * 0.2 * sc, br * 0.7 * sc, bl * 0.35 * sc, soft, 5, Math.PI / 2);
    }
    // head
    const hx = 0;
    const hy = (cfg.headY ?? by + 0.12) * sc;
    const hz = (cfg.headZ ?? bl * 0.45) * sc;
    ball(g, hx, hy, hz, (cfg.headR ?? 0.16) * sc, fur, 6, 5);
    if (cfg.snout) {
      cone(g, 0, hy - 0.02 * sc, hz + (cfg.snoutZ ?? 0.12) * sc, (cfg.snoutR ?? 0.07) * sc, (cfg.snoutL ?? 0.14) * sc, soft, 5, Math.PI / 2);
    }
    // ears
    if (cfg.ears !== false) {
      for (const s of [-1, 1]) {
        const ear = cfg.earPoint
          ? cone(g, s * (cfg.earX ?? 0.1) * sc, hy + (cfg.earY ?? 0.12) * sc, hz, (cfg.earR ?? 0.05) * sc, (cfg.earH ?? 0.1) * sc, fur, 4)
          : ball(g, s * (cfg.earX ?? 0.1) * sc, hy + (cfg.earY ?? 0.1) * sc, hz, (cfg.earR ?? 0.05) * sc, fur, 4, 3);
        if (cfg.earPoint) ear.rotation.z = s * 0.2;
      }
    }
    // legs
    const legH = (cfg.legH ?? 0.32) * sc;
    const legR = (cfg.legR ?? 0.05) * sc;
    const stance = (cfg.stance ?? 0.14) * sc;
    const fore = (cfg.fore ?? bl * 0.28) * sc;
    const hind = (cfg.hind ?? -bl * 0.28) * sc;
    const names = ['legLF', 'legRF', 'legL', 'legR'];
    const pos = [
      [-stance, fore], [stance, fore], [-stance, hind], [stance, hind],
    ];
    pos.forEach(([x, z], i) => {
      cyl(g, x, legH * 0.5, z, legR, legR * 1.1, legH, fur, 4, 0, 0, names[i]);
      if (cfg.paws) ball(g, x, 0.03 * sc, z, legR * 1.3, dark, 4, 3);
    });
    // tail
    if (cfg.tail !== false) {
      const t = cone(g, 0, by * sc, -bl * 0.55 * sc, (cfg.tailR ?? 0.06) * sc, (cfg.tailL ?? 0.35) * sc, cfg.tailCol || fur, 5, -Math.PI / 2 + (cfg.tailLift || 0.15));
      t.name = 'tail';
      if (cfg.tailTip) ball(g, 0, by * sc + 0.02 * sc, -bl * 0.55 * sc - (cfg.tailL ?? 0.35) * sc, (cfg.tailR ?? 0.06) * 0.7 * sc, soft, 4, 3);
    }
    // pattern accents (stripes / spots — few cards)
    if (cfg.marks) {
      const markCol = cfg.markColor || dark;
      const n = Math.min(cfg.marks, 6);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * H;
        const mark = new THREE.Mesh(
          new THREE.PlaneGeometry((cfg.markW ?? 0.04) * sc, (cfg.markH ?? 0.12) * sc),
          mat(markCol, { side: THREE.DoubleSide })
        );
        mark.position.set(Math.cos(a) * br * 0.95 * sc, by * sc, Math.sin(a) * bl * 0.3 * sc);
        mark.rotation.y = a + Math.PI / 2;
        mark.castShadow = false;
        mark.receiveShadow = false;
        mark.name = 'leafCard'; // skip shadow pass like foliage cards
        g.add(mark);
      }
    }
    if (cfg.horn) {
      for (const s of cfg.hornSides || [0]) {
        cone(g, s * 0.08 * sc, hy + 0.1 * sc, hz + 0.02 * sc, 0.04 * sc, (cfg.hornH || 0.2) * sc, soft, 5);
      }
    }
    if (cfg.tusk) {
      for (const s of [-1, 1]) {
        cone(g, s * 0.06 * sc, hy - 0.04 * sc, hz + 0.1 * sc, 0.02 * sc, 0.1 * sc, '#e8e0d0', 4, Math.PI / 2);
      }
    }
    if (cfg.hump) {
      ball(g, 0, (by + 0.14) * sc, -0.05 * sc, br * 1.1 * sc, fur, 5, 4);
    }
    if (cfg.mane) {
      for (let i = 0; i < 5; i++) {
        cone(g, 0, hy + 0.05 * sc, hz - 0.05 * sc - i * 0.04 * sc, 0.06 * sc, 0.12 * sc, soft, 4);
      }
    }
    return finish(g, props);
  }

  function makeApe(props, cfg) {
    const g = new THREE.Group();
    const sc = (props.scale ?? 1) * (cfg.unit || 0.65);
    const fur = mcol(props, 'color', cfg.color);
    const dark = mcol(props, 'color2', cfg.color2 || '#3a2818');
    ball(g, 0, 0.72 * sc, 0, 0.32 * sc, fur, 7, 6).scale.set(1.1, 1.25, 0.95);
    ball(g, 0, 1.15 * sc, 0, 0.2 * sc, fur, 6, 5);
    ball(g, 0, 1.12 * sc, 0.14 * sc, 0.12 * sc, dark, 5, 4).scale.set(0.95, 1.05, 0.7);
    for (const s of [-1, 1]) {
      cyl(g, s * 0.32 * sc, 0.55 * sc, 0.04 * sc, 0.07 * sc, 0.09 * sc, (cfg.armL || 0.85) * sc, fur, 5, 0, s * 0.55, s < 0 ? 'armL' : 'armR');
      ball(g, s * 0.55 * sc, 0.18 * sc, 0.08 * sc, 0.07 * sc, dark, 4, 3);
      cyl(g, s * 0.12 * sc, 0.24 * sc, 0, 0.08 * sc, 0.1 * sc, 0.45 * sc, fur, 5, 0, 0, s < 0 ? 'legL' : 'legR');
    }
    if (cfg.tail) {
      const t = cone(g, 0, 0.5 * sc, -0.28 * sc, 0.04 * sc, 0.4 * sc, fur, 4, -Math.PI / 2);
      t.name = 'tail';
    }
    return finish(g, props);
  }

  function makeBird(props, cfg) {
    const g = new THREE.Group();
    const sc = (props.scale ?? 1) * (cfg.unit || 0.35);
    const feather = mcol(props, 'color', cfg.color);
    const soft = mcol(props, 'color2', cfg.color2 || '#e8e0d0');
    const by = cfg.bodyY ?? 0.22;
    ball(g, 0, by * sc, 0, (cfg.bodyR ?? 0.14) * sc, feather, 6, 5).scale.set(cfg.bodySX || 1, cfg.bodySY || 0.9, cfg.bodySZ || 1.3);
    const neckH = (cfg.neck || 0.12) * sc;
    if (neckH > 0.02) cyl(g, 0, by * sc + neckH * 0.5, (cfg.neckZ || 0.1) * sc, 0.03 * sc, 0.04 * sc, neckH, feather, 4);
    ball(g, 0, by * sc + neckH + 0.06 * sc, (cfg.headZ || 0.16) * sc, (cfg.headR || 0.07) * sc, feather, 5, 4);
    cone(g, 0, by * sc + neckH + 0.05 * sc, (cfg.headZ || 0.16) * sc + 0.08 * sc, 0.025 * sc, (cfg.beak || 0.08) * sc, soft, 4, Math.PI / 2);
    // wings
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(
        new THREE.PlaneGeometry((cfg.wingW || 0.22) * sc, (cfg.wingL || 0.16) * sc),
        mat(feather, { side: THREE.DoubleSide })
      );
      wing.position.set(s * 0.12 * sc, by * sc + 0.02 * sc, 0);
      wing.rotation.y = s * 0.2;
      wing.rotation.z = s * 0.15;
      wing.name = s < 0 ? 'wingL' : 'wingR';
      wing.castShadow = false;
      wing.receiveShadow = false;
      g.add(wing);
    }
    // tail
    const tail = new THREE.Mesh(
      new THREE.PlaneGeometry((cfg.tailW || 0.1) * sc, (cfg.tailL || 0.2) * sc),
      mat(cfg.tailCol || feather, { side: THREE.DoubleSide })
    );
    tail.position.set(0, by * sc, -(cfg.tailZ || 0.18) * sc);
    tail.rotation.x = 0.3;
    tail.name = 'tail';
    g.add(tail);
    if (cfg.crest) {
      for (let i = 0; i < 4; i++) {
        cone(g, 0, by * sc + neckH + 0.12 * sc + i * 0.02 * sc, (cfg.headZ || 0.16) * sc - 0.02 * sc, 0.02 * sc, 0.08 * sc, soft, 3);
      }
    }
    if (cfg.legs !== false) {
      for (const s of [-1, 1]) {
        cyl(g, s * 0.04 * sc, 0.08 * sc, 0.02 * sc, 0.015 * sc, 0.02 * sc, 0.14 * sc, '#c09040', 3, 0, 0, s < 0 ? 'legL' : 'legR');
      }
    }
    if (cfg.comb) {
      cone(g, 0, by * sc + neckH + 0.14 * sc, (cfg.headZ || 0.16) * sc, 0.03 * sc, 0.08 * sc, '#c03030', 4);
      ball(g, 0, by * sc + neckH + 0.02 * sc, (cfg.headZ || 0.16) * sc + 0.06 * sc, 0.03 * sc, '#c03030', 4, 3);
    }
    return finish(g, props);
  }

  function makeSnake(props, cfg) {
    const g = new THREE.Group();
    const sc = (props.scale ?? 1) * (cfg.unit || 0.4);
    const col = mcol(props, 'color', cfg.color);
    const soft = mcol(props, 'color2', cfg.color2 || '#e8d0c0');
    const segs = 8;
    for (let i = 0; i < segs; i++) {
      const t = i / (segs - 1);
      const r = (0.06 - t * 0.035) * sc;
      const z = (0.35 - t * 0.7) * sc;
      const y = 0.06 * sc + Math.sin(t * Math.PI) * 0.04 * sc;
      const part = ball(g, Math.sin(t * 3) * 0.04 * sc, y, z, r, col, 5, 4);
      if (i === 0) part.name = 'head';
    }
    ball(g, 0, 0.08 * sc, 0.38 * sc, 0.07 * sc, col, 5, 4);
    cone(g, 0, 0.07 * sc, 0.48 * sc, 0.03 * sc, 0.08 * sc, soft, 4, Math.PI / 2);
    if (cfg.eyes) {
      for (const s of [-1, 1]) ball(g, s * 0.04 * sc, 0.1 * sc, 0.42 * sc, 0.015 * sc, '#e04040', 3, 3);
    }
    return finish(g, props);
  }

  function makeTurtle(props) {
    const g = new THREE.Group();
    const sc = (props.scale ?? 1) * 0.35;
    const shell = mcol(props, 'color', '#2a3530');
    const soft = mcol(props, 'color2', '#4a5a48');
    ball(g, 0, 0.14 * sc, 0, 0.22 * sc, shell, 7, 5).scale.set(1.2, 0.7, 1.35);
    ball(g, 0, 0.08 * sc, 0.22 * sc, 0.08 * sc, soft, 5, 4);
    for (const s of [-1, 1]) {
      cyl(g, s * 0.14 * sc, 0.05 * sc, 0.1 * sc, 0.03 * sc, 0.04 * sc, 0.12 * sc, soft, 4, Math.PI / 2, 0, s < 0 ? 'legLF' : 'legRF');
      cyl(g, s * 0.14 * sc, 0.05 * sc, -0.1 * sc, 0.03 * sc, 0.04 * sc, 0.12 * sc, soft, 4, Math.PI / 2, 0, s < 0 ? 'legL' : 'legR');
    }
    return finish(g, props);
  }

  function makeTadpole(props) {
    const g = new THREE.Group();
    const sc = (props.scale ?? 1) * 0.18;
    const col = mcol(props, 'color', '#6a7a50');
    const soft = mcol(props, 'color2', '#a8b888');
    ball(g, 0, 0.08 * sc, 0.06 * sc, 0.1 * sc, col, 6, 5);
    const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.08 * sc, 0.22 * sc), mat(soft, { side: THREE.DoubleSide, transparent: true, opacity: 0.75 }));
    tail.position.set(0, 0.08 * sc, -0.12 * sc);
    tail.name = 'tail';
    g.add(tail);
    return finish(g, props);
  }

  function makeFish(props, cfg) {
    const g = new THREE.Group();
    const sc = (props.scale ?? 1) * (cfg.unit || 0.28);
    const col = mcol(props, 'color', cfg.color);
    const soft = mcol(props, 'color2', cfg.color2 || '#e8e0d0');
    ball(g, 0, 0.1 * sc, 0, (cfg.bodyR || 0.1) * sc, col, 6, 5).scale.set(0.7, 0.85, cfg.bodySZ || 1.6);
    // tail fin
    const fin = new THREE.Mesh(new THREE.PlaneGeometry(0.12 * sc, 0.14 * sc), mat(soft, { side: THREE.DoubleSide }));
    fin.position.set(0, 0.1 * sc, -0.2 * sc);
    fin.name = 'tail';
    g.add(fin);
    // side fins as wings for flap anim
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.PlaneGeometry((cfg.finW || 0.1) * sc, 0.08 * sc), mat(col, { side: THREE.DoubleSide }));
      wing.position.set(s * 0.08 * sc, 0.1 * sc, 0.02 * sc);
      wing.rotation.z = s * 0.5;
      wing.name = s < 0 ? 'wingL' : 'wingR';
      wing.castShadow = false;
      wing.receiveShadow = false;
      g.add(wing);
    }
    if (cfg.humanFace) {
      ball(g, 0, 0.12 * sc, 0.14 * sc, 0.07 * sc, soft, 5, 4);
      for (const s of [-1, 1]) ball(g, s * 0.03 * sc, 0.13 * sc, 0.18 * sc, 0.012 * sc, '#2a2018', 3, 3);
    }
    if (cfg.whiskers) {
      for (const s of [-1, 1]) {
        cyl(g, s * 0.04 * sc, 0.08 * sc, 0.16 * sc, 0.008 * sc, 0.008 * sc, 0.12 * sc, soft, 3, Math.PI / 2, s * 0.4);
      }
    }
    if (cfg.arms) {
      for (const s of [-1, 1]) {
        cyl(g, s * 0.1 * sc, 0.1 * sc, 0.05 * sc, 0.02 * sc, 0.025 * sc, 0.12 * sc, soft, 4, 0, s * 1.1, s < 0 ? 'armL' : 'armR');
      }
    }
    return finish(g, props);
  }

  function makeCrab(props) {
    const g = new THREE.Group();
    const sc = (props.scale ?? 1) * 0.45;
    const col = mcol(props, 'color', '#b05030');
    const soft = mcol(props, 'color2', '#d07040');
    ball(g, 0, 0.12 * sc, 0, 0.2 * sc, col, 6, 4).scale.set(1.4, 0.55, 1.1);
    for (const s of [-1, 1]) {
      cyl(g, s * 0.28 * sc, 0.14 * sc, 0.08 * sc, 0.04 * sc, 0.05 * sc, 0.22 * sc, soft, 4, Math.PI / 2, 0, s < 0 ? 'armL' : 'armR');
      ball(g, s * 0.42 * sc, 0.14 * sc, 0.12 * sc, 0.08 * sc, col, 4, 3).scale.set(1.2, 0.7, 0.9);
    }
    for (let i = 0; i < 3; i++) {
      for (const s of [-1, 1]) {
        cyl(g, s * (0.12 + i * 0.06) * sc, 0.06 * sc, (-0.05 - i * 0.06) * sc, 0.015 * sc, 0.02 * sc, 0.16 * sc, soft, 3, Math.PI / 2.5, s * 0.3);
      }
    }
    return finish(g, props);
  }

  function makeSnail(props) {
    const g = new THREE.Group();
    const sc = (props.scale ?? 1) * 0.28;
    const shell = mcol(props, 'color', '#6a3a7a');
    const soft = mcol(props, 'color2', '#c8b0a0');
    ball(g, 0, 0.16 * sc, -0.02 * sc, 0.14 * sc, shell, 7, 6);
    ball(g, 0, 0.06 * sc, 0.1 * sc, 0.08 * sc, soft, 5, 4).scale.set(1.4, 0.6, 1.8);
    for (const s of [-1, 1]) {
      cyl(g, s * 0.04 * sc, 0.16 * sc, 0.18 * sc, 0.01 * sc, 0.01 * sc, 0.1 * sc, soft, 3);
      ball(g, s * 0.04 * sc, 0.22 * sc, 0.18 * sc, 0.02 * sc, soft, 3, 3);
    }
    return finish(g, props);
  }

  function makeInsect(props, cfg) {
    const g = new THREE.Group();
    const sc = (props.scale ?? 1) * (cfg.unit || 0.25);
    const col = mcol(props, 'color', cfg.color || '#2a2820');
    const soft = mcol(props, 'color2', cfg.color2 || '#4a4030');
    ball(g, 0, 0.08 * sc, 0.08 * sc, 0.07 * sc, col, 5, 4);
    ball(g, 0, 0.08 * sc, -0.02 * sc, 0.09 * sc, soft, 5, 4).scale.set(1, 0.8, 1.4);
    for (let i = 0; i < 3; i++) {
      for (const s of [-1, 1]) {
        cyl(g, s * 0.08 * sc, 0.05 * sc, (0.06 - i * 0.06) * sc, 0.01 * sc, 0.012 * sc, 0.12 * sc, col, 3, Math.PI / 2.2, s * 0.5);
      }
    }
    if (cfg.wings) {
      for (const s of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.16 * sc, 0.1 * sc), mat(soft, { side: THREE.DoubleSide, transparent: true, opacity: 0.55 }));
        wing.position.set(s * 0.06 * sc, 0.12 * sc, 0);
        wing.name = s < 0 ? 'wingL' : 'wingR';
        g.add(wing);
      }
    }
    return finish(g, props);
  }

  function makeWorm(props) {
    const g = new THREE.Group();
    const sc = (props.scale ?? 1) * 0.3;
    const col = mcol(props, 'color', '#5a6a48');
    const soft = mcol(props, 'color2', '#3a4a30');
    for (let i = 0; i < 6; i++) {
      ball(g, 0, 0.05 * sc, (0.2 - i * 0.08) * sc, (0.05 - i * 0.004) * sc, i % 2 ? soft : col, 5, 4);
    }
    return finish(g, props);
  }

  function makeRhino(props) {
    const g = makeQuad(props, {
      unit: 0.7, color: '#6a6860', color2: '#8a8880', dark: '#4a4840',
      bodyY: 0.42, bodyLen: 0.7, bodyR: 0.28, headY: 0.48, headZ: 0.4, headR: 0.18,
      snout: true, snoutL: 0.2, snoutR: 0.1, ears: true, earR: 0.06,
      legH: 0.38, legR: 0.08, stance: 0.18, tailL: 0.2, tailR: 0.04, belly: false,
    });
    const sc = (props.scale ?? 1) * 0.7;
    cone(g, 0, 0.55 * sc, 0.52 * sc, 0.05 * sc, 0.22 * sc, '#d0c8b0', 5);
    cone(g, 0, 0.5 * sc, 0.42 * sc, 0.03 * sc, 0.1 * sc, '#d0c8b0', 4);
    return g;
  }

  function makeElephant(props) {
    const g = new THREE.Group();
    const sc = (props.scale ?? 1) * 0.85;
    const col = mcol(props, 'color', '#7a7870');
    const soft = mcol(props, 'color2', '#c8c0a8');
    ball(g, 0, 0.55 * sc, 0, 0.38 * sc, col, 7, 6).scale.set(1.1, 1.05, 1.35);
    ball(g, 0, 0.7 * sc, 0.42 * sc, 0.22 * sc, col, 6, 5);
    // trunk
    const trunk = cyl(g, 0, 0.45 * sc, 0.58 * sc, 0.06 * sc, 0.04 * sc, 0.45 * sc, col, 5, 0.4);
    trunk.name = 'armL';
    // ears
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.PlaneGeometry(0.28 * sc, 0.32 * sc), mat(col, { side: THREE.DoubleSide }));
      ear.position.set(s * 0.22 * sc, 0.72 * sc, 0.35 * sc);
      ear.rotation.y = s * 0.6;
      ear.name = s < 0 ? 'wingL' : 'wingR';
      g.add(ear);
    }
    // tusks
    for (const s of [-1, 1]) {
      cone(g, s * 0.1 * sc, 0.48 * sc, 0.55 * sc, 0.03 * sc, 0.28 * sc, soft, 5, Math.PI / 2.2);
    }
    const legH = 0.42 * sc;
    [[-1, 0.2], [1, 0.2], [-1, -0.25], [1, -0.25]].forEach(([sx, z], i) => {
      const names = ['legLF', 'legRF', 'legL', 'legR'];
      cyl(g, sx * 0.2 * sc, legH * 0.5, z * sc, 0.09 * sc, 0.1 * sc, legH, col, 5, 0, 0, names[i]);
    });
    const t = cone(g, 0, 0.5 * sc, -0.5 * sc, 0.05 * sc, 0.25 * sc, col, 4, -Math.PI / 2);
    t.name = 'tail';
    return finish(g, props);
  }

  // ─── Species registry ───────────────────────────────────
  const BEASTS = [
    { type: '虎', icon: '🐯', label: '虎', loco: 'ground', speed: 1.5, headY: 0.85, wander: 10,
      color: '#c46828', color2: '#f0e8e0',
      make: (p) => makeQuad(p, { unit: 0.72, color: '#c46828', color2: '#f0e8e0', dark: '#1a1810', bodyY: 0.42, bodyLen: 0.7, bodyR: 0.2, headR: 0.18, snout: true, belly: true, marks: 6, markW: 0.03, markH: 0.16, markColor: '#1a1810', tailL: 0.45, legH: 0.36, earPoint: false }) },
    { type: '豹', icon: '🐆', label: '豹', loco: 'ground', speed: 1.7, headY: 0.72, wander: 12,
      color: '#c8a040', color2: '#f0e8d8',
      make: (p) => makeQuad(p, { unit: 0.58, color: '#c8a040', color2: '#f0e8d8', dark: '#2a2010', bodyY: 0.36, bodyLen: 0.6, bodyR: 0.15, headR: 0.14, snout: true, belly: true, marks: 10, markW: 0.05, markH: 0.05, markColor: '#2a2010', tailL: 0.5, legH: 0.32 }) },
    { type: '熊', icon: '🐻', label: '熊', loco: 'ground', speed: 0.75, headY: 0.9, wander: 7,
      color: '#3a3028', color2: '#5a4a38',
      make: (p) => makeQuad(p, { unit: 0.68, color: '#3a3028', color2: '#5a4a38', dark: '#1a1810', bodyY: 0.4, bodyLen: 0.55, bodyR: 0.28, headR: 0.2, snout: true, snoutL: 0.12, ears: true, earR: 0.07, legH: 0.34, legR: 0.08, paws: true, tailL: 0.12, tailR: 0.05 }) },
    { type: '羆', icon: '🐻‍❄️', label: '羆', loco: 'ground', speed: 0.65, headY: 1.05, wander: 6,
      color: '#2a2418', color2: '#4a3a28',
      make: (p) => makeQuad(p, { unit: 0.82, color: '#2a2418', color2: '#4a3a28', dark: '#1a1810', bodyY: 0.45, bodyLen: 0.65, bodyR: 0.32, headR: 0.22, snout: true, hump: true, ears: true, legH: 0.38, legR: 0.1, paws: true, tailL: 0.1 }) },
    { type: '猩', icon: '🦧', label: '猩', loco: 'ground', speed: 0.9, headY: 1.35, wander: 6,
      color: '#9a5a32', color2: '#3a2818',
      make: (p) => makeApe(p, { unit: 0.7, color: '#9a5a32', color2: '#3a2818', armL: 0.9 }) },
    { type: '犀', icon: '🦏', label: '犀', loco: 'ground', speed: 0.7, headY: 0.95, wander: 8,
      color: '#6a6860', color2: '#8a8880', make: makeRhino },
    { type: '象', icon: '🐘', label: '象', loco: 'ground', speed: 0.6, headY: 1.15, wander: 9,
      color: '#7a7870', color2: '#c8c0a8', make: makeElephant },
    { type: '鹿', icon: '🦌', label: '鹿', loco: 'ground', speed: 1.55, headY: 0.95, wander: 11,
      color: '#8a6040', color2: '#f0e8d8',
      make: (p) => {
        const g = makeQuad(p, { unit: 0.55, color: '#8a6040', color2: '#f0e8d8', bodyY: 0.42, bodyLen: 0.5, bodyR: 0.14, headR: 0.1, snout: true, legH: 0.42, legR: 0.035, stance: 0.1, tailL: 0.15, marks: 4, markW: 0.04, markH: 0.04, markColor: '#f0e8d8' });
        const sc = (p.scale ?? 1) * 0.55;
        for (const s of [-1, 1]) {
          cyl(g, s * 0.05 * sc, 0.95 * sc, 0.28 * sc, 0.015 * sc, 0.012 * sc, 0.22 * sc, '#d0c0a0', 3);
          cyl(g, s * 0.08 * sc, 1.05 * sc, 0.28 * sc, 0.01 * sc, 0.01 * sc, 0.12 * sc, '#d0c0a0', 3, 0, s * 0.8);
        }
        return g;
      } },
    { type: '麂', icon: '🦌', label: '麂', loco: 'ground', speed: 1.4, headY: 0.55, wander: 8,
      color: '#a06840', color2: '#e8d0b0',
      make: (p) => makeQuad(p, { unit: 0.32, color: '#a06840', color2: '#e8d0b0', bodyY: 0.32, bodyLen: 0.4, bodyR: 0.12, headR: 0.09, snout: true, tusk: true, legH: 0.28, legR: 0.03, tailL: 0.1 }) },
    { type: '狐', icon: '🦊', label: '狐', loco: 'ground', speed: 1.4, headY: 0.55, wander: 10,
      color: '#c46830', color2: '#f0e8e0',
      make: (p) => makeQuad(p, { unit: 0.42, color: '#c46830', color2: '#f0e8e0', dark: '#2a2018', bodyY: 0.32, bodyLen: 0.48, bodyR: 0.14, headR: 0.12, snout: true, belly: true, earPoint: true, earH: 0.12, tailL: 0.42, tailR: 0.08, tailTip: true, legH: 0.26 }) },
    { type: '狼', icon: '🐺', label: '狼', loco: 'ground', speed: 1.45, headY: 0.7, wander: 12,
      color: '#6a6860', color2: '#c8c0b0',
      make: (p) => makeQuad(p, { unit: 0.52, color: '#6a6860', color2: '#c8c0b0', dark: '#2a2820', bodyY: 0.38, bodyLen: 0.55, bodyR: 0.16, headR: 0.14, snout: true, snoutL: 0.16, earPoint: true, tailL: 0.35, tailLift: 0, legH: 0.36 }) },
    { type: '犬', icon: '🐕', label: '犬', loco: 'ground', speed: 1.3, headY: 0.6, wander: 9,
      color: '#8a7060', color2: '#e8d8c8',
      make: (p) => makeQuad(p, { unit: 0.45, color: '#8a7060', color2: '#e8d8c8', bodyY: 0.34, bodyLen: 0.48, bodyR: 0.15, headR: 0.13, snout: true, earPoint: true, earH: 0.08, tailL: 0.28, tailLift: 0.9, legH: 0.3 }) },
    { type: '猴', icon: '🐒', label: '猴', loco: 'ground', speed: 1.2, headY: 0.75, wander: 8,
      color: '#8a6a48', color2: '#d0b090',
      make: (p) => makeApe(p, { unit: 0.42, color: '#8a6a48', color2: '#d0b090', armL: 0.55, tail: true }) },
    { type: '猿', icon: '🦍', label: '猿', loco: 'ground', speed: 0.95, headY: 1.1, wander: 7,
      color: '#5a4a40', color2: '#3a3028',
      make: (p) => makeApe(p, { unit: 0.62, color: '#5a4a40', color2: '#3a3028', armL: 1.0 }) },
    { type: '馬', icon: '🐴', label: '馬', loco: 'ground', speed: 1.8, headY: 1.05, wander: 14,
      color: '#6a5040', color2: '#2a2018',
      make: (p) => makeQuad(p, { unit: 0.7, color: '#6a5040', color2: '#2a2018', bodyY: 0.48, bodyLen: 0.7, bodyR: 0.18, headY: 0.75, headZ: 0.42, headR: 0.12, snout: true, snoutL: 0.18, mane: true, legH: 0.48, legR: 0.05, tailL: 0.4, tailCol: '#2a2018' }) },
    { type: '牛', icon: '🐂', label: '牛', loco: 'ground', speed: 0.7, headY: 0.9, wander: 8,
      color: '#4a4038', color2: '#c8c0a8',
      make: (p) => {
        const g = makeQuad(p, { unit: 0.72, color: '#4a4038', color2: '#c8c0a8', bodyY: 0.42, bodyLen: 0.65, bodyR: 0.26, headR: 0.16, snout: true, legH: 0.36, legR: 0.08, tailL: 0.25 });
        const sc = (p.scale ?? 1) * 0.72;
        for (const s of [-1, 1]) cone(g, s * 0.1 * sc, 0.85 * sc, 0.35 * sc, 0.03 * sc, 0.18 * sc, '#e8e0d0', 4, 0);
        return g;
      } },
    { type: '羊', icon: '🐏', label: '羊', loco: 'ground', speed: 0.9, headY: 0.65, wander: 8,
      color: '#e8e0d0', color2: '#c8c0b0',
      make: (p) => {
        const g = makeQuad(p, { unit: 0.4, color: '#e8e0d0', color2: '#c8c0b0', bodyY: 0.32, bodyLen: 0.42, bodyR: 0.18, headR: 0.1, snout: true, legH: 0.26, tailL: 0.1 });
        const sc = (p.scale ?? 1) * 0.4;
        for (const s of [-1, 1]) {
          const horn = cyl(g, s * 0.08 * sc, 0.55 * sc, 0.22 * sc, 0.025 * sc, 0.02 * sc, 0.16 * sc, '#d0c0a0', 4, 0, s * 1.2);
        }
        return g;
      } },
    { type: '豬', icon: '🐗', label: '豬', loco: 'ground', speed: 0.85, headY: 0.5, wander: 7,
      color: '#6a5a50', color2: '#c8b0a0',
      make: (p) => makeQuad(p, { unit: 0.42, color: '#6a5a50', color2: '#c8b0a0', bodyY: 0.3, bodyLen: 0.5, bodyR: 0.2, headR: 0.14, snout: true, snoutR: 0.08, snoutL: 0.12, tusk: true, ears: true, legH: 0.22, legR: 0.06, tailL: 0.12 }) },
    { type: '獺', icon: '🦦', label: '獺', loco: 'swim', speed: 1.3, headY: 0.35, wander: 10, flyHeight: 0.35,
      color: '#4a3a30', color2: '#6a5a48',
      make: (p) => makeQuad(p, { unit: 0.32, color: '#4a3a30', color2: '#6a5a48', bodyY: 0.2, bodyLen: 0.55, bodyR: 0.1, headR: 0.09, snout: true, legH: 0.12, legR: 0.03, tailL: 0.4, tailR: 0.05 }) },
    { type: '兔', icon: '🐇', label: '兔', loco: 'ground', speed: 1.6, headY: 0.4, wander: 6,
      color: '#d0c8b8', color2: '#f0e8e0',
      make: (p) => makeQuad(p, { unit: 0.28, color: '#d0c8b8', color2: '#f0e8e0', bodyY: 0.22, bodyLen: 0.32, bodyR: 0.12, headR: 0.1, snout: true, earPoint: true, earH: 0.18, earY: 0.16, legH: 0.18, tailL: 0.06, tailR: 0.05, tailTip: true }) },
    { type: '鼠', icon: '🐀', label: '鼠', loco: 'ground', speed: 1.5, headY: 0.22, wander: 5,
      color: '#6a6860', color2: '#c8c0b0',
      make: (p) => makeQuad(p, { unit: 0.18, color: '#6a6860', color2: '#c8c0b0', bodyY: 0.12, bodyLen: 0.28, bodyR: 0.07, headR: 0.06, snout: true, earR: 0.035, legH: 0.08, legR: 0.015, tailL: 0.28, tailR: 0.015 }) },
    { type: '貂', icon: '🦡', label: '貂', loco: 'ground', speed: 1.35, headY: 0.28, wander: 7,
      color: '#5a4030', color2: '#c8a060',
      make: (p) => makeQuad(p, { unit: 0.26, color: '#5a4030', color2: '#c8a060', bodyY: 0.16, bodyLen: 0.45, bodyR: 0.08, headR: 0.07, snout: true, legH: 0.1, legR: 0.025, tailL: 0.32, tailR: 0.04 }) },
    { type: '狸', icon: '🐈', label: '狸', loco: 'ground', speed: 1.35, headY: 0.45, wander: 9,
      color: '#b09050', color2: '#f0e8d8',
      make: (p) => makeQuad(p, { unit: 0.35, color: '#b09050', color2: '#f0e8d8', dark: '#2a2010', bodyY: 0.28, bodyLen: 0.42, bodyR: 0.12, headR: 0.11, snout: true, belly: true, marks: 8, markW: 0.04, markH: 0.04, earPoint: true, tailL: 0.35, legH: 0.24 }) },
  ];

  const BIRDS = [
    { type: '雉', icon: '🦚', label: '雉', loco: 'fly', speed: 1.4, headY: 0.45, wander: 10, flyHeight: 2.8,
      color: '#8a4a28', color2: '#2a6a48',
      make: (p) => makeBird(p, { unit: 0.38, color: '#8a4a28', color2: '#2a6a48', tailL: 0.35, tailW: 0.12, bodySY: 0.85 }) },
    { type: '鵲', icon: '🐦‍⬛', label: '鵲', loco: 'fly', speed: 1.7, headY: 0.35, wander: 12, flyHeight: 4,
      color: '#1a1a20', color2: '#f0f0f0',
      make: (p) => makeBird(p, { unit: 0.3, color: '#1a1a20', color2: '#f0f0f0', tailL: 0.28, tailCol: '#1a1a20' }) },
    { type: '鴞', icon: '🦉', label: '鴞', loco: 'fly', speed: 1.2, headY: 0.4, wander: 9, flyHeight: 3.5,
      color: '#6a5a40', color2: '#e8c040',
      make: (p) => makeBird(p, { unit: 0.34, color: '#6a5a40', color2: '#e8c040', headR: 0.12, neck: 0.02, bodyR: 0.16, beak: 0.05 }) },
    { type: '鸚鵡', icon: '🦜', label: '鸚鵡', loco: 'fly', speed: 1.5, headY: 0.38, wander: 8, flyHeight: 3.2,
      color: '#2a8a40', color2: '#c03030',
      make: (p) => makeBird(p, { unit: 0.3, color: '#2a8a40', color2: '#c03030', beak: 0.1, headR: 0.09 }) },
    { type: '鷩', icon: '✨', label: '鷩', loco: 'fly', speed: 1.35, headY: 0.42, wander: 9, flyHeight: 2.5,
      color: '#c03020', color2: '#e8c030',
      make: (p) => makeBird(p, { unit: 0.36, color: '#c03020', color2: '#e8c030', tailL: 0.4, crest: true }) },
    { type: '白雉', icon: '🦢', label: '白雉', loco: 'fly', speed: 1.35, headY: 0.42, wander: 9, flyHeight: 2.6,
      color: '#f0f0e8', color2: '#c8c0a8',
      make: (p) => makeBird(p, { unit: 0.36, color: '#f0f0e8', color2: '#c8c0a8', tailL: 0.35 }) },
    { type: '翠鳥', icon: '🐦', label: '翠鳥', loco: 'fly', speed: 1.9, headY: 0.28, wander: 8, flyHeight: 2.2,
      color: '#2a7a8a', color2: '#e8a030',
      make: (p) => makeBird(p, { unit: 0.22, color: '#2a7a8a', color2: '#e8a030', beak: 0.12, bodyR: 0.1 }) },
    { type: '戴勝', icon: '🪶', label: '戴勝', loco: 'fly', speed: 1.4, headY: 0.4, wander: 8, flyHeight: 3,
      color: '#c8a060', color2: '#2a2018',
      make: (p) => makeBird(p, { unit: 0.32, color: '#c8a060', color2: '#2a2018', crest: true, marks: false }) },
    { type: '鴟', icon: '🦅', label: '鴟', loco: 'fly', speed: 1.85, headY: 0.4, wander: 14, flyHeight: 6,
      color: '#6a5a48', color2: '#c8a060',
      make: (p) => makeBird(p, { unit: 0.4, color: '#6a5a48', color2: '#c8a060', wingW: 0.35, wingL: 0.2, beak: 0.1 }) },
    { type: '鸛', icon: '🦢', label: '鸛', loco: 'fly', speed: 1.3, headY: 0.7, wander: 12, flyHeight: 5,
      color: '#e8e8e0', color2: '#c03030',
      make: (p) => makeBird(p, { unit: 0.48, color: '#e8e8e0', color2: '#c03030', neck: 0.35, beak: 0.18, bodyR: 0.14, legH: true }) },
    { type: '鳧', icon: '🦆', label: '鳧', loco: 'fly', speed: 1.4, headY: 0.35, wander: 10, flyHeight: 2,
      color: '#4a5a48', color2: '#c8a040',
      make: (p) => makeBird(p, { unit: 0.32, color: '#4a5a48', color2: '#c8a040', bodySZ: 1.4, beak: 0.1, neck: 0.08 }) },
    { type: '鵝', icon: '🦢', label: '鵝', loco: 'fly', speed: 1.5, headY: 0.55, wander: 12, flyHeight: 4,
      color: '#6a7068', color2: '#c8c0a8',
      make: (p) => makeBird(p, { unit: 0.42, color: '#6a7068', color2: '#c8c0a8', neck: 0.28, bodyR: 0.16, beak: 0.1 }) },
    { type: '雞', icon: '🐓', label: '雞', loco: 'ground', speed: 0.9, headY: 0.45, wander: 6,
      color: '#c8a060', color2: '#c03030',
      make: (p) => makeBird(p, { unit: 0.32, color: '#c8a060', color2: '#c03030', comb: true, tailL: 0.22, neck: 0.1 }) },
    { type: '燕', icon: '🕊️', label: '燕', loco: 'fly', speed: 2.2, headY: 0.25, wander: 12, flyHeight: 5.5,
      color: '#2a3038', color2: '#e8e0d0',
      make: (p) => makeBird(p, { unit: 0.22, color: '#2a3038', color2: '#e8e0d0', wingW: 0.28, tailL: 0.18, bodyR: 0.08 }) },
  ];

  const AQUA = [
    { type: '何羅魚', icon: '🐟', label: '何羅魚', loco: 'swim', speed: 1.2, headY: 0.35, wander: 10, flyHeight: 0.4,
      color: '#4a7a8a', color2: '#c8e0e8',
      make: (p) => {
        const g = makeFish(p, { unit: 0.35, color: '#4a7a8a', color2: '#c8e0e8', bodySZ: 1.4 });
        const sc = (p.scale ?? 1) * 0.35;
        for (let i = 0; i < 3; i++) {
          ball(g, (i - 1) * 0.08 * sc, 0.05 * sc, -0.05 * sc, 0.07 * sc, '#4a7a8a', 5, 4).scale.set(0.6, 0.7, 1.2);
        }
        return g;
      } },
    { type: '鰼鰼', icon: '🐠', label: '鰼鰼', loco: 'swim', speed: 1.5, headY: 0.22, wander: 8, flyHeight: 0.35,
      color: '#5a8aa0', color2: '#e8f0f8',
      make: (p) => makeFish(p, { unit: 0.22, color: '#5a8aa0', color2: '#e8f0f8' }) },
    { type: '赤鱬', icon: '🐡', label: '赤鱬', loco: 'swim', speed: 1.1, headY: 0.35, wander: 8, flyHeight: 0.4,
      color: '#c04030', color2: '#e8d0c0',
      make: (p) => makeFish(p, { unit: 0.32, color: '#c04030', color2: '#e8d0c0', humanFace: true }) },
    { type: '文魚', icon: '🐠', label: '文魚', loco: 'swim', speed: 1.3, headY: 0.25, wander: 8, flyHeight: 0.35,
      color: '#3a6a8a', color2: '#e8c040',
      make: (p) => makeFish(p, { unit: 0.26, color: '#3a6a8a', color2: '#e8c040' }) },
    { type: '龍魚', icon: '🐉', label: '龍魚', loco: 'swim', speed: 1.4, headY: 0.3, wander: 10, flyHeight: 0.45,
      color: '#2a6a50', color2: '#c8a040',
      make: (p) => makeFish(p, { unit: 0.4, color: '#2a6a50', color2: '#c8a040', bodySZ: 2.2, whiskers: true, finW: 0.14 }) },
    { type: '人魚', icon: '🧜', label: '人魚', loco: 'swim', speed: 1.2, headY: 0.4, wander: 9, flyHeight: 0.4,
      color: '#3a7a8a', color2: '#e8d0c0',
      make: (p) => makeFish(p, { unit: 0.38, color: '#3a7a8a', color2: '#e8d0c0', humanFace: true, arms: true, bodySZ: 1.8 }) },
    { type: '飛魚', icon: '🐟', label: '飛魚', loco: 'swim', speed: 1.8, headY: 0.25, wander: 12, flyHeight: 1.2,
      color: '#5a8ab0', color2: '#c8d8e8',
      make: (p) => makeFish(p, { unit: 0.28, color: '#5a8ab0', color2: '#c8d8e8', finW: 0.22 }) },
    { type: '大蟹', icon: '🦀', label: '大蟹', loco: 'ground', speed: 0.7, headY: 0.35, wander: 6,
      color: '#b05030', color2: '#d07040', make: makeCrab },
    { type: '茈羸', icon: '🐌', label: '茈羸', loco: 'ground', speed: 0.25, headY: 0.3, wander: 3,
      color: '#6a3a7a', color2: '#c8b0a0', make: makeSnail },
  ];

  const CRAWL = [
    { type: '蛇', icon: '🐍', label: '蛇', loco: 'ground', speed: 0.9, headY: 0.2, wander: 7,
      color: '#3a5a38', color2: '#c8b060',
      make: (p) => makeSnake(p, { unit: 0.45, color: '#3a5a38', color2: '#c8b060' }) },
    { type: '白蛇', icon: '🐍', label: '白蛇', loco: 'ground', speed: 0.9, headY: 0.2, wander: 7,
      color: '#f0f0e8', color2: '#e06070',
      make: (p) => makeSnake(p, { unit: 0.45, color: '#f0f0e8', color2: '#e8d0c0', eyes: true }) },
    { type: '玄龜', icon: '🐢', label: '玄龜', loco: 'ground', speed: 0.35, headY: 0.28, wander: 5,
      color: '#2a3530', color2: '#4a5a48', make: makeTurtle },
    { type: '活師', icon: '🫧', label: '活師', loco: 'swim', speed: 0.6, headY: 0.15, wander: 4, flyHeight: 0.2,
      color: '#6a7a50', color2: '#a8b888', make: makeTadpole },
    { type: '蜚', icon: '🪳', label: '蜚', loco: 'ground', speed: 1.1, headY: 0.2, wander: 5,
      color: '#2a2820', color2: '#4a4030',
      make: (p) => makeInsect(p, { unit: 0.28, color: '#2a2820', color2: '#4a4030', wings: true }) },
    { type: '蠪蚔', icon: '🪱', label: '蠪蚔', loco: 'ground', speed: 0.4, headY: 0.12, wander: 4,
      color: '#5a6a48', color2: '#3a4a30', make: makeWorm },
  ];

  const ALL = [...BEASTS, ...BIRDS, ...AQUA, ...CRAWL];

  const PRESETS = [
    ...BEASTS.map((t) => ({ type: t.type, icon: t.icon, label: t.label, terrain: false, mob: true, tab: 'beasts', fly: t.loco === 'fly', swim: t.loco === 'swim' })),
    ...BIRDS.map((t) => ({ type: t.type, icon: t.icon, label: t.label, terrain: false, mob: true, tab: 'birds', fly: t.loco === 'fly', swim: t.loco === 'swim' })),
    ...AQUA.map((t) => ({ type: t.type, icon: t.icon, label: t.label, terrain: false, mob: true, tab: 'aqua', fly: t.loco === 'fly', swim: t.loco === 'swim' })),
    ...CRAWL.map((t) => ({ type: t.type, icon: t.icon, label: t.label, terrain: false, mob: true, tab: 'crawl', fly: t.loco === 'fly', swim: t.loco === 'swim' })),
  ];

  const DEFAULTS = {};
  const FACTORIES = {};
  const MOB_TYPES = new Set();
  const FLYING_MOBS = new Set();
  const SWIM_MOBS = new Set();
  const META = {};

  ALL.forEach((t) => {
    MOB_TYPES.add(t.type);
    if (t.loco === 'fly') FLYING_MOBS.add(t.type);
    if (t.loco === 'swim') SWIM_MOBS.add(t.type);
    META[t.type] = t;
    DEFAULTS[t.type] = {
      scale: 1,
      rotation: 0,
      color: t.color,
      color2: t.color2,
      wanderRadius: t.wander || 8,
      showName: false,
      stationary: false,
      hitbox: true,
      ...(t.loco === 'fly' || t.loco === 'swim' ? { flyHeight: t.flyHeight || 4 } : {}),
    };
    FACTORIES[t.type] = t.make;
  });

  // Legacy English aliases (old saves / starter)
  const LEGACY = {
    orangutan: '猩',
    fox: '狐',
    goose: '鵝',
    swallow: '燕',
    pheasant: '雉',
  };
  Object.entries(LEGACY).forEach(([old, neu]) => {
    FACTORIES[old] = FACTORIES[neu];
    DEFAULTS[old] = { ...DEFAULTS[neu] };
    MOB_TYPES.add(old);
    if (FLYING_MOBS.has(neu)) FLYING_MOBS.add(old);
  });

  function migrateMobType(o) {
    if (!o?.type) return;
    if (LEGACY[o.type]) o.type = LEGACY[o.type];
  }

  function isMob(type) { return MOB_TYPES.has(type); }
  function isFlyingMob(type) { return FLYING_MOBS.has(type); }
  function isSwimMob(type) { return SWIM_MOBS.has(type); }

  function mobHeadY(type, scale) {
    const s = Math.max(0.15, scale || 1);
    const base = META[type]?.headY ?? META[LEGACY[type]]?.headY ?? 0.8;
    return base * s + 0.04;
  }

  function mobSpeed(type, scale) {
    const meta = META[type] || META[LEGACY[type]];
    const base = meta?.speed ?? 0.9;
    return base * Math.max(0.4, scale || 1);
  }

  return {
    PRESETS,
    DEFAULTS,
    FACTORIES,
    MOB_TYPES,
    FLYING_MOBS,
    SWIM_MOBS,
    META,
    isMob,
    isFlyingMob,
    isSwimMob,
    migrateMobType,
    mobHeadY,
    mobSpeed,
  };
}
