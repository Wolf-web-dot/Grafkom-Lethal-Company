import { MyObject } from "./MyObjectTexture.js";

/*
   ENVIRONMENT : lorong pipa Facility (Lethal Company)

   Mengikuti referensi game:
   - lorong sempit, dinding bata batako abu-abu yang kotor
   - lantai beton gelap, langit-langit rendah dengan rangka besi
   - beberapa pipa tembaga tipis yang menempel & berbelok di dinding
   - sangat gelap: hanya cahaya senter pemain + satu lampu langit-langit

   Memakai shader texture (sama seperti Hoarding Bug & Nutcracker):
       warna akhir = warna vertex * texture
   - texture (bata, beton, logam) digambar sendiri di canvas
   - warna vertex = warna dasar * cahaya yang "dipanggang" (baked)
   Semua geometri dibuat langsung di koordinat dunia.
*/

// UKURAN LORONG
const FLOOR_Y = -5.75;     // telapak kaki monster
const CEIL_Y = 2.6;        // langit-langit rendah
const HALF_W = 6.6;        // dinding di x = -6.6 dan x = +6.6
const Z_NEAR = 16.0;       // kamera ada di z = 18
const Z_END = -23.0;       // dinding ujung lorong

// perempatan: bukaan kiri & kanan di antara CROSS_Z0 dan CROSS_Z1
const CROSS_Z0 = 1.0;      // sisi dekat perempatan
const CROSS_Z1 = -6.5;    // sisi jauh perempatan
const SIDE_LEN = 10.0;     // panjang lorong samping (kiri & kanan)

// UKURAN PIPA
// skala: Coil Head ±6.4 unit ≈ 2 m  ->  1 unit ≈ 0.31 m
// diameter (inch) ≈ radius * 2 * 0.31 / 0.0254  ≈ radius * 24.6
const PIPE = {
    big:    0.20,   // +-4.9 inch  (pipa kiri ke kotak sambungan)
    main:   0.18,   // +-4.4 inch  (pipa pojok kanan, pipa ujung)
    medium: 0.16,   // +-3.9 inch  (pipa katup, pipa lorong samping)
    small:  0.14    // +-3.4 inch  (pipa penyeberang, pipa ujung kedua)
};

// WARNA DASAR (dikali texture)
const C = {
    brick:    [0.80, 0.80, 0.78],
    concrete: [0.75, 0.74, 0.72],
    ceiling:  [0.45, 0.45, 0.45],
    steel:    [0.30, 0.30, 0.31],
    copper:   [0.72, 0.45, 0.28],
    brass:    [0.75, 0.62, 0.32],
    valve:    [0.55, 0.12, 0.10],
    lamp:     [1.00, 0.96, 0.85]
};

// PENCAHAYAAN (dipanggang ke warna vertex)
const AMBIENT = 0.035;

// senter pemain (spot light dari arah kamera)
const FLASH = {
    p: [0.8, -1.2, 17.5],
    dir: norm([0, -0.10, -1]),
    cosIn: Math.cos(0.30), cosOut: Math.cos(0.62),
    col: [1.0, 0.97, 0.90], power: 2.4, range: 16
};

// lampu langit-langit di tengah lorong
const LAMPS = [
    { p: [0, CEIL_Y - 0.6, (CROSS_Z0 + CROSS_Z1) / 2], col: [1.0, 0.93, 0.80], power: 2.0, range: 7.0 },  // di atas perempatan
    { p: [0, CEIL_Y - 0.6, -17], col: [1.0, 0.93, 0.80], power: 1.6, range: 6.0 }                         // dekat dinding ujung
];

