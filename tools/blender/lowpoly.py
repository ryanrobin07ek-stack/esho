"""Shared helpers for the pure-Python low-poly vehicle generators.

Coordinates while building: +X forward, Y width, Z up. Exports convert to Y-up.
Each model writes <name>.obj, <name>.mtl and <name>_viewer.html (open in a browser).
"""
import json
import math
import os


def newell(p):
    nx = ny = nz = 0.0
    for i in range(len(p)):
        a, b = p[i], p[(i + 1) % len(p)]
        nx += (a[1] - b[1]) * (a[2] + b[2])
        ny += (a[2] - b[2]) * (a[0] + b[0])
        nz += (a[0] - b[0]) * (a[1] + b[1])
    return nx, ny, nz


def chaikin(pts, n):
    """Round the corners of a closed 2D polygon."""
    for _ in range(n):
        out = []
        for i in range(len(pts)):
            p, q = pts[i], pts[(i + 1) % len(pts)]
            out.append((0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]))
            out.append((0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1]))
        pts = out
    return pts


def rounded_rect(w, zb, zt, rb, rt, n=3):
    """Closed (y, z) outline of a box cross-section with rounded corners."""
    pts = []

    def arc(cy, cz, r, a0, a1):
        for k in range(n + 1):
            a = a0 + (a1 - a0) * k / n
            pts.append((cy + r * math.cos(a), cz + r * math.sin(a)))

    arc(w - rb, zb + rb, rb, -math.pi / 2, 0)
    arc(w - rt, zt - rt, rt, 0, math.pi / 2)
    arc(-w + rt, zt - rt, rt, math.pi / 2, math.pi)
    arc(-w + rb, zb + rb, rb, math.pi, 1.5 * math.pi)
    return pts


def catmull(vals, u):
    n = len(vals)
    i = min(int(u), n - 2)
    t = u - i
    p0, p1 = vals[max(i - 1, 0)], vals[i]
    p2, p3 = vals[i + 1], vals[min(i + 2, n - 1)]
    return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                  + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)


def densify(rows, count):
    """Smoothly interpolate a table of key sections into `count` sections."""
    cols = list(zip(*rows))
    out = []
    for k in range(count):
        u = k * (len(rows) - 1) / (count - 1)
        out.append(tuple(catmull(list(c), u) for c in cols))
    return out


WHEEL_COLORS = {
    "dark": (0.04, 0.04, 0.045),
    "tyre": (0.07, 0.07, 0.075),
    "rim": (0.80, 0.80, 0.84),
    "rimdark": (0.18, 0.18, 0.20),
}


