import { MyObject } from "./MyObject.js";

// Daftar Bentuk:
//   Topi     : Cylinder, Cone
//   Kepala   : Sphere
//   Badan    : Ellipsoid
//   Tangan   : Cylinder, Ellipsoid
//   Kaki     : Cylinder, Ellipsoid
//   Sepatu   : Ellipsoid, Hyperboloid 2 sheet
//   Aksesori : Kubus, Elliptic paraboloid
//   Senjata  : Cylinder, Bezier curve, Kubus

var FACE_IMAGE = "";

var LIGHT = (function () {
    var l = [0.4, 0.6, 0.7];
    var len = Math.hypot(l[0], l[1], l[2]);
    return [l[0] / len, l[1] / len, l[2] / len];
})();

// satu vertex = posisi(3) + warna(3) + uv(2)
function pushVertex(vertices, x, y, z, nx, ny, nz, color, u, v) {
    var len = Math.hypot(nx, ny, nz) || 1;
    var d = (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / len;
    var shade = 0.4 + 0.6 * Math.max(d, 0);

    vertices.push(x, y, z);
    vertices.push(color[0] * shade, color[1] * shade, color[2] * shade);
    vertices.push(u || 0, v || 0);
}

// gabungkan beberapa geometri jadi satu mesh
function mergeGeometry(list) {
    var vertices = [];
    var faces = [];

    list.forEach(function (g) {
        var offset = vertices.length / 8;
        for (var i = 0; i < g.vertices.length; i++) vertices.push(g.vertices[i]);
        for (var i = 0; i < g.faces.length; i++) faces.push(g.faces[i] + offset);
    });

    return { vertices, faces };
}

// ELLIPSOID / SPHERE (dengan UV)
function generateEllipsoid(a, b, c, stack, step, color) {
    var vertices = [];
    var faces = [];

    for (var i = 0; i <= stack; i++) {
        var u = i / stack * Math.PI - Math.PI / 2;

        for (var j = 0; j <= step; j++) {
            var v = j / step * 2 * Math.PI - Math.PI;

            var x = a * Math.cos(v) * Math.cos(u);
            var y = b * Math.sin(u);
            var z = c * Math.sin(v) * Math.cos(u);

            // uv equirectangular: depan (+Z) ada di u = 0.75
            pushVertex(
                vertices, x, y, z,
                x / (a * a), y / (b * b), z / (c * c),
                color,
                j / step, 1 - i / stack
            );
        }
    }

    for (var i = 0; i < stack; i++) {
        for (var j = 0; j < step; j++) {
            var first = i * (step + 1) + j;
            var second = first + 1;
            var third = first + (step + 1);
            var fourth = third + 1;

            faces.push(first, second, fourth);
            faces.push(first, fourth, third);
        }
    }

    return { vertices, faces };
}

// CYLINDER (sumbu Y, pusat di origin)
// arcStart/arcEnd (radian): hanya sebagian keliling (tanpa tutup). Depan (+Z) = PI/2
function generateCylinder(r, h, slices, color, arcStart, arcEnd) {
    var vertices = [];
    var faces = [];

    var partial = (arcStart !== undefined && arcEnd !== undefined);
    var a0 = partial ? arcStart : 0;
    var a1 = partial ? arcEnd : 2 * Math.PI;

    for (var j = 0; j <= slices; j++) {
        var ang = a0 + (a1 - a0) * j / slices;
        var cx = Math.cos(ang), sz = Math.sin(ang);

        pushVertex(vertices, r * cx, -h / 2, r * sz, cx, 0, sz, color);
        pushVertex(vertices, r * cx, h / 2, r * sz, cx, 0, sz, color);
    }
    for (var j = 0; j < slices; j++) {
        var i0 = j * 2, i1 = i0 + 1, i2 = i0 + 2, i3 = i0 + 3;
        faces.push(i0, i2, i1);
        faces.push(i1, i2, i3);
    }

    if (!partial) {
        [1, -1].forEach(function (sign) {
            var center = vertices.length / 8;
            pushVertex(vertices, 0, sign * h / 2, 0, 0, sign, 0, color);

            var start = vertices.length / 8;
            for (var j = 0; j <= slices; j++) {
                var ang = j / slices * 2 * Math.PI;
                pushVertex(
                    vertices,
                    r * Math.cos(ang), sign * h / 2, r * Math.sin(ang),
                    0, sign, 0, color
                );
            }
            for (var j = 0; j < slices; j++) {
                faces.push(center, start + j, start + j + 1);
            }
        });
    }

    return { vertices, faces };
}

// CONE / CONE TERPOTONG (sumbu Y, pusat di origin)
function generateCone(rBottom, rTop, h, slices, color, zScale) {
    var vertices = [];
    var faces = [];

    var zs = zScale || 1;   // skala kedalaman (Z) supaya penampang bisa elips
    var ny = (rBottom - rTop) / h;

    for (var j = 0; j <= slices; j++) {
        var ang = j / slices * 2 * Math.PI;
        var cx = Math.cos(ang), sz = Math.sin(ang);

        pushVertex(vertices, rBottom * cx, -h / 2, rBottom * sz * zs, cx, ny, sz / zs, color);
        pushVertex(vertices, rTop * cx, h / 2, rTop * sz * zs, cx, ny, sz / zs, color);
    }
    for (var j = 0; j < slices; j++) {
        var i0 = j * 2, i1 = i0 + 1, i2 = i0 + 2, i3 = i0 + 3;
        faces.push(i0, i2, i1);
        faces.push(i1, i2, i3);
    }

    [[-1, rBottom], [1, rTop]].forEach(function (cap) {
        var sign = cap[0], r = cap[1];
        if (r <= 0) return;

        var center = vertices.length / 8;
        pushVertex(vertices, 0, sign * h / 2, 0, 0, sign, 0, color);

        var start = vertices.length / 8;
        for (var j = 0; j <= slices; j++) {
            var ang = j / slices * 2 * Math.PI;
            pushVertex(
                vertices,
                r * Math.cos(ang), sign * h / 2, r * Math.sin(ang) * zs,
                0, sign, 0, color
            );
        }
        for (var j = 0; j < slices; j++) {
            faces.push(center, start + j, start + j + 1);
        }
    });

    return { vertices, faces };
}

// KUBUS / BALOK (kubus yang diskalakan w x h x d)
// Orientasi ditentukan oleh tiga sumbu ex, ey, ez (default: sejajar sumbu dunia)
function generateBox(w, h, d, color, center, ex, ey, ez) {
    center = center || [0, 0, 0];
    ex = ex || [1, 0, 0];
    ey = ey || [0, 1, 0];
    ez = ez || [0, 0, 1];

    var hw = w / 2, hh = h / 2, hd = d / 2;

    // [normal lokal, 4 sudut lokal]
    var faceDefs = [
        [[0, 0, 1], [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]],
        [[0, 0, -1], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]]],
        [[1, 0, 0], [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]]],
        [[-1, 0, 0], [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]]],
        [[0, 1, 0], [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]]],
        [[0, -1, 0], [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]]]
    ];

    var vertices = [];
    var faces = [];

    function toWorld(lx, ly, lz) {
        return [
            center[0] + ex[0] * lx + ey[0] * ly + ez[0] * lz,
            center[1] + ex[1] * lx + ey[1] * ly + ez[1] * lz,
            center[2] + ex[2] * lx + ey[2] * ly + ez[2] * lz
        ];
    }

    faceDefs.forEach(function (f) {
        var n = f[0];
        var nw = [
            ex[0] * n[0] + ey[0] * n[1] + ez[0] * n[2],
            ex[1] * n[0] + ey[1] * n[1] + ez[1] * n[2],
            ex[2] * n[0] + ey[2] * n[1] + ez[2] * n[2]
        ];
        var base = vertices.length / 8;

        f[1].forEach(function (c) {
            var p = toWorld(c[0] * hw, c[1] * hh, c[2] * hd);
            pushVertex(vertices, p[0], p[1], p[2], nw[0], nw[1], nw[2], color);
        });

        faces.push(base, base + 1, base + 2);
        faces.push(base, base + 2, base + 3);
    });

    return { vertices, faces };
}