function bake(color, x, y, z, nx, ny, nz) {
    const n = norm([nx, ny, nz]);
    let r = AMBIENT, g = AMBIENT, b = AMBIENT;

    const addLight = (L, k) => {
        const d = [L.p[0] - x, L.p[1] - y, L.p[2] - z];
        const dist = Math.hypot(d[0], d[1], d[2]) || 1;
        const lambert = Math.max(0, (n[0] * d[0] + n[1] * d[1] + n[2] * d[2]) / dist);
        const att = L.power / (1 + (dist * dist) / (L.range * L.range));
        const v = att * k * (0.2 + 0.8 * lambert);
        r += L.col[0] * v; g += L.col[1] * v; b += L.col[2] * v;
    };

    // senter: makin ke tengah kerucut makin terang
    const to = norm([x - FLASH.p[0], y - FLASH.p[1], z - FLASH.p[2]]);
    const c = to[0] * FLASH.dir[0] + to[1] * FLASH.dir[1] + to[2] * FLASH.dir[2];
    const spot = smooth(FLASH.cosOut, FLASH.cosIn, c);
    addLight(FLASH, 0.05 + 0.95 * spot);

    LAMPS.forEach(L => addLight(L, 1));

    // bagian bawah dinding lebih kotor/gelap
    const dirt = 0.75 + 0.25 * Math.min(1, (y - FLOOR_Y) / 2.5);
    // makin jauh dari kamera makin gelap
    const fog = Math.max(0, Math.min(1, 1.3 - Math.hypot(x, y, z - 18) / 55));
    r *= fog; g *= fog; b *= fog;

    return [
        Math.min(1, color[0] * r * dirt),
        Math.min(1, color[1] * g * dirt),
        Math.min(1, color[2] * b * dirt)
    ];
}

// MATH KECIL
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
function smooth(e0, e1, x) { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); }
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lerp = (a, b, t) => add(a, mul(sub(b, a), t));

// random yang selalu sama setiap dibuka (supaya texture tidak berubah-ubah)
function makeRandom(seed) {
    return () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
    };
}

// TEXTURE PROSEDURAL (canvas)
function makeCanvas(size) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = size;
    return [cv, cv.getContext("2d")];
}

function noise(ctx, size, rand, amount, count) {
    for (let i = 0; i < count; i++) {
        const v = Math.floor(rand() * amount);
        ctx.fillStyle = rand() < 0.5 ? `rgba(0,0,0,${v / 255})` : `rgba(255,255,255,${v / 400})`;
        ctx.fillRect(rand() * size, rand() * size, 1 + rand() * 2, 1 + rand() * 2);
    }
}

