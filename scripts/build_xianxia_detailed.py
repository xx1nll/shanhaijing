"""仙侠 / celestial woman — all-angle correct hair, vertical halo, layered robe."""
import bpy
import bmesh
import math
from mathutils import Vector, Matrix, Quaternion


# ---------------------------------------------------------------------------
# utilities
# ---------------------------------------------------------------------------

def clear_scene():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.curves,
                 bpy.data.cameras, bpy.data.lights):
        for block in list(coll):
            coll.remove(block)


def mat(name, color, rough=0.4, metallic=0.0, alpha=1.0,
        emit=None, emit_str=0.0, sss=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    if "Roughness" in bsdf.inputs:
        bsdf.inputs["Roughness"].default_value = rough
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = metallic
    if alpha < 1.0:
        if hasattr(m, "blend_method"):
            m.blend_method = "BLEND"
        if "Alpha" in bsdf.inputs:
            bsdf.inputs["Alpha"].default_value = alpha
        if alpha < 0.65:
            nt = m.node_tree
            out = nt.nodes["Material Output"]
            trans = nt.nodes.new("ShaderNodeBsdfTransparent")
            mix = nt.nodes.new("ShaderNodeMixShader")
            mix.inputs["Fac"].default_value = 1.0 - alpha
            for link in list(nt.links):
                if link.to_node == out and link.to_socket == out.inputs[0]:
                    nt.links.remove(link)
            nt.links.new(bsdf.outputs[0], mix.inputs[2])
            nt.links.new(trans.outputs[0], mix.inputs[1])
            nt.links.new(mix.outputs[0], out.inputs[0])
    if emit is not None and "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = (*emit, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emit_str
    if sss > 0:
        for key in ("Subsurface Weight", "Subsurface"):
            if key in bsdf.inputs:
                bsdf.inputs[key].default_value = sss
                break
        if "Subsurface Radius" in bsdf.inputs:
            bsdf.inputs["Subsurface Radius"].default_value = (1.0, 0.35, 0.2)
    return m


def shade_subdiv(obj, levels=2, render=3):
    if obj.type == "MESH":
        for p in obj.data.polygons:
            p.use_smooth = True
    for m in list(obj.modifiers):
        if m.type == "SUBSURF":
            obj.modifiers.remove(m)
    if levels > 0 and obj.type == "MESH":
        mod = obj.modifiers.new("Subdivision", "SUBSURF")
        mod.levels = levels
        mod.render_levels = render
    return obj


def parent(obj, root, matl=None):
    obj.parent = root
    if matl and obj.type in {"MESH", "CURVE"}:
        if obj.data.materials:
            obj.data.materials[0] = matl
        else:
            obj.data.materials.append(matl)
    return obj


def mesh_obj(name, bm, root, matl, levels=2):
    me = bpy.data.meshes.new(name + "_mesh")
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    parent(obj, root, matl)
    return shade_subdiv(obj, levels, levels + 1)


def lathe(name, profile_xz, root, matl, segments=36, levels=2, closed_bottom=True):
    """Revolve XZ profile around Z. profile: list of (radius, z)."""
    bm = bmesh.new()
    rings = []
    for r, z in profile_xz:
        ring = []
        for i in range(segments):
            a = (i / segments) * math.tau
            ring.append(bm.verts.new((math.cos(a) * r, math.sin(a) * r, z)))
        rings.append(ring)
    bm.verts.ensure_lookup_table()
    for ri in range(len(rings) - 1):
        for i in range(segments):
            a = rings[ri][i]
            b = rings[ri][(i + 1) % segments]
            c = rings[ri + 1][(i + 1) % segments]
            d = rings[ri + 1][i]
            try:
                bm.faces.new((a, b, c, d))
            except ValueError:
                pass
    if closed_bottom and profile_xz[0][0] > 1e-5:
        try:
            bm.faces.new(list(reversed(rings[0])))
        except ValueError:
            pass
    if profile_xz[-1][0] > 1e-5:
        try:
            bm.faces.new(rings[-1])
        except ValueError:
            pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_obj(name, bm, root, matl, levels)


def capsule(name, loc, radius, depth, root, matl, axis="Z",
            segments=16, rings=10, levels=2, scale=(1, 1, 1)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=radius)
    stretch = depth / (radius * 2.0)
    for v in bm.verts:
        co = v.co.copy()
        if axis == "Z":
            s = stretch if abs(co.z) > 1e-6 else 1.0
            # keep hemispheres, stretch mid
            if abs(co.z) < radius * 0.99:
                co.z *= stretch
            else:
                co.z = math.copysign(radius * stretch + (abs(co.z) - radius), co.z)
            # simpler: uniform Z scale then recenter
        v.co = co
    # uniform axis scale is clearer:
    bm.free()
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=1.0)
    for v in bm.verts:
        x, y, z = v.co
        if axis == "Z":
            v.co = Vector((x * radius * scale[0], y * radius * scale[1], z * (depth * 0.5) * scale[2]))
        elif axis == "Y":
            v.co = Vector((x * radius * scale[0], y * (depth * 0.5) * scale[1], z * radius * scale[2]))
        else:
            v.co = Vector((x * (depth * 0.5) * scale[0], y * radius * scale[1], z * radius * scale[2]))
    obj = mesh_obj(name, bm, root, matl, levels)
    obj.location = loc
    return obj


