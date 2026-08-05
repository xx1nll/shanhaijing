"""
Catalpa tree from scratch — cylinders/curves/spheres/planes only.
11m height, flaky bark, large ovate leaves, bell flowers, long hanging pods.
"""
import bpy
import bmesh
import math
import random
from mathutils import Vector, Matrix

SEED = 61
random.seed(SEED)

TREE_HEIGHT = 11.0
TRUNK_BASE_R = 0.45
CANOPY_BOTTOM = 3.2
CANOPY_TOP = 11.0
CANOPY_RX = 2.75  # half-width ~5.5m (narrower oval/pyramidal than mulberry)
CANOPY_RY = 2.55


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


def make_mat(name, color, roughness=0.7, specular=0.25):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
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
    """Light gray-brown catalpa bark with flaky peeling look."""
    mat = bpy.data.materials.new(name="CatalpaBark")
    mat.use_nodes = True
    nt = mat.node_tree
    nodes, links = nt.nodes, nt.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    tex = nodes.new("ShaderNodeTexCoord")
    mapping = nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (2.0, 2.0, 7.0)
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 9.0
    noise.inputs["Detail"].default_value = 12.0
    noise.inputs["Roughness"].default_value = 0.75
    voronoi = nodes.new("ShaderNodeTexVoronoi")
    voronoi.feature = "DISTANCE_TO_EDGE"
    voronoi.inputs["Scale"].default_value = 6.0
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.35
    ramp.color_ramp.elements[0].color = (0.28, 0.22, 0.16, 1)  # inner tan
    ramp.color_ramp.elements[1].position = 0.62
    ramp.color_ramp.elements[1].color = (0.58, 0.54, 0.48, 1)  # outer gray-brown
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.7
    bump.inputs["Distance"].default_value = 0.04
    links.new(tex.outputs["Object"], mapping.inputs["Vector"])
    links.new(mapping.outputs["Vector"], noise.inputs["Vector"])
    links.new(mapping.outputs["Vector"], voronoi.inputs["Vector"])
    links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(voronoi.outputs["Distance"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    bsdf.inputs["Roughness"].default_value = 0.92
    key = "Specular IOR Level" if "Specular IOR Level" in bsdf.inputs else "Specular"
    if key in bsdf.inputs:
        bsdf.inputs[key].default_value = 0.1
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
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


def apply_displace(obj, strength=0.025, scale=0.32):
    tex = bpy.data.textures.new(obj.name + "_tex", type="CLOUDS")
    tex.noise_scale = scale
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


def assign_mat(obj, mat):
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)


def canopy_radius_at_z(z):
    """Oval/pyramidal canopy radius in meters."""
    if z < CANOPY_BOTTOM:
        return 0.0
    t = (z - CANOPY_BOTTOM) / (CANOPY_TOP - CANOPY_BOTTOM)
    t = max(0.0, min(1.0, t))
    # Wider mid-upper (catalpa rounded crown), softer base of canopy
    profile = math.sin(math.pi * (t ** 0.75))
    if t < 0.2:
        profile *= 0.4 + 3.0 * t
    if t > 0.78:
        profile *= 1.0 - 0.45 * ((t - 0.78) / 0.22) ** 1.1
    return profile * CANOPY_RX


def build_trunk(bark_mat):
    pts = [
        (0.00, 0.00, 0.00),
        (0.06, -0.04, 0.55),
        (0.08, 0.03, 1.20),
        (0.04, 0.07, 2.00),
        (-0.03, 0.05, 2.90),
        (-0.05, -0.02, 3.80),
        (-0.02, -0.06, 4.80),
        (0.03, -0.04, 5.90),
        (0.02, 0.01, 7.00),
        (0.00, 0.00, 8.20),
    ]
    radii = [0.48, 0.45, 0.42, 0.38, 0.33, 0.28, 0.22, 0.17, 0.12, 0.08]
    trunk = curve_to_mesh("CatalpaTrunk", pts, radii, bevel_res=4, res_u=12)
    bpy.context.view_layer.objects.active = trunk
    trunk.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.subdivide(number_cuts=1)
    bpy.ops.object.mode_set(mode="OBJECT")
    apply_displace(trunk, strength=0.028, scale=0.35)
    assign_mat(trunk, bark_mat)
    return trunk


def add_bark_flakes(trunk, bark_mat, count=55):
    """Thin curled plane flakes peeling off trunk for catalpa bark look."""
    flakes = []
    # Sample trunk surface verts
    verts = [trunk.matrix_world @ v.co for v in trunk.data.vertices]
    mid = [v for v in verts if 0.4 < v.z < 6.5]
    random.shuffle(mid)
    for i, origin in enumerate(mid[:count]):
        radial = Vector((origin.x, origin.y, 0))
        if radial.length < 1e-4:
            continue
        radial.normalize()
        # Thin plate
        bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0, 0, 0))
        flake = bpy.context.active_object
        flake.name = f"BarkFlake_{i:02d}"
        # Scale to irregular vertical flake
        sx = random.uniform(0.06, 0.14)
        sy = random.uniform(0.12, 0.28)
        flake.scale = (sx, sy, 1.0)
        bpy.ops.object.transform_apply(scale=True)
        # Curl: bend in edit mode
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.subdivide(number_cuts=2)
        bpy.ops.object.mode_set(mode="OBJECT")
        for v in flake.data.vertices:
            # peel outward
            v.co.z += 0.015 * (v.co.x ** 2) * 40 + random.uniform(0, 0.008)
        flake.data.update()
        # Orient: local +Z outward, +Y up trunk
        quat = radial.to_track_quat("Z", "Y")
        flake.rotation_euler = quat.to_euler()
        flake.rotation_euler.z += random.uniform(-0.4, 0.4)
        # Place slightly outside surface
        flake.location = origin + radial * random.uniform(0.01, 0.04)
        assign_mat(flake, bark_mat)
        flakes.append(flake)
    return flakes