function normalize3(v) {
    var l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
}

function cross3(a, b) {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ];
}

// RANTAI KUBUS menempel di permukaan depan ellipsoid
// dipakai untuk sabuk silang di dada
function ellipsoidFrontPoint(a, b, c, k, x, y) {
    var A = a * k, B = b * k, C = c * k;
    var q = 1 - (x / A) * (x / A) - (y / B) * (y / B);
    return [x, y, C * Math.sqrt(Math.max(q, 0))];
}

function generateStrapBoxes(a, b, c, k, x0, y0, x1, y1, width, thickness, segs, color) {
    var pts = [];
    for (var i = 0; i <= segs; i++) {
        var t = i / segs;
        pts.push(ellipsoidFrontPoint(a, b, c, k, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t));
    }

    var list = [];
    for (var i = 0; i < segs; i++) {
        var p0 = pts[i], p1 = pts[i + 1];
        var dir = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
        var len = Math.hypot(dir[0], dir[1], dir[2]);

        var ex = normalize3(dir);
        var eyRaw = normalize3([-ex[1], ex[0], 0]);
        var ez = normalize3(cross3(ex, eyRaw));   // mengarah keluar (+Z)
        var ey = cross3(ez, ex);

        var center = [
            (p0[0] + p1[0]) / 2 + ez[0] * thickness / 2,
            (p0[1] + p1[1]) / 2 + ez[1] * thickness / 2,
            (p0[2] + p1[2]) / 2 + ez[2] * thickness / 2
        ];

        list.push(generateBox(len * 1.15, width, thickness, color, center, ex, ey, ez));
    }
    return mergeGeometry(list);
}

// KANCING KECIL (kubus) yang menempel di atas sabuk pada posisi t (0..1) sepanjang sabuk
function generateStrapMark(a, b, c, k, x0, y0, x1, y1, t, length, width, thickness, color) {
    var e = 0.01;
    var pA = ellipsoidFrontPoint(a, b, c, k, x0 + (x1 - x0) * (t - e), y0 + (y1 - y0) * (t - e));
    var pB = ellipsoidFrontPoint(a, b, c, k, x0 + (x1 - x0) * (t + e), y0 + (y1 - y0) * (t + e));
    var p = ellipsoidFrontPoint(a, b, c, k, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);

    var ex = normalize3([pB[0] - pA[0], pB[1] - pA[1], pB[2] - pA[2]]);
    var eyRaw = normalize3([-ex[1], ex[0], 0]);
    var ez = normalize3(cross3(ex, eyRaw));
    var ey = cross3(ez, ex);

    var lift = 0.03 + thickness / 2;   // di atas permukaan sabuk
    var center = [p[0] + ez[0] * lift, p[1] + ez[1] * lift, p[2] + ez[2] * lift];

    return generateBox(length, width, thickness, color, center, ex, ey, ez);
}

// CINCIN KUBUS mengelilingi badan (ikat pinggang)
function generateBoxRing(a, c, y, n, w, h, d, color, psiStart, psiEnd) {
    var list = [];
    var partial = (psiStart !== undefined && psiEnd !== undefined);
    for (var i = 0; i < n; i++) {
        var psi = partial
            ? psiStart + (psiEnd - psiStart) * i / (n - 1)
            : 2 * Math.PI * i / n;
        var ex = normalize3([-a * Math.sin(psi), 0, c * Math.cos(psi)]);
        var ey = [0, 1, 0];
        var ez = [ex[2], 0, -ex[0]];             // mengarah keluar
        var center = [a * Math.cos(psi), y, c * Math.sin(psi)];

        list.push(generateBox(w, h, d, color, center, ex, ey, ez));
    }
    return mergeGeometry(list);
}