class Model:
    def __init__(self, colors):
        self.colors = dict(WHEEL_COLORS)
        self.colors.update(colors)
        self.parts = []  # (name, verts, faces[(idx, mat)], smooth)

    # ---------- building blocks ----------
    def add(self, name, verts, faces, smooth=False, up_only=False):
        """Store a part, orienting faces outward from its centre (or upward)."""
        n = len(verts)
        c = [sum(v[k] for v in verts) / n for k in range(3)]
        fixed = []
        for idx, mat in faces:
            p = [verts[i] for i in idx]
            nx, ny, nz = newell(p)
            if up_only:
                flip = nz < 0
            else:
                f = [sum(q[k] for q in p) / len(p) - c[k] for k in range(3)]
                flip = nx * f[0] + ny * f[1] + nz * f[2] < 0
            fixed.append((tuple(reversed(idx)) if flip else tuple(idx), mat))
        if smooth:
            assert len({m for _, m in fixed}) == 1, f"smooth part {name} needs one material"
        self.parts.append((name, verts, fixed, smooth))

    def loft(self, name, rings, mat="body", mat_fn=None, cap_mat=None, smooth=False):
        verts, faces = [], []
        m = len(rings[0])
        for r in rings:
            verts.extend(r)
        for s in range(len(rings) - 1):
            for i in range(m):
                j = (i + 1) % m
                a, b = s * m, (s + 1) * m
                quad = (a + i, a + j, b + j, b + i)
                faces.append((quad, mat_fn(s, [verts[q] for q in quad]) if mat_fn else mat))
        cap = cap_mat or mat
        faces.append((tuple(range(m)), cap))
        last = (len(rings) - 1) * m
        faces.append((tuple(range(last, last + m)), cap))
        self.add(name, verts, faces, smooth)

    def obox(self, name, c, ax, ay, az, mat):
        """Box from a centre and three half-extent vectors (allows rotation)."""
        vv = [tuple(c[k] + sx * ax[k] + sy * ay[k] + sz * az[k] for k in range(3))
              for sz in (-1, 1) for sy in (-1, 1) for sx in (-1, 1)]
        ff = [(0, 1, 3, 2), (4, 5, 7, 6), (0, 1, 5, 4), (2, 3, 7, 6), (0, 2, 6, 4), (1, 3, 7, 5)]
        self.add(name, vv, [(i, mat) for i in ff])

    def box(self, name, c, s, mat):
        self.obox(name, c, (s[0] / 2, 0, 0), (0, s[1] / 2, 0), (0, 0, s[2] / 2), mat)

    def lathe_y(self, name, x, z, profile, side, mat, seg=16, smooth=False, caps=True):
        """Revolve [(radius, |y|)] around the axis through (x, *, z) parallel to Y."""
        vv, ff = [], []
        for rad, yo in profile:
            for k in range(seg):
                a = 2 * math.pi * (k + 0.5) / seg
                vv.append((x + rad * math.cos(a), side * yo, z + rad * math.sin(a)))
        for p in range(len(profile) - 1):
            for k in range(seg):
                n = (k + 1) % seg
                a, b = p * seg, (p + 1) * seg
                ff.append(((a + k, a + n, b + n, b + k), mat))
        if caps:
            ff.append((tuple(range(seg)), mat))
            last = (len(profile) - 1) * seg
            ff.append((tuple(range(last, last + seg)), mat))
        self.add(name, vv, ff, smooth)

    def wheel(self, tag, x, z, yc, side, R, hw, spokes=5, seg=20, arch_r=None, arch_y=None):
        """Rounded tyre + recessed rim with spokes and hub. yc = |y| of the wheel centre."""
        if arch_r:
            # flat dark ring around the tyre on the body side (wheel-well look);
            # a ring, not a disc, so it never covers the rim
            self.lathe_y(f"Arch_{tag}", x, z, [(R * 1.03, arch_y + 0.03), (arch_r, arch_y + 0.03)],
                         side, "dark", seg, caps=False)
        tyre = [(0.64, -1.0), (0.90, -1.0), (0.985, -0.78), (1.0, -0.42),
                (1.0, 0.42), (0.985, 0.78), (0.90, 1.0), (0.64, 1.0)]
        self.lathe_y(f"Tyre_{tag}", x, z, [(R * r, yc + hw * d) for r, d in tyre],
                     side, "tyre", seg, smooth=True, caps=False)
        # rim lip + barrel (open tube), recessed dark dish behind the spokes
        self.lathe_y(f"RimLip_{tag}", x, z,
                     [(0.69 * R, yc + hw * 1.02), (0.64 * R, yc + hw * 0.88), (0.62 * R, yc + hw * 0.2)],
                     side, "rim", seg, caps=False)
        self.lathe_y(f"Dish_{tag}", x, z, [(0.63 * R, yc + hw * 0.15), (0.63 * R, yc + hw * 0.25)],
                     side, "rimdark", seg)
        r0, r1 = 0.15 * R, 0.63 * R
        rm, half = (r0 + r1) / 2, (r1 - r0) / 2
        for k in range(spokes):
            a = 2 * math.pi * k / spokes + math.pi / 2
            ca, sa = math.cos(a), math.sin(a)
            self.obox(f"Spoke_{tag}_{k}", (x + ca * rm, side * (yc + hw * 0.55), z + sa * rm),
                      (ca * half, 0, sa * half), (0, hw * 0.14, 0),
                      (-sa * 0.075 * R, 0, ca * 0.075 * R), "rim")
        self.lathe_y(f"Hub_{tag}", x, z,
                     [(0.21 * R, yc + hw * 0.4), (0.21 * R, yc + hw * 0.72), (0.13 * R, yc + hw * 0.86)],
                     side, "rim", 10)
        self.lathe_y(f"HubCap_{tag}", x, z, [(0.07 * R, yc + hw * 0.86), (0.07 * R, yc + hw * 0.92)],
                     side, "rimdark", 6)

    # ---------- export ----------
    def write(self, folder, base, angle=0.8):
        with open(os.path.join(folder, base + ".mtl"), "w") as m:
            for n, (r, g, b) in self.colors.items():
                m.write(f"newmtl {n}\nKd {r} {g} {b}\nKa 0 0 0\nKs 0.2 0.2 0.2\nNs 30\n\n")
        with open(os.path.join(folder, base + ".obj"), "w") as o:
            o.write(f"mtllib {base}.mtl\n")
            start = 1
            for name, verts, faces, smooth in self.parts:
                o.write(f"o {name}\n")
                o.write("s 1\n" if smooth else "s off\n")
                for x, y, z in verts:
                    o.write(f"v {x:.4f} {z:.4f} {-y:.4f}\n")
                cur = None
                for idx, mat in faces:
                    if mat != cur:
                        o.write(f"usemtl {mat}\n")
                        cur = mat
                    o.write("f " + " ".join(str(i + start) for i in idx) + "\n")
                start += len(verts)
        ntri = self._write_viewer(os.path.join(folder, base + "_viewer.html"), base, angle)
        print(f"Wrote {base}.obj, {base}.mtl, {base}_viewer.html  "
              f"(parts: {len(self.parts)}, triangles: {ntri})")

    def _write_viewer(self, path, title, angle):
        mat_ids = {name: i for i, name in enumerate(self.colors)}
        P, N, M, IDX = [], [], [], []

        def emit(p, nrm):
            ln = math.sqrt(sum(c * c for c in nrm)) or 1.0
            P.extend((round(p[0], 3), round(p[2], 3), round(-p[1], 3)))
            N.extend((round(nrm[0] / ln, 2), round(nrm[2] / ln, 2), round(-nrm[1] / ln, 2)))
            return len(P) // 3 - 1

        ntri = 0
        for name, verts, faces, smooth in self.parts:
            fn = [newell([verts[i] for i in idx]) for idx, _ in faces]
            if smooth:
                vn = [[0.0, 0.0, 0.0] for _ in verts]
                for (idx, _), nrm in zip(faces, fn):
                    for i in idx:
                        for k in range(3):
                            vn[i][k] += nrm[k]
                ids = [emit(verts[i], vn[i]) for i in range(len(verts))]
                M.extend([mat_ids[faces[0][1]]] * len(verts))
                for idx, _ in faces:
                    for k in range(1, len(idx) - 1):
                        IDX.extend((ids[idx[0]], ids[idx[k]], ids[idx[k + 1]]))
                        ntri += 1
            else:
                for (idx, mat), nrm in zip(faces, fn):
                    ids = [emit(verts[i], nrm) for i in idx]
                    M.extend([mat_ids[mat]] * len(ids))
                    for k in range(1, len(ids) - 1):
                        IDX.extend((ids[0], ids[k], ids[k + 1]))
                        ntri += 1

        xs, ys, zs = P[0::3], P[1::3], P[2::3]
        extent = max(max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs))
        palette = [c for name in self.colors for c in self.colors[name]]

        def js(a):
            return json.dumps(a, separators=(",", ":"))

        page = (VIEWER.replace("__TITLE__", title).replace("__P__", js(P)).replace("__N__", js(N))
                .replace("__M__", js(M)).replace("__I__", js(IDX)).replace("__PAL__", js(palette))
                .replace("__ANGLE__", str(angle)).replace("__DIST__", f"{extent * 1.75:.2f}")
                .replace("__LOOK__", f"{(max(ys) + min(ys)) * 0.45:.2f}"))
        with open(path, "w") as f:
            f.write(page)
        return ntri


