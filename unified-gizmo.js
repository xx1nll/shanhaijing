/**
 * Tinkercad-style gizmo
 * - World-aligned AABB gizmo (never spins with the object)
 * - Move: RGB arrows always +X/+Y/+Z world; screen-constant thickness
 * - Rotate: π/3 RGB arcs with arrowheads; Shift = 15°
 * - Scale: 8 boxes always on AABB bottom + top height; Shift+corner = aspect lock
 * - Height: dashed drop-lines from 4 bottom corners to the ground plane
 */
import * as THREE from 'three';

const COL = {
  x: 0xe05050,
  y: 0x45a058,
  z: 0x4580d0,
  scale: 0xf2f2f2,
  scaleEdge: 0x1a1a1a,
  rotate: 0x2a2a2a,
  hover: 0xffc933,
  box: 0xf2f2f2,
};

const ROT_SNAP = Math.PI / 12; // 15°
const ROT_ARC = Math.PI / 6; // idle visible ring segment
const ROT_GHOST_OPACITY = 0.28; // rest of circle while dragging
const SCALE_BOX = 0.04; // unit geometry size; world size set via chrome

function meshMat(color, opacity = 0.98) {
  return new THREE.MeshBasicMaterial({
    color,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    opacity,
    toneMapped: false,
  });
}

function lineMat(color, opacity = 0.5) {
  return new THREE.LineBasicMaterial({
    color,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    opacity,
    toneMapped: false,
  });
}

/**
 * Unit arrow along +Y (base at 0).
 * setLength(totalLen, radius) — radius is identical for every axis; only length varies.
 * Shaft uses scale (r, len, r) from a unit cylinder so thickness never couples to length.
 */
function makeMoveArrow(axis, color) {
  const g = new THREE.Group();
  g.name = `translate-${axis}`;

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, 1, 12),
    meshMat(color),
  );
  shaft.position.y = 0.5;
  shaft.renderOrder = 3000;
  g.add(shaft);

  const head = new THREE.Mesh(
    new THREE.ConeGeometry(1, 1, 12),
    meshMat(color),
  );
  head.position.y = 1;
  head.renderOrder = 3001;
  g.add(head);

  const pick = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, 1, 8),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.01, depthTest: false, depthWrite: false, toneMapped: false,
    }),
  );
  pick.position.y = 0.5;
  pick.name = 'picker';
  g.add(pick);

  g.userData.shaft = shaft;
  g.userData.head = head;
  g.userData.pick = pick;
  g.userData.setLength = (totalLen, radius) => {
    const r = Math.max(0.006, radius);
    const headR = r * 2.45;
    const headH = r * 5.2;
    const len = Math.max(headH * 1.8, totalLen);
    const shaftLen = Math.max(r * 2, len - headH);
    // Uniform radial scale — same r on X and Z keeps thickness equal for every axis
    shaft.scale.set(r, shaftLen, r);
    shaft.position.y = shaftLen * 0.5;
    head.scale.set(headR, headH, headR);
    head.position.y = shaftLen + headH * 0.5;
    pick.scale.set(r * 3.2, len, r * 3.2);
    pick.position.y = len * 0.5;
  };
  g.userData.setLength(1, 0.03);

  if (axis === 'x') g.rotation.z = -Math.PI / 2;
  else if (axis === 'z') g.rotation.x = Math.PI / 2;
  g.userData.handle = { kind: 'translate', axis };
  return g;
}

/**
 * π/6 rotation arc with arrowhead cones (same proportions as move arrows).
 * While pressed, a fainter full circle is shown behind the solid segment.
 *
 * Local build: arc mid at +Y in XY, axis = local Z — then oriented per world axis:
 *   Y (green): mid → +Z (ahead of the red/+X line), plane = XZ
 *   X (red):   mid → +Y (above green), plane = YZ; layout pushes to −X box side
 *   Z (blue):  mid → +Y (above green), plane = XY; layout pushes to −Z box side
 */
function makeRotateArc(axis, color) {
  const g = new THREE.Group();
  g.name = `rotate-${axis}`;
  const mats = [];

  // Orient local (Z=axis, +Y=mid) into world
  {
    let z;
    let y;
    if (axis === 'x') {
      z = new THREE.Vector3(1, 0, 0);
      y = new THREE.Vector3(0, 1, 0); // above green
    } else if (axis === 'y') {
      z = new THREE.Vector3(0, 1, 0);
      y = new THREE.Vector3(0, 0, 1); // ahead of red
    } else {
      z = new THREE.Vector3(0, 0, 1);
      y = new THREE.Vector3(0, 1, 0); // above green
    }
    const x = new THREE.Vector3().crossVectors(y, z).normalize();
    y = new THREE.Vector3().crossVectors(z, x).normalize();
    g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  }

  g.userData.handle = { kind: 'rotate', axis };
  g.userData._arcMats = mats;
  g.userData.setPressed = (on) => {
    if (g.userData.ghost) g.userData.ghost.visible = !!on;
  };
  g.userData.setArc = (radius, tube) => {
    const wasPressed = !!g.userData.ghost?.visible;
    while (g.children.length) {
      const c = g.children[0];
      g.remove(c);
      disposeObject3D(c);
    }
    mats.length = 0;
    g.userData.ghost = null;

    const r = Math.max(0.12, radius);
    const t = Math.max(0.006, tube);
    const half = ROT_ARC * 0.5;
    const a0 = Math.PI / 2 - half;
    const a1 = Math.PI / 2 + half;

    // Full circle (ghost) — shown only while this handle is pressed
    const ghostMat = meshMat(color, ROT_GHOST_OPACITY);
    mats.push(ghostMat);
    const ghost = new THREE.Mesh(new THREE.TorusGeometry(r, t * 0.9, 8, 64), ghostMat);
    ghost.name = 'ghostRing';
    ghost.visible = wasPressed;
    ghost.renderOrder = 2993;
    ghost.raycast = () => {}; // pick stays on the solid segment
    g.add(ghost);
    g.userData.ghost = ghost;

    const pts = [];
    const n = 16;
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * (i / n);
      pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const mat = meshMat(color, 0.92);
    mats.push(mat);
    const tubeMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, n, t, 6, false), mat);
    tubeMesh.renderOrder = 2995;
    g.add(tubeMesh);

    const headR = t * 2.45;
    const headH = t * 5.2;
    [0, pts.length - 1].forEach((i) => {
      const end = pts[i];
      const prev = pts[i === 0 ? 1 : pts.length - 2];
      const tang = end.clone().sub(prev).normalize();
      const tipMat = meshMat(color, 0.92);
      mats.push(tipMat);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(headR, headH, 10), tipMat);
      tip.position.copy(end);
      tip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tang);
      tip.renderOrder = 2996;
      g.add(tip);
    });

    const pick = new THREE.Mesh(
      new THREE.TorusGeometry(r, Math.max(t * 4.5, 0.08), 6, 16, ROT_ARC),
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.01, depthTest: false, depthWrite: false, toneMapped: false,
      }),
    );
    pick.rotation.z = a0;
    pick.name = 'picker';
    g.add(pick);
  };
  g.userData.setArc(1, 0.025);
  return g;
}