def build_main_branches(bark_mat):
    # (az, start_z, length_f, r0, r1, bend, z_gain)
    specs = [
        (210, 3.10, 1.05, 0.16, 0.032, 0.30, 0.82),
        (30, 3.20, 1.02, 0.155, 0.030, -0.28, 0.84),
        (140, 3.40, 0.98, 0.14, 0.028, 0.22, 0.80),
        (320, 3.30, 0.96, 0.138, 0.028, -0.20, 0.81),
        (90, 3.60, 0.92, 0.125, 0.026, 0.15, 0.78),
        (270, 3.70, 0.90, 0.122, 0.026, -0.14, 0.77),
        (175, 4.40, 0.88, 0.11, 0.024, 0.25, 0.86),
        (10, 4.50, 0.86, 0.108, 0.024, -0.22, 0.87),
        (60, 5.40, 0.78, 0.09, 0.020, 0.18, 0.92),
        (240, 5.50, 0.76, 0.088, 0.020, -0.16, 0.90),
        (120, 6.40, 0.68, 0.075, 0.018, 0.12, 0.95),
        (300, 6.50, 0.66, 0.072, 0.017, -0.12, 0.94),
        (0, 7.20, 0.55, 0.06, 0.015, 0.08, 0.98),
        (180, 7.30, 0.52, 0.058, 0.014, -0.08, 0.97),
    ]
    branches = []
    for i, (az_deg, start_z, length_f, r0, r1, bend, z_gain) in enumerate(specs):
        az = math.radians(az_deg)
        n = 7
        pts, rads = [], []
        for k in range(n):
            t = k / (n - 1)
            z = start_z + t * (TREE_HEIGHT - start_z - 0.2) * z_gain
            profile_r = canopy_radius_at_z(z)
            reach = length_f * profile_r * (0.4 + 0.55 * math.sin(min(1.0, t * 1.1) * math.pi * 0.5))
            if t < 0.12:
                reach *= t / 0.12 * 0.3 + 0.05
            side = bend * math.sin(t * math.pi) * 0.5
            x = math.cos(az) * reach + math.cos(az + math.pi / 2) * side
            y = math.sin(az) * reach * (CANOPY_RY / CANOPY_RX) + math.sin(az + math.pi / 2) * side
            x += 0.06 * math.sin(k * 1.7 + i)
            y += 0.06 * math.cos(k * 1.3 + i)
            pts.append((x, y, z))
            rads.append(r0 * (1 - t) + r1 * t)
        pts[0] = (math.cos(az) * 0.1, math.sin(az) * 0.1, start_z)
        rads[0] = r0
        obj = curve_to_mesh(f"Limb_{i:02d}", pts, rads, bevel_res=3)
        apply_displace(obj, strength=0.014, scale=0.4)
        assign_mat(obj, bark_mat)
        branches.append((obj, pts))
    return branches


