/* =====================================================================
   ANIMASI SCENE KEJAR-KEJARAN DI PEREMPATAN

   Scene 1 : urutan kiri->kanan = Coil Head, Hoarding Bug, Nutcracker
             lari dari kanan ke kiri (Nutcracker mengejar)
   Scene 2 : urutan kiri->kanan = Nutcracker, Hoarding Bug, Coil Head
             lari dari kiri ke kanan (Nutcracker mengejar)
   Scene 3A: urutan kanan->kiri = Coil Head, Hoarding Bug, Nutcracker
             lari dari kanan ke kiri, mengerem & berhenti di tengah
             perempatan, Nutcracker menoleh ke belakang & kaget
             (baru sadar mangsanya ada di belakangnya)
   Scene 3B: semua berbalik badan, Hoarding Bug dan Coil Head mengecil
             1.5x (seperti tikus kecil) lalu kabur ke kanan,
             dikejar Nutcracker
   Setelah scene 3B, timeline diulang dari scene 1.

   Cara kerja:
   - POSITION_MATRIX root  -> posisi di lorong (diubah tiap frame)
   - MOVE_MATRIX tiap sendi -> rotasi gerakan (lari, kepak sayap, menoleh)
     (dirender sebagai MOVE * POSITION * PARENT, jadi rotasi terjadi
      di titik sendi / pivot bagian itu)

   Arah rotasi dengan LIBS (bagian yang menjulur ke -Y):
   - rotateX(+a) -> ujungnya bergerak ke belakang (-Z)
   - rotateX(-a) -> ujungnya bergerak ke depan   (+Z)
   ===================================================================== */

// arah hadap (rotasi Y root): model aslinya menghadap +Z (ke kamera)
const FACE_LEFT = -Math.PI / 2;
const FACE_RIGHT = Math.PI / 2;

// ---------------- PENGATURAN ----------------
const LANE_Z = -2.75;      // garis lari: tengah perempatan (CROSS_Z0 = 1, CROSS_Z1 = -6.5)
const SPEED = 6.0;         // kecepatan lari (unit per detik)
const SPACING = 4.5;       // jarak antar karakter yang berurutan
// Batas tersembunyi di dalam lorong samping.
// Dinding dekat lorong samping ada di z = 1 dan mulai dari |x| = 6.6.
// Garis pandang kamera (0, 0, 18) ke titik (x, z) memotong z = 1 di x * 17 / (18 - z).
// Bagian badan terjauh: z = LANE_Z - 2.15 (ujung sayap Hoarding Bug) = -4.9
//   -> tersembunyi bila |x| > 6.6 * 22.9 / 17 = 8.9
// Ditambah setengah tebal badan saat menghadap samping + ayunan kaki/lengan (± 2.3)
//   -> pusat karakter harus di |x| >= 11.2. Dipakai 11.5 supaya aman.
const HIDDEN_X = 11.5;
const PAUSE = 1.0;         // jeda lorong kosong di antara scene (detik)

// ketinggian root tiap karakter (telapak kaki di lantai y = -5.75)
const GROUND = { coil: -1.0, nut: -1.75 };
const BUG_FLY_Y = -1.7;    // Hoarding Bug terbang setinggi dada

// fase langkah per unit jarak (langkah terkunci ke jarak tempuh,
// jadi saat melambat langkahnya ikut melambat)
const STRIDE = { coil: 1.5, nut: 1.42 };

// Scene 3B: buruan mengecil 1.5x saat kabur
const SHRINK = 1 / 1.5;
// jarak root Coil Head (dada) ke telapak kaki; dipakai supaya kaki tetap
// menapak lantai saat mengecil (skala terjadi di sekitar root)
const COIL_ROOT_TO_FEET = 4.71;

/* ================= HELPER MATRIX ================= */

// isi MOVE_MATRIX: identitas lalu rotasi X, Y, Z, lalu translasi
function pose(obj, rx = 0, ry = 0, rz = 0, tx = 0, ty = 0, tz = 0) {
    const m = obj.MOVE_MATRIX;
    LIBS.set_I4(m);
    if (rx) LIBS.rotateX(m, rx);
    if (ry) LIBS.rotateY(m, ry);
    if (rz) LIBS.rotateZ(m, rz);
    LIBS.translateX(m, tx);
    LIBS.translateY(m, ty);
    LIBS.translateZ(m, tz);
}

