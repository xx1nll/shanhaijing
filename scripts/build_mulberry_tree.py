"""
Mulberry tree from scratch — cylinders/curves/spheres/planes only.
Matches dense ovate silhouette, fissured bark, serrated leaves, aggregate fruits.
"""
import bpy
import bmesh
import math
import random
from mathutils import Vector, Matrix

SEED = 47
random.seed(SEED)

TREE_HEIGHT = 7.5
TRUNK_BASE_R = 0.35
CANOPY_BOTTOM = 1.35
CANOPY_TOP = 7.5
CANOPY_RX = 3.35  # half-width ~6.7m before normalize
CANOPY_RY = 3.15


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


def make_mat(name, color, roughness=0.75, specular=0.25):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    key = "Specular IOR Level" if "Specular IOR Level" in bsdf.inputs else "Specular"
    if key in bsdf.inputs:
        bsdf.inputs[key].default_value = specular
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def make_bark_mat():
    mat = bpy.data.materials.new(name="MulberryBark")
    mat.use_nodes = True
    nt = mat.node_tree
    nodes, links = nt.nodes, nt.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    tex_coord = nodes.new("ShaderNodeTexCoord")
    mapping = nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (1.2, 1.2, 10.0)
    noise1 = nodes.new("ShaderNodeTexNoise")
    noise1.inputs["Scale"].default_value = 14.0
    noise1.inputs["Detail"].default_value = 10.0
    noise1.inputs["Roughness"].default_value = 0.7
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.40
    ramp.color_ramp.elements[0].color = (0.10, 0.07, 0.05, 1)
    ramp.color_ramp.elements[1].position = 0.58
    ramp.color_ramp.elements[1].color = (0.64, 0.61, 0.55, 1)
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.55
    bump.inputs["Distance"].default_value = 0.025
    links.new(tex_coord.outputs["Object"], mapping.inputs["Vector"])
    links.new(mapping.outputs["Vector"], noise1.inputs["Vector"])
    links.new(noise1.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(noise1.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    bsdf.inputs["Roughness"].default_value = 0.9
    key = "Specular IOR Level" if "Specular IOR Level" in bsdf.inputs else "Specular"
    if key in bsdf.inputs:
        bsdf.inputs[key].default_value = 0.12
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def make_leaf_mat():
    mat = make_mat("MulberryLeaf", (0.30, 0.55, 0.20), roughness=0.68, specular=0.2)
    # Slight variation via mix is overkill; solid green is fine
    return mat


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
    tex = bpy.data.textures.new(obj.name + "_tex", type="CLOUDS")
    tex.noise_scale = 0.28
    tex.noise_depth = 4
    tex.noise_type = "HARD_NOISE"
    mod = obj.modifiers.new(name="BarkDisplace", type="DISPLACE")
    mod.texture = tex
    mod.strength = strength
    mod.mid_level = 0.55
    mod.direction = "NORMAL"
    mod.texture_coords = "LOCAL"
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.select_set(False)


def assign_mat(obj, mat):
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)


def canopy_radius_at_z(z):
    """Ovate/spade silhouette radius in meters: widest mid-lower, taper to rounded top."""
    if z < CANOPY_BOTTOM:
        return 0.0
    t = (z - CANOPY_BOTTOM) / (CANOPY_TOP - CANOPY_BOTTOM)
    t = max(0.0, min(1.0, t))
    profile = math.sin(math.pi * (t ** 0.85))
    if t < 0.25:
        profile *= 0.55 + 1.8 * t
    if t > 0.82:
        profile *= 1.0 - 0.55 * ((t - 0.82) / 0.18) ** 1.2
    # Actual world radius (meters), elliptical axes applied by callers via RX/RY ratio
    return profile * CANOPY_RX


def build_trunk(bark_mat):
    pts = [
        (0.00, 0.00, 0.00),
        (0.05, -0.03, 0.40),
        (0.07, 0.02, 0.85),
        (0.03, 0.06, 1.25),
        (-0.02, 0.03, 1.70),
        (-0.01, -0.02, 2.30),
        (0.02, -0.04, 3.00),
        (0.00, -0.02, 3.80),
    ]
    radii = [0.38, 0.35, 0.31, 0.26, 0.20, 0.15, 0.11, 0.07]
    trunk = curve_to_mesh("MulberryTrunk", pts, radii, bevel_res=4, res_u=12)
    bpy.context.view_layer.objects.active = trunk
    trunk.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.subdivide(number_cuts=1)
    bpy.ops.object.mode_set(mode="OBJECT")
    apply_bark_displace(trunk, 0.024)
    assign_mat(trunk, bark_mat)
    return trunk


def build_main_branches(bark_mat):
    """Wide-spreading limbs; tips stay near outer silhouette (not caged inward)."""
    # (az_deg, start_z, length_factor, start_r, tip_r, side_bend, z_gain)
    specs = [
        # More horizontal spread to match broad ovate silhouette
        (200, 1.25, 1.12, 0.145, 0.028, 0.35, 0.78),
        (25, 1.30, 1.10, 0.140, 0.027, -0.30, 0.80),
        (135, 1.40, 1.05, 0.125, 0.026, 0.22, 0.76),
        (315, 1.35, 1.04, 0.125, 0.026, -0.18, 0.77),
        (90, 1.50, 1.00, 0.110, 0.024, 0.12, 0.72),
        (270, 1.55, 0.98, 0.108, 0.024, -0.12, 0.72),
        (165, 2.00, 0.95, 0.095, 0.022, 0.28, 0.82),
        (5, 2.05, 0.93, 0.092, 0.022, -0.22, 0.83),
        (55, 2.70, 0.82, 0.078, 0.018, 0.18, 0.90),
        (235, 2.80, 0.80, 0.075, 0.018, -0.16, 0.88),
        (110, 3.30, 0.68, 0.065, 0.016, 0.10, 0.95),
        (290, 3.40, 0.66, 0.062, 0.015, -0.10, 0.94),
    ]
    branches = []
    for i, (az_deg, start_z, length_f, r0, r1, bend, z_gain) in enumerate(specs):
        az = math.radians(az_deg)
        n = 7
        pts, rads = [], []
        for k in range(n):
            t = k / (n - 1)
            z = start_z + t * (TREE_HEIGHT - start_z - 0.15) * z_gain
            # Stay under silhouette radius; grow out then hold outer edge
            profile_r = canopy_radius_at_z(z)
            # Reach ~90% of silhouette at mid, don't collapse inward
            reach = length_f * profile_r * (0.40 + 0.55 * math.sin(min(1.0, t * 1.15) * math.pi * 0.5))
            if t < 0.15:
                reach *= t / 0.15 * 0.35 + 0.05
            side = bend * math.sin(t * math.pi) * 0.55
            x = math.cos(az) * reach + math.cos(az + math.pi / 2) * side
            y = math.sin(az) * reach * (CANOPY_RY / CANOPY_RX) + math.sin(az + math.pi / 2) * side
            x += 0.05 * math.sin(k * 1.9 + i)
            y += 0.05 * math.cos(k * 1.4 + i)
            pts.append((x, y, z))
            rads.append(r0 * (1 - t) + r1 * t)
        # Attach near trunk
        pts[0] = (math.cos(az) * 0.08, math.sin(az) * 0.08, start_z)
        rads[0] = r0
        obj = curve_to_mesh(f"Limb_{i:02d}", pts, rads, bevel_res=3)
        apply_bark_displace(obj, 0.012)
        assign_mat(obj, bark_mat)
        branches.append((obj, pts))
    return branches


def build_twigs(branch_data, bark_mat):
    """Many twigs from limbs, plus filler twigs aimed at canopy volume."""
    twigs = []  # (obj, pts, tip_dir)

    def add_twig(origin, direction, length, r0, name):
        direction = direction.normalized()
        n = 4
        pts, rads = [], []
        for k in range(n):
            t = k / (n - 1)
            wob = Vector((
                0.025 * math.sin(t * 5 + hash(name) % 7),
                0.025 * math.cos(t * 4 + hash(name) % 5),
                0.01 * math.sin(t * 3),
            ))
            pts.append(origin + direction * (length * t) + wob * t)
            rads.append(r0 * (1 - 0.7 * t))
        obj = curve_to_mesh(name, [(p.x, p.y, p.z) for p in pts], rads, bevel_res=1, res_u=6)
        assign_mat(obj, bark_mat)
        twigs.append((obj, pts, direction))

    # From main branch polylines
    for bi, (obj, bpts) in enumerate(branch_data):
        bpts_v = [Vector(p) for p in bpts]
        n_tw = 16 if bi < 6 else 11
        for j in range(n_tw):
            t = 0.2 + 0.75 * (j / (n_tw - 1))
            seg = t * (len(bpts_v) - 1)
            i0 = int(seg)
            i1 = min(i0 + 1, len(bpts_v) - 1)
            origin = bpts_v[i0].lerp(bpts_v[i1], seg - i0)
            radial = Vector((origin.x, origin.y, 0))
            if radial.length < 1e-4:
                radial = Vector((1, 0, 0))
            radial.normalize()
            tang = (bpts_v[i1] - bpts_v[i0]).normalized()
            direction = (radial * 0.55 + Vector((0, 0, 1)) * 0.35 + tang * 0.25)
            direction += Vector((random.uniform(-0.35, 0.35), random.uniform(-0.35, 0.35), random.uniform(-0.15, 0.25)))
            length = random.uniform(0.45, 1.05) * (1.05 - 0.35 * origin.z / TREE_HEIGHT)
            add_twig(origin, direction, length, random.uniform(0.011, 0.02), f"Twig_{bi:02d}_{j:02d}")

    # Volume-filling twigs for dense silhouette (from interior toward surface)
    for k in range(70):
        # Sample point inside canopy ellipsoid-ish
        for _try in range(20):
            z = random.uniform(CANOPY_BOTTOM + 0.2, CANOPY_TOP - 0.15)
            pr = canopy_radius_at_z(z)
            if pr < 0.2:
                continue
            rr = pr * random.uniform(0.15, 0.78)
            ang = random.uniform(0, math.tau)
            origin = Vector((math.cos(ang) * rr, math.sin(ang) * rr * (CANOPY_RY / CANOPY_RX), z))
            # Aim outward toward silhouette
            outward = Vector((origin.x, origin.y, 0.15))
            if outward.length < 1e-4:
                outward = Vector((1, 0, 0.2))
            outward = (outward.normalized() * 0.7 + Vector((0, 0, random.uniform(-0.2, 0.6)))).normalized()
            length = random.uniform(0.35, 0.9)
            tip = origin + outward * length
            tip_r = math.sqrt(tip.x ** 2 + (tip.y * CANOPY_RX / CANOPY_RY) ** 2)
            max_r = canopy_radius_at_z(tip.z)
            # clamp length so tip stays inside silhouette
            if tip_r > max_r * 0.98 and tip_r > 1e-4:
                scale = (max_r * 0.95) / tip_r
                length *= scale
            add_twig(origin, outward, length, random.uniform(0.008, 0.015), f"FillTwig_{k:03d}")
            break

    return twigs


def create_leaf_mesh(leaf_mat):
    bm = bmesh.new()
    length = 0.16
    width = 0.058
    steps = 16
    outline = []
    for i in range(steps + 1):
        t = i / steps
        y = t * length
        if t < 0.1:
            w = width * (0.2 + 0.8 * (t / 0.1) ** 0.6)
        else:
            u = (t - 0.1) / 0.9
            # ovate: widest ~0.32
            w = width * math.sin(math.pi * (0.05 + 0.95 * (1 - u ** 1.25))) * 1.2
            w = max(0.0015, w)
        if 0 < i < steps:
            w += 0.0035 * (1 if i % 2 == 0 else -0.25)  # serration
            w = max(0.0015, w)
        outline.append((w, y))

    coords = [(0.0, 0.0, 0.0)]
    for w, y in outline[1:]:
        coords.append((w, y, 0.0))
    for w, y in reversed(outline[1:-1]):
        coords.append((-w, y, 0.0))
    verts = [bm.verts.new(c) for c in coords]
    bm.verts.ensure_lookup_table()
    bm.faces.new(verts)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    # Thin shell
    res = bmesh.ops.extrude_face_region(bm, geom=list(bm.faces))
    ext = [e for e in res["geom"] if isinstance(e, bmesh.types.BMVert)]
    for v in ext:
        v.co.z -= 0.0012
    # V-fold + tip curl
    for v in bm.verts:
        x, y, z = v.co
        v.co.z += -abs(x) * 0.4 - 0.018 * (y / length) ** 2

    mesh = bpy.data.meshes.new("LeafMesh")
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("LeafProto", mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(leaf_mat)
    return obj


def create_fruit_mesh(mat, ripe=True):
    bm = bmesh.new()
    rows, around = 4, 4
    length, radius, dr = 0.024, 0.006, 0.0036
    for i in range(rows):
        t = (i + 0.5) / rows
        z = (t - 0.5) * length
        ring_r = radius * math.sin(math.pi * t) * 1.08
        n = around if 0 < i < rows - 1 else max(3, around - 1)
        for k in range(n):
            a = 2 * math.pi * k / n + (i % 2) * (math.pi / n)
            bmesh.ops.create_icosphere(
                bm,
                subdivisions=0,
                radius=dr * random.uniform(0.88, 1.12),
                matrix=Matrix.Translation((math.cos(a) * ring_r, math.sin(a) * ring_r, z)),
            )
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0012)
    mesh = bpy.data.meshes.new("FruitMesh_" + ("R" if ripe else "U"))
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("FruitProto", mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(mat)
    return obj


def place_foliage(twigs, leaf_proto, fruit_ripe, fruit_unripe):
    leaves, fruits = [], []
    leaf_proto.hide_set(True)
    fruit_ripe.hide_set(True)
    fruit_unripe.hide_set(True)

    def add_leaf(pos, normal_hint, name):
        leaf = leaf_proto.copy()
        leaf.data = leaf_proto.data.copy()
        bpy.context.collection.objects.link(leaf)
        leaf.hide_set(False)
        leaf.location = pos
        d = normal_hint.normalized() if normal_hint.length > 1e-6 else Vector((0, 0, 1))
        leaf.rotation_euler = d.to_track_quat("Y", "Z").to_euler()
        leaf.rotation_euler.z += random.uniform(-1.0, 1.0)
        leaf.rotation_euler.x += random.uniform(-0.45, 0.3)
        s = random.uniform(0.7, 1.35)
        leaf.scale = (s, s, s)
        leaf.name = name
        leaves.append(leaf)

    def add_fruit(pos, name):
        proto = fruit_ripe if random.random() < 0.72 else fruit_unripe
        fr = proto.copy()
        fr.data = proto.data.copy()
        bpy.context.collection.objects.link(fr)
        fr.hide_set(False)
        fr.location = pos + Vector((0, 0, -random.uniform(0.015, 0.045)))
        fr.rotation_euler = (random.uniform(-0.5, 0.5), random.uniform(-0.5, 0.5), random.uniform(0, 6.28))
        s = random.uniform(0.8, 1.25)
        fr.scale = (s, s, s)
        fr.name = name
        fruits.append(fr)

    # Along twigs
    for ti, (twig, pts, direction) in enumerate(twigs):
        n_leaves = random.randint(5, 9)
        for li in range(n_leaves):
            t = 0.3 + 0.65 * (li / max(1, n_leaves - 1))
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
            hint = (up * 0.55 + direction * 0.25 + Vector((0, 0, 0.35)))
            add_leaf(pos, hint, f"Leaf_{ti:03d}_{li:02d}")
        if random.random() < 0.55:
            for fi in range(random.randint(1, 2)):
                t = random.uniform(0.4, 0.9)
                seg = t * (len(pts) - 1)
                i0 = int(seg)
                i1 = min(i0 + 1, len(pts) - 1)
                pos = pts[i0].lerp(pts[i1], seg - i0)
                add_fruit(pos, f"Fruit_{ti:03d}_{fi:02d}")

    # Extra canopy cloud leaves for solid silhouette (volume samples near surface)
    cloud_id = 0
    for k in range(900):
        z = random.uniform(CANOPY_BOTTOM + 0.15, CANOPY_TOP - 0.05)
        pr = canopy_radius_at_z(z)
        if pr < 0.15:
            continue
        # Bias to outer shell for silhouette edge bumpiness
        rr = pr * (random.uniform(0.7, 1.0) if random.random() < 0.7 else random.uniform(0.25, 0.7))
        ang = random.uniform(0, math.tau)
        x = math.cos(ang) * rr
        y = math.sin(ang) * rr * (CANOPY_RY / CANOPY_RX)
        x += random.uniform(-0.08, 0.08)
        y += random.uniform(-0.08, 0.08)
        pos = Vector((x, y, z + random.uniform(-0.05, 0.05)))
        hint = Vector((x, y, 0.4)).normalized() if (abs(x) + abs(y)) > 0.01 else Vector((0, 0, 1))
        add_leaf(pos, hint, f"CloudLeaf_{cloud_id:04d}")
        cloud_id += 1
        if random.random() < 0.10:
            add_fruit(pos, f"CloudFruit_{cloud_id:04d}")

    return leaves, fruits


def join_objs(objects, name):
    ensure_object_mode()
    bpy.ops.object.select_all(action="DESELECT")
    if not objects:
        return None
    # Reset origins to world zero BEFORE join so scale/center later is stable
    for o in objects:
        o.hide_set(False)
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        # Bake location into mesh, origin at world 0
        mw = o.matrix_world.copy()
        o.data.transform(mw)
        o.matrix_world = Matrix.Identity(4)
        o.select_set(False)
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = name
    joined.location = (0.0, 0.0, 0.0)
    joined.rotation_euler = (0.0, 0.0, 0.0)
    joined.scale = (1.0, 1.0, 1.0)
    return joined


def build_all():
    clear_scene()
    bark = make_bark_mat()
    leaf_mat = make_leaf_mat()
    ripe = make_mat("MulberryRipe", (0.07, 0.01, 0.08), roughness=0.32, specular=0.6)
    unripe = make_mat("MulberryUnripe", (0.52, 0.62, 0.25), roughness=0.5, specular=0.35)

    print("1 trunk")
    trunk = build_trunk(bark)
    print("2 limbs")
    branch_data = build_main_branches(bark)
    print("3 twigs")
    twigs = build_twigs(branch_data, bark)
    print("4 leaf/fruit proto")
    leaf_proto = create_leaf_mesh(leaf_mat)
    fruit_ripe = create_fruit_mesh(ripe, True)
    fruit_unripe = create_fruit_mesh(unripe, False)
    print("5 distribute")
    leaves, fruits = place_foliage(twigs, leaf_proto, fruit_ripe, fruit_unripe)

    bpy.data.objects.remove(leaf_proto, do_unlink=True)
    bpy.data.objects.remove(fruit_ripe, do_unlink=True)
    bpy.data.objects.remove(fruit_unripe, do_unlink=True)

    print("6 join")
    wood_parts = [trunk] + [b[0] for b in branch_data] + [t[0] for t in twigs]
    wood = join_objs(wood_parts, "MulberryWood")
    leaf_mesh = join_objs(leaves, "MulberryLeaves")
    fruit_mesh = join_objs(fruits, "MulberryFruits")

    # Normalize height to 7.5m, base on z=0, centered XY — edit mesh verts directly
    parts = [o for o in (wood, leaf_mesh, fruit_mesh) if o]
    from mathutils import Vector as V
    mins = [1e9] * 3
    maxs = [-1e9] * 3
    for o in parts:
        for v in o.data.vertices:
            co = v.co
            for i in range(3):
                mins[i] = min(mins[i], co[i])
                maxs[i] = max(maxs[i], co[i])
    h = maxs[2] - mins[2]
    print(f"pre-scale H={h:.3f} W={maxs[0]-mins[0]:.3f} D={maxs[1]-mins[1]:.3f}")
    if h > 0.1:
        s = TREE_HEIGHT / h
        cx = (mins[0] + maxs[0]) * 0.5
        cy = (mins[1] + maxs[1]) * 0.5
        for o in parts:
            for v in o.data.vertices:
                v.co.x = (v.co.x - cx) * s
                v.co.y = (v.co.y - cy) * s
                v.co.z = (v.co.z - mins[2]) * s
            o.data.update()
            o.location = (0.0, 0.0, 0.0)
            o.scale = (1.0, 1.0, 1.0)

    empty = bpy.data.objects.new("MulberryTree", None)
    empty.empty_display_type = "PLAIN_AXES"
    empty.location = (0, 0, 0)
    bpy.context.collection.objects.link(empty)
    for o in parts:
        o.parent = empty

    # Final stats
    mins = [1e9] * 3
    maxs = [-1e9] * 3
    for o in parts:
        for c in o.bound_box:
            w = o.matrix_world @ V(c)
            for i in range(3):
                mins[i] = min(mins[i], w[i])
                maxs[i] = max(maxs[i], w[i])
    print("DONE")
    print(f"final H={maxs[2]-mins[2]:.3f} W={maxs[0]-mins[0]:.3f} D={maxs[1]-mins[1]:.3f} z0={mins[2]:.3f}")
    print("verts", {o.name: len(o.data.vertices) for o in parts})
    print("objects", [o.name for o in bpy.data.objects])
    return empty


if __name__ == "__main__":
    build_all()
