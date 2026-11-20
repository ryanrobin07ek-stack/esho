"""Smooth low-poly sports car -> sports_car.obj/.mtl + sports_car_viewer.html.

Run:  python tools/blender/make_car_obj.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lowpoly import Model, chaikin, densify  # noqa: E402

car = Model({
    "body": (0.80, 0.05, 0.05),
    "glass": (0.30, 0.52, 0.68),
    "headlight": (1.0, 0.95, 0.7),
    "taillight": (0.9, 0.0, 0.0),
})

# ---------------- body ----------------
# x, z_bottom, z_shoulder, z_top, half-width bottom / shoulder / top
SECTIONS = [
    (-2.20, 0.36, 0.64, 0.80, 0.76, 0.86, 0.62),
    (-1.80, 0.30, 0.72, 0.90, 0.88, 0.97, 0.70),
    (-1.20, 0.28, 0.74, 0.90, 0.92, 0.99, 0.76),
    (0.20, 0.28, 0.72, 0.88, 0.92, 0.98, 0.78),
    (1.30, 0.30, 0.62, 0.74, 0.90, 0.95, 0.74),
    (2.20, 0.37, 0.50, 0.58, 0.80, 0.85, 0.60),
]
stations = densify(SECTIONS, 26)


def body_ring(x, zb, zs, zt, wb, ws, wt):
    base = [(-wb, zb), (wb, zb), (ws, zs), (wt, zt), (-wt, zt), (-ws, zs)]
    return [(x, y, z) for y, z in chaikin(base, 2)]


def shrink(ring, dx, s):
    zm = sum(p[2] for p in ring) / len(ring)
    return [(p[0] + dx, p[1] * s, zm + (p[2] - zm) * s) for p in ring]


main = [body_ring(*s) for s in stations]
tail = [shrink(main[0], -d, s) for d, s in ((0.14, 0.40), (0.10, 0.72), (0.05, 0.92))]
nose = [shrink(main[-1], d, s) for d, s in ((0.05, 0.92), (0.10, 0.70), (0.15, 0.38))]
car.loft("Body", tail + main + nose, smooth=True)


def top_z(x):
    """Hood/deck height at x, matching the lofted stations."""
    for a, b in zip(stations, stations[1:]):
        if a[0] <= x <= b[0]:
            t = (x - a[0]) / (b[0] - a[0])
            return a[3] + (b[3] - a[3]) * t
    return stations[0][3] if x < 0 else stations[-1][3]


# ---------------- cabin (curved greenhouse) ----------------
# x, roof height, half-width at base, half-width at roof
CABIN = [
    (-1.25, 0.82, 0.70, 0.60),
    (-1.05, 0.98, 0.72, 0.56),
    (-0.80, 1.20, 0.72, 0.52),
    (-0.45, 1.30, 0.72, 0.50),
    (-0.10, 1.28, 0.72, 0.50),
    (0.20, 1.12, 0.72, 0.54),
    (0.50, 0.96, 0.72, 0.58),
    (0.75, 0.86, 0.72, 0.62),
    (0.90, 0.82, 0.72, 0.64),
]
ZB = 0.78
cabin_rings, roof_z = [], []
for x, zr, wb, wr in densify(CABIN, 18):
    pts = chaikin([(-wb, ZB), (wb, ZB), (wr, zr), (-wr, zr)], 2)
    cabin_rings.append([(x, y, z) for y, z in pts])
    roof_z.append(zr)


def cabin_mat(s, quad):
    xm = sum(q[0] for q in quad) / 4
    top = all(q[2] >= roof_z[s] - 0.11 for q in quad)
    return "body" if (top and -0.95 <= xm <= 0.0) else "glass"


car.loft("Cabin", cabin_rings, mat_fn=cabin_mat, cap_mat="glass")

# ---------------- wheels ----------------
for fx in (1.38, -1.38):
    for side in (-1, 1):
        tag = f"{'F' if fx > 0 else 'R'}{'L' if side < 0 else 'R'}"
        car.wheel(tag, fx, 0.43, 0.86, side, R=0.43, hw=0.17, spokes=5,
                  arch_r=0.53, arch_y=0.945)

# ---------------- details ----------------
for side in (-1, 1):
    car.box(f"Headlight_{side}", (2.10, side * 0.50, 0.53), (0.18, 0.30, 0.09), "headlight")
    car.box(f"Taillight_{side}", (-2.26, side * 0.52, 0.68), (0.10, 0.38, 0.11), "taillight")
    car.box(f"SpoilerStand_{side}", (-2.02, side * 0.45, 0.95), (0.10, 0.06, 0.22), "dark")
    car.box(f"Skirt_{side}", (0.0, side * 0.945, 0.34), (1.9, 0.06, 0.09), "dark")
    car.box(f"Mirror_{side}", (0.12, side * 0.84, 0.90), (0.14, 0.14, 0.08), "body")
    car.box(f"Exhaust_{side}", (-2.30, side * 0.30, 0.40), (0.12, 0.12, 0.12), "dark")
car.box("Grille", (2.20, 0, 0.46), (0.06, 0.60, 0.11), "dark")
car.box("Splitter", (2.20, 0, 0.35), (0.26, 1.45, 0.04), "dark")
car.box("Diffuser", (-2.25, 0, 0.37), (0.20, 1.20, 0.05), "dark")
car.box("SpoilerWing", (-2.08, 0, 1.08), (0.42, 1.60, 0.05), "dark")

# racing stripe hugging the hood and rear deck
for x0, x1 in ((0.95, 2.1), (-2.1, -1.3)):
    sv = []
    for k in range(11):
        x = x0 + (x1 - x0) * k / 10
        z = top_z(x) + 0.006
        sv += [(x, -0.12, z), (x, 0.12, z)]
    sf = [((2 * k, 2 * k + 1, 2 * k + 3, 2 * k + 2), "dark") for k in range(10)]
    car.add("Stripe", sv, sf, up_only=True)

angle = float(sys.argv[1]) if len(sys.argv) > 1 else 0.8
car.write(os.path.dirname(os.path.abspath(__file__)), "sports_car", angle)
