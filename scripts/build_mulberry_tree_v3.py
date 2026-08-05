"""
Hand-built mulberry tree — no Sapling/procedural generators.
Cylinders (bevelled curves), serrated leaf meshes, aggregate fruit meshes only.
Target: ~7m, broad rounded crown, light gray-brown fissured bark, game-clean mesh.
"""
import bpy
import bmesh
import math
import random
from mathutils import Vector, Matrix, Euler

SEED = 53
random.seed(SEED)

TREE_HEIGHT = 7.0
CANOPY_BOTTOM = 1.15
CANOPY_TOP = 6.85  # leave soft dome under 7m tip
CANOPY_RX = 3.65
CANOPY_RY = 3.40

REF_TREE = "/Users/xin/shanhai-island-editor/refs/mulberry_tree_ref.png"
REF_BARK = "/Users/xin/shanhai-island-editor/refs/mulberry_bark_ref.png"
REF_LEAF = "/Users/xin/shanhai-island-editor/refs/mulberry_leaf_fruit_ref.png"
OUT_GLB = "/Users/xin/shanhai-island-editor/models/mulberry-tree.glb"


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for coll in (bpy.data.meshes, bpy.data.curves, bpy.data.materials,
                 bpy.data.textures, bpy.data.images, bpy.data.lights, bpy.data.cameras):
        for block in list(coll):
            try:
                coll.remove(block)
            except Exception:
                pass


def ensure_object_mode():
    if bpy.context.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")


def setup_scene_refs_and_lights():
    """Ground plane, reference empties, upper-left key light matching reference."""
    # Ground
    bpy.ops.mesh.primitive_plane_add(size=14, location=(0, 0, 0))
    ground = bpy.context.active_object
    ground.name = "Ground"
    gmat = bpy.data.materials.new("GroundMat")
    gmat.use_nodes = True
    nt = gmat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (0.72, 0.72, 0.70, 1)
    bsdf.inputs["Roughness"].default_value = 0.95
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    ground.data.materials.append(gmat)

    # Dirt patch under tree
    bpy.ops.mesh.primitive_circle_add(vertices=24, radius=1.1, fill_type="NGON", location=(0, 0, 0.005))
    dirt = bpy.context.active_object
    dirt.name = "DirtPatch"
    dmat = bpy.data.materials.new("DirtMat")
    dmat.use_nodes = True
    nt = dmat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (0.28, 0.20, 0.12, 1)
    bsdf.inputs["Roughness"].default_value = 0.92
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    dirt.data.materials.append(dmat)

    # Reference images as empties (viewport background guides)
    for path, name, loc, scale in (
        (REF_TREE, "Ref_Tree", (-6.5, 0, 3.5), 7.0),
        (REF_BARK, "Ref_Bark", (6.5, 0, 2.0), 3.5),
        (REF_LEAF, "Ref_LeafFruit", (6.5, 0, 5.5), 3.0),
    ):
        try:
            img = bpy.data.images.load(path, check_existing=True)
        except Exception:
            continue
        empty = bpy.data.objects.new(name, None)
        empty.empty_display_type = "IMAGE"
        empty.data = img
        empty.empty_display_size = scale
        empty.location = loc
        empty.rotation_euler = (math.pi / 2, 0, math.pi / 2 if "Ref_Tree" in name else -math.pi / 2)
        bpy.context.collection.objects.link(empty)

    # Camera
    cam_data = bpy.data.cameras.new("Camera")
    cam = bpy.data.objects.new("Camera", cam_data)
    cam.location = (8.5, -9.5, 4.2)
    cam.rotation_euler = (math.radians(72), 0, math.radians(40))
    bpy.context.collection.objects.link(cam)
    bpy.context.scene.camera = cam

    # Key light upper-left (matches reference)
    key = bpy.data.lights.new("KeyLight", type="AREA")
    key.energy = 850
    key.size = 6.0
    key_obj = bpy.data.objects.new("KeyLight", key)
    key_obj.location = (-6.5, -3.5, 11.0)
    key_obj.rotation_euler = (math.radians(45), math.radians(-15), math.radians(-35))
    bpy.context.collection.objects.link(key_obj)

    fill = bpy.data.lights.new("FillLight", type="AREA")
    fill.energy = 180
    fill.size = 8.0
    fill_obj = bpy.data.objects.new("FillLight", fill)
    fill_obj.location = (5.0, 4.0, 6.0)
    fill_obj.rotation_euler = (math.radians(55), math.radians(20), math.radians(140))
    bpy.context.collection.objects.link(fill_obj)

    rim = bpy.data.lights.new("RimLight", type="AREA")
    rim.energy = 120
    rim.size = 4.0
    rim_obj = bpy.data.objects.new("RimLight", rim)
    rim_obj.location = (2.0, 7.0, 8.0)
    rim_obj.rotation_euler = (math.radians(50), 0, math.radians(200))
    bpy.context.collection.objects.link(rim_obj)

    world = bpy.context.scene.world
    if world is None:
        world = bpy.data.worlds.new("World")
        bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.78, 0.78, 0.76, 1)
        bg.inputs[1].default_value = 0.55

    # Viewport: material shading + camera background image
    for area in bpy.context.screen.areas:
        if area.type != "VIEW_3D":
            continue
        for space in area.spaces:
            if space.type != "VIEW_3D":
                continue
            space.shading.type = "MATERIAL"
            space.overlay.show_relationship_lines = False
            try:
                space.background_images.clear()
                bgimg = space.background_images.new()
                bgimg.image = bpy.data.images.load(REF_TREE, check_existing=True)
                bgimg.opacity = 0.35
                bgimg.display_depth = "BACK"
                space.show_background_images = True
            except Exception:
                pass