def build_twigs(branch_data, bark_mat):
    twigs = []

    def add_twig(origin, direction, length, r0, name):
        direction = direction.normalized()
        n = 4
        pts, rads = [], []
        for k in range(n):
            t = k / (n - 1)
            wob = Vector((
                0.03 * math.sin(t * 5 + hash(name) % 9),
                0.03 * math.cos(t * 4 + hash(name) % 7),
                0.0,
            ))
            pts.append(origin + direction * (length * t) + wob * t)
            rads.append(r0 * (1 - 0.65 * t))
        obj = curve_to_mesh(name, [(p.x, p.y, p.z) for p in pts], rads, bevel_res=1, res_u=6)
        assign_mat(obj, bark_mat)
        twigs.append((obj, pts, direction))

    for bi, (obj, bpts) in enumerate(branch_data):
        bpts_v = [Vector(p) for p in bpts]
        n_tw = 14 if bi < 6 else 10
        for j in range(n_tw):
            t = 0.25 + 0.7 * (j / max(1, n_tw - 1))
            seg = t * (len(bpts_v) - 1)
            i0 = int(seg)
            i1 = min(i0 + 1, len(bpts_v) - 1)
            origin = bpts_v[i0].lerp(bpts_v[i1], seg - i0)
            radial = Vector((origin.x, origin.y, 0))
            if radial.length < 1e-4:
                radial = Vector((1, 0, 0))
            radial.normalize()
            tang = (bpts_v[i1] - bpts_v[i0]).normalized()
            direction = (radial * 0.45 + Vector((0, 0, 1)) * 0.45 + tang * 0.25)
            direction += Vector((
                random.uniform(-0.3, 0.3),
                random.uniform(-0.3, 0.3),
                random.uniform(-0.1, 0.25),
            ))
            length = random.uniform(0.55, 1.25) * (1.05 - 0.3 * origin.z / TREE_HEIGHT)
            add_twig(origin, direction, length, random.uniform(0.012, 0.022), f"Twig_{bi:02d}_{j:02d}")

    # Volume fillers for denser crown tips
    for k in range(55):
        for _ in range(25):
            z = random.uniform(CANOPY_BOTTOM + 0.3, CANOPY_TOP - 0.2)
            pr = canopy_radius_at_z(z)
            if pr < 0.25:
                continue
            rr = pr * random.uniform(0.2, 0.75)
            ang = random.uniform(0, math.tau)
            origin = Vector((math.cos(ang) * rr, math.sin(ang) * rr * (CANOPY_RY / CANOPY_RX), z))
            outward = Vector((origin.x, origin.y, 0.3))
            if outward.length < 1e-4:
                outward = Vector((1, 0, 0.3))
            outward = (outward.normalized() * 0.65 + Vector((0, 0, 0.45))).normalized()
            length = random.uniform(0.4, 0.95)
            tip = origin + outward * length
            tip_r = math.sqrt(tip.x ** 2 + (tip.y * CANOPY_RX / CANOPY_RY) ** 2)
            max_r = canopy_radius_at_z(tip.z)
            if tip_r > max_r * 0.98 and tip_r > 1e-4:
                length *= (max_r * 0.95) / tip_r
            add_twig(origin, outward, length, random.uniform(0.009, 0.016), f"FillTwig_{k:03d}")
            break
    return twigs


