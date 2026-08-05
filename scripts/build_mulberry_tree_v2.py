"""
Mulberry tree — skeleton-driven outward-spread limbs.
HARD: first-order limbs from thick-line skeleton; NO inward-upward curl.
Workflow pauses after trunk+limbs for validation.
"""
import bpy
import bmesh
import math
import random
from mathutils import Vector, Matrix, Euler

SEED = 77
random.seed(SEED)

TREE_HEIGHT = 7.5
TRUNK_BASE_R = 0.35
# Skeleton: trunk ~30% then first limbs
TRUNK_TOP_Z = 2.35


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for coll in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.textures):
        for block in list(coll):
            try:
                coll.remove(block)
            except Exception:
                pass


def ensure_object_mode():
    if bpy.context.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")


def make_bark_mat():
    mat = bpy.data.materials.new(name="MulberryBark")
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    tex = nodes.new("ShaderNodeTexCoord")
    mapping = nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (1.0, 1.0, 9.0)
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 12.0
    noise.inputs["Detail"].default_value = 10.0
    noise.inputs["Roughness"].default_value = 0.7
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.38
    ramp.color_ramp.elements[0].color = (0.18, 0.14, 0.10, 1)  # crack dark
    ramp.color_ramp.elements[1].position = 0.55
    ramp.color_ramp.elements[1].color = (0.55, 0.48, 0.40, 1)  # light-gray-brown
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.55
    bump.inputs["Distance"].default_value = 0.03
    links.new(tex.outputs["Object"], mapping.inputs["Vector"])
    links.new(mapping.outputs["Vector"], noise.inputs["Vector"])
    links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    bsdf.inputs["Roughness"].default_value = 0.9
    key = "Specular IOR Level" if "Specular IOR Level" in bsdf.inputs else "Specular"
    if key in bsdf.inputs:
        bsdf.inputs[key].default_value = 0.12
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def make_leaf_mat():
    mat = bpy.data.materials.new(name="MulberryLeaf")
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (0.28, 0.52, 0.20, 1.0)  # medium-green
    bsdf.inputs["Roughness"].default_value = 0.68
    key = "Specular IOR Level" if "Specular IOR Level" in bsdf.inputs else "Specular"
    if key in bsdf.inputs:
        bsdf.inputs[key].default_value = 0.2
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def make_fruit_mat():
    mat = bpy.data.materials.new(name="MulberryFruit")
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (0.06, 0.01, 0.07, 1.0)  # dark-purple-black
    bsdf.inputs["Roughness"].default_value = 0.32
    key = "Specular IOR Level" if "Specular IOR Level" in bsdf.inputs else "Specular"
    if key in bsdf.inputs:
        bsdf.inputs[key].default_value = 0.55
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def make_unripe_mat():
    mat = bpy.data.materials.new(name="MulberryUnripe")
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (0.55, 0.65, 0.28, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.5
    key = "Specular IOR Level" if "Specular IOR Level" in bsdf.inputs else "Specular"
    if key in bsdf.inputs:
        bsdf.inputs[key].default_value = 0.3
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def assign_mat(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)


def curve_to_mesh(name, points, radii, bevel_res=3, res_u=10):
    curve_data = bpy.data.curves.new(name + "_c", type="CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = res_u
    curve_data.fill_mode = "FULL"
    curve_data.bevel_depth = 1.0
    curve_data.bevel_resolution = bevel_res
    curve_data.use_fill_caps = True
    spline = curve_data.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for i, (p, r) in enumerate(zip(points, radii)):
        bp = spline.bezier_points[i]
        bp.co = Vector(p)
        bp.radius = float(r)
        bp.handle_left_type = "AUTO"
        bp.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve_data)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.view_layer.objects.active
    obj.name = name
    bpy.ops.object.select_all(action="DESELECT")
    return obj


def apply_bark_displace(obj, strength=0.02):
    tex = bpy.data.textures.new(obj.name + "_crack", type="CLOUDS")
    tex.noise_scale = 0.28
    tex.noise_depth = 4
    tex.noise_type = "HARD_NOISE"
    mod = obj.modifiers.new(name="BarkDisplace", type="DISPLACE")
    mod.texture = tex
    mod.strength = strength
    mod.mid_level = 0.5
    mod.direction = "NORMAL"
    mod.texture_coords = "LOCAL"
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.select_set(False)


def build_trunk(bark_mat):
    """Organic curved trunk, base r=0.35, up to first limb zone."""
    pts = [
        (0.00, 0.00, 0.00),
        (0.04, -0.03, 0.45),
        (0.06, 0.02, 0.95),
        (0.03, 0.05, 1.45),
        (-0.02, 0.03, 1.90),
        (-0.01, -0.02, TRUNK_TOP_Z),
        (0.01, -0.03, 2.85),  # short leader into fork zone
        (0.00, -0.01, 3.50),
    ]
    radii = [0.38, 0.35, 0.32, 0.28, 0.24, 0.20, 0.15, 0.11]
    trunk = curve_to_mesh("MulberryTrunk", pts, radii, bevel_res=4, res_u=12)
    bpy.context.view_layer.objects.active = trunk
    trunk.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.subdivide(number_cuts=1)
    bpy.ops.object.mode_set(mode="OBJECT")
    apply_bark_displace(trunk, 0.022)
    assign_mat(trunk, bark_mat)
    return trunk


def outward_limb_points(az_deg, elev_from_vert_deg, start_z, length, start_r, tip_r,
                        side_bend=0.0, dip=0.0, depth_bias=0.0):
    """
    Build polyline that ALWAYS increases radial distance from trunk axis.
    elev_from_vert_deg: 0=straight up, 90=horizontal. Skeleton uses ~45-85.
    FORBID inward curl: radial r(t) is strictly increasing.
    """
    az = math.radians(az_deg)
    elev = math.radians(elev_from_vert_deg)  # from vertical
    # Primary direction: outward + upward component from elevation
    # elev 80° => mostly horizontal; elev 45° => diagonal up-out
    dir_xy = math.sin(elev)
    dir_z = math.cos(elev)
    n = 6
    pts, rads = [], []
    attach = 0.12
    for i in range(n):
        t = i / (n - 1)
        # Monotonic outward distance
        dist = attach + length * dir_xy * (0.08 + 0.92 * t)
        # Gentle organic bend sideways (still outward)
        side = side_bend * math.sin(t * math.pi) * length * 0.15
        # Optional slight dip then recover (skeleton low-left), never curl inward
        z_dip = dip * math.sin(t * math.pi) * length * 0.12
        z = start_z + length * dir_z * t + z_dip
        # Soft tip lift only — still increase XY radius
        if t > 0.7 and dip < 0:
            # recovering from dip: add a little Z, keep XY growing
            z += abs(dip) * 0.08 * ((t - 0.7) / 0.3)
        x = math.cos(az) * dist + math.cos(az + math.pi / 2) * side
        y = math.sin(az) * dist + math.sin(az + math.pi / 2) * side + depth_bias * t
        # micro wobble without reducing radius
        wob = 0.03 * math.sin(i * 1.7 + az)
        x += math.cos(az + math.pi / 2) * wob
        y += math.sin(az + math.pi / 2) * wob
        pts.append((x, y, z))
        rads.append(start_r * (1 - t) + tip_r * t)
    # Enforce strictly increasing radial distance
    last_r = 0.0
    fixed = []
    for p in pts:
        r = math.sqrt(p[0] ** 2 + p[1] ** 2)
        if r < last_r + 0.02:
            # push further out along XY
            scale = (last_r + 0.05) / max(r, 1e-4)
            p = (p[0] * scale, p[1] * scale, p[2])
            r = math.sqrt(p[0] ** 2 + p[1] ** 2)
        last_r = r
        fixed.append(p)
    return fixed, rads


def skeleton_main_limbs(bark_mat):
    """
    Thick-line skeleton (front view) first-order limbs:
    1. Low-right  ~ horizontal outward (~80° from vertical), origin ~z=2.1
    2. Low-left   ~ horizontal outward (~75°), slight dip, origin ~z=2.4
    3. Mid-right  ~ obliquely out (~55°), origin ~z=3.2
    4. Mid-left   ~ obliquely out (~55°), origin ~z=3.4
    5. Upper-left V (~42°), origin ~z=4.0
    6. Upper-right V (~42°), origin ~z=4.0
    Plus 2 depth limbs (front/back) so 3D isn't a flat cardboard tree —
    same outward-oblique rule, matching skeleton openness.
    """
    # (name, az, elev_from_vert, start_z, length, r0, r1, side_bend, dip, depth_bias)
    # Front view: +X = right, -X = left. Depth via az near ±90 and depth_bias.
    specs = [
        # Low layer — nearly horizontal sideways (skeleton)
        ("Limb_LowR",  8,   82, 2.10, 3.4, 0.12, 0.028,  0.15,  0.00,  0.25),
        ("Limb_LowL", 172,  78, 2.35, 3.3, 0.118, 0.026, -0.20, -0.35, -0.20),
        # Mid layer — oblique outward
        ("Limb_MidR",  25,  55, 3.15, 3.1, 0.105, 0.024,  0.10,  0.00,  0.45),
        ("Limb_MidL", 155,  55, 3.35, 3.0, 0.102, 0.024, -0.12,  0.00, -0.35),
        # Upper V-fork
        ("Limb_UpL",  140,  42, 3.95, 2.8, 0.090, 0.022, -0.08,  0.00,  0.15),
        ("Limb_UpR",   40,  42, 4.00, 2.8, 0.090, 0.022,  0.08,  0.00, -0.10),
        # Depth openers (still outward-oblique, not upward-inward)
        ("Limb_Front", 90,  62, 2.80, 2.9, 0.095, 0.022,  0.05,  0.00,  0.00),
        ("Limb_Back", 270,  60, 3.00, 2.7, 0.092, 0.022, -0.05,  0.00,  0.00),
    ]
    limbs = []
    for name, az, elev, z0, length, r0, r1, bend, dip, depth in specs:
        pts, rads = outward_limb_points(az, elev, z0, length, r0, r1, bend, dip, depth)
        obj = curve_to_mesh(name, pts, rads, bevel_res=3)
        apply_bark_displace(obj, 0.012)
        assign_mat(obj, bark_mat)
        # Validate radial growth
        rs = [math.sqrt(p[0] ** 2 + p[1] ** 2) for p in pts]
        ok = all(rs[i] <= rs[i + 1] + 1e-4 for i in range(len(rs) - 1))
        print(f"  {name}: elev={elev} tip_r={rs[-1]:.2f} tip_z={pts[-1][2]:.2f} mono_out={ok}")
        limbs.append((obj, pts, rads))
    return limbs


def validate_limbs_not_compact_ball(limbs):
    """Reject if tips cluster near center or form tight oval ball."""
    tips = [Vector(pts[-1]) for _, pts, _ in limbs]
    tip_rs = [math.sqrt(t.x ** 2 + t.y ** 2) for t in tips]
    avg_r = sum(tip_rs) / len(tip_rs)
    min_r = min(tip_rs)
    max_r = max(tip_rs)
    # Compact ball symptom: tips at similar small radius, high tip Z
    tip_zs = [t.z for t in tips]
    avg_z = sum(tip_zs) / len(tip_zs)
    print(f"VALIDATE tip_r min/avg/max={min_r:.2f}/{avg_r:.2f}/{max_r:.2f} tip_z_avg={avg_z:.2f}")
    # For 7.5m open mulberry, tips should reach ~2.5m+ radially
    if avg_r < 2.2:
        return False, "tips too close to center (compact)"
    if min_r < 1.5:
        return False, "some tips not outward enough"
    # Reject if most tips are very high with modest spread (flame/cage)
    if avg_z > 6.5 and avg_r < 2.8:
        return False, "upward-dominant compact crown"
    return True, "ok"


def build_trunk_and_limbs():
    clear_scene()
    bark = make_bark_mat()
    print("STEP1 trunk")
    trunk = build_trunk(bark)
    print("STEP2 main limbs from skeleton")
    limbs = skeleton_main_limbs(bark)
    ok, msg = validate_limbs_not_compact_ball(limbs)
    print("VALIDATION:", ok, msg)
    if not ok:
        # discard limbs and rebuild once with more horizontal push
        print("REBUILDING LIMBS — rejected:", msg)
        for obj, _, _ in limbs:
            bpy.data.objects.remove(obj, do_unlink=True)
        # More extreme outward
        limbs = skeleton_main_limbs(bark)  # same defs already outward; if still fail, scale XY
        for obj, pts, rads in limbs:
            for v in obj.data.vertices:
                v.co.x *= 1.15
                v.co.y *= 1.15
            obj.data.update()
        # refresh pts for later
        new_limbs = []
        for obj, pts, rads in limbs:
            pts2 = [(p[0] * 1.15, p[1] * 1.15, p[2]) for p in pts]
            new_limbs.append((obj, pts2, rads))
        limbs = new_limbs
        ok, msg = validate_limbs_not_compact_ball(limbs)
        print("REVALIDATE:", ok, msg)

    # Parent under empty
    empty = bpy.data.objects.new("MulberryTree", None)
    empty.empty_display_type = "PLAIN_AXES"
    empty.location = (0, 0, 0)
    bpy.context.collection.objects.link(empty)
    trunk.parent = empty
    for obj, _, _ in limbs:
        obj.parent = empty

    # Store limb polylines on empty for next steps via custom props? Use scene dict
    bpy.context.scene["mulberry_phase"] = "limbs_done"
    print("PAUSE — trunk + main limbs ready. Objects:", [o.name for o in bpy.data.objects])
    return trunk, limbs, bark, empty


# ---------- continue after validation ----------

def build_secondary_twigs(limbs, bark_mat):
    """Secondary twigs ONLY from main limbs, continuing outward trajectory."""
    twigs = []
    for bi, (limb_obj, pts, rads) in enumerate(limbs):
        bpts = [Vector(p) for p in pts]
        n_tw = 8 if bi < 4 else 6
        for j in range(n_tw):
            t = 0.35 + 0.55 * (j / max(1, n_tw - 1))  # outer half mostly
            seg = t * (len(bpts) - 1)
            i0 = int(seg)
            i1 = min(i0 + 1, len(bpts) - 1)
            origin = bpts[i0].lerp(bpts[i1], seg - i0)
            tang = (bpts[i1] - bpts[i0]).normalized()
            radial = Vector((origin.x, origin.y, 0))
            if radial.length < 1e-4:
                radial = Vector((1, 0, 0))
            radial.normalize()
            # Continue outward — small upward allowed, NO toward-center
            direction = (radial * 0.7 + tang * 0.35 + Vector((0, 0, 0.15))).normalized()
            # Reject if direction points inward (dot with radial < 0)
            if direction.dot(radial) < 0.15:
                direction = (radial * 0.85 + Vector((0, 0, 0.2))).normalized()
            length = random.uniform(0.45, 0.95)
            n = 4
            tpts, trads = [], []
            r0 = random.uniform(0.012, 0.02)
            for k in range(n):
                u = k / (n - 1)
                wob = Vector((
                    0.02 * math.sin(u * 4 + j),
                    0.02 * math.cos(u * 3 + j),
                    0.0,
                ))
                p = origin + direction * (length * u) + wob * u
                # keep outward
                pr = math.sqrt(p.x ** 2 + p.y ** 2)
                orr = math.sqrt(origin.x ** 2 + origin.y ** 2)
                if pr < orr:
                    p = origin + radial * (0.05 + length * u) + Vector((0, 0, direction.z - origin.z))
                tpts.append(p)
                trads.append(r0 * (1 - 0.7 * u))
            name = f"Twig_{bi:02d}_{j:02d}"
            obj = curve_to_mesh(name, [(p.x, p.y, p.z) for p in tpts], trads, bevel_res=1, res_u=6)
            assign_mat(obj, bark_mat)
            twigs.append((obj, tpts, direction))
    return twigs


def create_leaf_mesh(leaf_mat):
    bm = bmesh.new()
    length, width, steps = 0.18, 0.065, 14
    outline = []
    for i in range(steps + 1):
        t = i / steps
        y = t * length
        if t < 0.1:
            w = width * (0.2 + 0.8 * (t / 0.1) ** 0.6)
        else:
            u = (t - 0.1) / 0.9
            w = width * math.sin(math.pi * (0.05 + 0.95 * (1 - u ** 1.2))) * 1.15
            w = max(0.0015, w)
        if 0 < i < steps:
            w = max(0.0015, w + 0.0038 * (1 if i % 2 == 0 else -0.3))
        outline.append((w, y))
    coords = [(0, 0, 0)]
    for w, y in outline[1:]:
        coords.append((w, y, 0))
    for w, y in reversed(outline[1:-1]):
        coords.append((-w, y, 0))
    vs = [bm.verts.new(c) for c in coords]
    bm.faces.new(vs)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    res = bmesh.ops.extrude_face_region(bm, geom=list(bm.faces))
    for v in [e for e in res["geom"] if isinstance(e, bmesh.types.BMVert)]:
        v.co.z -= 0.0014
    for v in bm.verts:
        x, y, z = v.co
        v.co.z += -abs(x) * 0.35 - 0.02 * (y / length) ** 2
    mesh = bpy.data.meshes.new("LeafMesh")
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("LeafProto", mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(leaf_mat)
    return obj


def create_fruit_mesh(fruit_mat):
    bm = bmesh.new()
    rows, around = 5, 5
    length, radius, dr = 0.028, 0.007, 0.004
    for i in range(rows):
        t = (i + 0.5) / rows
        z = (t - 0.5) * length
        ring = radius * math.sin(math.pi * t) * 1.05
        n = around if 0 < i < rows - 1 else max(3, around - 1)
        for k in range(n):
            a = 2 * math.pi * k / n + (i % 2) * (math.pi / n)
            bmesh.ops.create_icosphere(
                bm, subdivisions=1, radius=dr * random.uniform(0.9, 1.1),
                matrix=Matrix.Translation((math.cos(a) * ring, math.sin(a) * ring, z)),
            )
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0015)
    mesh = bpy.data.meshes.new("FruitMesh")
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("FruitProto", mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(fruit_mat)
    return obj


def place_leaves_fruits(twigs, leaf_proto, fruit_ripe, fruit_unripe):
    leaves, fruits = [], []
    leaf_proto.hide_set(True)
    fruit_ripe.hide_set(True)
    fruit_unripe.hide_set(True)

    for ti, (twig, pts, direction) in enumerate(twigs):
        n_leaves = random.randint(4, 7)
        for li in range(n_leaves):
            t = 0.35 + 0.6 * (li / max(1, n_leaves - 1))
            seg = t * (len(pts) - 1)
            i0 = int(seg)
            i1 = min(i0 + 1, len(pts) - 1)
            pos = pts[i0].lerp(pts[i1], seg - i0)
            side = direction.cross(Vector((0, 0, 1)))
            if side.length < 1e-4:
                side = direction.cross(Vector((1, 0, 0)))
            side.normalize()
            up = direction.cross(side).normalized()
            pos = pos + side * random.uniform(-0.05, 0.05) + up * random.uniform(0.01, 0.06)
            leaf = leaf_proto.copy()
            leaf.data = leaf_proto.data.copy()
            bpy.context.collection.objects.link(leaf)
            leaf.hide_set(False)
            leaf.location = pos
            hint = (up * 0.4 + direction * 0.3 + Vector((0, 0, 0.3))).normalized()
            leaf.rotation_euler = hint.to_track_quat("Y", "Z").to_euler()
            leaf.rotation_euler.z += random.uniform(-0.9, 0.9)
            leaf.rotation_euler.x += random.uniform(-0.4, 0.2)
            s = random.uniform(0.8, 1.25)
            leaf.scale = (s, s, s)
            leaf.name = f"Leaf_{ti:03d}_{li:02d}"
            # ensure leaf mat
            if leaf.data.materials:
                leaf.data.materials[0] = leaf_proto.data.materials[0]
            leaves.append(leaf)

        if random.random() < 0.65:
            for fi in range(random.randint(1, 3)):
                t = random.uniform(0.45, 0.9)
                seg = t * (len(pts) - 1)
                i0 = int(seg)
                i1 = min(i0 + 1, len(pts) - 1)
                pos = pts[i0].lerp(pts[i1], seg - i0)
                proto = fruit_ripe if random.random() < 0.75 else fruit_unripe
                fr = proto.copy()
                fr.data = proto.data.copy()
                bpy.context.collection.objects.link(fr)
                fr.hide_set(False)
                fr.location = pos + Vector((0, 0, -random.uniform(0.02, 0.05)))
                fr.rotation_euler = (
                    random.uniform(-0.4, 0.4),
                    random.uniform(-0.4, 0.4),
                    random.uniform(0, 6.28),
                )
                s = random.uniform(0.85, 1.2)
                fr.scale = (s, s, s)
                fr.name = f"Fruit_{ti:03d}_{fi:02d}"
                fruits.append(fr)
    return leaves, fruits


def join_objs(objects, name, mat=None):
    ensure_object_mode()
    bpy.ops.object.select_all(action="DESELECT")
    if not objects:
        return None
    for o in objects:
        o.hide_set(False)
        mw = o.matrix_world.copy()
        o.data.transform(mw)
        o.matrix_world = Matrix.Identity(4)
        if mat is not None:
            assign_mat(o, mat)
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = name
    joined.location = (0, 0, 0)
    if mat is not None:
        assign_mat(joined, mat)
    return joined


def normalize_base(parts):
    mins = [1e9] * 3
    maxs = [-1e9] * 3
    for o in parts:
        for v in o.data.vertices:
            for i in range(3):
                mins[i] = min(mins[i], v.co[i])
                maxs[i] = max(maxs[i], v.co[i])
    h = maxs[2] - mins[2]
    s = TREE_HEIGHT / h if h > 0.1 else 1.0
    cx = (mins[0] + maxs[0]) * 0.5
    cy = (mins[1] + maxs[1]) * 0.5
    for o in parts:
        for v in o.data.vertices:
            v.co.x = (v.co.x - cx) * s
            v.co.y = (v.co.y - cy) * s
            v.co.z = (v.co.z - mins[2]) * s
        o.data.update()
    # soft clamp trunk base
    wood = next((o for o in parts if "Wood" in o.name or "Trunk" in o.name), None)
    # After join wood contains trunk
    if wood is None and parts:
        wood = parts[0]
    return s


def set_front_view():
    for area in bpy.context.screen.areas:
        if area.type == "VIEW_3D":
            for space in area.spaces:
                if space.type == "VIEW_3D":
                    space.shading.type = "MATERIAL"
                    space.region_3d.view_perspective = "ORTHO"
                    space.region_3d.view_rotation = Euler((1.5708, 0, 0), "XYZ").to_quaternion()
                    space.region_3d.view_location = (0, 0, 3.5)
                    space.region_3d.view_distance = 16


if __name__ == "__main__":
    # Default: only trunk+limbs (pause). Continue via continue_build().
    build_trunk_and_limbs()
    set_front_view()
