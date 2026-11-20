"""Low-poly sports car for Blender (3.x / 4.x).

Usage: Blender > Scripting tab > Open this file > Run Script.
Car faces +X, width along Y, up is Z. Units ~ metres (about 4.4 m long).
Also exports sports_car.glb next to this script if the file is saved on disk.
"""
import math
import os

import bmesh
import bpy
from mathutils import Matrix, Vector

# ---------- colours (edit these) ----------
COLORS = {
    "body": (0.80, 0.05, 0.05, 1),
    "glass": (0.05, 0.10, 0.16, 1),
    "dark": (0.03, 0.03, 0.035, 1),
    "rim": (0.75, 0.75, 0.78, 1),
    "headlight": (1.0, 0.95, 0.7, 1),
    "taillight": (0.9, 0.0, 0.0, 1),
}

# clear old car
for o in [o for o in bpy.data.objects if o.name.startswith("Car_")]:
    bpy.data.objects.remove(o, do_unlink=True)

mats = {}
for name, col in COLORS.items():
    m = bpy.data.materials.get("Car_" + name) or bpy.data.materials.new("Car_" + name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = col
        bsdf.inputs["Roughness"].default_value = 0.45
    m.diffuse_color = col
    mats[name] = m


def finish(name, bm, mat_names, face_mats=None):
    """Turn a bmesh into an object. face_mats: list of material names per face."""
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("Car_" + name)
    bm.to_mesh(me)
    bm.free()
    for mn in mat_names:
        me.materials.append(mats[mn])
    if face_mats:
        for poly, idx in zip(me.polygons, face_mats):
            poly.material_index = idx
    ob = bpy.data.objects.new("Car_" + name, me)
    bpy.context.collection.objects.link(ob)
    return ob


# ---------- body: lofted cross-sections (rear -> front) ----------
# x, z_bottom, z_shoulder, z_top, half-width bottom / shoulder / top
SECTIONS = [
    (-2.20, 0.36, 0.66, 0.80, 0.78, 0.86, 0.62),
    (-1.90, 0.30, 0.72, 0.90, 0.88, 0.95, 0.68),
    (-1.20, 0.28, 0.72, 0.88, 0.90, 0.96, 0.74),
    (0.20, 0.28, 0.70, 0.88, 0.90, 0.95, 0.75),
    (1.40, 0.30, 0.60, 0.72, 0.88, 0.92, 0.70),
    (2.20, 0.38, 0.50, 0.58, 0.78, 0.82, 0.58),
]


def body():
    bm = bmesh.new()
    rings = []
    for x, zb, zs, zt, wb, ws, wt in SECTIONS:
        pts = [(-wb, zb), (wb, zb), (ws, zs), (wt, zt), (-wt, zt), (-ws, zs)]
        rings.append([bm.verts.new((x, y, z)) for y, z in pts])
    n = 6
    for a, b in zip(rings, rings[1:]):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(rings[0][::-1])
    bm.faces.new(rings[-1])
    return finish("Body", bm, ["body"])


# ---------- cabin (greenhouse) ----------
def cabin():
    bm = bmesh.new()
    zb, zr = 0.80, 1.28
    wb, wr = 0.70, 0.50
    v = [
        (-1.15, -wb, zb), (-1.15, wb, zb), (0.35, wb, zb), (0.35, -wb, zb),
        (-0.75, -wr, zr), (-0.75, wr, zr), (-0.05, wr, zr), (-0.05, -wr, zr),
    ]
    vs = [bm.verts.new(p) for p in v]
    faces = [
        (0, 3, 2, 1),  # bottom
        (4, 5, 6, 7),  # roof
        (0, 1, 5, 4),  # rear window
        (2, 3, 7, 6),  # windshield
        (3, 0, 4, 7),  # left window
        (1, 2, 6, 5),  # right window
    ]
    for f in faces:
        bm.faces.new([vs[i] for i in f])
    # roof = body colour (index 0), everything else glass (index 1)
    order = [1, 0, 1, 1, 1, 1]
    bm.faces.ensure_lookup_table()
    return finish("Cabin", bm, ["body", "glass"], order)


def box(name, center, size, mat):
    bm = bmesh.new()
    m = Matrix.Translation(center) @ Matrix.Diagonal(Vector((*size, 1.0)))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m)
    return finish(name, bm, [mat])


def cylinder_y(name, center, radius, width, mat, segments=10):
    bm = bmesh.new()
    m = Matrix.Translation(center) @ Matrix.Rotation(math.pi / 2, 4, "X")
    bmesh.ops.create_cone(
        bm, cap_ends=True, segments=segments,
        radius1=radius, radius2=radius, depth=width, matrix=m,
    )
    return finish(name, bm, [mat])


body()
cabin()

# wheels (tyre + rim + dark arch disc on the body side)
WHEEL_X = (1.38, -1.38)
for fx in WHEEL_X:
    for side in (-1, 1):
        tag = f"{'F' if fx > 0 else 'R'}{'L' if side < 0 else 'R'}"
        cylinder_y(f"Arch_{tag}", (fx, side * 0.955, 0.40), 0.47, 0.05, "dark", 12)
        cylinder_y(f"Tyre_{tag}", (fx, side * 0.86, 0.38), 0.38, 0.32, "dark", 12)
        cylinder_y(f"Rim_{tag}", (fx, side * 1.025, 0.38), 0.24, 0.03, "rim", 6)

# lights
for side in (-1, 1):
    box(f"Headlight_{side}", (2.12, side * 0.52, 0.52), (0.16, 0.30, 0.09), "headlight")
    box(f"Taillight_{side}", (-2.18, side * 0.55, 0.70), (0.08, 0.36, 0.12), "taillight")

# front splitter, rear diffuser
box("Splitter", (2.18, 0, 0.34), (0.22, 1.50, 0.05), "dark")
box("Diffuser", (-2.15, 0, 0.36), (0.20, 1.30, 0.06), "dark")

# spoiler
box("SpoilerWing", (-2.10, 0, 1.06), (0.40, 1.55, 0.05), "dark")
for side in (-1, 1):
    box(f"SpoilerStand_{side}", (-2.05, side * 0.45, 0.93), (0.10, 0.06, 0.22), "dark")

# hood stripe
box("Stripe", (1.0, 0, 0.84), (1.9, 0.22, 0.02), "dark")

# ---------- export ----------
path = bpy.data.filepath or __file__
out = os.path.join(os.path.dirname(os.path.abspath(path)), "sports_car.glb")
try:
    bpy.ops.object.select_all(action="DESELECT")
    for o in bpy.data.objects:
        if o.name.startswith("Car_"):
            o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=out, use_selection=True)
    print("Exported", out)
except Exception as e:  # export is optional
    print("glTF export skipped:", e)