function blotches(ctx, size, rand, count, rgb, alphaMax, rMax) {
    for (let i = 0; i < count; i++) {
        const x = rand() * size, y = rand() * size, r = 10 + rand() * rMax;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${rgb},${alphaMax * rand()})`);
        g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
}

// Bata batako: 4 kolom x 8 baris, susunan selang-seling
function drawBrick() {
    const S = 512, rand = makeRandom(7);
    const [cv, ctx] = makeCanvas(S);
    ctx.fillStyle = "#4e4e4c";            // semen
    ctx.fillRect(0, 0, S, S);

    const BW = S / 4, BH = S / 8, M = 5;
    for (let row = 0; row < 8; row++) {
        const off = (row % 2) * BW / 2;
        for (let col = -1; col < 5; col++) {
            const x = col * BW + off, y = row * BH;
            const t = 138 + Math.floor((rand() - 0.5) * 30);
            ctx.fillStyle = `rgb(${t},${t},${t - 4})`;
            ctx.fillRect(x + M / 2, y + M / 2, BW - M, BH - M);
            // pinggir bata sedikit gelap
            ctx.strokeStyle = "rgba(0,0,0,0.18)";
            ctx.lineWidth = 3;
            ctx.strokeRect(x + M / 2 + 1.5, y + M / 2 + 1.5, BW - M - 3, BH - M - 3);
        }
    }
    noise(ctx, S, rand, 70, 26000);
    blotches(ctx, S, rand, 26, "30,28,25", 0.45, 70);      // noda kotor
    // rembesan kotor vertikal
    for (let i = 0; i < 10; i++) {
        const x = rand() * S, w = 6 + rand() * 18, h = 80 + rand() * 260, y = rand() * S;
        const g = ctx.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0, "rgba(25,22,18,0)");
        g.addColorStop(0.3, `rgba(25,22,18,${0.15 + rand() * 0.2})`);
        g.addColorStop(1, "rgba(25,22,18,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x, y, w, h);
    }
    return cv;
}

// Beton lantai / langit-langit
function drawConcrete() {
    const S = 512, rand = makeRandom(31);
    const [cv, ctx] = makeCanvas(S);
    ctx.fillStyle = "#5a5a58";
    ctx.fillRect(0, 0, S, S);
    blotches(ctx, S, rand, 40, "20,20,18", 0.5, 90);
    blotches(ctx, S, rand, 15, "120,118,112", 0.25, 60);
    noise(ctx, S, rand, 90, 40000);
    // retakan
    ctx.strokeStyle = "rgba(15,15,15,0.55)";
    for (let i = 0; i < 6; i++) {
        ctx.lineWidth = 1 + rand() * 1.5;
        ctx.beginPath();
        let x = rand() * S, y = rand() * S;
        ctx.moveTo(x, y);
        for (let k = 0; k < 8; k++) {
            x += (rand() - 0.5) * 60; y += (rand() - 0.5) * 60;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
    return cv;
}

// Logam / tembaga: noise + bercak karat (dikali warna vertex)
function drawMetal() {
    const S = 256, rand = makeRandom(99);
    const [cv, ctx] = makeCanvas(S);
    ctx.fillStyle = "#d8d8d8";
    ctx.fillRect(0, 0, S, S);
    noise(ctx, S, rand, 80, 9000);
    blotches(ctx, S, rand, 10, "60,35,20", 0.35, 22);  // karat
    blotches(ctx, S, rand, 8, "20,20,20", 0.25, 20);   // kotor
    return cv;
}

function makeTexture(GL, canvas) {
    const tex = GL.createTexture();
    GL.bindTexture(GL.TEXTURE_2D, tex);
    GL.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA, GL.RGBA, GL.UNSIGNED_BYTE, canvas);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.REPEAT);   // ukuran 2^n -> boleh REPEAT
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.REPEAT);
    GL.generateMipmap(GL.TEXTURE_2D);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.LINEAR_MIPMAP_LINEAR);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.LINEAR);
    return tex;
}

// Geometri: vertex = posisi(3) + warna(3) + uv(2)  (format MyObjectTexture)
class Geo {
    constructor(texScale) {
        this.vertices = [];
        this.faces = [];
        this.texScale = texScale;   // berapa unit dunia untuk 1x texture
    }

    count() { return this.vertices.length / 8; }

    // grid rows x cols; fn(u, v) -> { p, n, uv }
    grid(rows, cols, color, fn, emissive = false) {
        const base = this.count();
        for (let i = 0; i <= rows; i++) {
            for (let j = 0; j <= cols; j++) {
                const { p, n, uv } = fn(i / rows, j / cols);
                const c = emissive ? color : bake(color, p[0], p[1], p[2], n[0], n[1], n[2]);
                this.vertices.push(p[0], p[1], p[2], c[0], c[1], c[2], uv[0], uv[1]);
            }
        }
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                const a = base + i * (cols + 1) + j, b = a + cols + 1;
                this.faces.push(a, b, a + 1, b, b + 1, a + 1);
            }
        }
        return this;
    }

    // bidang datar: titik o, sisi eu (arah u texture) & ev (arah v texture)
    quad(color, o, eu, ev, n, step = 0.8, emissive = false) {
        const lu = Math.hypot(...eu), lv = Math.hypot(...ev);
        const rows = Math.max(1, Math.ceil(lu / step)), cols = Math.max(1, Math.ceil(lv / step));
        const s = this.texScale;
        return this.grid(rows, cols, color, (u, v) => ({
            p: add(o, add(mul(eu, u), mul(ev, v))),
            n,
            uv: [(u * lu) / s, (v * lv) / s]
        }), emissive);
    }

    box(color, min, max, step = 1.5, emissive = false) {
        const [x0, y0, z0] = min, [x1, y1, z1] = max;
        const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
        this.quad(color, [x0, y1, z0], [dx, 0, 0], [0, 0, dz], [0, 1, 0], step, emissive);
        this.quad(color, [x0, y0, z0], [dx, 0, 0], [0, 0, dz], [0, -1, 0], step, emissive);
        this.quad(color, [x0, y0, z1], [dx, 0, 0], [0, dy, 0], [0, 0, 1], step, emissive);
        this.quad(color, [x0, y0, z0], [dx, 0, 0], [0, dy, 0], [0, 0, -1], step, emissive);
        this.quad(color, [x1, y0, z0], [0, dy, 0], [0, 0, dz], [1, 0, 0], step, emissive);
        this.quad(color, [x0, y0, z0], [0, dy, 0], [0, 0, dz], [-1, 0, 0], step, emissive);
        return this;
    }

    // tabung mengikuti kurva curve(t) -> [x,y,z]
    tube(color, curve, r, segs, ring = 14, emissive = false) {
        let prevN = null;
        const frames = [];
        for (let i = 0; i <= segs; i++) {
            const t = i / segs, e = 0.001;
            const T = norm(sub(curve(Math.min(1, t + e)), curve(Math.max(0, t - e))));
            // frame yang "diteruskan" supaya tabung tidak terpelintir
            let N = prevN ? norm(sub(prevN, mul(T, T[0] * prevN[0] + T[1] * prevN[1] + T[2] * prevN[2])))
                : norm(cross(T, Math.abs(T[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
            prevN = N;
            frames.push([curve(t), N, cross(T, N)]);
        }
        return this.grid(segs, ring, color, (u, v) => {
            const [P, N, B] = frames[Math.round(u * segs)];
            const a = v * Math.PI * 2;
            const n = add(mul(N, Math.cos(a)), mul(B, Math.sin(a)));
            return { p: add(P, mul(n, r)), n, uv: [u * 4, v] };
        }, emissive);
    }

    cylinder(color, A, B, r0, r1 = r0, ring = 14, caps = true, emissive = false) {
        const axis = norm(sub(B, A));
        const U = norm(cross(axis, Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
        const V = cross(axis, U);
        const ring3 = (v) => { const a = v * Math.PI * 2; return add(mul(U, Math.cos(a)), mul(V, Math.sin(a))); };

        // selimut
        this.grid(1, ring, color, (u, v) => {
            const d = ring3(v);
            return { p: add(lerp(A, B, u), mul(d, r0 + (r1 - r0) * u)), n: d, uv: [u, v] };
        }, emissive);

        // tutup
        if (caps) {
            [[A, r0, -1], [B, r1, 1]].forEach(([P0, rr, s]) => {
                this.grid(1, ring, color, (u, v) => ({
                    p: add(P0, mul(ring3(v), rr * u)), n: mul(axis, s), uv: [u, v]
                }), emissive);
            });
        }
        return this;
    }

    sphere(color, P, r, rings = 8, segs = 12, emissive = false) {
        return this.grid(rings, segs, color, (u, v) => {
            const ph = u * Math.PI, th = v * Math.PI * 2;
            const n = [Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)];
            return { p: add(P, mul(n, r)), n, uv: [v, u] };
        }, emissive);
    }

    // Pipa mengikuti titik-titik; tiap sudut dibulatkan (siku) dengan jari-jari bend
    pipePath(color, pts, r, bend = 0.45, collarColor = null) {
        const pieces = [];
        let start = pts[0];
        for (let i = 1; i < pts.length; i++) {
            const P = pts[i];
            if (i === pts.length - 1) { pieces.push(["line", start, P]); break; }
            const N = pts[i + 1];
            const din = norm(sub(P, pts[i - 1])), dout = norm(sub(N, P));
            const a = sub(P, mul(din, bend)), b = add(P, mul(dout, bend));
            pieces.push(["line", start, a]);
            pieces.push(["bend", a, P, b]);
            start = b;
        }
        pieces.forEach(pc => {
            if (pc[0] === "line") {
                const len = Math.hypot(...sub(pc[2], pc[1]));
                this.tube(color, t => lerp(pc[1], pc[2], t), r, Math.max(1, Math.ceil(len / 1.5)), 12);
            } else {
                const [, A, P, B] = pc;   // Bezier kuadrat: sudut sebagai titik kontrol
                this.tube(color, t => add(add(mul(A, (1 - t) * (1 - t)), mul(P, 2 * t * (1 - t))), mul(B, t * t)), r, 8, 12);
                if (collarColor) {
                    // cincin sambungan kecil di awal & akhir siku
                    [[A, sub(P, A)], [B, sub(B, P)]].forEach(([Q, d]) => {
                        const dn = norm(d);
                        this.cylinder(collarColor, sub(Q, mul(dn, 0.07)), add(Q, mul(dn, 0.07)), r * 1.3, r * 1.3, 12);
                    });
                }
            }
        });
        return this;
    }
}

// createEnvironment  (parameter sama seperti createHoardingBug)
export function createEnvironment(GL, SHADER_PROGRAM, _position, _color, _Mmatrix, _uv, _sampler) {

    const TEX = {
        brick: makeTexture(GL, drawBrick()),
        concrete: makeTexture(GL, drawConcrete()),
        metal: makeTexture(GL, drawMetal())
    };

    // satu Geo per texture (skala texture: bata 4 unit, beton 6 unit, logam 1 unit)
    const brick = new Geo(4.0);
    const concrete = new Geo(6.0);
    const metal = new Geo(3.0);

    const LEN = Z_NEAR - Z_END;

    //LANTAI & LANGIT-LANGIT
    concrete.quad(C.concrete, [-HALF_W, FLOOR_Y, Z_NEAR], [2 * HALF_W, 0, 0], [0, 0, -LEN], [0, 1, 0], 0.7);
    concrete.quad(C.ceiling, [-HALF_W, CEIL_Y, Z_NEAR], [2 * HALF_W, 0, 0], [0, 0, -LEN], [0, -1, 0], 0.8);

    //DINDING BATA (terbuka di perempatan)
    const H = CEIL_Y - FLOOR_Y;
    [-1, 1].forEach(sd => {
        const x = sd * HALF_W, n = [-sd, 0, 0];
        brick.quad(C.brick, [x, FLOOR_Y, Z_NEAR], [0, 0, CROSS_Z0 - Z_NEAR], [0, H, 0], n, 0.6);   // sebelum perempatan
        brick.quad(C.brick, [x, FLOOR_Y, CROSS_Z1], [0, 0, Z_END - CROSS_Z1], [0, H, 0], n, 0.6);  // setelah perempatan
    });
    // dinding ujung
    brick.quad(C.brick, [-HALF_W, FLOOR_Y, Z_END], [2 * HALF_W, 0, 0], [0, H, 0], [0, 0, 1], 0.6);

    //LORONG SAMPING KIRI & KANAN
    [-1, 1].forEach(sd => {
        const xi = sd * HALF_W, xo = sd * (HALF_W + SIDE_LEN), w = xo - xi, dz = CROSS_Z1 - CROSS_Z0;
        concrete.quad(C.concrete, [xi, FLOOR_Y, CROSS_Z0], [w, 0, 0], [0, 0, dz], [0, 1, 0], 0.7);
        concrete.quad(C.ceiling, [xi, CEIL_Y, CROSS_Z0], [w, 0, 0], [0, 0, dz], [0, -1, 0], 0.8);
        brick.quad(C.brick, [xi, FLOOR_Y, CROSS_Z0], [w, 0, 0], [0, H, 0], [0, 0, -1], 0.6);   // dinding sisi dekat
        brick.quad(C.brick, [xi, FLOOR_Y, CROSS_Z1], [w, 0, 0], [0, H, 0], [0, 0, 1], 0.6);    // dinding sisi jauh
        brick.quad(C.brick, [xo, FLOOR_Y, CROSS_Z0], [0, 0, dz], [0, H, 0], [-sd, 0, 0], 0.6); // ujung (gelap)

        // balok langit-langit lorong samping
        for (let k = 1.5; k < SIDE_LEN; k += 4) {
            const x = xi + sd * k;
            metal.box(C.steel, [x - 0.2, CEIL_Y - 0.4, CROSS_Z1], [x + 0.2, CEIL_Y - 0.28, CROSS_Z0]);
            metal.box(C.steel, [x - 0.04, CEIL_Y - 0.28, CROSS_Z1], [x + 0.04, CEIL_Y, CROSS_Z0]);
        }
    });

    //RANGKA BESI LANGIT-LANGIT
    // rel di pojok atas, terputus di perempatan
    [-1, 1].forEach(sd => {
        const x = sd * (HALF_W - 0.25);
        [[CROSS_Z0, Z_NEAR], [Z_END, CROSS_Z1]].forEach(([z0, z1]) => {
            metal.box(C.steel, [x - 0.25, CEIL_Y - 0.45, z0], [x + 0.25, CEIL_Y - 0.3, z1]);
            metal.box(C.steel, [x - 0.05, CEIL_Y - 0.3, z0], [x + 0.05, CEIL_Y, z1]);
        });
    });
    // balok melintang tiap 4 unit
    for (let z = Z_NEAR - 2; z > Z_END + 1; z -= 4) {
        metal.box(C.steel, [-HALF_W, CEIL_Y - 0.4, z - 0.2], [HALF_W, CEIL_Y - 0.28, z + 0.2]);
        metal.box(C.steel, [-HALF_W, CEIL_Y - 0.28, z - 0.04], [HALF_W, CEIL_Y, z + 0.04]);
    }

    //LAMPU LANGIT-LANGIT
    LAMPS.forEach(L => {
        const [x, , z] = L.p;
        metal.box(C.steel, [x - 0.9, CEIL_Y - 0.25, z - 0.35], [x + 0.9, CEIL_Y, z + 0.35]);
        metal.box(C.lamp, [x - 0.75, CEIL_Y - 0.3, z - 0.22], [x + 0.75, CEIL_Y - 0.25, z + 0.22], 2, true);
    });

    //PIPA TEMBAGA
    const Y_TOP = CEIL_Y - 0.75;

    // 1) pipa di pojok kanan atas, lalu belok masuk ke lorong samping kanan
    metal.pipePath(C.copper, [
        [HALF_W - 0.9, Y_TOP, Z_NEAR],
        [HALF_W - 0.9, Y_TOP, CROSS_Z0 - 0.8],
        [HALF_W + SIDE_LEN, Y_TOP, CROSS_Z0 - 0.8]
    ], PIPE.main, 0.6, C.brass);

    // pipa di lorong samping kiri: keluar dari ujung lorong kiri, menyeberangi
    // perempatan di bawah langit-langit, lalu masuk ke lorong samping kanan
    metal.pipePath(C.copper, [
        [-HALF_W - SIDE_LEN, Y_TOP - 0.3, CROSS_Z1 + 1.0],
        [HALF_W + SIDE_LEN, Y_TOP - 0.3, CROSS_Z1 + 1.0]
    ], PIPE.small);
    metal.pipePath(C.copper, [
        [-HALF_W - SIDE_LEN, FLOOR_Y + 3.4, CROSS_Z0 - 0.4],
        [-HALF_W - 1.2, FLOOR_Y + 3.4, CROSS_Z0 - 0.4],
        [-HALF_W - 1.2, FLOOR_Y, CROSS_Z0 - 0.4]
    ], PIPE.medium, 0.5, C.brass);

    // 2) pipa kanan kedua: turun ke lantai dengan belokan S + katup
    metal.pipePath(C.copper, [
        [HALF_W - 0.55, Y_TOP - 0.35, Z_NEAR],
        [HALF_W - 0.55, Y_TOP - 0.35, -10.0],
        [HALF_W - 0.55, FLOOR_Y + 3.6, -10.0],
        [HALF_W - 0.55, FLOOR_Y + 2.4, -11.6],
        [HALF_W - 0.55, FLOOR_Y, -11.6]
    ], PIPE.medium, 0.45, C.brass);
    {
        // katup roda pada pipa vertikal
        const x = HALF_W - 0.55, y = FLOOR_Y + 1.6, z = -11.6;
        metal.cylinder(C.brass, [x, y - 0.22, z], [x, y + 0.22, z], PIPE.medium * 1.4, PIPE.medium * 1.4, 12);
        metal.cylinder(C.steel, [x, y, z], [x - 0.45, y, z], 0.04, 0.04, 8);
        metal.tube(C.valve, t => {
            const a = t * Math.PI * 2;
            return [x - 0.45, y + Math.cos(a) * 0.28, z + Math.sin(a) * 0.28];
        }, 0.04, 24, 8);
        for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI * 2;
            metal.cylinder(C.valve, [x - 0.45, y, z], [x - 0.45, y + Math.cos(a) * 0.28, z + Math.sin(a) * 0.28], 0.025, 0.025, 6, false);
        }
    }

    // 3) pipa kiri atas, lalu turun di dinding kiri ke kotak sambungan di lantai
    metal.pipePath(C.copper, [
        [-HALF_W + 0.8, Y_TOP, Z_NEAR],
        [-HALF_W + 0.8, Y_TOP, -10.0],
        [-HALF_W + 0.5, FLOOR_Y + 1.2, -10.0],
        [-HALF_W + 0.5, FLOOR_Y + 0.5, -11.4],
        [-HALF_W + 0.5, FLOOR_Y + 0.5, -12.4]
    ], PIPE.big, 0.5, C.brass);
    metal.box(C.steel, [-HALF_W, FLOOR_Y, -13.3], [-HALF_W + 1.1, FLOOR_Y + 0.9, -12.4]);

    // 4) dua pipa di dinding ujung: turun dari langit-langit, menyerong, lalu ke lantai
    [[-1.0, PIPE.main], [-0.45, PIPE.small]].forEach(([dx, r], k) => {
        const z = Z_END + 0.3 + k * 0.4;
        metal.pipePath(C.copper, [
            [1.2 + dx, CEIL_Y, z],
            [1.2 + dx, FLOOR_Y + 5.0, z],
            [3.6 + dx, FLOOR_Y + 2.6, z],
            [3.6 + dx, FLOOR_Y, z]
        ], r, 0.5, C.brass);
    });
    // pipa ke-5: vertikal di dinding ujung kiri, belok masuk ke dinding kiri
    metal.pipePath(C.copper, [
        [-3.0, CEIL_Y, Z_END + 0.35],
        [-3.0, FLOOR_Y + 3.0, Z_END + 0.35],
        [-HALF_W, FLOOR_Y + 3.0, Z_END + 0.35]
    ], PIPE.medium, 0.5, C.brass);

    // batang penggantung untuk pipa yang menyeberangi perempatan
    for (let x = -HALF_W - SIDE_LEN + 1.5; x < HALF_W + SIDE_LEN; x += 3) {
        metal.cylinder(C.steel, [x, CEIL_Y, CROSS_Z1 + 1.0], [x, Y_TOP - 0.3 - PIPE.small, CROSS_Z1 + 1.0], 0.025, 0.025, 6);
        if (x > HALF_W) metal.cylinder(C.steel, [x, CEIL_Y, CROSS_Z0 - 0.8], [x, Y_TOP - PIPE.main, CROSS_Z0 - 0.8], 0.025, 0.025, 6);
    }

    // klem pipa ke dinding/langit-langit
    for (let z = Z_NEAR - 3; z > Z_END; z -= 5) {
        if (z > CROSS_Z0) metal.box(C.steel, [HALF_W - 1.05, Y_TOP + 0.1, z - 0.05], [HALF_W - 0.75, CEIL_Y, z + 0.05]);
        if (z > -10) metal.box(C.steel, [-HALF_W + 0.65, Y_TOP + 0.1, z - 0.05], [-HALF_W + 0.95, CEIL_Y, z + 0.05]);
    }

    //KE GPU (pakai MyObject dari MyObjectTexture.js)
    const groups = [[concrete, TEX.concrete], [brick, TEX.brick], [metal, TEX.metal]];
    const objects = [];

    groups.forEach(([geo, tex]) => {
        if (geo.count() > 65535) console.error("Environment: vertex terlalu banyak", geo.count());
        const OBJECT_VERTEX = GL.createBuffer();
        GL.bindBuffer(GL.ARRAY_BUFFER, OBJECT_VERTEX);
        GL.bufferData(GL.ARRAY_BUFFER, new Float32Array(geo.vertices), GL.STATIC_DRAW);
        const OBJECT_FACES = GL.createBuffer();
        GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, OBJECT_FACES);
        GL.bufferData(GL.ELEMENT_ARRAY_BUFFER, new Uint16Array(geo.faces), GL.STATIC_DRAW);

        const mesh = { OBJECT_VERTEX, OBJECT_FACES, count: geo.faces.length, texture: tex };
        objects.push(new MyObject(GL, SHADER_PROGRAM, _position, _color, _Mmatrix, mesh, _uv, _sampler));
    });

    // lantai jadi root, dinding & logam jadi child
    const root = objects[0];
    root.childs.push(objects[1], objects[2]);

    return { root };
}