function makeScaleBox(name, color = COL.scale) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(SCALE_BOX, SCALE_BOX, SCALE_BOX),
    meshMat(color),
  );
  mesh.name = name;
  mesh.renderOrder = 3002;
  const pick = new THREE.Mesh(
    new THREE.BoxGeometry(SCALE_BOX * 3.2, SCALE_BOX * 3.2, SCALE_BOX * 3.2),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.01, depthTest: false, depthWrite: false, toneMapped: false,
    }),
  );
  pick.name = 'picker';
  mesh.add(pick);
  return mesh;
}

/** Full through-axis line (both directions) — shown while rotating */
function makeAxisLine(axis, color) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
    color,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    opacity: 0.92,
    toneMapped: false,
  }));
  line.name = `axisLine-${axis}`;
  line.renderOrder = 2991;
  line.frustumCulled = false;
  line.visible = false;
  line.userData.axis = axis;
  line.userData.setSpan = (len) => {
    const L = Math.max(0.2, len);
    const pos = line.geometry.attributes.position.array;
    if (axis === 'x') {
      pos[0] = -L; pos[1] = 0; pos[2] = 0;
      pos[3] = L; pos[4] = 0; pos[5] = 0;
    } else if (axis === 'y') {
      pos[0] = 0; pos[1] = -L; pos[2] = 0;
      pos[3] = 0; pos[4] = L; pos[5] = 0;
    } else {
      pos[0] = 0; pos[1] = 0; pos[2] = -L;
      pos[3] = 0; pos[4] = 0; pos[5] = L;
    }
    line.geometry.attributes.position.needsUpdate = true;
    line.geometry.computeBoundingSphere();
  };
  line.userData.setSpan(1);
  return line;
}

function skipBounds(o) {
  return !o || o.name === 'mobNameTag' || o.userData?.skipBounds || o.userData?.isHelper;
}

function disposeObject3D(obj) {
  obj.traverse((c) => {
    if (c.geometry) c.geometry.dispose();
    if (c.material) {
      if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
      else c.material.dispose();
    }
  });
}

export class UnifiedTransformControls extends THREE.EventDispatcher {
  constructor(camera, domElement) {
    super();
    this.camera = camera;
    this.domElement = domElement;
    this.object = null;
    this.enabled = true;
    this.dragging = false;
    this.mode = 'translate';
    this.space = 'world';
    this.size = 1;
    this.showX = true;
    this.showY = true;
    this.showZ = true;
    this.axisMask = {
      translate: { x: true, y: true, z: true },
      rotate: { x: true, y: true, z: true },
      scale: { x: true, y: true, z: true },
    };

    this._restHalf = { x: 0.5, y: 0.5, z: 0.5 }; // local unscaled (for scale math)
    this._restCenter = new THREE.Vector3();
    this._worldHalf = { x: 0.5, y: 0.5, z: 0.5 };
    this._worldCenter = new THREE.Vector3();
    this._box3 = new THREE.Box3();
    this._boundsValid = false;
    this._lastRotKey = '';
    this._rotRingLock = null;

    this.root = new THREE.Group();
    this.root.name = 'UnifiedTransformControls';
    this.root.renderOrder = 3000;
    this._handles = new THREE.Group();
    this.root.add(this._handles);

    this._tX = makeMoveArrow('x', COL.x);
    this._tY = makeMoveArrow('y', COL.y);
    this._tZ = makeMoveArrow('z', COL.z);
    this._handles.add(this._tX, this._tY, this._tZ);

    // Full XYZ axis lines (circle colors) — visible while rotating
    this._axisLineX = makeAxisLine('x', COL.x);
    this._axisLineY = makeAxisLine('y', COL.y);
    this._axisLineZ = makeAxisLine('z', COL.z);
    this._handles.add(this._axisLineX, this._axisLineY, this._axisLineZ);

    // RGB rotation arcs (π/3 segments with arrowheads)
    this._rX = makeRotateArc('x', COL.x);
    this._rY = makeRotateArc('y', COL.y);
    this._rZ = makeRotateArc('z', COL.z);
    this._handles.add(this._rX, this._rY, this._rZ);

    // Dashed drop-lines from AABB bottom corners down to the ground (XZ footprint)
    const dashMat = () => new THREE.LineDashedMaterial({
      color: COL.box,
      dashSize: 0.2,
      gapSize: 0.12,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.5,
      toneMapped: false,
    });
    this._dropLines = new THREE.LineSegments(new THREE.BufferGeometry(), dashMat());
    this._dropLines.renderOrder = 2980;
    this._dropLines.frustumCulled = false;
    this._dropLines.visible = false;
    this._handles.add(this._dropLines);

    // Dashed ground-cut on the white box where the AABB meets terrain (when partially buried)
    this._groundCut = new THREE.LineSegments(new THREE.BufferGeometry(), dashMat());
    this._groundCut.renderOrder = 2981;
    this._groundCut.frustumCulled = false;
    this._groundCut.visible = false;
    this._handles.add(this._groundCut);

    // White dashed ground square (same dash style as Y drop-lines) while translating
    this._dragGhost = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineDashedMaterial({
        color: COL.scale,
        dashSize: 0.2,
        gapSize: 0.12,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 0.5,
        toneMapped: false,
      }),
    );
    this._dragGhost.renderOrder = 2982;
    this._dragGhost.frustumCulled = false;
    this._dragGhost.visible = false;
    this.root.add(this._dragGhost);

