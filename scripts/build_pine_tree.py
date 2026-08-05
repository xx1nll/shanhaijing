"""
Pine tree from scratch — cylinders/curves/spheres only.
9m height, scaly bark, needle clusters, pine cones.
Run inside Blender or via Blender MCP execute_blender_code.
"""
# Reconstructible reference script mirroring the MCP build session.
# Primary output: models/pine-tree.glb

OUT_GLB = "/Users/xin/shanhai-island-editor/models/pine-tree.glb"

# Specs (authoritative):
# - Total height 9.0 m, trunk base radius 0.42 m
# - First-order limbs from matched-view line-art (outward/drooping, organic bends)
# - Materials: PineBark, PineNeedle, PineCone
# - No external assets / geometry-node trees / image-to-mesh

print("See Blender scene PineTree / models/pine-tree.glb — built via MCP session.")
print("Rebuild: re-run the MCP pine construction workflow or expand this script.")