def create_leaf_mesh(leaf_mat):
    """Large broad ovate / heart-shaped catalpa leaf."""
    bm = bmesh.new()
    length = 0.32
    width = 0.14
    steps = 16
    outline = []
    for i in range(steps + 1):
        t = i / steps
        y = t * length
        if t < 0.08:
            # cordate notch / wide base
            w = width * (0.35 + 0.65 * (t / 0.08) ** 0.5)
        else:
            u = (t - 0.08) / 0.92
            # broad ovate, widest ~0.28, pointed tip
            w = width * math.sin(math.pi * (0.02 + 0.98 * (1 - u ** 1.35))) * 1.25
            w = max(0.002, w)
        outline.append((w, y))

    coords = [(0.0, -0.01, 0.0)]  # slight petiole
    for w, y in outline[1:]:
        coords.append((w, y, 0.0))
    for w, y in reversed(outline[1:-1]):
        coords.append((-w, y, 0.0))
    verts = [bm.verts.new(c) for c in coords]
    bm.verts.ensure_lookup_table()
    bm.faces.new(verts)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    res = bmesh.ops.extrude_face_region(bm, geom=list(bm.faces))
    for v in [e for e in res["geom"] if isinstance(e, bmesh.types.BMVert)]:
        v.co.z -= 0.0018
    for v in bm.verts:
        x, y, z = v.co
        # gentle dome + tip droop
        v.co.z += 0.012 * (1 - abs(x) / max(width, 1e-4)) - 0.025 * (max(0, y) / length) ** 2

    mesh = bpy.data.meshes.new("CatalpaLeaf")
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("LeafProto", mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(leaf_mat)
    return obj


def create_bell_flower(flower_mat):
    """Creamy-white campanulate (bell) flower from sphere + taper."""
    bm = bmesh.new()
    # Start from UV sphere, reshape into bell
    bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=0.018)
    for v in bm.verts:
        x, y, z = v.co
        # map z from -r..r to bell: narrow top (attachment), flare bottom
        t = (z + 0.018) / 0.036  # 0 at bottom, 1 at top
        # flip so opening points +Y later via orientation; use local -Z as opening
        flare = 0.55 + 0.9 * (1 - t) ** 0.7
        neck = 0.45 + 0.55 * t
        s = flare if t < 0.55 else neck
        v.co.x *= s
        v.co.y *= s
        v.co.z = (t - 0.5) * 0.038
    # open bottom a bit by scaling lower ring
    mesh = bpy.data.meshes.new("BellFlower")
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("FlowerProto", mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(flower_mat)
    return obj


def create_flower_cluster(flower_mat):
    """Upright panicle of many small bells."""
    bm = bmesh.new()
    # Build one bell into bmesh repeatedly
    for row in range(5):
        n = 3 + row
        z = 0.02 + row * 0.028
        ring_r = 0.01 + row * 0.008
        for k in range(n):
            a = 2 * math.pi * k / n + row * 0.3
            cx = math.cos(a) * ring_r * random.uniform(0.7, 1.0)
            cy = math.sin(a) * ring_r * random.uniform(0.7, 1.0)
            # mini bell as icosphere reshaped lightly
            mat = Matrix.Translation((cx, cy, z)) @ Matrix.Scale(random.uniform(0.7, 1.0), 4)
            bmesh.ops.create_uvsphere(
                bm, u_segments=6, v_segments=4, radius=0.012 * random.uniform(0.85, 1.15), matrix=mat
            )
    # tip bud
    bmesh.ops.create_uvsphere(
        bm, u_segments=6, v_segments=4, radius=0.01, matrix=Matrix.Translation((0, 0, 0.16))
    )
    mesh = bpy.data.meshes.new("FlowerCluster")
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("ClusterProto", mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(flower_mat)
    return obj


def create_seed_pod(pod_mat):
    """Long slender cylindrical catalpa seed pod."""
    length = random.uniform(0.38, 0.55)
    radius = 0.007
    pts = [(0, 0, 0), (0.005, 0, -length * 0.35), (-0.004, 0.003, -length * 0.7), (0, 0, -length)]
    rads = [radius * 0.7, radius, radius * 0.95, radius * 0.35]
    obj = curve_to_mesh("PodProto", pts, rads, bevel_res=2, res_u=8)
    assign_mat(obj, pod_mat)
    return obj, length


def place_foliage(twigs, leaf_proto, cluster_proto, pod_proto, pod_mat):
    leaves, flowers, pods = [], [], []
    leaf_proto.hide_set(True)
    cluster_proto.hide_set(True)
    pod_proto.hide_set(True)

    def add_leaf(pos, hint, name):
        leaf = leaf_proto.copy()
        leaf.data = leaf_proto.data.copy()
        bpy.context.collection.objects.link(leaf)
        leaf.hide_set(False)
        leaf.location = pos
        d = hint.normalized() if hint.length > 1e-6 else Vector((0, 0, 1))
        leaf.rotation_euler = d.to_track_quat("Y", "Z").to_euler()
        leaf.rotation_euler.z += random.uniform(-0.9, 0.9)
        leaf.rotation_euler.x += random.uniform(-0.55, 0.15)  # slight droop
        s = random.uniform(0.75, 1.2)
        leaf.scale = (s, s, s)
        leaf.name = name
        leaves.append(leaf)

    def add_cluster(pos, name):
        c = cluster_proto.copy()
        c.data = cluster_proto.data.copy()
        bpy.context.collection.objects.link(c)
        c.hide_set(False)
        c.location = pos
        # upright
        c.rotation_euler = (
            random.uniform(-0.15, 0.15),
            random.uniform(-0.15, 0.15),
            random.uniform(0, 6.28),
        )
        s = random.uniform(0.85, 1.25)
        c.scale = (s, s, s)
        c.name = name
        flowers.append(c)

    def add_pod(pos, name):
        # fresh pod each time for length variation via scale
        p = pod_proto.copy()
        p.data = pod_proto.data.copy()
        bpy.context.collection.objects.link(p)
        p.hide_set(False)
        p.location = pos
        # hang straight down with tiny sway
        p.rotation_euler = (
            random.uniform(-0.08, 0.08),
            random.uniform(-0.08, 0.08),
            random.uniform(0, 6.28),
        )
        s = random.uniform(0.85, 1.2)
        p.scale = (s, s, s)
        p.name = name
        pods.append(p)

    tip_sites = []
    for ti, (twig, pts, direction) in enumerate(twigs):
        n_leaves = random.randint(3, 6)
        for li in range(n_leaves):
            t = 0.4 + 0.55 * (li / max(1, n_leaves - 1))
            seg = t * (len(pts) - 1)
            i0 = int(seg)
            i1 = min(i0 + 1, len(pts) - 1)
            pos = pts[i0].lerp(pts[i1], seg - i0)
            side = direction.cross(Vector((0, 0, 1)))
            if side.length < 1e-4:
                side = direction.cross(Vector((1, 0, 0)))
            side.normalize()
            up = direction.cross(side).normalized()
            pos = pos + side * random.uniform(-0.08, 0.08) + up * random.uniform(0.02, 0.08)
            hint = (up * 0.3 + Vector((0, 0, 1)) * 0.2 + direction * 0.15)
            add_leaf(pos, hint, f"Leaf_{ti:03d}_{li:02d}")

        tip = pts[-1]
        tip_sites.append(tip)
        # Flowers on upper twigs
        if tip.z > 5.5 and random.random() < 0.55:
            add_cluster(tip + Vector((0, 0, 0.05)), f"Flower_{ti:03d}")
        # Pods hanging from mid-outer twigs
        if tip.z > 4.0 and random.random() < 0.5:
            n_pods = random.randint(2, 5)
            for pi in range(n_pods):
                offset = Vector((
                    random.uniform(-0.04, 0.04),
                    random.uniform(-0.04, 0.04),
                    -0.02,
                ))
                add_pod(tip + offset, f"Pod_{ti:03d}_{pi:02d}")

    # Cloud leaves for solid canopy silhouette
    cloud_id = 0
    for k in range(520):
        z = random.uniform(CANOPY_BOTTOM + 0.2, CANOPY_TOP - 0.1)
        pr = canopy_radius_at_z(z)
        if pr < 0.2:
            continue
        rr = pr * (random.uniform(0.55, 0.98) if random.random() < 0.72 else random.uniform(0.2, 0.55))
        ang = random.uniform(0, math.tau)
        x = math.cos(ang) * rr + random.uniform(-0.08, 0.08)
        y = math.sin(ang) * rr * (CANOPY_RY / CANOPY_RX) + random.uniform(-0.08, 0.08)
        pos = Vector((x, y, z + random.uniform(-0.06, 0.06)))
        hint = Vector((0, 0, 1)) + Vector((x, y, 0)) * 0.15
        add_leaf(pos, hint, f"CloudLeaf_{cloud_id:04d}")
        cloud_id += 1

    # Extra flower crowns near top
    for fi in range(28):
        z = random.uniform(7.0, 10.5)
        pr = canopy_radius_at_z(z)
        rr = pr * random.uniform(0.15, 0.7)
        ang = random.uniform(0, math.tau)
        pos = Vector((math.cos(ang) * rr, math.sin(ang) * rr * (CANOPY_RY / CANOPY_RX), z))
        add_cluster(pos, f"CrownFlower_{fi:02d}")

    # Extra hanging pod groups mid-canopy
    for pi in range(40):
        z = random.uniform(4.5, 9.0)
        pr = canopy_radius_at_z(z)
        rr = pr * random.uniform(0.3, 0.85)
        ang = random.uniform(0, math.tau)
        base = Vector((math.cos(ang) * rr, math.sin(ang) * rr * (CANOPY_RY / CANOPY_RX), z))
        for j in range(random.randint(2, 4)):
            add_pod(base + Vector((random.uniform(-0.05, 0.05), random.uniform(-0.05, 0.05), 0)), f"HangPod_{pi:02d}_{j}")

    return leaves, flowers, pods


def join_objs(objects, name):
    ensure_object_mode()
    bpy.ops.object.select_all(action="DESELECT")
    if not objects:
        return None
    for o in objects:
        o.hide_set(False)
        mw = o.matrix_world.copy()
        o.data.transform(mw)
        o.matrix_world = Matrix.Identity(4)
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = name
    joined.location = (0, 0, 0)
    joined.rotation_euler = (0, 0, 0)
    joined.scale = (1, 1, 1)
    return joined


def normalize_tree(parts):
    mins = [1e9] * 3
    maxs = [-1e9] * 3
    for o in parts:
        for v in o.data.vertices:
            for i in range(3):
                mins[i] = min(mins[i], v.co[i])
                maxs[i] = max(maxs[i], v.co[i])
    h = maxs[2] - mins[2]
    print(f"pre-scale H={h:.3f} W={maxs[0]-mins[0]:.3f} D={maxs[1]-mins[1]:.3f}")
    if h < 0.1:
        return
    s = TREE_HEIGHT / h
    cx = (mins[0] + maxs[0]) * 0.5
    cy = (mins[1] + maxs[1]) * 0.5
    for o in parts:
        for v in o.data.vertices:
            v.co.x = (v.co.x - cx) * s
            v.co.y = (v.co.y - cy) * s
            v.co.z = (v.co.z - mins[2]) * s
        o.data.update()
        o.location = (0, 0, 0)


def build_all():
    clear_scene()
    bark = make_bark_mat()
    leaf_mat = make_mat("CatalpaLeaf", (0.22, 0.48, 0.18), roughness=0.65, specular=0.2)
    flower_mat = make_mat("CatalpaFlower", (0.92, 0.90, 0.82), roughness=0.45, specular=0.4)
    pod_mat = make_mat("CatalpaPod", (0.30, 0.48, 0.18), roughness=0.55, specular=0.25)

    print("1 trunk")
    trunk = build_trunk(bark)
    print("1b bark flakes")
    flakes = add_bark_flakes(trunk, bark, count=48)
    print("2 limbs")
    branch_data = build_main_branches(bark)
    print("3 twigs")
    twigs = build_twigs(branch_data, bark)
    print("4 prototypes")
    leaf_proto = create_leaf_mesh(leaf_mat)
    cluster_proto = create_flower_cluster(flower_mat)
    pod_proto, _ = create_seed_pod(pod_mat)
    print("5 distribute")
    leaves, flowers, pods = place_foliage(twigs, leaf_proto, cluster_proto, pod_proto, pod_mat)

    for proto in (leaf_proto, cluster_proto, pod_proto):
        bpy.data.objects.remove(proto, do_unlink=True)

    print("6 join")
    wood_parts = [trunk] + flakes + [b[0] for b in branch_data] + [t[0] for t in twigs]
    wood = join_objs(wood_parts, "CatalpaWood")
    leaf_mesh = join_objs(leaves, "CatalpaLeaves")
    flower_mesh = join_objs(flowers, "CatalpaFlowers") if flowers else None
    pod_mesh = join_objs(pods, "CatalpaPods") if pods else None

    parts = [o for o in (wood, leaf_mesh, flower_mesh, pod_mesh) if o]
    normalize_tree(parts)

    # Clamp trunk base radius
    if wood:
        for v in wood.data.vertices:
            if v.co.z < 0.15:
                r = (v.co.x ** 2 + v.co.y ** 2) ** 0.5
                if r > 0.52:
                    s = 0.48 / r
                    v.co.x *= s
                    v.co.y *= s
        wood.data.update()

    empty = bpy.data.objects.new("CatalpaTree", None)
    empty.empty_display_type = "PLAIN_AXES"
    empty.location = (0, 0, 0)
    bpy.context.collection.objects.link(empty)
    for o in parts:
        o.parent = empty

    mins = [1e9] * 3
    maxs = [-1e9] * 3
    for o in parts:
        for v in o.data.vertices:
            for i in range(3):
                mins[i] = min(mins[i], v.co[i])
                maxs[i] = max(maxs[i], v.co[i])
    print("DONE")
    print(f"final H={maxs[2]-mins[2]:.3f} W={maxs[0]-mins[0]:.3f} D={maxs[1]-mins[1]:.3f} z0={mins[2]:.3f}")
    print("verts", {o.name: len(o.data.vertices) for o in parts})
    print("objects", [o.name for o in bpy.data.objects])
    return empty


if __name__ == "__main__":
    build_all()