// seperti pose(), tapi diawali skala seragam (dipakai root yang mengecil).
// skala dibuat di matriks identitas dulu, baru diputar, karena
// LIBS.scaleX/Y/Z hanya mengalikan elemen diagonal (salah bila sudah diputar)
function poseScaled(obj, scale, rx = 0, ry = 0, rz = 0, ty = 0) {
    const m = obj.MOVE_MATRIX;
    LIBS.set_I4(m);
    m[0] = m[5] = m[10] = scale;
    if (rx) LIBS.rotateX(m, rx);
    if (ry) LIBS.rotateY(m, ry);
    if (rz) LIBS.rotateZ(m, rz);
    LIBS.translateY(m, ty);
}

// ROTATE ARBITRARY AXIS untuk kepakan sayap Hoarding Bug.
// Engsel sayap: sumbu yang melewati pangkal sayap (0, 3, 0) lokal
// (ujung sayap ada di titik asal) dengan arah miring (1, 0, 0.6).
// Karena sumbunya miring, sayap tidak hanya naik-turun tetapi juga
// sedikit menyapu maju-mundur, seperti kepakan serangga.
// Rumusnya ada di LIBS.get_rotation_arbitrary (libs.js).
const WING_PIVOT = [0, 3.0, 0];
const WING_AXIS = [1, 0, 0.6];

function flapWing(wing, angle) {
    wing.MOVE_MATRIX = LIBS.get_rotation_arbitrary(WING_PIVOT, WING_AXIS, angle);
}

/* ================= HELPER GERAK ================= */

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const lerp = (a, b, u) => a + (b - a) * u;

// profil kecepatan: percepatan sejauh accelD, konstan, perlambatan sejauh decelD
// mengembalikan jarak tempuh s dan kecepatan relatif (0..1)
function travel(tau, dist, accelD = 0, decelD = 0) {
    const V = SPEED;
    const ta = (2 * accelD) / V, td = (2 * decelD) / V;
    const cruiseD = dist - accelD - decelD;
    const tc = cruiseD / V;

    if (tau <= 0) return { s: 0, v: accelD > 0 ? 0 : 1 };
    if (tau < ta) return { s: 0.5 * (V / ta) * tau * tau, v: tau / ta };
    tau -= ta;
    if (tau < tc) return { s: accelD + V * tau, v: 1 };
    tau -= tc;
    if (tau < td) {
        const a = V / td;
        return { s: accelD + cruiseD + V * tau - 0.5 * a * tau * tau, v: 1 - tau / td };
    }
    return { s: dist, v: 0 };
}
const travelTime = (dist, accelD = 0, decelD = 0) =>
    (2 * accelD) / SPEED + (dist - accelD - decelD) / SPEED + (2 * decelD) / SPEED;

const legPhase = (phase, side) => phase + (side > 0 ? 0 : Math.PI);
const kneeBend = (p, base, amp) => base + amp * Math.max(0, Math.sin(p + 0.6));

/* ================= GERAKAN TIAP KARAKTER =================
   st = { x, face, phase, run (0 = berdiri, 1 = lari penuh), headYaw, hop } */

function poseCoilHead(coil, st, t) {
    const k = st.run;
    coil.legs.forEach(({ side, thigh, shin }) => {
        const p = legPhase(st.phase, side);
        pose(thigh, 0.70 * k * Math.sin(p));
        pose(shin, k * kneeBend(p, 0.15, 1.2));
    });
    coil.arms.forEach(({ side, shoulder, fore }) => {
        const p = legPhase(st.phase, side) + Math.PI;
        pose(shoulder, 0.60 * k * Math.sin(p));
        pose(fore, -0.75 * k);
    });
    // pegas leher: goyang saat lari, bergoyang pelan saat diam
    pose(coil.spring,
        k * Math.sin(st.phase * 2) * 0.12 + (1 - k) * Math.sin(t * 2.2) * 0.04, 0,
        k * Math.sin(st.phase) * 0.07);

    const bob = k * Math.abs(Math.sin(st.phase)) * 0.25 + (st.hop || 0);
    const sc = st.scale || 1;
    // turunkan root supaya kaki tetap di lantai saat mengecil
    const y = GROUND.coil - COIL_ROOT_TO_FEET * (1 - sc);
    LIBS.set_position(coil.root.POSITION_MATRIX, st.x, y, LANE_Z);
    poseScaled(coil.root, sc, 0.15 * k, st.face, 0, bob * sc);
}