    // White dotted AABB wireframes at original + current object positions
    this._dragBoxes = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineDashedMaterial({
        color: COL.scale,
        dashSize: 0.18,
        gapSize: 0.12,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 0.85,
        toneMapped: false,
      }),
    );
    this._dragBoxes.renderOrder = 2983;
    this._dragBoxes.frustumCulled = false;
    this._dragBoxes.visible = false;
    this.root.add(this._dragBoxes);

    this._scaleHandles = [];
    [[-1, -1, -1], [1, -1, -1], [-1, -1, 1], [1, -1, 1]].forEach(([ix, iy, iz]) => {
      const m = makeScaleBox(`bc${ix}${iz}`, COL.scale);
      m.userData.handle = {
        kind: 'scale', dir: new THREE.Vector3(ix, iy, iz), axes: [1, 0, 1], role: 'bottom-corner',
      };
      this._handles.add(m);
      this._scaleHandles.push(m);
    });
    [
      { dir: [0, -1, 1], axes: [0, 0, 1] },
      { dir: [0, -1, -1], axes: [0, 0, 1] },
      { dir: [1, -1, 0], axes: [1, 0, 0] },
      { dir: [-1, -1, 0], axes: [1, 0, 0] },
    ].forEach((ed, i) => {
      const m = makeScaleBox(`be${i}`, COL.scaleEdge);
      m.userData.handle = {
        kind: 'scale', dir: new THREE.Vector3(...ed.dir), axes: ed.axes.slice(), role: 'bottom-edge',
      };
      this._handles.add(m);
      this._scaleHandles.push(m);
    });
    const top = makeScaleBox('topY', COL.scale);
    top.userData.handle = {
      kind: 'scale', dir: new THREE.Vector3(0, 1, 0), axes: [0, 1, 0], role: 'top-height',
    };
    this._handles.add(top);
    this._scaleHandles.push(top);

    this._box = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(2, 2, 2)),
      lineMat(COL.box, 0.5),
    );
    this._box.renderOrder = 2990;
    this._handles.add(this._box);

    // Invisible AABB for body-drag hit testing (proxies / sparse meshes)
    this._bodyPick = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2),
      new THREE.MeshBasicMaterial({
        visible: false, depthTest: false, depthWrite: false, toneMapped: false,
      }),
    );
    this._bodyPick.name = 'bodyPick';
    this._bodyPick.userData.skipBounds = true;
    this._bodyPick.userData.isHelper = true;
    this.root.add(this._bodyPick);

    this._raycaster = new THREE.Raycaster();
    this._pointer = new THREE.Vector2();
    this._ndc0 = new THREE.Vector2();
    this._drag = null;
    this._hover = null;
    this._tmpV = new THREE.Vector3();
    this._tmpV2 = new THREE.Vector3();
    this._tmpV3 = new THREE.Vector3();
    this._rotVec = new THREE.Vector3();
    this._rotCross = new THREE.Vector3();
    this._plane = new THREE.Plane();
    this._planeHit = new THREE.Vector3();
    this._quat = new THREE.Quaternion();
    this._savedRots = [];

    this._onPointerDown = this._onPointerDown.bind(this);
    this._onWinMove = this._onWinMove.bind(this);
    this._onWinUp = this._onWinUp.bind(this);
    this._onHover = this._onHover.bind(this);
    domElement.addEventListener('pointerdown', this._onPointerDown, true);
    domElement.addEventListener('pointermove', this._onHover);
  }

  getHelper() { return this.root; }
  setMode(m) { if (m === 'translate' || m === 'rotate' || m === 'scale') this.mode = m; }
  setSpace(s) { this.space = s; }
  setSize(s) { this.size = s; }
  /** Optional (x,z) => ground Y — used for height drop-lines */
  getGroundY = null;
  /** When true, horizontal translate rides getGroundY (objects only — not terrain proxies) */
  followTerrain = false;

  attach(object) {
    this.object = object;
    this.root.visible = !!object;
    this._boundsValid = false;
    this._lastRotKey = '';
    this._captureRestBounds();
    this._refreshLayout();
  }

  detach() {
    this._endDragListeners();
    this._rX.userData.setPressed?.(false);
    this._rY.userData.setPressed?.(false);
    this._rZ.userData.setPressed?.(false);
    this.object = null;
    this.root.visible = false;
    this.dragging = false;
    this._drag = null;
    this._boundsValid = false;
    this._rotRingLock = null;
  }

  invalidateBounds() {
    this._boundsValid = false;
    this._lastRotKey = '';
    if (!this.dragging) this._rotRingLock = null;
    if (this.object && !this.dragging) {
      this._captureRestBounds();
      this._refreshLayout();
    }
  }

  refresh() {
    if (this.object && this.root.visible && !this.dragging) this._refreshLayout();
  }

  dispose() {
    this._endDragListeners();
    this.domElement.removeEventListener('pointerdown', this._onPointerDown, true);
    this.domElement.removeEventListener('pointermove', this._onHover);
  }

  _endDragListeners() {
    window.removeEventListener('pointermove', this._onWinMove, true);
    window.removeEventListener('pointerup', this._onWinUp, true);
    window.removeEventListener('pointercancel', this._onWinUp, true);
  }

  update() {
    if (!this.object || !this.root.visible) return;
    if (!this.dragging) this._refreshLayout();
    else {
      this.object.updateMatrixWorld(true);
      this._followObject();
      if (this.mode === 'rotate' || this.mode === 'scale') this._layoutHandles(this._worldHalf);
      else if (this.mode === 'translate') {
        this._layoutDropLines(this._worldHalf);
        this._layoutGroundCut(this._worldHalf);
        this._layoutDragGhost();
      }
    }
  }

  /** World AABB center; root stays IDENTITY so arrows/box never spin with the object */
  _followObject() {
    this._updateWorldBounds();
    this.root.position.copy(this._worldCenter);
    this.root.quaternion.identity();
  }

  /** World-unit size that stays ~constant on screen */
  _chrome() {
    const dist = this.camera.getWorldPosition(this._tmpV)
      .distanceTo(this.root.getWorldPosition(this._tmpV2));
    return Math.max(0.035, dist * 0.011 * this.size);
  }

  _setPointer(e) {
    const rect = this.domElement.getBoundingClientRect();
    this._pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this._pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  _freezeAnim(obj) {
    this._savedRots.length = 0;
    obj.traverse((c) => {
      // Wind lean lives on plantSway — never zero the selectable root (placement yaw)
      if (c.name === 'plantSway') {
        this._savedRots.push({ o: c, x: c.rotation.x, y: c.rotation.y, z: c.rotation.z });
        c.rotation.set(0, 0, 0);
      }
      if (c.userData?.baseOut != null) {
        this._savedRots.push({ o: c, x: c.rotation.x, y: c.rotation.y, z: c.rotation.z });
        c.rotation.set(0, 0, (c.userData.baseOut || 0) * 0.5);
      }
    });
    obj.updateMatrixWorld(true);
  }

  _restoreAnim() {
    if (this.object?.userData?.freezeAnim) { this._savedRots.length = 0; return; }
    for (const s of this._savedRots) s.o.rotation.set(s.x, s.y, s.z);
    this._savedRots.length = 0;
    this.object?.updateMatrixWorld(true);
  }

  /** Axis-aligned world bounds of the selection (gizmo frame). Updates as object rotates. */
  _updateWorldBounds() {
    const obj = this.object;
    if (!obj) return;
    obj.updateMatrixWorld(true);
    const box = this._box3;
    box.makeEmpty();
    const forced = obj.userData?.gizmoBounds;
    const corner = this._tmpV3;

    if (forced?.half) {
      const c = forced.center || { x: 0, y: 0, z: 0 };
      const h = forced.half;
      for (let ix = -1; ix <= 1; ix += 2) {
        for (let iy = -1; iy <= 1; iy += 2) {
          for (let iz = -1; iz <= 1; iz += 2) {
            corner.set(c.x + ix * h.x, c.y + iy * h.y, c.z + iz * h.z).applyMatrix4(obj.matrixWorld);
            box.expandByPoint(corner);
          }
        }
      }
    } else {
      this._freezeAnim(obj);
      let has = false;
      obj.traverse((ch) => {
        if (!ch.isMesh || !ch.geometry || skipBounds(ch)) return;
        if (!ch.geometry.boundingBox) ch.geometry.computeBoundingBox();
        const bb = ch.geometry.boundingBox;
        if (!bb || bb.isEmpty()) return;
        ch.updateWorldMatrix(true, false);
        for (let ix = 0; ix < 2; ix++) for (let iy = 0; iy < 2; iy++) for (let iz = 0; iz < 2; iz++) {
          corner.set(
            ix ? bb.max.x : bb.min.x,
            iy ? bb.max.y : bb.min.y,
            iz ? bb.max.z : bb.min.z,
          ).applyMatrix4(ch.matrixWorld);
          box.expandByPoint(corner);
          has = true;
        }
      });
      this._restoreAnim();
      if (!has) {
        const p = obj.getWorldPosition(this._tmpV);
        box.set(
          new THREE.Vector3(p.x - 0.4, p.y - 0.4, p.z - 0.4),
          new THREE.Vector3(p.x + 0.4, p.y + 0.4, p.z + 0.4),
        );
      }
    }

    box.getCenter(this._worldCenter);
    const size = this._tmpV;
    box.getSize(size);
    this._worldHalf = {
      x: Math.max(size.x * 0.5, 0.05),
      y: Math.max(size.y * 0.5, 0.05),
      z: Math.max(size.z * 0.5, 0.05),
    };
  }

  /** Local unscaled half-extents — used so scale factors map to object.scale */
  _captureRestBounds() {
    const obj = this.object;
    if (!obj) return;
    const forced = obj.userData?.gizmoBounds;
    if (forced?.half) {
      const c = forced.center || { x: 0, y: 0, z: 0 };
      this._restHalf = {
        x: Math.max(forced.half.x, 0.05),
        y: Math.max(forced.half.y, 0.05),
        z: Math.max(forced.half.z, 0.05),
      };
      this._restCenter.set(c.x, c.y, c.z);
      this._boundsValid = true;
      this._updateWorldBounds();
      return;
    }

    const saved = obj.scale.clone();
    obj.scale.set(1, 1, 1);
    this._freezeAnim(obj);
    obj.updateMatrixWorld(true);

    const quat = obj.getWorldQuaternion(new THREE.Quaternion());
    const invQ = quat.clone().invert();
    const origin = obj.getWorldPosition(new THREE.Vector3());
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    let has = false;
    const corner = new THREE.Vector3();
    const local = new THREE.Vector3();

    obj.traverse((c) => {
      if (!c.isMesh || !c.geometry || skipBounds(c)) return;
      if (!c.geometry.boundingBox) c.geometry.computeBoundingBox();
      const bb = c.geometry.boundingBox;
      if (!bb || bb.isEmpty()) return;
      c.updateWorldMatrix(true, false);
      for (let ix = 0; ix < 2; ix++) for (let iy = 0; iy < 2; iy++) for (let iz = 0; iz < 2; iz++) {
        corner.set(ix ? bb.max.x : bb.min.x, iy ? bb.max.y : bb.min.y, iz ? bb.max.z : bb.min.z)
          .applyMatrix4(c.matrixWorld);
        local.copy(corner).sub(origin).applyQuaternion(invQ);
        minX = Math.min(minX, local.x); maxX = Math.max(maxX, local.x);
        minY = Math.min(minY, local.y); maxY = Math.max(maxY, local.y);
        minZ = Math.min(minZ, local.z); maxZ = Math.max(maxZ, local.z);
        has = true;
      }
    });

    this._restoreAnim();
    obj.scale.copy(saved);
    obj.updateMatrixWorld(true);

    if (!has) {
      this._restHalf = { x: 0.4, y: 0.4, z: 0.4 };
      this._restCenter.set(0, 0, 0);
    } else {
      this._restHalf = {
        x: Math.max((maxX - minX) * 0.5, 0.04),
        y: Math.max((maxY - minY) * 0.5, 0.04),
        z: Math.max((maxZ - minZ) * 0.5, 0.04),
      };
      this._restCenter.set((minX + maxX) * 0.5, (minY + maxY) * 0.5, (minZ + maxZ) * 0.5);
    }
    this._boundsValid = true;
    this._updateWorldBounds();
  }

  _liveHalf() {
    return { ...this._worldHalf };
  }

  _ensureRotateArcs(radius, tube) {
    const key = `${radius.toFixed(2)}_${tube.toFixed(3)}`;
    if (key === this._lastRotKey) return;
    this._lastRotKey = key;
    this._rX.userData.setArc(radius, tube);
    this._rY.userData.setArc(radius, tube);
    this._rZ.userData.setArc(radius, tube);
  }

  _hideDragGhost() {
    if (this._dragGhost) this._dragGhost.visible = false;
    if (this._dragBoxes) this._dragBoxes.visible = false;
  }

  /** Push 12 edges of an AABB (min/max in local space) into a flat position array. */
  _pushAabbEdges(pos, x0, y0, z0, x1, y1, z1) {
    const c = [
      [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1],
      [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1],
    ];
    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ];
    for (const [i, j] of edges) {
      pos.push(c[i][0], c[i][1], c[i][2], c[j][0], c[j][1], c[j][2]);
    }
  }

  /**
   * While translating:
   * - White dashed ground square (drop-line style) from farthest old/new footprint corners
   * - Black dotted exact AABB boxes at original + current positions
   */
  _layoutDragGhost() {
    const d = this._drag;
    if (!this.dragging || !d || d.handle?.kind !== 'translate' || !d.startWorldCenter || !d.startWorldHalf) {
      this._hideDragGhost();
      return;
    }
    const a = d.startWorldCenter;
    const ah = d.startWorldHalf;
    const b = this._worldCenter;
    const bh = this._worldHalf;
    const u = this._chrome();
    const dash = Math.max(0.06, u * 1.1);
    const gap = Math.max(0.04, u * 0.7);

    // —— White ground square (farthest footprint corners) ——
    const pts = [];
    for (const cx of [a.x - ah.x, a.x + ah.x]) {
      for (const cz of [a.z - ah.z, a.z + ah.z]) pts.push({ x: cx, z: cz });
    }
    for (const cx of [b.x - bh.x, b.x + bh.x]) {
      for (const cz of [b.z - bh.z, b.z + bh.z]) pts.push({ x: cx, z: cz });
    }

    let bestI = 0;
    let bestJ = 1;
    let bestD = -1;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x;
        const dz = pts[i].z - pts[j].z;
        const dd = dx * dx + dz * dz;
        if (dd > bestD) {
          bestD = dd;
          bestI = i;
          bestJ = j;
        }
      }
    }

    const p0 = pts[bestI];
    const p1 = pts[bestJ];
    let x0 = Math.min(p0.x, p1.x);
    let x1 = Math.max(p0.x, p1.x);
    let z0 = Math.min(p0.z, p1.z);
    let z1 = Math.max(p0.z, p1.z);

    const minSpan = Math.max(0.2, u * 4);
    if (x1 - x0 < minSpan) {
      const m = (x0 + x1) * 0.5;
      x0 = m - minSpan * 0.5;
      x1 = m + minSpan * 0.5;
    }
    if (z1 - z0 < minSpan) {
      const m = (z0 + z1) * 0.5;
      z0 = m - minSpan * 0.5;
      z1 = m + minSpan * 0.5;
    }

    const gx = (x0 + x1) * 0.5;
    const gz = (z0 + z1) * 0.5;
    const yWorld = typeof this.getGroundY === 'function'
      ? this.getGroundY(gx, gz)
      : Math.min(a.y - ah.y, b.y - bh.y);

    const cx = this._worldCenter.x;
    const cy = this._worldCenter.y;
    const cz = this._worldCenter.z;
    const y = yWorld - cy;
    const groundPos = [];
    const gCorners = [
      [x0 - cx, y, z0 - cz], [x1 - cx, y, z0 - cz],
      [x1 - cx, y, z1 - cz], [x0 - cx, y, z1 - cz],
    ];
    for (const [i, j] of [[0, 1], [1, 2], [2, 3], [3, 0]]) {
      groundPos.push(
        gCorners[i][0], gCorners[i][1], gCorners[i][2],
        gCorners[j][0], gCorners[j][1], gCorners[j][2],
      );
    }

    const gGeo = this._dragGhost.geometry;
    gGeo.setAttribute('position', new THREE.Float32BufferAttribute(groundPos, 3));
    gGeo.computeBoundingSphere();
    this._dragGhost.computeLineDistances();
    this._dragGhost.material.dashSize = dash;
    this._dragGhost.material.gapSize = gap;
    this._dragGhost.visible = true;

    // —— Black dotted exact boxes at original + current AABB ——
    const boxPos = [];
    this._pushAabbEdges(
      boxPos,
      a.x - ah.x - cx, a.y - ah.y - cy, a.z - ah.z - cz,
      a.x + ah.x - cx, a.y + ah.y - cy, a.z + ah.z - cz,
    );
    this._pushAabbEdges(
      boxPos,
      -bh.x, -bh.y, -bh.z,
      bh.x, bh.y, bh.z,
    );

    const bGeo = this._dragBoxes.geometry;
    bGeo.setAttribute('position', new THREE.Float32BufferAttribute(boxPos, 3));
    bGeo.computeBoundingSphere();
    this._dragBoxes.computeLineDistances();
    this._dragBoxes.material.dashSize = Math.max(0.05, u * 1.0);
    this._dragBoxes.material.gapSize = Math.max(0.04, u * 0.65);
    this._dragBoxes.visible = true;
  }

  _layoutDropLines(half) {
    const { x: lx, y: ly, z: lz } = half;
    const cx = this._worldCenter.x;
    const cz = this._worldCenter.z;
    const bottomWorldY = this._worldCenter.y - ly;
    const corners = [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]];
    const pos = [];
    let elevated = false;
    for (const [dx, dz] of corners) {
      const wx = cx + dx;
      const wz = cz + dz;
      const ground = typeof this.getGroundY === 'function' ? +this.getGroundY(wx, wz) : 0;
      if (bottomWorldY - ground > 0.06) elevated = true;
      const localGround = ground - this._worldCenter.y;
      pos.push(dx, -ly, dz, dx, localGround, dz);
    }
    const draggingY = !!(
      this.dragging && this._drag?.handle?.kind === 'translate' && this._drag.handle.axis === 'y'
    );
    const geo = this._dropLines.geometry;
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeBoundingSphere();
    this._dropLines.computeLineDistances();
    const u = this._chrome();
    const dash = Math.max(0.06, u * 1.1);
    const gap = Math.max(0.04, u * 0.7);
    this._dropLines.material.dashSize = dash;
    this._dropLines.material.gapSize = gap;
    this._dropLines.visible = elevated || draggingY;
  }

  /**
   * When the AABB dips below terrain: dotted white-box overlay —
   * ground waterline + underground verticals + buried bottom edges.
   */
  _layoutGroundCut(half) {
    const { x: lx, y: ly, z: lz } = half;
    const cx = this._worldCenter.x;
    const cz = this._worldCenter.z;
    const bottom = -ly;
    const top = ly;
    // CCW around footprint
    const corners = [[-lx, -lz], [lx, -lz], [lx, lz], [-lx, lz]];
    const cuts = [];
    let buried = false;
    for (let i = 0; i < 4; i++) {
      const dx = corners[i][0];
      const dz = corners[i][1];
      const ground = typeof this.getGroundY === 'function' ? +this.getGroundY(cx + dx, cz + dz) : 0;
      const gLocal = ground - this._worldCenter.y;
      if (bottom < gLocal - 0.03) buried = true;
      const yCut = THREE.MathUtils.clamp(gLocal, bottom, top);
      cuts.push([dx, yCut, dz]);
    }

    const pos = [];
    if (buried) {
      // Waterline — where the box cuts the ground (dotted “white box” contour)
      for (let i = 0; i < 4; i++) {
        const a = cuts[i];
        const b = cuts[(i + 1) % 4];
        pos.push(a[0], a[1], a[2], b[0], b[1], b[2]);
      }
      // Underground vertical edges (bottom → cut)
      for (let i = 0; i < 4; i++) {
        const c = cuts[i];
        if (c[1] > bottom + 0.01) {
          pos.push(c[0], bottom, c[2], c[0], c[1], c[2]);
        }
      }
      // Buried bottom face edges
      for (let i = 0; i < 4; i++) {
        const a = corners[i];
        const b = corners[(i + 1) % 4];
        pos.push(a[0], bottom, a[1], b[0], bottom, b[1]);
      }
    }

    const geo = this._groundCut.geometry;
    if (pos.length) {
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.computeBoundingSphere();
      this._groundCut.computeLineDistances();
      const u = this._chrome();
      this._groundCut.material.dashSize = Math.max(0.06, u * 1.1);
      this._groundCut.material.gapSize = Math.max(0.04, u * 0.7);
    }
    this._groundCut.visible = buried && pos.length > 0;
  }

  _layoutHandles(half) {
    const { x: lx0, y: ly0, z: lz0 } = half;
    let lx = lx0;
    let ly = ly0;
    let lz = lz0;
    this._box.scale.set(lx, ly, lz);
    this._bodyPick.scale.set(lx, ly, lz);

    const u = this._chrome();

    // Shared stroke thickness for move arrows + rotate rings
    let ringR = Math.max(Math.hypot(lx, ly, lz) * 0.72, Math.max(lx, ly, lz) * 1.05, u * 5);
    let strokeR = Math.min(u * 0.13, ringR * 0.045);
    const arrowR = strokeR;

    const rotating = this.dragging && this.mode === 'rotate';
    // Freeze ring radius / arc placement for the whole rotate gesture
    if (rotating) {
      if (!this._rotRingLock) {
        this._rotRingLock = { radius: ringR, strokeR, lx, ly, lz };
      }
      ringR = this._rotRingLock.radius;
      strokeR = this._rotRingLock.strokeR;
      lx = this._rotRingLock.lx;
      ly = this._rotRingLock.ly;
      lz = this._rotRingLock.lz;
    } else {
      this._rotRingLock = null;
    }

    const sm = this.axisMask.scale;
    // Tiny boxes — ~0.55× chrome unit (Tinkercad-small)
    const boxWorld = u * 0.55;
    const boxScale = boxWorld / SCALE_BOX;
    this._scaleHandles.forEach((m) => {
      const h = m.userData.handle;
      const d = h.dir;
      // Scale handles track live AABB (use current half, not locked ring half)
      const hx = lx0; const hy = ly0; const hz = lz0;
      if (h.role === 'top-height') m.position.set(0, hy, 0);
      else m.position.set(d.x * hx, d.y * hy, d.z * hz);
      const ax = [h.axes[0] && sm.x ? 1 : 0, h.axes[1] && sm.y ? 1 : 0, h.axes[2] && sm.z ? 1 : 0];
      h.liveAxes = ax;
      m.visible = !!(ax[0] || ax[1] || ax[2]);
      // Edge mids slightly smaller than corners / top
      m.scale.setScalar(h.role === 'bottom-edge' ? boxScale * 0.85 : boxScale);
    });

    // Move: from CENTER. Slightly short of the faces so Y doesn't cover the top scale box.
    const reach = 0.88;
    const minLen = u * 5.2;
    const yClear = boxWorld * 1.35; // leave room for top white box
    this._tX.position.set(0, 0, 0);
    this._tY.position.set(0, 0, 0);
    this._tZ.position.set(0, 0, 0);
    this._tX.userData.setLength(Math.max(lx0 * reach, minLen), arrowR);
    this._tY.userData.setLength(Math.max(ly0 * reach - yClear, minLen * 0.65), arrowR);
    this._tZ.userData.setLength(Math.max(lz0 * reach, minLen), arrowR);
    this._tX.visible = !rotating && this.showX && this.axisMask.translate.x;
    this._tY.visible = !rotating && this.showY && this.axisMask.translate.y;
    this._tZ.visible = !rotating && this.showZ && this.axisMask.translate.z;

    // Full XYZ axis lines through center (ring colors) while rotating — locked span
    const axisLen = Math.max(ringR * 1.25, Math.max(lx, ly, lz) * 1.35, u * 8);
    this._axisLineX.userData.setSpan(axisLen);
    this._axisLineY.userData.setSpan(axisLen);
    this._axisLineZ.userData.setSpan(axisLen);
    this._axisLineX.visible = rotating && this.showX && this.axisMask.rotate.x;
    this._axisLineY.visible = rotating && this.showY && this.axisMask.rotate.y;
    this._axisLineZ.visible = rotating && this.showZ && this.axisMask.rotate.z;

    // π/3 arcs: green ahead of red (+Z); red/blue above green, pushed to opposite box sides
    this._ensureRotateArcs(ringR, strokeR);
    this._rY.position.set(0, 0, 0);           // green — stays centered, mid at +Z
    this._rX.position.set(-lx, 0, 0);          // red — opposite +X arrow, height unchanged
    this._rZ.position.set(0, 0, -lz);          // blue — opposite +Z arrow, height unchanged
    this._rX.visible = this.showX && this.axisMask.rotate.x;
    this._rY.visible = this.showY && this.axisMask.rotate.y;
    this._rZ.visible = this.showZ && this.axisMask.rotate.z;

    this._layoutDropLines({ x: lx0, y: ly0, z: lz0 });
    this._layoutGroundCut({ x: lx0, y: ly0, z: lz0 });
  }

  _refreshLayout() {
    if (!this.object) return;
    if (!this._boundsValid) this._captureRestBounds();
    this.object.updateMatrixWorld(true);
    this._followObject();
    this._layoutHandles(this._worldHalf);
  }

  _owner(obj) {
    let o = obj;
    while (o && o !== this._handles) {
      if (o.userData?.handle) return o;
      o = o.parent;
    }
    return null;
  }

  _pick(e) {
    if (!this.object || !this.enabled || !this.root.visible) return null;
    this._setPointer(e);
    this._raycaster.setFromCamera(this._pointer, this.camera);
    const hits = this._raycaster.intersectObject(this._handles, true);
    for (const h of hits) {
      const mesh = this._owner(h.object);
      if (mesh && mesh.visible !== false) {
        return { mesh, handle: mesh.userData.handle, point: h.point };
      }
    }
    return null;
  }

  /** Hit the selected object or its AABB — for XZ body drag */
  _pickBody(e) {
    if (!this.object || !this.enabled || !this.root.visible) return null;
    this._setPointer(e);
    this._raycaster.setFromCamera(this._pointer, this.camera);
    const meshHits = this._raycaster.intersectObject(this.object, true);
    for (const h of meshHits) {
      if (skipBounds(h.object)) continue;
      if (h.object === this._bodyPick) continue;
      return h;
    }
    const boxHits = this._raycaster.intersectObject(this._bodyPick, false);
    return boxHits[0] || null;
  }

  /** Mouse ray ∩ horizontal plane at world Y → point (or null) */
  _hitXZPlane(e, planeY) {
    this._setPointer(e);
    this._raycaster.setFromCamera(this._pointer, this.camera);
    this._plane.set(new THREE.Vector3(0, 1, 0), -planeY);
    if (!this._raycaster.ray.intersectPlane(this._plane, this._planeHit)) return null;
    return this._planeHit;
  }

  _worldAxisToNdc(worldAxis) {
    const o = this.root.getWorldPosition(this._tmpV);
    const t = this._tmpV2.copy(o).addScaledVector(worldAxis, 1);
    o.project(this.camera);
    t.project(this.camera);
    this._ndc0.set(t.x - o.x, t.y - o.y);
    if (this._ndc0.lengthSq() < 1e-8) return new THREE.Vector2(1, 0);
    return this._ndc0.clone().normalize();
  }

  /**
   * Mouse ray ∩ plane through center, ⊥ to axis → unit vector in the ring plane.
   * Returns null if the ray misses / grazes (axis nearly parallel to view).
   */
  _rotPointerVec(e, center, axis) {
    this._setPointer(e);
    this._raycaster.setFromCamera(this._pointer, this.camera);
    this._plane.setFromNormalAndCoplanarPoint(axis, center);
    const hit = this._rotVec;
    if (!this._raycaster.ray.intersectPlane(this._plane, hit)) return null;
    hit.sub(center);
    hit.addScaledVector(axis, -hit.dot(axis));
    if (hit.lengthSq() < 1e-10) return null;
    return hit.normalize();
  }

  /** Signed angle from `from` → `to` around `axis` (radians, −π..π). */
  _signedAngleAround(from, to, axis) {
    this._rotCross.crossVectors(from, to);
    return Math.atan2(this._rotCross.dot(axis), from.dot(to));
  }

  _onPointerDown(e) {
    if (!this.enabled || !this.object || e.button !== 0) return;
    const handleHit = this._pick(e);
    let handle = handleHit?.handle || null;
    if (!handle) {
      if (!this.axisMask.translate.x && !this.axisMask.translate.z) return;
      if (!this._pickBody(e)) return;
      handle = { kind: 'translate', axis: 'xz', role: 'body-xz' };
    }

    e.stopImmediatePropagation();
    e.preventDefault();

    this.mode = handle.kind;
    this.dragging = true;

    const obj = this.object;
    if (!this._boundsValid) this._captureRestBounds();
    obj.updateMatrixWorld(true);
    this._refreshLayout();

    const half = { ...this._worldHalf };
    const axes = (handle.liveAxes || handle.axes || [1, 1, 1]).slice();
    const dir = handle.dir ? handle.dir.clone() : new THREE.Vector3();

    // World-AABB face opposite the handle stays fixed while scaling
    const anchorWorld = this._worldCenter.clone();
    if (handle.role === 'top-height') {
      anchorWorld.y = this._worldCenter.y - this._worldHalf.y;
    } else if (dir.lengthSq() > 0) {
      if (axes[0]) anchorWorld.x = this._worldCenter.x - dir.x * this._worldHalf.x;
      if (axes[1]) anchorWorld.y = this._worldCenter.y - dir.y * this._worldHalf.y;
      if (axes[2]) anchorWorld.z = this._worldCenter.z - dir.z * this._worldHalf.z;
    }

    // Always world axes — gizmo never inherits object rotation
    const worldAxis = new THREE.Vector3(
      handle.axis === 'x' ? 1 : 0,
      handle.axis === 'y' ? 1 : 0,
      handle.axis === 'z' ? 1 : 0,
    );

    const rect = this.domElement.getBoundingClientRect();
    const rotCenter = this._worldCenter.clone();
    let rotPrevVec = null;
    let rotUsePlane = false;
    if (handle.kind === 'rotate') {
      const v = this._rotPointerVec(e, rotCenter, worldAxis);
      if (v) {
        rotPrevVec = v.clone();
        rotUsePlane = true;
      }
      this._rX.userData.setPressed?.(handle.axis === 'x');
      this._rY.userData.setPressed?.(handle.axis === 'y');
      this._rZ.userData.setPressed?.(handle.axis === 'z');
    }

    this._drag = {
      handle,
      pointerId: e.pointerId,
      startPos: obj.position.clone(),
      startQuat: obj.quaternion.clone(),
      startScale: obj.scale.clone(),
      half,
      axes,
      dir,
      anchorWorld,
      restHalf: { ...this._restHalf },
      restCenter: this._restCenter.clone(),
      worldAxis,
      screenAxis: this._worldAxisToNdc(worldAxis),
      clientX0: e.clientX,
      clientY0: e.clientY,
      clientXPrev: e.clientX,
      clientYPrev: e.clientY,
      rectW: rect.width,
      rectH: rect.height,
      camDist: this.camera.getWorldPosition(this._tmpV3).distanceTo(this.root.position),
      worldAxes: {
        x: new THREE.Vector3(1, 0, 0),
        y: new THREE.Vector3(0, 1, 0),
        z: new THREE.Vector3(0, 0, 1),
      },
      rotCenter,
      rotPrevVec,
      rotUsePlane,
      rotAccum: 0,
      planeY: obj.position.y,
      grabOffset: new THREE.Vector3(),
    };

    if (handle.role === 'body-xz') {
      this._drag.planeY = this._worldCenter.y;
      const hit = this._hitXZPlane(e, this._drag.planeY);
      if (hit) {
        this._drag.grabOffset.set(obj.position.x - hit.x, 0, obj.position.z - hit.z);
      }
    }

    if (handle.kind === 'translate') {
      this._drag.startWorldCenter = this._worldCenter.clone();
      this._drag.startWorldHalf = { ...this._worldHalf };
      if (this.followTerrain && typeof this.getGroundY === 'function') {
        const gy0 = this.getGroundY(obj.position.x, obj.position.z);
        this._drag.terrainYOffset = Number.isFinite(gy0) ? obj.position.y - gy0 : 0;
      }
    }

    window.addEventListener('pointermove', this._onWinMove, true);
    window.addEventListener('pointerup', this._onWinUp, true);
    window.addEventListener('pointercancel', this._onWinUp, true);
    this.dispatchEvent({ type: 'dragging-changed', value: true });
  }

  _onHover(e) {
    if (this.dragging) return;
    const hit = this._pick(e);
    if (this._hover && this._hover !== hit?.mesh) {
      this._setHover(this._hover, false);
      this._hover = null;
    }
    if (hit?.mesh && hit.mesh !== this._hover) {
      this._hover = hit.mesh;
      this._setHover(hit.mesh, true);
    }
  }

  _setHover(mesh, on) {
    const paint = (m) => {
      if (!m?.color) return;
      if (on) {
        if (m.userData._base == null) m.userData._base = m.color.getHex();
        m.color.setHex(COL.hover);
      } else if (m.userData._base != null) m.color.setHex(m.userData._base);
    };
    if (mesh.userData?._arcMats) mesh.userData._arcMats.forEach(paint);
    else mesh.traverse((c) => { if (c.isMesh && c.material) paint(c.material); });
  }

  _onWinMove(e) {
    if (!this.dragging || !this._drag || e.pointerId !== this._drag.pointerId) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    this._applyDrag(e);
  }

  _applyDrag(e) {
    const d = this._drag;
    const obj = this.object;
    if (!d || !obj) return;

    const dx = e.clientX - d.clientX0;
    const dy = e.clientY - d.clientY0;
    const mx = dx / Math.max(1, d.rectW) * 2;
    const my = -dy / Math.max(1, d.rectH) * 2;
    const shift = !!e.shiftKey;

    if (d.handle.kind === 'translate') {
      if (d.handle.role === 'body-xz') {
        // Drag object on horizontal plane — XZ follow cursor; Y rides heightmap
        const hit = this._hitXZPlane(e, d.planeY);
        if (hit) {
          const allowX = this.axisMask.translate.x;
          const allowZ = this.axisMask.translate.z;
          if (allowX) obj.position.x = hit.x + d.grabOffset.x;
          if (allowZ) obj.position.z = hit.z + d.grabOffset.z;
        }
      } else {
        const along = mx * d.screenAxis.x + my * d.screenAxis.y;
        obj.position.copy(d.startPos).addScaledVector(d.worldAxis, along * d.camDist * 0.85);
      }
      // Horizontal move (X / Z / body): keep height relative to heightmap.
      // Pure Y arrow leaves Y free. Proxies (terrain) leave followTerrain off.
      const axis = d.handle.axis;
      const horizontal = d.handle.role === 'body-xz' || axis === 'x' || axis === 'z' || axis === 'xz';
      if (this.followTerrain && horizontal && typeof this.getGroundY === 'function' && d.terrainYOffset != null) {
        const gy = this.getGroundY(obj.position.x, obj.position.z);
        if (Number.isFinite(gy)) obj.position.y = gy + d.terrainYOffset;
      }
      obj.updateMatrixWorld(true);
      this._followObject();
      this._layoutDropLines(this._worldHalf);
      this._layoutGroundCut(this._worldHalf);
      this._layoutDragGhost();
    } else if (d.handle.kind === 'rotate') {
      // Circular drag in the plane ⊥ to the axis — accumulates past ±90°/180°
      let ang;
      if (d.rotUsePlane && d.rotPrevVec) {
        const curr = this._rotPointerVec(e, d.rotCenter, d.worldAxis);
        if (curr) {
          d.rotAccum += this._signedAngleAround(d.rotPrevVec, curr, d.worldAxis);
          d.rotPrevVec.copy(curr);
        }
        ang = d.rotAccum;
      } else {
        // Fallback when axis ≈ view direction: tangential screen motion
        const dx = e.clientX - d.clientXPrev;
        const dy = e.clientY - d.clientYPrev;
        d.clientXPrev = e.clientX;
        d.clientYPrev = e.clientY;
        const tx = -d.screenAxis.y;
        const ty = d.screenAxis.x;
        const along = (dx * tx + dy * ty) / Math.max(1, d.rectW);
        d.rotAccum += along * Math.PI * 2.2;
        ang = d.rotAccum;
      }
      if (shift) ang = Math.round(ang / ROT_SNAP) * ROT_SNAP;
      obj.quaternion.copy(
        new THREE.Quaternion().setFromAxisAngle(d.worldAxis, ang).multiply(d.startQuat),
      );
      obj.rotation.setFromQuaternion(obj.quaternion);
      obj.updateMatrixWorld(true);
      // AABB reshapes; arrows/boxes stay world-aligned
      this._followObject();
      this._layoutHandles(this._worldHalf);
    } else if (d.handle.kind === 'scale') {
      const factor = { x: 1, y: 1, z: 1 };
      ['x', 'y', 'z'].forEach((ax, i) => {
        if (!d.axes[i]) return;
        const scr = this._worldAxisToNdc(d.worldAxes[ax]);
        const sign = !d.dir || d.dir[ax] === 0 ? 1 : (d.dir[ax] > 0 ? 1 : -1);
        const along = (mx * scr.x + my * scr.y) * sign;
        const oldSpan = Math.max(0.08, 2 * d.half[ax]);
        factor[ax] = Math.max(0.08, oldSpan + along * d.camDist * 0.7) / oldSpan;
      });
      if (shift && d.handle.role === 'bottom-corner') {
        const sx = Math.abs(factor.x - 1);
        const sz = Math.abs(factor.z - 1);
        const f = sx >= sz ? factor.x : factor.z;
        if (d.axes[0]) factor.x = f;
        if (d.axes[2]) factor.z = f;
      }
      obj.scale.set(
        Math.max(0.05, d.startScale.x * factor.x),
        Math.max(0.05, d.startScale.y * factor.y),
        Math.max(0.05, d.startScale.z * factor.z),
      );
      obj.position.copy(d.startPos);
      obj.updateMatrixWorld(true);
      this._updateWorldBounds();

      // Keep the opposite world-AABB face pinned
      const desired = this._worldCenter.clone();
      const h = this._worldHalf;
      if (d.handle.role === 'top-height') {
        desired.y = d.anchorWorld.y + h.y;
      } else {
        ['x', 'y', 'z'].forEach((ax, i) => {
          if (!d.axes[i] || !d.dir || d.dir[ax] === 0) return;
          desired[ax] = d.anchorWorld[ax] + d.dir[ax] * h[ax];
        });
      }
      obj.position.x += desired.x - this._worldCenter.x;
      obj.position.y += desired.y - this._worldCenter.y;
      obj.position.z += desired.z - this._worldCenter.z;
      obj.updateMatrixWorld(true);
      this._followObject();
      this._layoutHandles(this._worldHalf);
    }

    this.dispatchEvent({ type: 'objectChange' });
  }

  _onWinUp(e) {
    if (!this.dragging || !this._drag || e.pointerId !== this._drag.pointerId) return;
    this._endDragListeners();
    this.dragging = false;
    this._drag = null;
    this._rotRingLock = null;
    this._rX.userData.setPressed?.(false);
    this._rY.userData.setPressed?.(false);
    this._rZ.userData.setPressed?.(false);
    this._hideDragGhost();
    this.dispatchEvent({ type: 'dragging-changed', value: false });
    this._refreshLayout();
  }
}