def make_mat(name, color, roughness=0.75, specular=0.25):
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
    """Light gray-brown bark with shallow irregular vertical cracks (bark close-up)."""
    mat = bpy.data.materials.new(name="MulberryBark")
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    tex = nodes.new("ShaderNodeTexCoord")
    mapping = nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (1.15, 1.15, 11.0)  # stretch vertical cracks
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 13.0
    noise.inputs["Detail"].default_value = 12.0
    noise.inputs["Roughness"].default_value = 0.72
    voronoi = nodes.new("ShaderNodeTexVoronoi")
    voronoi.feature = "DISTANCE_TO_EDGE"
    voronoi.inputs["Scale"].default_value = 7.5
    mix = nodes.new("ShaderNodeMix")
    mix.data_type = "FLOAT"
    mix.inputs["Factor"].default_value = 0.45
    ramp = nodes.new("ShaderNodeValToRGB")
    # dark fissure / creamy light-gray outer bark (matches bark ref)
    ramp.color_ramp.elements[0].position = 0.36
    ramp.color_ramp.elements[0].color = (0.22, 0.16, 0.11, 1)  # crack / inner tan
    mid = ramp.color_ramp.elements.new(0.50)
    mid.color = (0.48, 0.42, 0.34, 1)
    ramp.color_ramp.elements[1].position = 0.62
    ramp.color_ramp.elements[1].color = (0.62, 0.58, 0.50, 1)  # light gray-brown
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.62
    bump.inputs["Distance"].default_value = 0.028
    links.new(tex.outputs["Object"], mapping.inputs["Vector"])
    links.new(mapping.outputs["Vector"], noise.inputs["Vector"])
    links.new(mapping.outputs["Vector"], voronoi.inputs["Vector"])
    links.new(noise.outputs["Fac"], mix.inputs["A"])
    links.new(voronoi.outputs["Distance"], mix.inputs["B"])
    links.new(mix.outputs["Result"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(mix.outputs["Result"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    bsdf.inputs["Roughness"].default_value = 0.92
    key = "Specular IOR Level" if "Specular IOR Level" in bsdf.inputs else "Specular"
    if key in bsdf.inputs:
        bsdf.inputs[key].default_value = 0.10
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def make_leaf_mat():
    mat = make_mat("MulberryLeaf", (0.22, 0.46, 0.14), roughness=0.58, specular=0.28)
    # subtle translucency if available
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf and "Subsurface Weight" in bsdf.inputs:
        bsdf.inputs["Subsurface Weight"].default_value = 0.08
        if "Subsurface Radius" in bsdf.inputs:
            bsdf.inputs["Subsurface Radius"].default_value = (0.4, 0.7, 0.2)
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


def apply_bark_displace(obj, strength=0.018):
    tex = bpy.data.textures.new(obj.name + "_crack", type="CLOUDS")
    tex.noise_scale = 0.26
    tex.noise_depth = 3
    tex.noise_type = "HARD_NOISE"
    mod = obj.modifiers.new(name="BarkDisplace", type="DISPLACE")
    mod.texture = tex
    mod.strength = strength
    mod.mid_level = 0.52
    mod.direction = "NORMAL"
    mod.texture_coords = "LOCAL"
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.select_set(False)


def canopy_radius_at_z(z):
    """Broad rounded hemisphere — wide mid-band, flattened dome top (not pointed)."""
    if z < CANOPY_BOTTOM:
        return 0.0
    t = (z - CANOPY_BOTTOM) / (CANOPY_TOP - CANOPY_BOTTOM)
    t = max(0.0, min(1.0, t))
    # Circular dome of radius 1, squashed vertically
    # x = sqrt(1 - ((t-0.5)/0.55)^2) style for mid fullness
    u = (t - 0.08) / 0.92
    u = max(0.0, min(1.0, u))
    # Superellipse-ish dome: flatter top than semicircle
    profile = (1.0 - abs(2.0 * u - 1.0) ** 1.55) ** 0.55
    if t < 0.10:
        profile *= max(0.0, t / 0.10)
    if t > 0.90:
        # blunt top, keep residual radius
        profile = max(profile, 0.22 * (1.0 - (t - 0.90) / 0.10))
    return max(0.0, profile * CANOPY_RX)


def build_trunk_and_roots(bark_mat):
    # Main trunk — subtle S-bend, root flare; forks ~1/3 height like reference
    pts = [
        (0.00, 0.00, 0.00),
        (0.05, -0.04, 0.32),
        (0.07, 0.01, 0.70),
        (0.04, 0.05, 1.10),
        (-0.01, 0.04, 1.45),
        (-0.03, -0.01, 1.85),
        (0.01, -0.03, 2.25),
        (0.02, -0.01, 2.65),
    ]
    radii = [0.42, 0.36, 0.31, 0.27, 0.22, 0.17, 0.13, 0.09]
    trunk = curve_to_mesh("MulberryTrunk", pts, radii, bevel_res=4, res_u=12)
    bpy.context.view_layer.objects.active = trunk
    trunk.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.subdivide(number_cuts=1)
    bpy.ops.object.mode_set(mode="OBJECT")
    apply_bark_displace(trunk, 0.022)
    assign_mat(trunk, bark_mat)

    # Buttress / surface roots
    roots = []
    root_specs = [
        (15, 0.55, 0.11), (70, 0.48, 0.09), (130, 0.52, 0.10),
        (190, 0.50, 0.09), (250, 0.46, 0.085), (310, 0.53, 0.095),
    ]
    for i, (az_deg, length, r0) in enumerate(root_specs):
        az = math.radians(az_deg)
        rpts, rrads = [], []
        for k in range(5):
            t = k / 4
            dist = 0.18 + length * t
            z = 0.04 * (1 - t) ** 1.5 + 0.01
            x = math.cos(az) * dist + 0.02 * math.sin(k * 2.1)
            y = math.sin(az) * dist + 0.02 * math.cos(k * 1.7)
            rpts.append((x, y, z))
            rrads.append(r0 * (1 - 0.75 * t) + 0.012)
        robj = curve_to_mesh(f"Root_{i}", rpts, rrads, bevel_res=2, res_u=6)
        apply_bark_displace(robj, 0.01)
        assign_mat(robj, bark_mat)
        roots.append(robj)
    return trunk, roots


def build_main_limbs(bark_mat):
    """Spreading primary limbs for broad rounded crown — radial outward, not flame."""
    # (az, elev_from_vert, start_z, length, r0, r1, side, dip)
    # Lower / more horizontal primary limbs for early fork + broad crown
    specs = [
        (8, 82, 1.45, 3.55, 0.135, 0.030, 0.12, 0.0),
        (50, 80, 1.55, 3.40, 0.125, 0.028, -0.10, -0.1),
        (95, 78, 1.60, 3.30, 0.120, 0.027, 0.08, 0.0),
        (145, 81, 1.50, 3.50, 0.128, 0.028, -0.15, -0.25),
        (195, 80, 1.48, 3.45, 0.130, 0.029, 0.10, 0.0),
        (245, 79, 1.58, 3.25, 0.118, 0.026, -0.08, -0.1),
        (295, 81, 1.52, 3.35, 0.122, 0.027, 0.06, 0.0),
        (335, 76, 1.70, 3.10, 0.110, 0.024, -0.05, 0.0),
        # mid-upper dome fillers (still outward)
        (25, 55, 2.85, 2.70, 0.090, 0.020, 0.08, 0.0),
        (115, 58, 2.95, 2.55, 0.086, 0.019, -0.08, 0.0),
        (205, 54, 2.90, 2.65, 0.088, 0.019, 0.06, 0.0),
        (285, 56, 3.00, 2.50, 0.084, 0.018, -0.06, 0.0),
        (70, 42, 3.80, 2.20, 0.070, 0.016, 0.05, 0.0),
        (160, 44, 3.90, 2.10, 0.068, 0.015, -0.05, 0.0),
        (250, 43, 3.85, 2.15, 0.068, 0.015, 0.04, 0.0),
        (340, 45, 3.95, 2.05, 0.066, 0.015, -0.04, 0.0),
    ]
    limbs = []
    for i, (az_deg, elev_deg, z0, length, r0, r1, bend, dip) in enumerate(specs):
        az = math.radians(az_deg)
        elev = math.radians(elev_deg)
        n = 7
        pts, rads = [], []
        for k in range(n):
            t = k / (n - 1)
            dist = 0.10 + length * math.sin(elev) * (0.05 + 0.95 * t)
            side = bend * math.sin(t * math.pi) * length * 0.14
            z = z0 + length * math.cos(elev) * t + dip * math.sin(t * math.pi) * length * 0.1
            # Mild tip lift into dome — keep broad, not flame tip
            if t > 0.65:
                z += 0.18 * ((t - 0.65) / 0.35) ** 1.1
            x = math.cos(az) * dist + math.cos(az + math.pi / 2) * side
            y = math.sin(az) * dist * (CANOPY_RY / CANOPY_RX) + math.sin(az + math.pi / 2) * side
            x += 0.04 * math.sin(k * 1.8 + i)
            y += 0.04 * math.cos(k * 1.5 + i)
            # Clamp tip under rounded silhouette
            tip_r = math.sqrt(x * x + (y * CANOPY_RX / CANOPY_RY) ** 2)
            max_r = canopy_radius_at_z(z) * 0.95
            if tip_r > max_r and tip_r > 1e-4:
                s = max_r / tip_r
                x *= s
                y *= s
            pts.append((x, y, z))
            rads.append(r0 * (1 - t) + r1 * t)
        pts[0] = (math.cos(az) * 0.09, math.sin(az) * 0.09, z0)
        rads[0] = r0
        obj = curve_to_mesh(f"Limb_{i:02d}", pts, rads, bevel_res=3, res_u=10)
        apply_bark_displace(obj, 0.011)
        assign_mat(obj, bark_mat)
        limbs.append((obj, pts))
    return limbs


def build_twigs(limbs, bark_mat):
    twigs = []

    def add_twig(origin, direction, length, r0, name):
        direction = direction.normalized()
        radial = Vector((origin.x, origin.y, 0))
        if radial.length > 1e-4 and direction.dot(radial.normalized()) < 0.1:
            direction = (radial.normalized() * 0.7 + Vector((0, 0, 0.25)) + direction * 0.2).normalized()
        n = 4
        pts, rads = [], []
        for k in range(n):
            t = k / (n - 1)
            wob = Vector((
                0.022 * math.sin(t * 5 + hash(name) % 9),
                0.022 * math.cos(t * 4 + hash(name) % 7),
                0.008 * math.sin(t * 3),
            ))
            p = origin + direction * (length * t) + wob * t
            # stay under silhouette
            pr = math.sqrt(p.x ** 2 + (p.y * CANOPY_RX / CANOPY_RY) ** 2)
            mr = canopy_radius_at_z(p.z)
            if mr > 0.05 and pr > mr * 0.98:
                s = (mr * 0.96) / pr
                p = Vector((p.x * s, p.y * s, p.z))
            pts.append(p)
            rads.append(r0 * (1 - 0.72 * t))
        obj = curve_to_mesh(name, [(p.x, p.y, p.z) for p in pts], rads, bevel_res=1, res_u=5)
        assign_mat(obj, bark_mat)
        twigs.append((obj, pts, direction))

    for bi, (obj, bpts) in enumerate(limbs):
        bpts_v = [Vector(p) for p in bpts]
        n_tw = 14 if bi < 8 else 9
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
            direction = (radial * 0.55 + Vector((0, 0, 1)) * 0.28 + tang * 0.30)
            direction += Vector((
                random.uniform(-0.28, 0.28),
                random.uniform(-0.28, 0.28),
                random.uniform(-0.12, 0.22),
            ))
            length = random.uniform(0.40, 0.95) * (1.0 - 0.25 * origin.z / TREE_HEIGHT)
            add_twig(origin, direction, length, random.uniform(0.010, 0.018), f"Twig_{bi:02d}_{j:02d}")

    # Extra outer-shell twigs for dense rounded silhouette
    for k in range(72):
        z = random.uniform(CANOPY_BOTTOM + 0.25, CANOPY_TOP - 0.2)
        pr = canopy_radius_at_z(z)
        if pr < 0.3:
            continue
        rr = pr * random.uniform(0.50, 0.88)
        ang = random.uniform(0, math.tau)
        origin = Vector((math.cos(ang) * rr, math.sin(ang) * rr * (CANOPY_RY / CANOPY_RX), z))
        outward = Vector((origin.x, origin.y, 0.15)).normalized()
        outward = (outward * 0.72 + Vector((0, 0, random.uniform(-0.05, 0.45)))).normalized()
        add_twig(origin, outward, random.uniform(0.35, 0.85), random.uniform(0.008, 0.014), f"FillTwig_{k:03d}")
    return twigs


def create_leaf_mesh(leaf_mat):
    """Broad ovate leaf with serrated margin + cordate base hint (leaf close-up)."""
    bm = bmesh.new()
    length, width, steps = 0.20, 0.078, 18
    outline = []
    for i in range(steps + 1):
        t = i / steps
        y = t * length
        if t < 0.08:
            # slight cordate notch at base
            w = width * (0.15 + 0.55 * (t / 0.08))
        else:
            u = (t - 0.08) / 0.92
            # ovate: widest ~0.35 along length
            w = width * math.sin(math.pi * (0.08 + 0.92 * (1 - u ** 1.15))) * 1.18
            w = max(0.0012, w)
        if 0 < i < steps:
            # sharp serration
            serr = 0.0042 * (1.0 if i % 2 == 0 else -0.35)
            w = max(0.0012, w + serr)
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
    res = bmesh.ops.extrude_face_region(bm, geom=list(bm.faces))
    for v in [e for e in res["geom"] if isinstance(e, bmesh.types.BMVert)]:
        v.co.z -= 0.0012
    for v in bm.verts:
        x, y, z = v.co
        # V-fold + tip droop
        v.co.z += -abs(x) * 0.38 - 0.016 * (y / length) ** 2
    mesh = bpy.data.meshes.new("LeafMesh")
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("LeafProto", mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(leaf_mat)
    return obj


def create_fruit_mesh(mat, ripe=True):
    """Aggregate elongated mulberry (drupelets) — game-light poly."""
    bm = bmesh.new()
    rows, around = 4, 4
    length, radius, dr = 0.026, 0.0065, 0.0038
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
    obj = bpy.data.objects.new("FruitProto_" + ("R" if ripe else "U"), mesh)
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
        leaf.data = leaf_proto.data  # share mesh — game instance friendly until join
        bpy.context.collection.objects.link(leaf)
        leaf.hide_set(False)
        leaf.location = pos
        d = normal_hint.normalized() if normal_hint.length > 1e-6 else Vector((0, 0, 1))
        leaf.rotation_euler = d.to_track_quat("Y", "Z").to_euler()
        leaf.rotation_euler.z += random.uniform(-1.0, 1.0)
        leaf.rotation_euler.x += random.uniform(-0.4, 0.25)
        s = random.uniform(0.85, 1.45)
        leaf.scale = (s, s, s)
        leaf.name = name
        leaves.append(leaf)

    def add_fruit(pos, name):
        proto = fruit_ripe if random.random() < 0.68 else fruit_unripe
        fr = proto.copy()
        fr.data = proto.data
        bpy.context.collection.objects.link(fr)
        fr.hide_set(False)
        fr.location = pos + Vector((0, 0, -random.uniform(0.015, 0.048)))
        fr.rotation_euler = (
            random.uniform(-0.5, 0.5),
            random.uniform(-0.5, 0.5),
            random.uniform(0, 6.28),
        )
        s = random.uniform(0.75, 1.2)
        fr.scale = (s, s, s)
        fr.name = name
        fruits.append(fr)

    for ti, (twig, pts, direction) in enumerate(twigs):
        n_leaves = random.randint(5, 8)
        for li in range(n_leaves):
            t = 0.32 + 0.65 * (li / max(1, n_leaves - 1))
            seg = t * (len(pts) - 1)
            i0 = int(seg)
            i1 = min(i0 + 1, len(pts) - 1)
            pos = pts[i0].lerp(pts[i1], seg - i0)
            side = direction.cross(Vector((0, 0, 1)))
            if side.length < 1e-4:
                side = direction.cross(Vector((1, 0, 0)))
            side.normalize()
            up = direction.cross(side).normalized()
            pos = pos + side * random.uniform(-0.05, 0.05) + up * random.uniform(0.01, 0.055)
            hint = up * 0.5 + direction * 0.25 + Vector((0, 0, 0.35))
            add_leaf(pos, hint, f"Leaf_{ti:03d}_{li:02d}")
        if random.random() < 0.58:
            for fi in range(random.randint(1, 3)):
                t = random.uniform(0.4, 0.92)
                seg = t * (len(pts) - 1)
                i0 = int(seg)
                i1 = min(i0 + 1, len(pts) - 1)
                pos = pts[i0].lerp(pts[i1], seg - i0)
                add_fruit(pos, f"Fruit_{ti:03d}_{fi:02d}")

    # Outer canopy shell leaves for solid rounded / hemispherical silhouette
    cloud_id = 0
    for k in range(1100):
        z = random.uniform(CANOPY_BOTTOM + 0.12, CANOPY_TOP - 0.02)
        pr = canopy_radius_at_z(z)
        if pr < 0.18:
            continue
        # Heavy outer shell + mid fill for dense ref look
        roll = random.random()
        if roll < 0.70:
            rr = pr * random.uniform(0.82, 1.03)
        elif roll < 0.90:
            rr = pr * random.uniform(0.55, 0.82)
        else:
            rr = pr * random.uniform(0.25, 0.55)
        ang = random.uniform(0, math.tau)
        x = math.cos(ang) * rr + random.uniform(-0.05, 0.05)
        y = math.sin(ang) * rr * (CANOPY_RY / CANOPY_RX) + random.uniform(-0.05, 0.05)
        pos = Vector((x, y, z + random.uniform(-0.04, 0.04)))
        hint = Vector((x, y, 0.25)) if (abs(x) + abs(y)) > 0.01 else Vector((0, 0, 1))
        add_leaf(pos, hint, f"CloudLeaf_{cloud_id:04d}")
        cloud_id += 1
        if random.random() < 0.12:
            add_fruit(pos, f"CloudFruit_{cloud_id:04d}")
    return leaves, fruits


def join_objs(objects, name, make_unique=True):
    ensure_object_mode()
    bpy.ops.object.select_all(action="DESELECT")
    if not objects:
        return None
    for o in objects:
        o.hide_set(False)
        if make_unique and o.data.users > 1:
            o.data = o.data.copy()
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


def normalize_height(parts):
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


def export_glb(root_empty, parts):
    ensure_object_mode()
    bpy.ops.object.select_all(action="DESELECT")
    root_empty.select_set(True)
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = root_empty
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB,
        use_selection=True,
        export_format="GLB",
        export_apply=True,
        export_yup=True,
    )
    print("Exported", OUT_GLB)


def build_all():
    clear_scene()
    setup_scene_refs_and_lights()

    bark = make_bark_mat()
    leaf_mat = make_leaf_mat()
    ripe = make_mat("MulberryRipe", (0.06, 0.01, 0.07), roughness=0.28, specular=0.65)
    unripe = make_mat("MulberryUnripe", (0.50, 0.60, 0.24), roughness=0.52, specular=0.32)

    print("1 trunk+roots")
    trunk, roots = build_trunk_and_roots(bark)
    print("2 limbs")
    limbs = build_main_limbs(bark)
    print("3 twigs")
    twigs = build_twigs(limbs, bark)
    print("4 leaf/fruit proto")
    leaf_proto = create_leaf_mesh(leaf_mat)
    fruit_ripe = create_fruit_mesh(ripe, True)
    fruit_unripe = create_fruit_mesh(unripe, False)
    print("5 foliage")
    leaves, fruits = place_foliage(twigs, leaf_proto, fruit_ripe, fruit_unripe)

    bpy.data.objects.remove(leaf_proto, do_unlink=True)
    bpy.data.objects.remove(fruit_ripe, do_unlink=True)
    bpy.data.objects.remove(fruit_unripe, do_unlink=True)

    print("6 join")
    wood_parts = [trunk] + roots + [b[0] for b in limbs] + [t[0] for t in twigs]
    wood = join_objs(wood_parts, "MulberryWood")
    leaf_mesh = join_objs(leaves, "MulberryLeaves")
    fruit_mesh = join_objs(fruits, "MulberryFruits")

    parts = [o for o in (wood, leaf_mesh, fruit_mesh) if o]
    normalize_height(parts)

    # Parent under single group empty; keep ground/refs/lights out of asset
    empty = bpy.data.objects.new("MulberryTree", None)
    empty.empty_display_type = "PLAIN_AXES"
    empty.location = (0, 0, 0)
    bpy.context.collection.objects.link(empty)
    for o in parts:
        o.parent = empty

    # Stats
    mins = [1e9] * 3
    maxs = [-1e9] * 3
    for o in parts:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            for i in range(3):
                mins[i] = min(mins[i], w[i])
                maxs[i] = max(maxs[i], w[i])
    print("DONE")
    print(f"final H={maxs[2]-mins[2]:.3f} W={maxs[0]-mins[0]:.3f} D={maxs[1]-mins[1]:.3f}")
    print("verts", {o.name: len(o.data.vertices) for o in parts})
    export_glb(empty, parts)
    return empty


if __name__ == "__main__":
    build_all()
