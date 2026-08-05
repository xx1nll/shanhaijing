"""仙侠 archer — hand-built from geometric shapes only.

Design rules (from reference sheet):
  - ONE upright silhouette, few overlapping forms (not a toy pile)
  - Character RIGHT arm bare + muscular  (viewer's left, x < 0)
  - Character LEFT arm: gold pauldron + hanging sleeve (viewer's right, x > 0)
  - Lower: black pants → black mid tabard/scales → open red robe panels
  - Compact topknot; long hair only down the back
  - Gold = trim/embroidery, never blobs at the hands
  - Wide stance, chest upright (no hunch)
"""
import bpy
import bmesh
import math
from mathutils import Vector


def clear_keep_lights():
    keep = {"Camera", "Key", "Fill", "Rim"}
    for obj in list(bpy.data.objects):
        if obj.name in keep:
            continue
        data = obj.data
        bpy.data.objects.remove(obj, do_unlink=True)
        if data and getattr(data, "users", 1) == 0:
            if isinstance(data, bpy.types.Mesh):
                bpy.data.meshes.remove(data)
            elif isinstance(data, bpy.types.Curve):
                bpy.data.curves.remove(data)
    for m in list(bpy.data.materials):
        if m.users == 0:
            bpy.data.materials.remove(m)