// TABUNG (cylinder) berderet mengelilingi badan, dipakai untuk peluru
function generateCylinderRing(a, c, y, n, r, h, slices, color, psiStart, psiEnd) {
    var list = [];
    for (var i = 0; i < n; i++) {
        var psi = psiStart + (psiEnd - psiStart) * i / (n - 1);
        var g = generateCylinder(r, h, slices, color);
        var ox = a * Math.cos(psi);
        var oz = c * Math.sin(psi);

        for (var k = 0; k < g.vertices.length; k += 8) {
            g.vertices[k] += ox;
            g.vertices[k + 1] += y;
            g.vertices[k + 2] += oz;
        }
        list.push(g);
    }
    return mergeGeometry(list);
}

// ELLIPTIC PARABOLOID (kubah): y = h * (1 - x^2/a^2 - z^2/c^2), pusat vertikal di origin
function generateEllipticParaboloid(a, c, h, stacks, slices, color) {
    var vertices = [];
    var faces = [];

    // dari tepi (r = 1) ke puncak (r = 0)
    for (var i = 0; i <= stacks; i++) {
        var r = 1 - i / stacks;

        for (var j = 0; j <= slices; j++) {
            var t = j / slices * 2 * Math.PI;
            var x = a * r * Math.cos(t);
            var z = c * r * Math.sin(t);
            var y = h * (1 - r * r) - h;     // tepi di -h, puncak di 0

            pushVertex(
                vertices, x, y + h / 2, z,
                2 * h * x / (a * a), 1, 2 * h * z / (c * c),
                color
            );
        }
    }
    for (var i = 0; i < stacks; i++) {
        for (var j = 0; j < slices; j++) {
            var first = i * (slices + 1) + j;
            var second = first + 1;
            var third = first + (slices + 1);
            var fourth = third + 1;
            faces.push(first, second, fourth);
            faces.push(first, fourth, third);
        }
    }

    // alas datar
    var center = vertices.length / 8;
    pushVertex(vertices, 0, -h / 2, 0, 0, -1, 0, color);
    var start = vertices.length / 8;
    for (var j = 0; j <= slices; j++) {
        var t = j / slices * 2 * Math.PI;
        pushVertex(vertices, a * Math.cos(t), -h / 2, c * Math.sin(t), 0, -1, 0, color);
    }
    for (var j = 0; j < slices; j++) {
        faces.push(center, start + j, start + j + 1);
    }

    return { vertices, faces };
}

// HYPERBOLOID 2 SHEET (lembar atas):
//   y = c cosh(u), x = a sinh(u) cos(t), z = b sinh(u) sin(t)
// u dari uMin ke uMax -> bentuk corong yang melebar ke atas (dipakai untuk bibir sepatu)
function generateHyperboloid2(a, b, c, uMin, uMax, stacks, slices, color) {
    var vertices = [];
    var faces = [];

    var yMid = c * (Math.cosh(uMin) + Math.cosh(uMax)) / 2;

    for (var i = 0; i <= stacks; i++) {
        var u = uMin + (uMax - uMin) * i / stacks;

        for (var j = 0; j <= slices; j++) {
            var t = j / slices * 2 * Math.PI;

            var x = a * Math.sinh(u) * Math.cos(t);
            var z = b * Math.sinh(u) * Math.sin(t);
            var y = c * Math.cosh(u);

            // normal menghadap keluar-bawah
            pushVertex(
                vertices, x, y - yMid, z,
                x / (a * a), -y / (c * c), z / (b * b),
                color
            );
        }
    }
    for (var i = 0; i < stacks; i++) {
        for (var j = 0; j < slices; j++) {
            var first = i * (slices + 1) + j;
            var second = first + 1;
            var third = first + (slices + 1);
            var fourth = third + 1;
            faces.push(first, second, fourth);
            faces.push(first, fourth, third);
        }
    }

    return { vertices, faces };
}

// BEZIER CURVE (kubik) -> tabung yang menyapu sepanjang kurva
// kurva berada di bidang XY, penampang tabung lingkaran dengan radius r0 -> r1
function bezierPoint(p0, p1, p2, p3, t) {
    var u = 1 - t;
    var w0 = u * u * u, w1 = 3 * u * u * t, w2 = 3 * u * t * t, w3 = t * t * t;
    return [
        w0 * p0[0] + w1 * p1[0] + w2 * p2[0] + w3 * p3[0],
        w0 * p0[1] + w1 * p1[1] + w2 * p2[1] + w3 * p3[1]
    ];
}

function bezierTangent(p0, p1, p2, p3, t) {
    var u = 1 - t;
    var a = 3 * u * u, b = 6 * u * t, c = 3 * t * t;
    var tx = a * (p1[0] - p0[0]) + b * (p2[0] - p1[0]) + c * (p3[0] - p2[0]);
    var ty = a * (p1[1] - p0[1]) + b * (p2[1] - p1[1]) + c * (p3[1] - p2[1]);
    var l = Math.hypot(tx, ty) || 1;
    return [tx / l, ty / l];
}