def tapered(name, loc, r_top, r_bot, length, root, matl,
            segments=14, levels=2, rotation=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm, cap_ends=True, cap_tris=False, segments=segments,
        radius1=r_bot, radius2=r_top, depth=length,
    )
    obj = mesh_obj(name, bm, root, matl, levels)
    obj.location = loc
    obj.rotation_euler = rotation
    return obj


def curve_tube(name, points, radius, root, matl, bevel_res=3, resolution=10):
    curve = bpy.data.curves.new(name + "_data", type="CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = resolution
    curve.bevel_depth = radius
    curve.bevel_resolution = bevel_res
    curve.fill_mode = "FULL"
    spline = curve.splines.new("NURBS")
    spline.points.add(len(points) - 1)
    for i, p in enumerate(points):
        spline.points[i].co = (p[0], p[1], p[2], 1.0)
    spline.use_endpoint_u = True
    spline.order_u = min(4, len(points))
    obj = bpy.data.objects.new(name, curve)
    bpy.context.scene.collection.objects.link(obj)
    return parent(obj, root, matl)


def ribbon(name, points, width, root, matl, thickness=0.004):
    """Flat ribbon along a path (better than round tube for 飘带)."""
    curve = bpy.data.curves.new(name + "_data", type="CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 16
    curve.bevel_depth = thickness
    curve.bevel_resolution = 2
    curve.extrude = width * 0.5
    curve.fill_mode = "FULL"
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for i, p in enumerate(points):
        bp = spline.bezier_points[i]
        bp.co = Vector(p)
        bp.handle_left_type = "AUTO"
        bp.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    bpy.context.scene.collection.objects.link(obj)
    return parent(obj, root, matl)


def look_at(obj, target, track="-Z", up="Y"):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat(track, up).to_euler()


# ---------------------------------------------------------------------------
# build
# ---------------------------------------------------------------------------

def build():
    clear_scene()

    # --- materials (仙侠: frost white, ink hair, cyan jade, pale gold) ---
    M_SKIN = mat("Skin", (0.94, 0.84, 0.78), rough=0.48, sss=0.18)
    M_HAIR = mat("Hair", (0.02, 0.015, 0.02), rough=0.28)
    M_ROBE = mat("Robe", (0.96, 0.97, 0.99), rough=0.36)
    M_ROBE2 = mat("RobeInner", (0.88, 0.91, 0.95), rough=0.4)
    M_ROBE3 = mat("RobeSheer", (0.94, 0.96, 0.99), rough=0.3, alpha=0.55)
    M_TRIM = mat("Gold", (0.82, 0.68, 0.36), rough=0.28, metallic=0.72)
    M_BELT = mat("BeltCyan", (0.48, 0.70, 0.82), rough=0.34)
    M_GEM = mat("Jade", (0.20, 0.55, 0.58), rough=0.12, metallic=0.25)
    M_METAL = mat("Silver", (0.86, 0.89, 0.93), rough=0.18, metallic=0.92)
    M_PEARL = mat("Pearl", (0.97, 0.96, 0.93), rough=0.14)
    M_PIBO = mat("Pibo", (0.97, 0.98, 1.0), rough=0.2, alpha=0.38)
    M_LIP = mat("Lip", (0.72, 0.32, 0.34), rough=0.38)
    M_MARK = mat("Huadian", (0.78, 0.10, 0.12), rough=0.3)
    M_EYE = mat("Eye", (0.06, 0.05, 0.05), rough=0.2)
    M_SHOE = mat("Shoe", (0.92, 0.93, 0.95), rough=0.4)
    M_GROUND = mat("Ground", (0.52, 0.56, 0.60), rough=0.95)

    root = bpy.data.objects.new("XianxiaWoman", None)
    bpy.context.scene.collection.objects.link(root)

    world = bpy.context.scene.world or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.58, 0.64, 0.70, 1)
        bg.inputs[1].default_value = 0.85

    # Character faces +Y (front). Halo sits in XZ plane behind head (negative Y).

    # ========== HEAD (blank face — no facial features) ==========
    head = capsule("Head", (0, 0.04, 1.62), 0.115, 0.26, root, M_SKIN,
                   axis="Z", segments=28, rings=16, levels=2, scale=(1.0, 0.95, 1.0))

    # ears only (not facial features); needed for earrings
    for sx, side in ((-1, "L"), (1, "R")):
        capsule(f"Ear_{side}", (sx * 0.112, 0.02, 1.60), 0.018, 0.04, root, M_SKIN,
                axis="Z", segments=10, rings=6, levels=2, scale=(0.4, 0.65, 1.0))

    tapered("Neck", (0, 0.035, 1.455), 0.04, 0.048, 0.09, root, M_SKIN,
            segments=14, levels=2)

    # ========== HAIR — rooted to scalp ==========
    # Scalp cap sits ON the head (same center, slightly larger)
    scalp = lathe("Scalp", [
        (0.02, 1.74),
        (0.08, 1.73),
        (0.12, 1.70),
        (0.128, 1.64),
        (0.125, 1.58),
        (0.11, 1.52),
        (0.06, 1.50),
    ], root, M_HAIR, segments=28, levels=2, closed_bottom=False)
    # open underside so it cups the head
    scalp.location = (0, 0.01, 0)

    # crown volume connecting scalp → bun (so bun isn't floating)
    crown = lathe("HairCrown", [
        (0.04, 1.72),
        (0.09, 1.76),
        (0.10, 1.82),
        (0.09, 1.88),
        (0.06, 1.92),
    ], root, M_HAIR, segments=24, levels=2)
    crown.location = (0, -0.02, 0)

    # bun — sits on crown, clearly attached
    bun = capsule("Bun", (0, -0.04, 1.94), 0.07, 0.1, root, M_HAIR,
                  axis="Z", segments=18, rings=12, levels=2)
    bun_ring = lathe("BunRing", [
        (0.055, -0.015), (0.075, 0), (0.055, 0.015)
    ], root, M_HAIR, segments=20, levels=1)
    bun_ring.location = (0, -0.04, 2.01)
    bun_ring.rotation_euler = (math.radians(90), 0, 0)

    # hair stick through bun
    pin = tapered("HairPin", (0.04, -0.08, 1.95), 0.005, 0.004, 0.13, root, M_METAL,
                  segments=8, levels=1, rotation=(math.radians(65), math.radians(15), math.radians(25)))
    capsule("PinPearl", (0.085, -0.03, 1.99), 0.011, 0.013, root, M_PEARL,
            axis="Z", segments=10, rings=6, levels=1)

    # Solid back hair mass rooted under scalp (attached from all angles)
    hair_mass = lathe("HairMass", [
        (0.05, 1.68),
        (0.115, 1.60),
        (0.125, 1.45),
        (0.12, 1.20),
        (0.105, 0.95),
        (0.085, 0.70),
        (0.06, 0.45),
        (0.03, 0.25),
    ], root, M_HAIR, segments=28, levels=2)
    hair_mass.scale = (1.25, 1.15, 1.0)
    hair_mass.location = (0, -0.14, 0)

    # Full skull helmet + occipital fillers so the back isn't bald
    capsule("HairHelmet", (0.0, 0.0, 1.62), 0.15, 0.32, root, M_HAIR,
            axis="Z", segments=28, rings=16, levels=2)
    capsule("HairOccipital", (0.0, -0.10, 1.58), 0.13, 0.28, root, M_HAIR,
            axis="Z", segments=20, rings=12, levels=2, scale=(1.0, 1.1, 1.0))
    capsule("HairNape", (0.0, -0.07, 1.42), 0.12, 0.22, root, M_HAIR,
            axis="Z", segments=18, rings=12, levels=2)
    capsule("HairLineFringe", (0.0, 0.11, 1.68), 0.12, 0.1, root, M_HAIR,
            axis="Z", segments=16, rings=10, levels=1, scale=(1.1, 0.5, 0.55))

    # side locks — grow from temples on scalp
    for sx, side in ((-1, "L"), (1, "R")):
        for k, ox in enumerate([-0.01, 0.01]):
            curve_tube(f"SideLock_{side}_{k}", [
                (sx * (0.10 + ox), 0.04, 1.66),
                (sx * (0.115 + ox), 0.07, 1.52),
                (sx * (0.12 + ox), 0.05, 1.32),
                (sx * (0.10 + ox), 0.03, 1.12),
                (sx * (0.08 + ox), 0.02, 0.95),
            ], 0.014, root, M_HAIR)

    # Forehead huadian only (no full wrap band — that read as nape jewelry from behind)
    capsule("Huadian", (0, 0.155, 1.635), 0.012, 0.024, root, M_MARK,
            axis="Z", segments=12, rings=8, levels=1, scale=(1.0, 0.55, 1.0))
    for i, a in enumerate([0, 72, 144, 216, 288]):
        r = 0.010
        rad = math.radians(a)
        capsule(f"HuadianPetal_{i}",
                (math.sin(rad) * r, 0.152, 1.635 + math.cos(rad) * r),
                0.006, 0.012, root, M_MARK, axis="Z", segments=8, rings=6, levels=1,
                scale=(1.0, 0.6, 1.0))

    # Hair ornament at bun base (back) — not low on the nape
    capsule("HairOrnamentPearl", (0, -0.07, 2.00), 0.014, 0.028, root, M_PEARL,
            axis="Z", segments=12, rings=8, levels=1, scale=(1.0, 0.85, 1.0))
    capsule("HairOrnamentFlower", (0, -0.08, 1.97), 0.010, 0.02, root, M_MARK,
            axis="Z", segments=10, rings=6, levels=1, scale=(1.0, 0.6, 1.0))
    for i, a in enumerate([0, 72, 144, 216, 288]):
        r = 0.009
        rad = math.radians(a)
        capsule(f"HairOrnamentPetal_{i}",
                (math.sin(rad) * r, -0.078, 1.97 + math.cos(rad) * r),
                0.005, 0.01, root, M_MARK, axis="Z", segments=8, rings=6, levels=1,
                scale=(1.0, 0.7, 1.0))

    # earrings from ears
    for sx, side in ((-1, "L"), (1, "R")):
        curve_tube(f"Earring_{side}", [
            (sx * 0.115, 0.04, 1.57),
            (sx * 0.118, 0.05, 1.48),
            (sx * 0.115, 0.04, 1.40),
        ], 0.0025, root, M_METAL)
        capsule(f"EarringPearl_{side}", (sx * 0.115, 0.04, 1.38), 0.009, 0.011,
                root, M_PEARL, axis="Z", segments=8, rings=6, levels=1)

    # ribbons from bun hanging down back (attached)
    for sx, side in ((-1, "L"), (1, "R")):
        ribbon(f"BunRibbon_{side}", [
            (sx * 0.02, -0.08, 1.92),
            (sx * 0.04, -0.14, 1.72),
            (sx * 0.03, -0.12, 1.50),
            (sx * 0.02, -0.08, 1.28),
        ], 0.025, root, M_ROBE, thickness=0.003)

    # ========== HALO — gold ring only (no solid disc; head readable from behind) ==========
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.45, minor_radius=0.012,
        major_segments=64, minor_segments=12, location=(0, 0, 0))
    halo_edge = bpy.context.active_object
    halo_edge.name = "HaloEdge"
    parent(halo_edge, root, M_TRIM)
    halo_edge.location = (0, -0.18, 1.78)
    halo_edge.rotation_euler = (math.radians(90), 0, 0)

    # ========== TORSO ==========
    lathe("Torso", [
        (0.04, 1.42),
        (0.10, 1.38),
        (0.145, 1.30),
        (0.155, 1.20),
        (0.14, 1.10),
        (0.12, 1.02),
        (0.14, 0.95),
        (0.16, 0.90),
        (0.08, 0.86),
    ], root, M_SKIN, segments=28, levels=2)

    # arms — continuous overlapping joints (shoulder → hand, no gaps)
    for sx, side in ((-1, "L"), (1, "R")):
        capsule(f"Shoulder_{side}", (sx * 0.165, 0.03, 1.30), 0.048, 0.08, root, M_SKIN,
                axis="X", segments=14, rings=10, levels=2)
        tapered(f"UpperArm_{side}", (sx * 0.23, 0.05, 1.16), 0.042, 0.034, 0.28,
                root, M_SKIN, segments=14, levels=2,
                rotation=(math.radians(14), math.radians(sx * 16), math.radians(sx * 4)))
        capsule(f"Elbow_{side}", (sx * 0.30, 0.09, 1.01), 0.032, 0.05, root, M_SKIN,
                axis="Z", segments=12, rings=8, levels=2)
        tapered(f"ForeArm_{side}", (sx * 0.33, 0.11, 0.87), 0.030, 0.025, 0.26,
                root, M_SKIN, segments=12, levels=2,
                rotation=(math.radians(18), math.radians(sx * 8), 0))
        capsule(f"Wrist_{side}", (sx * 0.36, 0.13, 0.73), 0.024, 0.04, root, M_SKIN,
                axis="Z", segments=10, rings=8, levels=2)
        capsule(f"Hand_{side}", (sx * 0.37, 0.14, 0.66), 0.030, 0.07, root, M_SKIN,
                axis="Z", segments=12, rings=8, levels=2, scale=(0.9, 0.55, 1.0))

    # legs (under skirt — proper length for 仙侠 proportions)
    for sx, side in ((-1, "L"), (1, "R")):
        tapered(f"Thigh_{side}", (sx * 0.07, 0.02, 0.58), 0.06, 0.048, 0.34,
                root, M_SKIN, segments=12, levels=2)
        tapered(f"Shin_{side}", (sx * 0.07, 0.04, 0.26), 0.045, 0.036, 0.30,
                root, M_SKIN, segments=12, levels=2)
        # cloth shoes (履) peeking under hem
        shoe = capsule(f"Shoe_{side}", (sx * 0.07, 0.09, 0.045), 0.04, 0.13, root, M_SHOE,
                       axis="Y", segments=12, rings=8, levels=2, scale=(0.85, 1.0, 0.5))

    # ========== ROBES — multi-layer 仙侠 silhouette ==========
    # Inner skirt (贴身裙): closer, slightly shorter
    lathe("SkirtInner", [
        (0.14, 0.95),
        (0.18, 0.85),
        (0.22, 0.70),
        (0.26, 0.50),
        (0.28, 0.30),
        (0.29, 0.12),
        (0.27, 0.04),
    ], root, M_ROBE2, segments=36, levels=2)

    # Main skirt (外裙): elegant A-line flare, floor-length, soft bell — NOT a sphere
    lathe("SkirtOuter", [
        (0.16, 1.00),
        (0.20, 0.92),
        (0.24, 0.80),
        (0.28, 0.65),
        (0.33, 0.45),
        (0.38, 0.25),
        (0.42, 0.10),
        (0.44, 0.02),
        (0.40, 0.0),
    ], root, M_ROBE, segments=40, levels=2)

    # Sheer overskirt / 霞帔-like overlay — slightly longer train in back via scale trick
    overskirt = lathe("SkirtSheer", [
        (0.17, 1.02),
        (0.22, 0.90),
        (0.27, 0.70),
        (0.33, 0.45),
        (0.39, 0.22),
        (0.45, 0.05),
        (0.46, -0.01),
    ], root, M_ROBE3, segments=40, levels=2)
    # pull back hem slightly for train feel
    overskirt.scale = (1.0, 1.08, 1.0)
    overskirt.location = (0, -0.03, 0)

    # Bodice / 交领 upper robe
    lathe("Bodice", [
        (0.10, 1.40),
        (0.16, 1.34),
        (0.19, 1.22),
        (0.18, 1.10),
        (0.17, 1.00),
        (0.12, 0.96),
    ], root, M_ROBE, segments=32, levels=2)

    # standing collar + gold trim
    collar = lathe("Collar", [
        (0.07, 0.0), (0.09, 0.015), (0.10, 0.04), (0.08, 0.07)
    ], root, M_TRIM, segments=24, levels=2)
    collar.location = (0, 0.04, 1.40)

    # 交领 front trims
    for sx, side in ((-1, "L"), (1, "R")):
        curve_tube(f"CollarTrim_{side}", [
            (sx * 0.015, 0.175, 1.38),
            (sx * 0.045, 0.195, 1.22),
            (sx * 0.055, 0.185, 1.08),
            (sx * 0.04, 0.175, 0.98),
        ], 0.005, root, M_TRIM)

    # wide hanging sleeves (垂袖) — vertical bells beside arms
    for sx, side in ((-1, "L"), (1, "R")):
        sleeve = lathe(f"Sleeve_{side}", [
            (0.05, 1.32),
            (0.08, 1.24),
            (0.11, 1.10),
            (0.14, 0.95),
            (0.17, 0.80),
            (0.18, 0.70),
            (0.15, 0.66),
        ], root, M_ROBE, segments=28, levels=2)
        sleeve.location = (sx * 0.20, 0.04, 0)
        cuff = lathe(f"Cuff_{side}", [
            (0.15, -0.01), (0.175, 0), (0.15, 0.012)
        ], root, M_TRIM, segments=24, levels=1)
        cuff.location = (sx * 0.20, 0.04, 0.66)

    # waist belt + jade buckle (典型仙侠腰饰)
    belt = lathe("Belt", [
        (0.18, -0.015), (0.215, 0), (0.215, 0.05), (0.18, 0.065)
    ], root, M_BELT, segments=32, levels=2)
    belt.location = (0, 0.02, 0.98)
    capsule("Jade", (0, 0.21, 1.00), 0.035, 0.04, root, M_GEM,
            axis="Y", segments=16, rings=10, levels=2)
    frame = lathe("JadeFrame", [(0.038, -0.004), (0.048, 0), (0.038, 0.004)],
                  root, M_METAL, segments=24, levels=1)
    frame.location = (0, 0.22, 1.00)
    frame.rotation_euler = (math.radians(90), 0, 0)

    # hanging pendants
    for i, x in enumerate([-0.09, -0.03, 0.03, 0.09]):
        curve_tube(f"Pendant_{i}", [
            (x, 0.19, 0.97),
            (x * 1.05, 0.21, 0.86),
            (x * 1.1, 0.19, 0.74),
        ], 0.0025, root, M_METAL)
        capsule(f"PendantPearl_{i}", (x * 1.1, 0.19, 0.72), 0.008, 0.01,
                root, M_PEARL if i % 2 == 0 else M_GEM, axis="Z", segments=8, rings=6, levels=1)

    # ========== 飘带 (pibo) — flat ribbons, draped from shoulders ==========
    ribbon("PiboR1", [
        (0.16, 0.12, 1.28),
        (0.42, 0.35, 1.35),
        (0.68, 0.30, 1.10),
        (0.82, 0.08, 0.75),
        (0.72, -0.12, 0.40),
        (0.50, -0.18, 0.12),
    ], 0.05, root, M_PIBO, thickness=0.003)
    ribbon("PiboR2", [
        (0.12, 0.05, 1.18),
        (0.38, -0.18, 1.22),
        (0.58, -0.40, 0.92),
        (0.52, -0.38, 0.55),
        (0.32, -0.22, 0.22),
    ], 0.04, root, M_PIBO, thickness=0.0025)
    ribbon("PiboL1", [
        (-0.16, 0.12, 1.28),
        (-0.42, 0.32, 1.32),
        (-0.70, 0.25, 1.05),
        (-0.80, 0.05, 0.70),
        (-0.68, -0.12, 0.35),
        (-0.48, -0.16, 0.10),
    ], 0.05, root, M_PIBO, thickness=0.003)
    ribbon("PiboL2", [
        (-0.12, 0.02, 1.15),
        (-0.35, -0.22, 1.18),
        (-0.55, -0.45, 0.88),
        (-0.48, -0.40, 0.50),
        (-0.28, -0.22, 0.20),
    ], 0.04, root, M_PIBO, thickness=0.0025)
    ribbon("PiboBack", [
        (0.0, -0.12, 1.30),
        (0.2, -0.38, 1.08),
        (-0.12, -0.50, 0.78),
        (0.12, -0.42, 0.48),
        (-0.05, -0.28, 0.22),
    ], 0.045, root, M_PIBO, thickness=0.0025)

    # ground
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=2, y_segments=2, size=2.0)
    ground = mesh_obj("Ground", bm, root, M_GROUND, levels=0)
    for v in ground.data.vertices:
        v.co.z = 0.0

    # ========== CAMERA & LIGHTS ==========
    cam_data = bpy.data.cameras.new("Camera")
    cam_data.lens = 50
    cam = bpy.data.objects.new("Camera", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    # front three-quarter
    cam.location = (1.85, 3.7, 1.4)
    look_at(cam, (0.0, 0.05, 1.05))

    def add_light(name, energy, size, loc, color=(1, 1, 1)):
        d = bpy.data.lights.new(name, "AREA")
        d.energy = energy
        d.size = size
        d.color = color
        o = bpy.data.objects.new(name, d)
        bpy.context.scene.collection.objects.link(o)
        o.location = loc
        look_at(o, (0, 0, 1.1))
        return o

    add_light("Key", 130, 2.4, (1.6, 2.8, 2.7), (1.0, 0.98, 0.95))
    add_light("Fill", 38, 3.5, (-2.4, 1.8, 1.9), (0.85, 0.9, 1.0))
    add_light("Rim", 65, 2.0, (-0.8, -2.2, 2.4), (0.9, 0.95, 1.0))
    # soft halo backlight
    add_light("HaloLight", 30, 1.5, (0.0, -1.5, 1.7), (0.85, 0.92, 1.0))

    for area in bpy.context.screen.areas:
        if area.type == "VIEW_3D":
            for space in area.spaces:
                if space.type == "VIEW_3D":
                    space.shading.type = "MATERIAL"
                    space.region_3d.view_perspective = "CAMERA"

    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except Exception:
        scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 960
    scene.render.resolution_y = 1280
    scene.render.filepath = "/Users/xin/shanhai-island-editor/xianxia_woman_viewport_render.png"
    scene.render.image_settings.file_format = "PNG"

    n = len([o for o in bpy.data.objects if o.parent == root])
    print(f"仙侠 woman: {n} parts")
    return n


def render_still():
    bpy.ops.render.render(write_still=True)
    print("rendered", bpy.context.scene.render.filepath)


def render_turntable():
    """Three angles to verify all-around correctness."""
    cam = bpy.data.objects.get("Camera")
    scene = bpy.context.scene
    views = [
        ("front", (0.0, 4.0, 1.35), (0, 0.05, 1.05)),
        ("threequarter", (1.85, 3.7, 1.4), (0, 0.05, 1.05)),
        ("side", (4.0, 0.2, 1.4), (0, 0.05, 1.05)),
        ("back", (0.3, -4.0, 1.45), (0, 0.0, 1.1)),
    ]
    paths = []
    for name, loc, target in views:
        cam.location = loc
        look_at(cam, target)
        path = f"/Users/xin/shanhai-island-editor/xianxia_{name}.png"
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        paths.append(path)
        print("view", name, path)
    # restore beauty cam
    cam.location = (1.85, 3.7, 1.4)
    look_at(cam, (0, 0.05, 1.05))
    scene.render.filepath = "/Users/xin/shanhai-island-editor/xianxia_woman_viewport_render.png"
    bpy.ops.render.render(write_still=True)
    return paths


if __name__ == "__main__":
    build()
    render_turntable()