def mat(name, color, rough=0.42, metallic=0.0, sss=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    if "Roughness" in bsdf.inputs:
        bsdf.inputs["Roughness"].default_value = rough
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = metallic
    if sss > 0:
        for key in ("Subsurface Weight", "Subsurface"):
            if key in bsdf.inputs:
                bsdf.inputs[key].default_value = sss
                break
    m.diffuse_color = (*color[:3], 1.0)
    return m


def shade(obj, levels=1):
    if obj.type == "MESH":
        for p in obj.data.polygons:
            p.use_smooth = True
    for mod in list(obj.modifiers):
        if mod.type == "SUBSURF":
            obj.modifiers.remove(mod)
    if levels > 0 and obj.type == "MESH":
        s = obj.modifiers.new("Subdivision", "SUBSURF")
        s.levels = levels
        s.render_levels = levels + 1
    return obj


def parent(obj, root, matl=None):
    obj.parent = root
    if matl and obj.type in {"MESH", "CURVE"}:
        if obj.data.materials:
            obj.data.materials[0] = matl
        else:
            obj.data.materials.append(matl)
    return obj


def from_bm(name, bm, root, matl, levels=1):
    me = bpy.data.meshes.new(name + "_mesh")
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    parent(obj, root, matl)
    return shade(obj, levels)


def lathe(name, profile, root, matl, segs=18, levels=1, y_scale=1.0):
    """Revolve profile (radius, z) around Z, optionally flatten on Y."""
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        ring = []
        for i in range(segs):
            a = (i / segs) * math.tau
            ring.append(bm.verts.new((math.cos(a) * r, math.sin(a) * r * y_scale, z)))
        rings.append(ring)
    bm.verts.ensure_lookup_table()
    for ri in range(len(rings) - 1):
        for i in range(segs):
            a, b = rings[ri][i], rings[ri][(i + 1) % segs]
            c, d = rings[ri + 1][(i + 1) % segs], rings[ri + 1][i]
            try:
                bm.faces.new((a, b, c, d))
            except ValueError:
                pass
    if profile[0][0] > 1e-5:
        try:
            bm.faces.new(list(reversed(rings[0])))
        except ValueError:
            pass
    if profile[-1][0] > 1e-5:
        try:
            bm.faces.new(rings[-1])
        except ValueError:
            pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return from_bm(name, bm, root, matl, levels)


def capsule(name, loc, radius, depth, root, matl, axis="Z", levels=1, scale=(1, 1, 1)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=1.0)
    for v in bm.verts:
        x, y, z = v.co
        if axis == "Z":
            v.co = Vector((x * radius * scale[0], y * radius * scale[1],
                           z * depth * 0.5 * scale[2]))
        elif axis == "X":
            v.co = Vector((z * depth * 0.5 * scale[0], y * radius * scale[1],
                           x * radius * scale[2]))
        else:
            v.co = Vector((x * radius * scale[0], z * depth * 0.5 * scale[1],
                           y * radius * scale[2]))
    obj = from_bm(name, bm, root, matl, levels)
    obj.location = loc
    return obj


def panel(name, w, h, d, loc, root, matl, levels=1, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= w
        v.co.y *= d
        v.co.z *= h
    obj = from_bm(name, bm, root, matl, levels)
    obj.location = loc
    obj.rotation_euler = rot
    return obj


def tube(name, pts, radius, root, matl):
    """Continuous limb / trim path — reads as one piece."""
    curve = bpy.data.curves.new(name + "_data", "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 16
    curve.bevel_depth = radius
    curve.bevel_resolution = 4
    curve.fill_mode = "FULL"
    spline = curve.splines.new("NURBS")
    spline.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        spline.points[i].co = (*p, 1.0)
    spline.use_endpoint_u = True
    spline.order_u = min(4, len(pts))
    obj = bpy.data.objects.new(name, curve)
    bpy.context.scene.collection.objects.link(obj)
    return parent(obj, root, matl)


def look_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def ensure_lights_camera():
    scene = bpy.context.scene
    if "Camera" not in bpy.data.objects:
        cam = bpy.data.objects.new("Camera", bpy.data.cameras.new("Camera"))
        scene.collection.objects.link(cam)
        scene.camera = cam
    else:
        scene.camera = bpy.data.objects["Camera"]

    def add_area(name, energy, size, loc, color):
        if name in bpy.data.objects:
            return
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.size = size
        data.color = color
        obj = bpy.data.objects.new(name, data)
        scene.collection.objects.link(obj)
        obj.location = loc
        look_at(obj, (0, 0, 1.0))

    add_area("Key", 280, 2.8, (2.4, 2.8, 3.2), (1.0, 0.96, 0.9))
    add_area("Fill", 90, 3.5, (-2.6, 1.6, 2.2), (0.88, 0.92, 1.0))
    add_area("Rim", 140, 2.2, (0.2, -3.0, 2.5), (1.0, 0.85, 0.65))


def build():
    clear_keep_lights()
    ensure_lights_camera()

    M_SKIN = mat("Skin", (0.90, 0.74, 0.60), rough=0.45, sss=0.12)
    M_HAIR = mat("Hair", (0.035, 0.03, 0.035), rough=0.28)
    M_BLACK = mat("Charcoal", (0.09, 0.08, 0.09), rough=0.44)
    M_GOLD = mat("Gold", (0.92, 0.70, 0.18), rough=0.18, metallic=0.9)
    M_RED = mat("Crimson", (0.55, 0.07, 0.11), rough=0.38)
    M_RED2 = mat("CrimsonDark", (0.32, 0.04, 0.07), rough=0.42)
    M_LEATHER = mat("Leather", (0.40, 0.24, 0.12), rough=0.55)
    M_ARROW = mat("ArrowWood", (0.52, 0.36, 0.18), rough=0.45)
    M_FLETCH = mat("Feather", (0.92, 0.90, 0.85), rough=0.35)
    M_STRING = mat("String", (0.06, 0.05, 0.05), rough=0.5)

    root = bpy.data.objects.new("XianxiaArcher", None)
    bpy.context.scene.collection.objects.link(root)

    world = bpy.context.scene.world or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.82, 0.82, 0.80, 1)
        bg.inputs[1].default_value = 1.0

    # =========================================================
    # HEAD — skin face visible from front; hair on top/back only
    # =========================================================
    lathe("Head", [
        (0.015, 1.76), (0.055, 1.74), (0.095, 1.68), (0.102, 1.60),
        (0.095, 1.52), (0.065, 1.46), (0.028, 1.43),
    ], root, M_SKIN, segs=18, y_scale=0.88)

    capsule("Neck", (0, -0.01, 1.39), 0.038, 0.08, root, M_SKIN)

    # scalp pulled back so face stays readable
    scalp = lathe("Scalp", [
        (0.02, 1.72), (0.08, 1.74), (0.105, 1.70), (0.108, 1.62),
        (0.08, 1.56), (0.03, 1.54),
    ], root, M_HAIR, segs=14, y_scale=0.85)
    scalp.location = (0, -0.04, 0)

    lathe("Topknot", [
        (0.012, 1.72), (0.045, 1.73), (0.055, 1.76), (0.048, 1.785),
        (0.022, 1.795), (0.008, 1.80),
    ], root, M_HAIR, segs=12, y_scale=0.75).location = (0, -0.04, 0)

    lathe("GuanBand", [
        (0.048, 1.725), (0.062, 1.732), (0.060, 1.745), (0.046, 1.750),
    ], root, M_GOLD, segs=12, levels=0).location = (0, -0.04, 0)

    lathe("HairBack", [
        (0.025, 1.58), (0.08, 1.40), (0.09, 1.10), (0.08, 0.80),
        (0.055, 0.50), (0.025, 0.25), (0.01, 0.12),
    ], root, M_HAIR, segs=12, y_scale=0.35).location = (0, -0.16, 0)

    for sx, side in ((-1, "R"), (1, "L")):
        tube(f"SideLock_{side}", [
            (sx * 0.08, 0.01, 1.60),
            (sx * 0.09, 0.02, 1.35),
            (sx * 0.08, 0.0, 1.10),
            (sx * 0.06, -0.02, 0.90),
        ], 0.010, root, M_HAIR)

    panel("ForeheadJewel", 0.014, 0.018, 0.007, (0, 0.095, 1.67), root, M_GOLD, levels=0)

    # =========================================================
    # TORSO skin + OPEN-FRONT ROBE (pants visible through front)
    # =========================================================
    lathe("Torso", [
        (0.04, 1.35), (0.12, 1.28), (0.16, 1.16), (0.17, 1.02),
        (0.16, 0.90), (0.15, 0.78), (0.13, 0.65), (0.10, 0.52),
    ], root, M_SKIN, segs=18, y_scale=0.85).location = (0, -0.01, 0)

    panel("ChestFront", 0.28, 0.42, 0.04, (0, 0.12, 1.10), root, M_BLACK, levels=1)

    # robe = back + sides only (~140° front opening)
    open_half = math.radians(70)
    a0 = math.pi / 2 + open_half
    a1 = math.pi / 2 - open_half + math.tau
    bm = bmesh.new()
    robe_profile = [
        (0.14, 1.32), (0.18, 1.18), (0.20, 1.02), (0.21, 0.88),
        (0.22, 0.72), (0.21, 0.55), (0.19, 0.40), (0.16, 0.28),
    ]
    n_arc = 16
    rings = []
    for r, z in robe_profile:
        ring = []
        for i in range(n_arc):
            t = i / (n_arc - 1)
            a = a0 + (a1 - a0) * t
            ring.append(bm.verts.new((math.cos(a) * r, math.sin(a) * r * 0.95, z)))
        rings.append(ring)
    bm.verts.ensure_lookup_table()
    for ri in range(len(rings) - 1):
        for i in range(n_arc - 1):
            a, b = rings[ri][i], rings[ri][i + 1]
            c, d = rings[ri + 1][i + 1], rings[ri + 1][i]
            try:
                bm.faces.new((a, b, c, d))
            except ValueError:
                pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("Robe_mesh")
    bm.to_mesh(me)
    bm.free()
    robe_obj = bpy.data.objects.new("Robe", me)
    bpy.context.scene.collection.objects.link(robe_obj)
    parent(robe_obj, root, M_BLACK)
    shade(robe_obj, 1)

    for sx, side in ((-1, "R"), (1, "L")):
        panel(f"RobeFlap_{side}", 0.06, 0.50, 0.012,
              (sx * 0.20, 0.04, 0.52), root, M_BLACK,
              rot=(math.radians(6), 0, math.radians(sx * 35)))

    tube("ChestGold_L", [
        (-0.02, 0.15, 1.26), (-0.07, 0.16, 1.12), (-0.08, 0.15, 0.98), (-0.03, 0.14, 0.92),
    ], 0.0035, root, M_GOLD)
    tube("ChestGold_R", [
        (0.02, 0.15, 1.26), (0.07, 0.16, 1.12), (0.08, 0.15, 0.98), (0.03, 0.14, 0.92),
    ], 0.0035, root, M_GOLD)

    lathe("WaistSash", [
        (0.14, 0), (0.185, 0.006), (0.195, 0.03), (0.185, 0.045), (0.14, 0.05),
    ], root, M_RED, segs=18, y_scale=0.70).location = (0, 0, 0.90)

    lathe("Belt", [
        (0.15, 0), (0.195, 0.004), (0.205, 0.028), (0.195, 0.038), (0.15, 0.042),
    ], root, M_BLACK, segs=18, y_scale=0.70).location = (0, 0, 0.93)

    buckle = lathe("BeltBuckle", [
        (0.01, -0.006), (0.042, 0), (0.038, 0.01), (0.012, 0.012),
    ], root, M_GOLD, segs=12, levels=0)
    buckle.location = (0, 0.125, 0.92)
    buckle.rotation_euler = (math.radians(90), 0, 0)

    # =========================================================
    # RIGHT ARM (character right, x<0) — ONE continuous bare arm
    # =========================================================
    # shoulder volume
    capsule("Shoulder_R", (-0.175, -0.02, 1.27), 0.052, 0.095, root, M_SKIN, axis="X",
            scale=(1.0, 0.85, 1.0))

    # gold pauldron plate on bare shoulder (sheet)
    pad = lathe("Pauldron_R", [
        (0.02, 0), (0.055, 0.012), (0.072, 0.045), (0.055, 0.075), (0.02, 0.085),
    ], root, M_GOLD, segs=12, levels=0, y_scale=0.65)
    pad.location = (-0.20, -0.02, 1.31)
    pad.rotation_euler = (math.radians(-6), math.radians(-18), math.radians(6))

    tube("Arm_R", [
        (-0.18, -0.02, 1.27),
        (-0.25, 0.00, 1.08),
        (-0.30, 0.02, 0.88),
        (-0.32, 0.04, 0.68),
        (-0.33, 0.05, 0.52),
    ], 0.045, root, M_SKIN)

    bicep = lathe("Bicep_R", [
        (0.025, 0), (0.050, 0.03), (0.058, 0.10), (0.052, 0.18), (0.032, 0.24),
    ], root, M_SKIN, segs=12, y_scale=0.8)
    bicep.location = (-0.27, 0.01, 0.95)
    bicep.rotation_euler = (math.radians(5), math.radians(-6), 0)

    bracer = lathe("Bracer_R", [
        (0.024, 0), (0.034, 0.01), (0.036, 0.07), (0.032, 0.11), (0.024, 0.12),
    ], root, M_BLACK, segs=10, levels=1)
    bracer.location = (-0.34, 0.06, 0.46)
    tube("BracerTrim_R", [
        (-0.34, 0.08, 0.56), (-0.35, 0.09, 0.52), (-0.35, 0.09, 0.48), (-0.34, 0.08, 0.45),
    ], 0.0028, root, M_GOLD)

    hand = lathe("Hand_R", [
        (0.01, 0), (0.024, 0.008), (0.030, 0.028), (0.026, 0.048), (0.012, 0.055),
    ], root, M_SKIN, segs=10, y_scale=0.55)
    hand.location = (-0.35, 0.07, 0.38)

    # =========================================================
    # LEFT ARM (character left, x>0) — pauldron + hanging sleeve
    # =========================================================
    under = lathe("PauldronUnder_L", [
        (0.025, 0), (0.075, 0.02), (0.095, 0.065), (0.075, 0.10), (0.025, 0.11),
    ], root, M_RED, segs=12, levels=1)
    under.location = (0.21, -0.02, 1.30)
    under.scale = (0.82, 0.82, 0.82)
    under.rotation_euler = (math.radians(-4), math.radians(14), math.radians(-4))

    pauldron = lathe("Pauldron_L", [
        (0.02, 0.01), (0.07, 0.025), (0.100, 0.07), (0.085, 0.12),
        (0.045, 0.14), (0.012, 0.11),
    ], root, M_GOLD, segs=14, levels=1)
    pauldron.location = (0.21, -0.01, 1.32)
    pauldron.scale = (0.82, 0.82, 0.82)
    pauldron.rotation_euler = (math.radians(-4), math.radians(16), math.radians(-5))

    capsule("Shoulder_L", (0.175, -0.02, 1.27), 0.042, 0.075, root, M_BLACK, axis="X")

    sleeve = lathe("RobeSleeve_L", [
        (0.035, 1.28), (0.050, 1.14), (0.070, 0.98), (0.090, 0.80),
        (0.100, 0.64), (0.095, 0.54), (0.070, 0.48),
    ], root, M_BLACK, segs=14, y_scale=0.70)
    sleeve.location = (0.24, 0.02, 0)

    lining = lathe("SleeveLining_L", [
        (0.050, 0.56), (0.090, 0.53), (0.095, 0.50), (0.065, 0.47),
    ], root, M_RED, segs=12, y_scale=0.70)
    lining.location = (0.24, 0.03, 0)

    cuff = lathe("SleeveCuffTrim_L", [
        (0.075, 0.485), (0.100, 0.490), (0.095, 0.500), (0.070, 0.502),
    ], root, M_GOLD, segs=12, levels=0, y_scale=0.70)
    cuff.location = (0.24, 0.03, 0)

    tube("SleevePattern_L", [
        (0.27, 0.05, 1.10), (0.30, 0.06, 0.90), (0.32, 0.06, 0.70), (0.33, 0.05, 0.55),
    ], 0.0028, root, M_GOLD)

    bracer_l = lathe("Bracer_L", [
        (0.020, 0), (0.028, 0.01), (0.030, 0.05), (0.028, 0.085), (0.020, 0.095),
    ], root, M_BLACK, segs=10, levels=1)
    bracer_l.location = (0.29, 0.06, 0.45)
    tube("BracerTrim_L", [
        (0.29, 0.08, 0.52), (0.30, 0.085, 0.49), (0.30, 0.085, 0.46), (0.29, 0.08, 0.44),
    ], 0.0025, root, M_GOLD)

    hand_l = lathe("Hand_L", [
        (0.01, 0), (0.020, 0.008), (0.026, 0.025), (0.022, 0.042), (0.010, 0.050),
    ], root, M_SKIN, segs=10, y_scale=0.55)
    hand_l.location = (0.30, 0.07, 0.38)

    # =========================================================
    # LEGS — wide stance + three layers
    # =========================================================
    # =========================================================
    # LEGS — thick pants visible through open robe front
    # =========================================================
    HIP = 0.18
    for sx, side in ((-1, "R"), (1, "L")):
        capsule(f"Thigh_{side}", (sx * HIP, 0.03, 0.50), 0.085, 0.40, root, M_BLACK)
        capsule(f"Shin_{side}", (sx * HIP, 0.04, 0.18), 0.065, 0.28, root, M_BLACK)

        boot = lathe(f"Boot_{side}", [
            (0.022, 0), (0.058, 0.012), (0.065, 0.05), (0.060, 0.095),
            (0.042, 0.125), (0.02, 0.135),
        ], root, M_BLACK, segs=12)
        boot.location = (sx * HIP, 0.08, 0.0)

        toe = lathe(f"BootToe_{side}", [
            (0.012, 0), (0.035, 0.01), (0.040, 0.025), (0.018, 0.04),
        ], root, M_GOLD, segs=8, levels=0)
        toe.location = (sx * HIP, 0.14, 0.025)
        toe.rotation_euler = (math.radians(90), 0, 0)

        tube(f"ShinGold_{side}", [
            (sx * HIP, 0.10, 0.30),
            (sx * (HIP + 0.03), 0.11, 0.22),
            (sx * HIP, 0.10, 0.14),
            (sx * (HIP + 0.022), 0.11, 0.08),
        ], 0.004, root, M_GOLD)

    panel("FrontTabard", 0.10, 0.55, 0.012, (0, 0.15, 0.45), root, M_BLACK,
          rot=(math.radians(2), 0, 0))
    emblem = lathe("TabardEmblem", [
        (0.006, -0.004), (0.026, 0), (0.020, 0.008),
    ], root, M_GOLD, segs=10, levels=0)
    emblem.location = (0, 0.165, 0.52)
    emblem.rotation_euler = (math.radians(90), 0, 0)

    for sx, side in ((-1, "R"), (1, "L")):
        panel(f"MidFlap_{side}", 0.06, 0.30, 0.012,
              (sx * 0.12, 0.10, 0.62), root, M_BLACK,
              rot=(math.radians(4), 0, math.radians(sx * 8)))
        panel(f"Scale_{side}", 0.05, 0.12, 0.014,
              (sx * 0.14, 0.12, 0.74), root, M_GOLD, levels=0,
              rot=(math.radians(5), 0, math.radians(sx * 8)))

    # flat red cape (wide, NOT a curved turtle shell)
    panel("Cape", 0.95, 0.88, 0.006, (0.0, -0.195, 0.58), root, M_RED,
          rot=(math.radians(2), 0, 0), levels=0)
    panel("CapeSide_L", 0.14, 0.82, 0.005, (0.48, -0.195, 0.55), root, M_RED,
          rot=(math.radians(2), 0, math.radians(-3)), levels=0)
    panel("CapeSide_R", 0.14, 0.82, 0.005, (-0.48, -0.195, 0.55), root, M_RED,
          rot=(math.radians(2), 0, math.radians(3)), levels=0)
    tube("CapeHem", [
        (-0.55, -0.20, 0.14), (0.0, -0.20, 0.12), (0.55, -0.20, 0.14),
    ], 0.003, root, M_GOLD)

    # =========================================================
    # BACK: bow (pure C/D arc — never an S) + quiver
    # =========================================================
    bx, z_lo, z_hi, z_mid = 0.30, 0.32, 1.86, 1.09
    y_tip, y_depth = -0.11, -0.46

    def _bow_y(z):
        t = (z - z_mid) / ((z_hi - z_lo) * 0.5)
        t = max(-1.0, min(1.0, t))
        return y_tip + (y_depth - y_tip) * (1.0 - t * t)

    bow_zs = [z_hi, 1.70, 1.48, 1.28, z_mid, 0.90, 0.70, 0.50, z_lo]
    tube("BowLimb", [(bx, _bow_y(z), z) for z in bow_zs], 0.012, root, M_GOLD)
    tube("BowGrip", [
        (bx, _bow_y(z_mid) + 0.008, 1.14),
        (bx, _bow_y(z_mid), z_mid),
        (bx, _bow_y(z_mid) + 0.008, 1.04),
    ], 0.017, root, M_GOLD)
    tube("BowString", [
        (bx, -0.09, z_hi), (bx, -0.08, z_mid), (bx, -0.09, z_lo),
    ], 0.002, root, M_STRING)

    tip_u = lathe("BowTip_U", [(0.003, 0), (0.012, 0.005), (0.014, 0.018), (0.004, 0.032)],
                 root, M_GOLD, segs=8, levels=0)
    tip_u.location = (bx, y_tip, z_hi)
    tip_l = lathe("BowTip_L", [(0.003, 0), (0.012, 0.005), (0.014, 0.018), (0.004, 0.032)],
                 root, M_GOLD, segs=8, levels=0)
    tip_l.location = (bx, y_tip, z_lo)
    tip_l.rotation_euler = (math.radians(180), 0, 0)

    # quiver + arrows share ONE diagonal (mouth at upper-left shoulder, bottom at lower-right hip)
    Q_BOTTOM = Vector((-0.14, -0.32, 0.55))
    Q_MOUTH = Vector((0.18, -0.26, 1.42))
    Q_DIR = (Q_MOUTH - Q_BOTTOM).normalized()
    Q_LEN = (Q_MOUTH - Q_BOTTOM).length

    quiver = lathe("Quiver", [
        (0.022, 0), (0.050, 0.02), (0.058, 0.08), (0.058, 0.40),
        (0.050, 0.50), (0.022, 0.54),
    ], root, M_LEATHER, segs=12)
    quiver.scale = (1.05, 1.05, Q_LEN / 0.54)
    quiver.location = Q_BOTTOM
    quiver.rotation_euler = Vector((0, 0, 1)).rotation_difference(Q_DIR).to_euler()

    for i, t in enumerate((0.2, 0.5, 0.8)):
        band = lathe(f"QuiverBand_{i}", [
            (0.058, -0.004), (0.070, 0), (0.058, 0.004),
        ], root, M_GOLD, segs=10, levels=0)
        band.location = Q_BOTTOM.lerp(Q_MOUTH, t)
        band.rotation_euler = quiver.rotation_euler.copy()
        band.rotation_euler.rotate_axis("X", math.radians(90))

    tube("QuiverStrap", [
        (-0.18, 0.08, 1.25), (-0.05, -0.10, 1.05),
        (0.08, -0.24, 0.85), (0.14, -0.30, 0.70),
    ], 0.006, root, M_LEATHER)

    up = Vector((0, 0, 1))
    side = Q_DIR.cross(up)
    if side.length < 1e-4:
        side = Q_DIR.cross(Vector((1, 0, 0)))
    side.normalize()
    bit = Q_DIR.cross(side).normalized()
    for i in range(5):
        ox = ((i % 3) - 1) * 0.011
        oy = ((i // 3) - 0.3) * 0.011
        off = side * ox + bit * oy
        p_in = Q_MOUTH - Q_DIR * 0.15 + off
        p_mid = Q_MOUTH + Q_DIR * 0.05 + off
        p_out = Q_MOUTH + Q_DIR * 0.35 + off
        tube(f"Arrow_{i}", [tuple(p_in), tuple(p_mid), tuple(p_out)], 0.0048, root, M_ARROW)

    # =========================================================
    # viewport / render setup
    # =========================================================
    for area in bpy.context.screen.areas:
        if area.type == "VIEW_3D":
            for space in area.spaces:
                if space.type == "VIEW_3D":
                    space.shading.type = "MATERIAL"

    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except Exception:
        scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 960
    scene.render.resolution_y = 1280
    scene.view_settings.view_transform = "Standard"

    cam = bpy.data.objects["Camera"]
    cam.location = (0, 4.8, 1.15)
    look_at(cam, (0, 0, 0.9))
    cam.data.lens = 55

    n = len([o for o in bpy.data.objects if o.parent == root])
    print(f"Archer geometric rebuild: {n} parts")
    return n


def render_views():
    cam = bpy.data.objects["Camera"]
    scene = bpy.context.scene
    base = "/Users/xin/shanhai-island-editor"
    for name, loc, target in [
        ("archer_front", (0.0, 5.0, 1.1), (0, 0, 0.88)),
        ("archer_threequarter", (3.3, 3.7, 1.2), (0, 0, 0.88)),
        ("archer_side", (4.6, 0.05, 1.15), (0, 0, 0.88)),
        ("archer_back", (0.0, -5.0, 1.2), (0, 0, 0.92)),
    ]:
        cam.location = loc
        look_at(cam, target)
        scene.render.filepath = f"{base}/{name}.png"
        bpy.ops.render.render(write_still=True)
        print("view", name)


if __name__ == "__main__":
    build()
    render_views()