VIEWER = """<!doctype html><meta charset=utf-8><title>__TITLE__ viewer</title>
<body style="margin:0;background:#9fb8c8;overflow:hidden">
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script>
const P=__P__, N=__N__, M=__M__, I=__I__, PAL=__PAL__;
const C=[]; for(const m of M) C.push(PAL[m*3],PAL[m*3+1],PAL[m*3+2]);
const s=new THREE.Scene(); s.background=new THREE.Color(0x9fb8c8);
const cam=new THREE.PerspectiveCamera(40,innerWidth/innerHeight,0.1,200);
const r=new THREE.WebGLRenderer({antialias:true}); r.setSize(innerWidth,innerHeight); document.body.appendChild(r.domElement);
const g=new THREE.BufferGeometry();
g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));
g.setAttribute('color',new THREE.Float32BufferAttribute(C,3));
g.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));
g.setIndex(I);
s.add(new THREE.Mesh(g,new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide})));
const ground=new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.MeshLambertMaterial({color:0x555a60})); ground.rotation.x=-Math.PI/2; s.add(ground);
s.add(new THREE.HemisphereLight(0xffffff,0x667788,0.85)); const d=new THREE.DirectionalLight(0xffffff,0.8); d.position.set(4,8,5); s.add(d);
let ay=__ANGLE__,ax=0.3,dist=__DIST__; const look=__LOOK__;
function draw(){cam.position.set(dist*Math.sin(ay)*Math.cos(ax),look+dist*Math.sin(ax),dist*Math.cos(ay)*Math.cos(ax));cam.lookAt(0,look,0);r.render(s,cam);}
let down=false,lx,ly; addEventListener('pointerdown',e=>{down=true;lx=e.clientX;ly=e.clientY});
addEventListener('pointerup',()=>down=false);
addEventListener('pointermove',e=>{if(!down)return;ay-=(e.clientX-lx)*0.01;ax=Math.max(0.02,Math.min(1.4,ax+(e.clientY-ly)*0.01));lx=e.clientX;ly=e.clientY;draw()});
addEventListener('wheel',e=>{dist=Math.max(2,Math.min(60,dist+e.deltaY*0.01));draw()});
addEventListener('resize',()=>{cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();r.setSize(innerWidth,innerHeight);draw()});
draw();
</script>"""