function generateBezierTube(p0, p1, p2, p3, r0, r1, segs, slices, color) {
    var vertices = [];
    var faces = [];

    for (var i = 0; i <= segs; i++) {
        var t = i / segs;
        var P = bezierPoint(p0, p1, p2, p3, t);
        var T = bezierTangent(p0, p1, p2, p3, t);
        var N = [-T[1], T[0]];
        var r = r0 + (r1 - r0) * t;

        for (var j = 0; j <= slices; j++) {
            var phi = j / slices * 2 * Math.PI;
            var nx = Math.cos(phi) * N[0];
            var ny = Math.cos(phi) * N[1];
            var nz = Math.sin(phi);

            pushVertex(
                vertices,
                P[0] + r * nx, P[1] + r * ny, r * nz,
                nx, ny, nz,
                color
            );
        }
    }
    for (var i = 0; i < segs; i++) {
        for (var j = 0; j < slices; j++) {
            var first = i * (slices + 1) + j;
            var second = first + 1;
            var third = first + (slices + 1);
            var fourth = third + 1;
            faces.push(first, second, fourth);
            faces.push(first, fourth, third);
        }
    }

    // tutup kedua ujung
    [[0, -1, r0], [1, 1, r1]].forEach(function (end) {
        var t = end[0], sign = end[1], r = end[2];
        var P = bezierPoint(p0, p1, p2, p3, t);
        var T = bezierTangent(p0, p1, p2, p3, t);
        var N = [-T[1], T[0]];

        var center = vertices.length / 8;
        pushVertex(vertices, P[0], P[1], 0, -sign * T[0], -sign * T[1], 0, color);

        var start = vertices.length / 8;
        for (var j = 0; j <= slices; j++) {
            var phi = j / slices * 2 * Math.PI;
            pushVertex(
                vertices,
                P[0] + r * Math.cos(phi) * N[0],
                P[1] + r * Math.cos(phi) * N[1],
                r * Math.sin(phi),
                -sign * T[0], -sign * T[1], 0,
                color
            );
        }
        for (var j = 0; j < slices; j++) {
            faces.push(center, start + j, start + j + 1);
        }
    });

    return { vertices, faces };
}

// TEXTURE
function isPowerOf2(n) {
    return (n & (n - 1)) === 0;
}

function uploadTexture(GL, texture, source, width, height) {
    GL.bindTexture(GL.TEXTURE_2D, texture);
    GL.texImage2D(
        GL.TEXTURE_2D, 0, GL.RGBA, GL.RGBA, GL.UNSIGNED_BYTE, source
    );

    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE);

    if (isPowerOf2(width) && isPowerOf2(height)) {
        GL.generateMipmap(GL.TEXTURE_2D);
        GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.LINEAR_MIPMAP_LINEAR);
    } else {
        GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.LINEAR);
    }
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.LINEAR);
}

function createWhiteTexture(GL) {
    var tex = GL.createTexture();
    GL.bindTexture(GL.TEXTURE_2D, tex);
    GL.texImage2D(
        GL.TEXTURE_2D, 0, GL.RGBA, 1, 1, 0,
        GL.RGBA, GL.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255])
    );
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.NEAREST);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.NEAREST);
    return tex;
}

// wajah digambar otomatis di canvas 2D (peta equirectangular)
function drawFaceCanvas() {
    var W = 1024, H = 512;
    var canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext("2d");

    // lon: derajat dari tengah depan (+ = kanan layar), lat: derajat dari ekuator (+ = atas)
    function px(lon) { return W * 0.75 + lon / 360 * W; }
    function py(lat) { return H / 2 - lat / 180 * H; }

    // kulit
    ctx.fillStyle = "#e9ddca";
    ctx.fillRect(0, 0, W, H);

    // pipi merah: lingkaran besar dengan tepi sedikit lembut
    [-34, 34].forEach(function (lon) {
        var g = ctx.createRadialGradient(px(lon), py(-14), 2, px(lon), py(-14), 38);
        g.addColorStop(0, "rgba(218, 52, 52, 1)");
        g.addColorStop(0.85, "rgba(218, 52, 52, 1)");
        g.addColorStop(1, "rgba(218, 52, 52, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px(lon), py(-14), 38, 0, 2 * Math.PI);
        ctx.fill();
    });

    // mata: putih dengan garis tepi hitam (tidak ada hidung)
    [-29, 29].forEach(function (lon) {
        ctx.beginPath();
        ctx.ellipse(px(lon), py(7), 20, 26, 0, 0, 2 * Math.PI);
        ctx.fillStyle = "#f8f4ec";
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = "#1c1210";
        ctx.stroke();
    });

    // bagian dalam mulut (hitam) di bawah gigi atas; rahang bawah ada di badan
    ctx.fillStyle = "#120a0a";
    ctx.fillRect(px(-20), py(-41), px(20) - px(-20), py(-62) - py(-41));

    // gigi rahang atas
    var tx = px(-17);
    var tw = px(17) - px(-17);
    var ty = py(-35);
    var th = py(-41) - py(-35);

    ctx.fillStyle = "#f4eee0";
    ctx.fillRect(tx, ty, tw, th);

    ctx.fillStyle = "#3a2a2a";
    for (var i = 1; i < 5; i++) {
        ctx.fillRect(tx + tw * i / 5 - 1.5, ty, 3, th);
    }

    return canvas;
}

function createFaceTexture(GL) {
    var tex = GL.createTexture();
    var canvas = drawFaceCanvas();
    uploadTexture(GL, tex, canvas, canvas.width, canvas.height);

    if (FACE_IMAGE) {
        var img = new Image();
        img.onload = function () {
            uploadTexture(GL, tex, img, img.width, img.height);
        };
        img.onerror = function () {
            console.error("Gambar wajah tidak ditemukan: " + FACE_IMAGE);
        };
        img.src = FACE_IMAGE;
    }
    return tex;
}

// TEXTURE BADAN: warna seragam + rahang bawah (mulut) yang digambar
function drawBodyCanvas() {
    var W = 1024, H = 512;
    var canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext("2d");

    // lon: derajat dari tengah depan, lat: derajat parametrik dari ekuator (+ = atas)
    function px(lon) { return W * 0.75 + lon / 360 * W; }
    function py(lat) { return H / 2 - lat / 180 * H; }

    // warna seragam (sama dengan RED di main)
    ctx.fillStyle = "#8c1412";
    ctx.fillRect(0, 0, W, H);

    // rahang bawah: bagian dalam mulut (hitam)
    ctx.fillStyle = "#120a0a";
    ctx.fillRect(px(-20), py(52), px(20) - px(-20), py(41.5) - py(52));

    // gigi rahang bawah
    var tx = px(-20);
    var tw = px(20) - px(-20);
    var ty = py(41.5);
    var th = py(36) - py(41.5);

    ctx.fillStyle = "#f4eee0";
    ctx.fillRect(tx, ty, tw, th);

    ctx.fillStyle = "#3a2a2a";
    for (var i = 1; i < 5; i++) {
        ctx.fillRect(tx + tw * i / 5 - 1.5, ty, 3, th);
    }

    return canvas;
}

function createBodyTexture(GL) {
    var tex = GL.createTexture();
    var canvas = drawBodyCanvas();
    uploadTexture(GL, tex, canvas, canvas.width, canvas.height);
    return tex;
}

// MEMBUAT MESH DAN BUFFER WEBGL
function createMesh(GL, geometry, texture) {
    var OBJECT_VERTEX = GL.createBuffer();
    GL.bindBuffer(GL.ARRAY_BUFFER, OBJECT_VERTEX);
    GL.bufferData(
        GL.ARRAY_BUFFER,
        new Float32Array(geometry.vertices),
        GL.STATIC_DRAW
    );

    var OBJECT_FACES = GL.createBuffer();
    GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, OBJECT_FACES);
    GL.bufferData(
        GL.ELEMENT_ARRAY_BUFFER,
        new Uint16Array(geometry.faces),
        GL.STATIC_DRAW
    );

    return {
        OBJECT_VERTEX: OBJECT_VERTEX,
        OBJECT_FACES: OBJECT_FACES,
        count: geometry.faces.length,
        texture: texture
    };
}