function poseHoardingBug(bug, st, t) {
    const k = st.run;
    const flap = t * 22.0;     // sayap selalu mengepak (terbang)
    const hover = t * 3.0;

    // sayap mengepak dengan rotasi terhadap sumbu sembarang (engsel sayap)
    bug.wings.forEach(({ wing }, i) => {
        flapWing(wing, Math.sin(flap + (i % 2) * 0.5) * 0.55);
    });
    bug.legs.forEach(({ side, hip, knee }) => {
        const p = legPhase(hover * 1.3, side);
        pose(hip, 0.15 + 0.20 * k + 0.20 * Math.sin(p));   // makin terseret ke belakang saat melaju
        pose(knee, 0.30 + Math.sin(p) * 0.15);
    });
    bug.arms.forEach(({ side, shoulder }) => {
        pose(shoulder, -0.3 + Math.sin(hover * 1.3 + side) * 0.15);
    });
    pose(bug.head, Math.sin(hover * 2) * 0.06);
    pose(bug.body, 0, 0, Math.sin(hover) * 0.06);

    const bob = Math.sin(hover) * 0.4 + (st.hop || 0);
    const sc = st.scale || 1;
    LIBS.set_position(bug.root.POSITION_MATRIX, st.x, BUG_FLY_Y, LANE_Z);
    poseScaled(bug.root, sc, 0.08 + 0.22 * k, st.face, 0, bob);   // condong ke depan saat melaju
}

function poseNutCracker(nut, st) {
    const k = st.run;
    nut.legs.forEach(({ side, hip, knee }) => {
        const p = legPhase(st.phase, side);
        pose(hip, 0.60 * k * Math.sin(p));
        pose(knee, k * kneeBend(p, 0.10, 1.0));
    });
    // kepala: terguncang saat lari, atau menoleh ke belakang (headYaw)
    pose(nut.head, k * Math.sin(st.phase * 2) * 0.05, st.headYaw || 0, k * Math.sin(st.phase) * 0.04);

    const bob = k * Math.abs(Math.sin(st.phase)) * 0.22 + (st.hop || 0);
    LIBS.set_position(nut.root.POSITION_MATRIX, st.x, GROUND.nut, LANE_Z);
    pose(nut.root, 0.12 * k, st.face, k * Math.sin(st.phase) * 0.03, 0, bob, 0);
}

/* ================= SCENE =================
   Tiap scene menghasilkan state untuk { coil, bug, nut } pada waktu tau. */

// rombongan lari melintas penuh (masuk dari satu sisi, keluar di sisi lain)
// order = urutan nama dari KIRI ke KANAN, dir = -1 (ke kiri) / +1 (ke kanan)
function crossScene(order, dir) {
    const span = SPACING * (order.length - 1);
    const startLeft = dir < 0 ? HIDDEN_X : -HIDDEN_X - span;   // x karakter paling kiri
    const dist = 2 * HIDDEN_X + span;
    const runTime = travelTime(dist);

    return {
        duration: runTime + PAUSE,
        state(tau) {
            const { s } = travel(tau, dist);
            const left = startLeft + dir * s;
            const out = {};
            order.forEach((name, i) => {
                out[name] = {
                    x: left + i * SPACING,
                    face: dir < 0 ? FACE_LEFT : FACE_RIGHT,
                    phase: s * (STRIDE[name] || 1.5),
                    run: tau < runTime ? 1 : 0
                };
            });
            return out;
        }
    };
}

