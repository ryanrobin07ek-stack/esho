"""Low-poly city bus -> bus.obj/.mtl + bus_viewer.html (same style as the sports car).

Run:  python tools/blender/make_bus_obj.py
About 9.5 m long, 2.5 m wide, 3.3 m tall. Doors are on the right (-Y) side.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lowpoly import Model, rounded_rect  # noqa: E402

bus = Model({
    "body": (0.94, 0.94, 0.90),
    "accent": (0.80, 0.08, 0.08),
    "glass": (0.16, 0.26, 0.36),
    "roofunit": (0.68, 0.70, 0.73),
    "sign": (1.0, 0.72, 0.10),
    "headlight": (1.0, 0.95, 0.7),
    "taillight": (0.9, 0.0, 0.0),
})

W, ZB, ZT = 1.25, 0.50, 3.10      # half width, floor, roof
X0, X1 = -4.60, 4.60              # flat-sided length before the rounded ends
RB, RT = 0.12, 0.38               # bottom / roof corner radius


def ring(x, inset):
    pts = rounded_rect(W - inset, ZB + inset, ZT - inset,
                       max(RB - inset * 0.3, 0.04), max(RT - inset * 0.5, 0.08), n=3)
    return [(x, y, z) for y, z in pts]


# rounded front and rear edges: rings step inward at the ends
ENDS = ((0.17, 0.22), (0.14, 0.10), (0.08, 0.03))
rear = [ring(X0 - dx, ins) for dx, ins in ENDS]
front = [ring(X1 + dx, ins) for dx, ins in reversed(ENDS)]
bus.loft("Body", rear + [ring(X0, 0), ring(X1, 0)] + front, smooth=True)

XF, XR = X1 + 0.17, X0 - 0.17     # flat front / rear faces
SIDE = W + 0.012                  # just proud of the side panels

# ---------------- sides: windows, doors, stripes ----------------
DOORS = [(3.55, 4.35), (-0.30, 0.50)]          # right side only
for side in (-1, 1):
    x = -4.20
    while x + 0.90 <= 3.40:
        clash = side == -1 and any(not (x + 0.90 < a or x > b) for a, b in DOORS)
        if not clash:
            bus.box(f"Window_{side}_{x:.2f}", (x + 0.45, side * SIDE, 2.17), (0.90, 0.04, 0.85), "glass")
        x += 1.04
    bus.box(f"Stripe_{side}", (0.0, side * (W + 0.006), 1.45), (9.15, 0.02, 0.20), "accent")
    bus.box(f"Skirt_{side}", (0.0, side * (W + 0.004), 0.66), (9.15, 0.02, 0.18), "dark")
    bus.box(f"RoofTrim_{side}", (0.0, side * (W + 0.004), 2.72), (9.15, 0.02, 0.06), "accent")

# driver window (left / +Y side, front)
bus.box("DriverWindow", (3.95, SIDE, 2.17), (0.80, 0.04, 0.85), "glass")

# doors on the right (-Y) side: dark frame, glass, centre split
for i, (a, b) in enumerate(DOORS):
    xm, ln = (a + b) / 2, b - a
    bus.box(f"DoorFrame_{i}", (xm, -(W + 0.008), 1.66), (ln + 0.08, 0.03, 2.08), "dark")
    bus.box(f"DoorGlass_{i}", (xm, -(W + 0.02), 1.66), (ln - 0.04, 0.04, 1.96), "glass")
    bus.box(f"DoorSplit_{i}", (xm, -(W + 0.045), 1.66), (0.04, 0.02, 1.96), "dark")

# ---------------- front ----------------
bus.box("Windshield", (XF, 0, 2.12), (0.04, 2.00, 1.15), "glass")
bus.box("SignFrame", (XF, 0, 2.86), (0.04, 1.60, 0.24), "dark")
bus.box("Sign", (XF + 0.02, 0, 2.86), (0.03, 1.40, 0.15), "sign")
bus.box("Grille", (XF, 0, 0.98), (0.04, 0.90, 0.26), "dark")
bus.box("FrontBumper", (XF - 0.02, 0, 0.62), (0.16, 2.40, 0.30), "dark")
for side in (-1, 1):
    bus.box(f"Headlight_{side}", (XF + 0.01, side * 0.78, 0.98), (0.04, 0.36, 0.18), "headlight")
    # mirror on an arm sticking out from the front corner
    bus.box(f"MirrorArm_{side}", (XF - 0.12, side * 1.40, 2.62), (0.05, 0.36, 0.05), "dark")
    bus.box(f"Mirror_{side}", (XF - 0.06, side * 1.58, 2.42), (0.08, 0.13, 0.36), "dark")

# ---------------- rear ----------------
bus.box("RearWindow", (XR, 0, 2.35), (0.04, 2.00, 0.75), "glass")
bus.box("EngineGrille", (XR, 0, 1.25), (0.04, 1.20, 0.34), "dark")
bus.box("RearBumper", (XR + 0.02, 0, 0.62), (0.16, 2.40, 0.30), "dark")
for side in (-1, 1):
    bus.box(f"Taillight_{side}", (XR - 0.01, side * 0.95, 1.15), (0.04, 0.26, 0.42), "taillight")

# ---------------- roof ----------------
bus.box("RoofUnit", (0.6, 0, ZT + 0.09), (2.20, 1.50, 0.26), "roofunit")
bus.box("RoofVent", (-2.8, 0, ZT + 0.03), (0.80, 0.80, 0.10), "roofunit")

# ---------------- wheels ----------------
for fx in (3.05, -2.75):
    for side in (-1, 1):
        tag = f"{'F' if fx > 0 else 'R'}{'L' if side < 0 else 'R'}"
        bus.wheel(tag, fx, 0.56, W - 0.10, side, R=0.56, hw=0.20, spokes=8,
                  arch_r=0.70, arch_y=W - 0.01)

angle = float(sys.argv[1]) if len(sys.argv) > 1 else 0.8
bus.write(os.path.dirname(os.path.abspath(__file__)), "bus", angle)