// MAIN
function main() {
    var CANVAS = document.getElementById("mycanvas");

    CANVAS.width = window.innerWidth;
    CANVAS.height = window.innerHeight;

    var GL = CANVAS.getContext("webgl", { antialias: true });

    if (!GL) {
        alert("WebGL tidak tersedia.");
        return;
    }

    // SHADERS
    var vertexSource = `
        attribute vec3 position;
        attribute vec3 color;
        attribute vec2 uv;

        uniform mat4 Pmatrix;
        uniform mat4 Vmatrix;
        uniform mat4 Mmatrix;

        varying vec3 vColor;
        varying vec2 vUV;

        void main(void) {
            gl_Position = Pmatrix * Vmatrix * Mmatrix * vec4(position, 1.0);
            vColor = color;
            vUV = uv;
        }
    `;

    var fragmentSource = `
        precision mediump float;

        uniform sampler2D sampler;

        varying vec3 vColor;
        varying vec2 vUV;

        void main(void) {
            gl_FragColor = vec4(vColor, 1.0) * texture2D(sampler, vUV);
        }
    `;

    function compileShader(source, type) {
        var shader = GL.createShader(type);
        GL.shaderSource(shader, source);
        GL.compileShader(shader);

        if (!GL.getShaderParameter(shader, GL.COMPILE_STATUS)) {
            console.error(GL.getShaderInfoLog(shader));
            return null;
        }
        return shader;
    }

    var vertexShader = compileShader(vertexSource, GL.VERTEX_SHADER);
    var fragmentShader = compileShader(fragmentSource, GL.FRAGMENT_SHADER);

    if (!vertexShader || !fragmentShader) return;

    var SHADER_PROGRAM = GL.createProgram();
    GL.attachShader(SHADER_PROGRAM, vertexShader);
    GL.attachShader(SHADER_PROGRAM, fragmentShader);
    GL.linkProgram(SHADER_PROGRAM);

    if (!GL.getProgramParameter(SHADER_PROGRAM, GL.LINK_STATUS)) {
        console.error(GL.getProgramInfoLog(SHADER_PROGRAM));
        return;
    }

    GL.useProgram(SHADER_PROGRAM);

    var _position = GL.getAttribLocation(SHADER_PROGRAM, "position");
    var _color = GL.getAttribLocation(SHADER_PROGRAM, "color");
    var _uv = GL.getAttribLocation(SHADER_PROGRAM, "uv");

    GL.enableVertexAttribArray(_position);
    GL.enableVertexAttribArray(_color);
    GL.enableVertexAttribArray(_uv);

    var _Pmatrix = GL.getUniformLocation(SHADER_PROGRAM, "Pmatrix");
    var _Vmatrix = GL.getUniformLocation(SHADER_PROGRAM, "Vmatrix");
    var _Mmatrix = GL.getUniformLocation(SHADER_PROGRAM, "Mmatrix");
    var _sampler = GL.getUniformLocation(SHADER_PROGRAM, "sampler");

    // WARNA dan TEXTURE
    var WHITE = [1.0, 1.0, 1.0];
    var BLACK = [0.06, 0.05, 0.06];
    var GOLD = [0.88, 0.66, 0.20];
    var RED = [0.55, 0.08, 0.07];
    var BLUE = [0.10, 0.13, 0.50];
    var CREAM = [0.90, 0.87, 0.78];
    var WOOD = [0.42, 0.24, 0.10];
    var METAL = [0.16, 0.16, 0.18];
    var MAROON = [0.42, 0.16, 0.13];        // kayu pelindung di bawah laras
    var MAROON_DARK = [0.34, 0.11, 0.10];   // kayu popor
    var BRASS = [0.86, 0.56, 0.20];         // cincin kuningan di pangkal laras
    var TAN = [0.74, 0.56, 0.24];           // epaulette (kuning kecokelatan, tidak mengilap)
    var SKIN = [0.914, 0.867, 0.792];   // sama dengan warna kulit di texture wajah (#e9ddca)

    var whiteTex = createWhiteTexture(GL);
    var faceTex = createFaceTexture(GL);
    var bodyTex = createBodyTexture(GL);

    function mesh(geometry) {
        return createMesh(GL, geometry, whiteTex);
    }

    // BADAN: ELLIPSOID (dada) + ELLIPSOID (rok seragam)
    var BODY_A = 0.58, BODY_B = 0.92, BODY_C = 0.38;

    // badan memakai texture (warna seragam + rahang bawah), jadi warna vertex dibuat putih
    var meshBody = createMesh(
        GL,
        generateEllipsoid(BODY_A, BODY_B, BODY_C, 36, 36, WHITE),
        bodyTex
    );
    // rok seragam: cone terpotong, bawahnya datar dan sedikit melebar
    var meshSkirt = mesh(generateCone(0.62, 0.52, 0.47, 36, RED, 0.70));

    // AKSESORI: KUBUS + ELLIPTIC PARABOLOID

    // sabuk silang lebar di dada (rantai kubus mengikuti lengkung badan):
    // X simetris, dari dekat leher sampai pojok ikat pinggang di sisi seberang
    var STRAP_A = [-0.40, 0.60, 0.42, -0.40];   // x0, y0, x1, y1
    var STRAP_B = [0.40, 0.60, -0.42, -0.40];
    var STRAP_W = 0.22;

    var meshStrapA = mesh(generateStrapBoxes(
        BODY_A, BODY_B, BODY_C, 1.025,
        STRAP_A[0], STRAP_A[1], STRAP_A[2], STRAP_A[3], STRAP_W, 0.03, 16, CREAM
    ));
    var meshStrapB = mesh(generateStrapBoxes(
        BODY_A, BODY_B, BODY_C, 1.045,
        STRAP_B[0], STRAP_B[1], STRAP_B[2], STRAP_B[3], STRAP_W, 0.03, 16, CREAM
    ));

    // "=" di tengah dada: dua tab putih horizontal di atas titik silang sabuk,
    // dengan kancing emas di setiap ujungnya (4 kancing)
    var BAR_Y = 0.11;        // tinggi tengah "="
    var BAR_GAP = 0.085;     // jarak tengah ke masing-masing tab
    var BAR_HALF = 0.32;     // setengah panjang tab
    var BAR_K = 1.085;       // sedikit di atas permukaan sabuk X

    var meshBars = mesh(mergeGeometry([
        generateStrapBoxes(BODY_A, BODY_B, BODY_C, BAR_K,
            -BAR_HALF, BAR_Y + BAR_GAP, BAR_HALF, BAR_Y + BAR_GAP, 0.09, 0.03, 12, CREAM),
        generateStrapBoxes(BODY_A, BODY_B, BODY_C, BAR_K,
            -BAR_HALF, BAR_Y - BAR_GAP, BAR_HALF, BAR_Y - BAR_GAP, 0.09, 0.03, 12, CREAM)
    ]));

    var pinList = [];
    [BAR_Y + BAR_GAP, BAR_Y - BAR_GAP].forEach(function (by) {
        [0.04, 0.96].forEach(function (t) {
            pinList.push(generateStrapMark(BODY_A, BODY_B, BODY_C, BAR_K,
                -BAR_HALF, by, BAR_HALF, by, t, 0.08, 0.045, 0.015, GOLD));
        });
    });
    var meshPins = mesh(mergeGeometry(pinList));

    // ikat pinggang putih (cincin kubus) + deretan peluru (kubus hitam) di bagian depan
    var meshBelt = mesh(generateBoxRing(0.545, 0.37, -0.44, 24, 0.15, 0.17, 0.04, CREAM));

    // peluru: tabung (cylinder) hitam berderet dalam satu kelompok di depan ikat pinggang,
    // menonjol di atas ikat pinggang
    var meshBullets = mesh(generateCylinderRing(
        0.585, 0.405, -0.40, 14, 0.043, 0.22, 12, BLACK,
        Math.PI * 0.12, Math.PI * 0.88
    ));

    // mulut hanya gambar: rahang atas digambar di texture kepala,
    // rahang bawah digambar di texture badan (tanpa bentuk tambahan)

    // epaulette di bahu (elliptic paraboloid)
    var meshEpaulette = mesh(generateEllipticParaboloid(0.30, 0.26, 0.22, 8, 28, TAN));

    // KEPALA: SPHERE + texture wajah
    var meshHead = createMesh(
        GL,
        generateEllipsoid(0.58, 0.58, 0.58, 40, 40, WHITE),
        faceTex
    );

    // TOPI: CYLINDER + CONE
    var HAT_R = 0.62;
    var meshHat = mesh(generateCylinder(HAT_R, 1.2, 40, BLACK));
    var meshHatTop = mesh(generateCone(HAT_R, 0.56, 0.12, 40, BLACK));

    // 3 garis emas pendek di tengah depan topi (busur cylinder)
    var FRONT = Math.PI / 2;
    var SPAN = 0.50;
    var STRIPE_COUNT = 3;
    var STRIPE_GAP = 0.08;
    var STRIPE_Y = 0.14;
    var STRIPE_T = 0.035;
    var STRIPE_R = HAT_R + 0.012;

    var meshStripe = mesh(generateCylinder(
        STRIPE_R, STRIPE_T, 20, GOLD, FRONT - SPAN, FRONT + SPAN
    ));

    // TANGAN: CYLINDER + ELLIPSOID (sendi di bahu & siku)
    var L1 = 0.70;   // bahu -> siku
    var L2 = 0.82;   // siku -> pusat tangan

    var meshShoulderBall = mesh(generateEllipsoid(0.18, 0.18, 0.18, 20, 20, RED));
    var meshUpperArm = mesh(generateCylinder(0.16, 0.70, 28, RED));
    var meshElbowBall = mesh(generateEllipsoid(0.17, 0.17, 0.17, 20, 20, RED));
    var meshForearm = mesh(generateEllipsoid(0.17, 0.39, 0.17, 28, 28, RED));
    var meshHand = mesh(generateEllipsoid(0.18, 0.20, 0.18, 24, 24, SKIN));

    // SENJATA: CYLINDER + BEZIER CURVE + KUBUS (sumbu panjang = Y lokal)

    // double barrel shotgun (sesuai template: laras tebal, cincin kuningan besar, kayu marun)
    var meshGunBreech = mesh(generateCylinder(0.21, 0.30, 28, BRASS));      // cincin kuningan di pangkal laras
    var meshGunBarrel = mesh(generateCylinder(0.088, 1.70, 24, METAL));     // dipakai dua kali (laras kiri & kanan)
    var meshGunForend = mesh(generateCylinder(0.098, 1.30, 24, MAROON));    // kayu di bawah laras

    // popor: tabung menyapu kurva Bezier kubik, menekuk tajam ke bawah (ujungnya di pinggul)
    var meshGunStock = mesh(generateBezierTube(
        [0.0, -0.05], [0.10, -0.10], [0.30, -0.18], [0.55, -0.34],
        0.13, 0.18,
        24, 16, MAROON_DARK
    ));

    // pelindung pelatuk: kurva Bezier kecil
    var meshGunTriggerGuard = mesh(generateBezierTube(
        [0.24, 0.10], [0.42, 0.10], [0.42, -0.14], [0.24, -0.14],
        0.014, 0.014,
        16, 8, METAL
    ));

    // dua hammer dan pembidik depan (kubus)
    var meshGunHammer = mesh(generateBox(0.07, 0.06, 0.03, METAL));
    var meshGunSight = mesh(generateBox(0.03, 0.04, 0.03, METAL));

    // rusuk tipis di alur antara dua laras (kubus)
    var meshGunRib = mesh(generateBox(0.04, 1.55, 0.10, METAL));

    // KAKI: CYLINDER + ELLIPSOID (sendi di pinggul & lutut)
    var meshHip = mesh(generateEllipsoid(0.22, 0.22, 0.22, 20, 20, BLUE));
    var meshThigh = mesh(generateCylinder(0.20, 1.40, 28, BLUE));
    var meshKnee = mesh(generateEllipsoid(0.20, 0.20, 0.20, 20, 20, BLUE));
    var meshShin = mesh(generateEllipsoid(0.19, 0.78, 0.18, 28, 28, BLUE));

    // SEPATU: ELLIPSOID (telapak) + HYPERBOLOID 2 SHEET (batang sepatu)
    var BOOT_A = 0.10;                                  // skala asimptot hyperboloid
    var BOOT_R0 = 0.20, BOOT_R1 = 0.24;                 // radius bawah & atas batang sepatu
    var BOOT_H = 0.50;                                  // tinggi batang sepatu
    var bootU0 = Math.asinh(BOOT_R0 / BOOT_A);
    var bootU1 = Math.asinh(BOOT_R1 / BOOT_A);
    var BOOT_C = BOOT_H / (Math.cosh(bootU1) - Math.cosh(bootU0));

    var meshBootShaft = mesh(generateHyperboloid2(
        BOOT_A, BOOT_A, BOOT_C, bootU0, bootU1, 10, 28, BLACK
    ));
    var meshBootFoot = mesh(generateEllipsoid(0.22, 0.17, 0.38, 24, 24, BLACK));

    // HIERARCHICAL OBJECT
    function make(m) {
        return new MyObject(
            GL, SHADER_PROGRAM,
            _position, _color, _Mmatrix,
            m,
            _uv, _sampler
        );
    }

    // buat object, taruh di posisi (x,y,z) relatif ke parent
    function attach(parent, m, x, y, z) {
        var obj = make(m);
        LIBS.set_position(obj.POSITION_MATRIX, x, y, z);
        parent.childs.push(obj);
        return obj;
    }

    var Body = make(meshBody);

    // badan & aksesori
    attach(Body, meshSkirt, 0, -0.735, 0);
    attach(Body, meshBelt, 0, 0, 0);
    attach(Body, meshBullets, 0, 0, 0);
    attach(Body, meshStrapA, 0, 0, 0);
    attach(Body, meshStrapB, 0, 0, 0);
    attach(Body, meshBars, 0, 0, 0);
    attach(Body, meshPins, 0, 0, 0);

    // epaulette (miring ke luar-bawah mengikuti bahu)
    var EpL = attach(Body, meshEpaulette, -0.66, 0.62, 0);
    LIBS.rotateZ(EpL.POSITION_MATRIX, 0.35);
    var EpR = attach(Body, meshEpaulette, 0.66, 0.62, 0);
    LIBS.rotateZ(EpR.POSITION_MATRIX, -0.35);

    // senapan: menyilang di depan badan
    var GUN_ANGLE = -1.05;                       // rotasi Z (radian)
    var GUN_DIR = [-Math.sin(GUN_ANGLE), Math.cos(GUN_ANGLE)];   // arah panjang senapan di bidang XY
    var GUN_POS = [-0.45, -0.25, 0.70];
    var GUN_HALF = 0.60;                         // jarak dari tengah ke masing-masing tangan

    var Gun = attach(Body, meshGunBreech, GUN_POS[0], GUN_POS[1], GUN_POS[2]);
    LIBS.rotateZ(Gun.POSITION_MATRIX, GUN_ANGLE);

    // dua laras sejajar (kiri-kanan di sumbu Z lokal)
    attach(Gun, meshGunBarrel, 0, 0.85, -0.088);
    attach(Gun, meshGunBarrel, 0, 0.85, 0.088);
    attach(Gun, meshGunRib, -0.08, 0.92, 0);
    attach(Gun, meshGunForend, 0.13, 1.00, 0);
    attach(Gun, meshGunStock, 0, 0, 0);          // geometri Bezier sudah memakai koordinat senapan
    attach(Gun, meshGunTriggerGuard, 0, 0, 0);
    attach(Gun, meshGunHammer, -0.14, -0.15, -0.088);
    attach(Gun, meshGunHammer, -0.14, -0.15, 0.088);
    attach(Gun, meshGunSight, -0.11, 1.65, 0);

    // lengan dengan IK sederhana: kedua tangan memegang senapan
    function buildArm(side, target) {
        var sx = side * 0.68, sy = 0.46, sz = 0;

        var Shoulder = attach(Body, meshShoulderBall, sx, sy, sz);
        attach(Shoulder, meshUpperArm, 0, -L1 / 2, 0);

        var Elbow = attach(Shoulder, meshElbowBall, 0, -L1, 0);
        attach(Elbow, meshForearm, 0, -0.39, 0);
        attach(Elbow, meshHand, 0, -L2 + 0.02, 0);

        // hitung sudut sendi supaya tangan mencapai target
        var dx = target[0] - sx;
        var dy = target[1] - sy;
        var dz = target[2] - sz;

        var delta = Math.atan2(dx, -dy); // ayunan ke samping
        var dyEff = -Math.hypot(dx, dy);
        var d = Math.hypot(dyEff, dz);

        function clamp(v) { return Math.max(-1, Math.min(1, v)); }

        var gamma = Math.acos(clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2)));
        var alpha = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)));
        var psi = Math.atan2(dz, -dyEff);
        var phi1 = psi - alpha;

        LIBS.rotateX(Shoulder.POSITION_MATRIX, -phi1);
        LIBS.rotateZ(Shoulder.POSITION_MATRIX, delta);
        LIBS.rotateX(Elbow.POSITION_MATRIX, -(Math.PI - gamma));
    }

    // tangan memegang senapan dari bawah: titik genggam dalam koordinat senapan
    // (lx = ke arah bawah senapan, ly = sepanjang laras)
    var GUN_DOWN = [Math.cos(GUN_ANGLE), Math.sin(GUN_ANGLE)];

    function gunPoint(lx, ly) {
        return [
            GUN_POS[0] + GUN_DOWN[0] * lx + GUN_DIR[0] * ly,
            GUN_POS[1] + GUN_DOWN[1] * lx + GUN_DIR[1] * ly,
            GUN_POS[2]
        ];
    }

    var handLeft = gunPoint(0.40, -0.12);    // tangan belakang: di bawah pelatuk dan pegangan popor
    var handRight = gunPoint(0.29, 1.15);    // tangan depan: di bawah kayu pelindung laras, dekat ujung

    buildArm(-1, handLeft);
    buildArm(1, handRight);

    // kaki: sendi pinggul -> lutut -> sepatu
    function buildLeg(side, hipX, hipSwing, hipSide, kneeBend) {
        var Hip = attach(Body, meshHip, hipX, -0.85, 0);
        attach(Hip, meshThigh, 0, -0.70, 0);

        var Knee = attach(Hip, meshKnee, 0, -1.40, 0);
        attach(Knee, meshShin, 0, -0.78, 0);
        attach(Knee, meshBootShaft, 0, -1.50, 0);
        attach(Knee, meshBootFoot, 0, -1.58, 0.16);

        LIBS.rotateX(Hip.POSITION_MATRIX, hipSwing);
        LIBS.rotateZ(Hip.POSITION_MATRIX, hipSide);
        LIBS.rotateX(Knee.POSITION_MATRIX, kneeBend);
    }

    // kedua kaki berdiri lurus, telapak menapak, sedikit terbuka ke samping
    buildLeg(-1, -0.26, 0.0, -0.03, 0.0);
    buildLeg(1, 0.26, 0.0, 0.03, 0.0);

    // kepala & topi 
    var Head = attach(Body, meshHead, 0, 1.20, 0);

    var Hat = attach(Head, meshHat, 0, 0.88, 0);
    attach(Hat, meshHatTop, 0, 0.66, 0);

    for (var k = 0; k < STRIPE_COUNT; k++) {
        var sy = STRIPE_Y + (k - (STRIPE_COUNT - 1) / 2) * STRIPE_GAP;
        attach(Hat, meshStripe, 0, sy, 0);
    }

    // CAMERA
    var PROJMATRIX = LIBS.get_projection(
        40, CANVAS.width / CANVAS.height, 1, 100
    );

    var VIEWMATRIX = LIBS.get_I4();
    LIBS.translateY(VIEWMATRIX, 0.6);
    LIBS.translateZ(VIEWMATRIX, -12.5);

    // INTERAKSI: drag mouse untuk memutar
    var rotY = 0;
    var dragging = false;
    var lastX = 0;

    CANVAS.addEventListener("mousedown", function (e) {
        dragging = true;
        lastX = e.clientX;
    });
    window.addEventListener("mouseup", function () { dragging = false; });
    window.addEventListener("mousemove", function (e) {
        if (!dragging) return;
        rotY += (e.clientX - lastX) * 0.01;
        lastX = e.clientX;
    });

    // DRAWING & ANIMATION
    GL.enable(GL.DEPTH_TEST);
    GL.depthFunc(GL.LEQUAL);
    GL.clearColor(0.12, 0.12, 0.12, 1.0);

    var previousTime = 0;

    function animate(time) {
        GL.viewport(0, 0, CANVAS.width, CANVAS.height);
        GL.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);

        var dt = time - previousTime;
        previousTime = time;

        if (!dragging) rotY += dt * 0.0005;

        LIBS.set_I4(Body.MOVE_MATRIX);
        LIBS.rotateY(Body.MOVE_MATRIX, rotY);

        // kepala miring pelan; topi ikut karena child
        LIBS.set_I4(Head.MOVE_MATRIX);
        //LIBS.rotateZ(Head.MOVE_MATRIX, Math.sin(time * 0.002) * 0.08);

        GL.uniformMatrix4fv(_Pmatrix, false, PROJMATRIX);
        GL.uniformMatrix4fv(_Vmatrix, false, VIEWMATRIX);

        Body.render(LIBS.get_I4());

        GL.flush();
        requestAnimationFrame(animate);
    }

    animate(0);
}

window.addEventListener("load", main);