// Scene 3A: Nut, Bug, Coil (kiri->kanan) lari ke kiri, berhenti di tengah perempatan,
// Nutcracker menoleh ke belakang lalu kaget (lompat kecil)
function scene3A() {
    const order = ["nut", "bug", "coil"];
    const span = SPACING * 2;
    const startLeft = HIDDEN_X;
    const stopLeft = -span / 2;                 // rombongan berhenti tepat di tengah
    const dist = startLeft - stopLeft;
    const DECEL = 3.0;                          // mengerem dalam 3 unit terakhir
    const runTime = travelTime(dist, 0, DECEL);
    const HOLD = 2.6;                           // durasi diam setelah berhenti

    return {
        duration: runTime + HOLD,
        state(tau) {
            const { s, v } = travel(tau, dist, 0, DECEL);
            const left = startLeft - s;
            const h = tau - runTime;            // waktu sejak berhenti

            // Nutcracker menoleh ke belakang (0.3 - 0.8 s), lalu kaget (lompat di 1.0 s)
            const look = smooth((h - 0.3) / 0.5);
            const jump = h > 1.0 && h < 1.35 ? Math.sin(((h - 1.0) / 0.35) * Math.PI) * 0.6 : 0;
            // buruan ikut tersentak sedikit saat Nutcracker kaget
            const flinch = h > 1.1 && h < 1.4 ? Math.sin(((h - 1.1) / 0.3) * Math.PI) * 0.3 : 0;

            const out = {};
            order.forEach((name, i) => {
                out[name] = {
                    x: left + i * SPACING,
                    face: FACE_LEFT,
                    phase: s * (STRIDE[name] || 1.5),
                    run: v,
                    hop: name === "nut" ? jump : flinch
                };
            });
            out.nut.headYaw = look * Math.PI * 0.75;    // menoleh ke belakang lewat sisi kamera
            return out;
        }
    };
}

// Scene 3B: semua berbalik badan, lalu Nutcracker mengejar Bug & Coil ke kanan
function scene3B() {
    const order = ["nut", "bug", "coil"];
    const span = SPACING * 2;
    const startLeft = -span / 2;
    const dist = HIDDEN_X - startLeft;           // sampai Nutcracker (paling kiri) tersembunyi
    const ACCEL = 1.5;
    const TURN = 0.6;
    // buruan berbalik duluan (panik), Nutcracker menyusul berbalik
    const turnStart = { coil: 0.0, bug: 0.1, nut: 0.45 };
    const runStart = { coil: 0.6, bug: 0.7, nut: 1.1 };
    const runTime = travelTime(dist, ACCEL);
    const lastStart = Math.max(...Object.values(runStart));

    return {
        duration: lastStart + runTime + PAUSE,
        state(tau) {
            const out = {};
            order.forEach((name, i) => {
                const u = smooth((tau - turnStart[name]) / TURN);
                const { s, v } = travel(tau - runStart[name], dist, ACCEL);
                // buruan mengecil 1.5x bersamaan dengan berbalik badan
                const scale = name === "nut" ? 1 : lerp(1, SHRINK, u);
                out[name] = {
                    x: startLeft + i * SPACING + s,
                    // berputar lewat menghadap kamera (0)
                    face: lerp(FACE_LEFT, FACE_RIGHT, u),
                    // badan kecil -> langkah lebih rapat (lari kecil seperti tikus)
                    phase: (s * (STRIDE[name] || 1.5)) / scale,
                    run: tau < runStart[name] ? 0 : v,
                    scale
                };
            });
            // kepala Nutcracker kembali menghadap depan saat berbalik
            out.nut.headYaw = Math.PI * 0.75 * (1 - smooth((tau - 0.3) / 0.4));
            return out;
        }
    };
}

const SCENES = [
    { name: "Scene 1", ...crossScene(["coil", "bug", "nut"], -1) },
    { name: "Scene 2", ...crossScene(["nut", "bug", "coil"], +1) },
    { name: "Scene 3A", ...scene3A() },
    { name: "Scene 3B", ...scene3B() }
];
const TOTAL = SCENES.reduce((sum, sc) => sum + sc.duration, 0);

/* ================= DIPANGGIL DARI main.js ================= */
// t = waktu dalam detik; mengembalikan nama scene yang sedang berjalan
export function animateScenes(coil, bug, nut, t) {
    let tau = t % TOTAL;
    let scene = SCENES[0];
    for (const sc of SCENES) {
        if (tau < sc.duration) { scene = sc; break; }
        tau -= sc.duration;
    }

    const st = scene.state(tau);
    poseCoilHead(coil, st.coil, t);
    poseHoardingBug(bug, st.bug, t);
    poseNutCracker(nut, st.nut);
    return scene.name;
}