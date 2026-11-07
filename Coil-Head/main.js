import { MyObject } from "./MyObject.js";

function main() {
    /** @type {HTMLCanvasElement} */
    var CANVAS = document.getElementById("mycanvas");
    CANVAS.width = window.innerWidth;
    CANVAS.height = window.innerHeight;

    /*===================== GET WEBGL CONTEXT ===================== */
    /** @type {WebGLRenderingContext} */
    var GL = CANVAS.getContext("webgl", { antialias: true });
    if (!GL) {
        alert("WebGL context cannot be initialized");
        return false;
    }

    /*========================= SHADERS ========================= */
    var shader_vertex_source = `
        attribute vec3 position;
        attribute vec3 color;

        uniform mat4 Pmatrix, Vmatrix, Mmatrix;

        varying vec3 vColor;

        void main(void) {
            gl_Position = Pmatrix * Vmatrix * Mmatrix * vec4(position, 1.0);
            vColor = color;
        }`;

    var shader_fragment_source = `
        precision mediump float;
        varying vec3 vColor;

        void main(void) {
            gl_FragColor = vec4(vColor, 1.);
        }`;

    var compile_shader = function (source, type, typeString) {
        var shader = GL.createShader(type);
        GL.shaderSource(shader, source);
        GL.compileShader(shader);
        if (!GL.getShaderParameter(shader, GL.COMPILE_STATUS)) {
            alert("ERROR IN " + typeString + " SHADER: " + GL.getShaderInfoLog(shader));
            return false;
        }
        return shader;
    };
    var shader_vertex = compile_shader(shader_vertex_source, GL.VERTEX_SHADER, "VERTEX");
    var shader_fragment = compile_shader(shader_fragment_source, GL.FRAGMENT_SHADER, "FRAGMENT");

    var SHADER_PROGRAM = GL.createProgram();
    GL.attachShader(SHADER_PROGRAM, shader_vertex);
    GL.attachShader(SHADER_PROGRAM, shader_fragment);
    GL.linkProgram(SHADER_PROGRAM);
    if (!GL.getProgramParameter(SHADER_PROGRAM, GL.LINK_STATUS)) {
        alert("LINK ERROR: " + GL.getProgramInfoLog(SHADER_PROGRAM));
        return false;
    }
    GL.useProgram(SHADER_PROGRAM);

    var _position = GL.getAttribLocation(SHADER_PROGRAM, "position");
    GL.enableVertexAttribArray(_position);

    var _color = GL.getAttribLocation(SHADER_PROGRAM, "color");
    GL.enableVertexAttribArray(_color);

    var _Pmatrix = GL.getUniformLocation(SHADER_PROGRAM, "Pmatrix");
    var _Vmatrix = GL.getUniformLocation(SHADER_PROGRAM, "Vmatrix");
    var _Mmatrix = GL.getUniformLocation(SHADER_PROGRAM, "Mmatrix");

    /*========================= HELPER ========================= */
    const ALL = [];
    const mk = () => new MyObject(GL, SHADER_PROGRAM, _position, _color, _Mmatrix);

    // pasang objek ke parent + posisi awal.
    // opsi: rot = [rx, ry, rz] (radian), scl = [sx, sy, sz]
    // urutan: scale -> rotate -> translate (semua di POSITION_MATRIX)
    function add(obj, parent, x, y, z, opt = {}) {
        const m = obj.POSITION_MATRIX;
        if (opt.scl) {
            LIBS.scaleX(m, opt.scl[0]);
            LIBS.scaleY(m, opt.scl[1]);
            LIBS.scaleZ(m, opt.scl[2]);
        }
        if (opt.rot) {
            LIBS.rotateX(m, opt.rot[0]);
            LIBS.rotateY(m, opt.rot[1]);
            LIBS.rotateZ(m, opt.rot[2]);
        }
        LIBS.translateX(m, x);
        LIBS.translateY(m, y);
        LIBS.translateZ(m, z);
        if (parent) parent.childs.push(obj);
        ALL.push(obj);
        return obj;
    }

    const C = {
        skin:      [0.88, 0.81, 0.71],
        skinDark:  [0.76, 0.68, 0.58],
        shadow:    [0.10, 0.08, 0.07],
        metal:     [0.70, 0.71, 0.73],
        metalDark: [0.38, 0.38, 0.40],
        blood:     [0.40, 0.09, 0.06],
        stain:     [0.52, 0.33, 0.24]
    };

    // PAKU: dua cylinder (batang tipis + kepala lebar).
    // Pivot diletakkan sedikit di luar permukaan; batang masuk ke badan.
    // axis = "x" | "z", sign = +1 (menghadap +axis) / -1 (menghadap -axis)
    function screw(parent, x, y, z, axis, sign = 1) {
        const s = mk()
            .cylinder(C.metalDark, 0.022, sign * 0.20, axis, 10)   // batang
            .cylinder(C.metal, 0.050, sign * 0.035, axis, 14);     // kepala
        return add(s, parent, x, y, z);
    }

    // Bercak darah/kotor: ellipsoid pipih ditempel di permukaan
    function stain(parent, col, x, y, z, rx, ry, rz) {
        return add(mk().ellipsoid(col, rx, ry, rz, 8, 12), parent, x, y, z);
    }

    /*========================= KARAKTER: COIL-HEAD =========================
       Mannequin pucat dengan kepala di atas pegas logam.
       Pivot setiap primitif ada di ujung atas, memanjang ke bawah (-y).
       Wajah menghadap +z (ke kamera). */

    /* ---------- BADAN: ellipsoid (dada, panggul) + cylinder (pinggang, kerah) ---------- */
    const chest = add(mk().ellipsoid(C.skin, 0.62, 0.55, 0.32), null, 0, 1.45, 0);
    add(mk().cylinder(C.skin, 0.45, 1.15), chest, 0, -0.45, 0, { scl: [1, 1, 0.66] });   // pinggang
    const pelvis = add(mk().ellipsoid(C.skin, 0.49, 0.38, 0.30), chest, 0, -1.40, 0);
    add(mk().cylinder(C.skinDark, 0.13, 0.12), chest, 0, 0.07, 0);                          // pangkal leher

    /* ---------- LEHER: pegas dari kurva heliks ---------- */
    const SPRING_LEN = 0.95, SPRING_R = 0.15, TURNS = 10;
    const springCurve = (t) => {
        const a = t * Math.PI * 2 * TURNS;
        return [SPRING_R * Math.cos(a), SPRING_LEN * t, SPRING_R * Math.sin(a)];
    };
    const spring = add(mk().tube(C.metal, springCurve, 0.03, 260, 8, [0, 1, 0]), chest, 0, 0.0, 0);

    /* ---------- KEPALA: ellipsoid + cylinder ---------- */
    const head = add(mk().ellipsoid(C.skin, 0.27, 0.36, 0.28), spring, 0, SPRING_LEN + 0.74, 0);
    add(mk().cylinder(C.metalDark, 0.13, 0.12), head, 0, -0.66, 0);                         // dudukan pegas
    // mata (ellipsoid gelap, cekung)
    [-0.10, 0.10].forEach(x =>
        add(mk().ellipsoid(C.shadow, 0.075, 0.055, 0.03), head, x, -0.26, 0.24));
    // hidung kecil
    add(mk().ellipsoid(C.skinDark, 0.035, 0.07, 0.04), head, 0, -0.34, 0.26);
    // mulut terbuka (cylinder sumbu z, dipipihkan)
    add(mk().cylinder(C.shadow, 0.065, 0.06, "z"), head, 0, -0.53, 0.265, { scl: [1, 1.25, 1] });
    stain(head, C.blood, 0.16, -0.12, 0.215, 0.05, 0.09, 0.03);
    stain(head, C.stain, -0.13, -0.55, 0.205, 0.05, 0.05, 0.03);

    /* ---------- TANGAN: ellipsoid (lengan atas, bawah) + elliptic paraboloid (telapak) ---------- */
    function makeArm(side) {                 // side: +1 kanan layar (x+), -1 kiri
        const shoulder = add(mk().ellipsoid(C.skin, 0.16, 0.15, 0.16), chest, side * 0.52, -0.08, 0);
        const upper = add(mk().ellipsoid(C.skin, 0.12, 0.50, 0.12), shoulder, 0, -0.10, 0,
            { rot: [0, 0, side * 0.12] });
        const fore = add(mk().ellipsoid(C.skinDark, 0.095, 0.46, 0.10), upper, 0, -0.93, 0,
            { rot: [-0.10, 0, side * 0.03] });
        add(mk().paraboloid(C.skin, 0.085, 0.06, 0.32), fore, 0, -0.86, 0);

        screw(shoulder, side * 0.20, -0.12, 0, "x", side);          // bahu
        screw(upper, side * 0.17, -0.85, 0, "x", side);             // siku
        screw(fore, 0, -0.45, 0.16, "z", 1);                        // lengan bawah depan
        stain(upper, C.blood, 0.0, -0.35, 0.095, 0.04, 0.10, 0.03);
        return shoulder;
    }
    const armR = makeArm(1);
    const armL = makeArm(-1);

    /* ---------- KAKI: ellipsoid (paha, lutut, telapak) + cylinder (betis, pergelangan) ---------- */
    function makeLeg(side, stepZ) {
        const thigh = add(mk().ellipsoid(C.skin, 0.21, 0.76, 0.21), pelvis, side * 0.24, -0.42, 0,
            { rot: [stepZ, 0, side * 0.05] });
        add(mk().ellipsoid(C.skinDark, 0.15, 0.16, 0.15), thigh, 0, -1.36, 0.01);  // lutut
        const shin = add(mk().cylinder(C.skin, 0.13, 1.28), thigh, 0, -1.45, 0,
            { rot: [-stepZ * 0.6, 0, 0] });
        add(mk().cylinder(C.skinDark, 0.085, 0.08), shin, 0, -1.26, 0);            // pergelangan
        add(mk().ellipsoid(C.skin, 0.12, 0.07, 0.27), shin, 0, -1.30, 0.10);       // telapak

        screw(thigh, side * 0.26, -0.55, 0, "x", side);             // paha luar
        screw(thigh, 0, -1.42, 0.20, "z", 1);                       // lutut depan
        screw(shin, side * 0.17, -0.75, 0, "x", side);              // betis
        stain(thigh, C.blood, -side * 0.05, -0.45, 0.175, 0.06, 0.12, 0.03);
        stain(shin, C.stain, 0.02, -0.55, 0.115, 0.05, 0.14, 0.03);
        return thigh;
    }
    const legR = makeLeg(1, 0.0);
    const legL = makeLeg(-1, -0.10);

    /* ---------- PAKU & BERCAK di badan ---------- */
    screw(chest, 0.24, -0.62, 0.36, "z", 1);
    screw(chest, -0.30, -0.40, 0.33, "z", 1);
    screw(chest, 0.0, -0.95, 0.31, "z", 1);
    screw(pelvis, 0.56, -0.36, 0, "x", 1);
    screw(pelvis, -0.56, -0.36, 0, "x", -1);
    screw(pelvis, 0.18, -0.30, 0.34, "z", 1);
    stain(chest, C.blood, -0.15, -0.30, 0.29, 0.09, 0.12, 0.03);
    stain(chest, C.stain, 0.30, -0.25, 0.25, 0.07, 0.09, 0.03);
    stain(chest, C.blood, 0.10, -1.05, 0.27, 0.06, 0.10, 0.03);
    stain(pelvis, C.stain, -0.20, -0.25, 0.27, 0.07, 0.08, 0.03);

    /*========================= KAMERA & INPUT ========================= */
    var PROJMATRIX = LIBS.get_projection(40, CANVAS.width / CANVAS.height, 1, 100);
    var VIEWMATRIX = LIBS.get_I4();
    LIBS.translateY(VIEWMATRIX, -0.1);
    LIBS.translateZ(VIEWMATRIX, -8.5);

    // drag mouse untuk memutar karakter
    var THETA = 0, PHI = 0, drag = false, oldX = 0, oldY = 0;
    CANVAS.addEventListener("mousedown", e => { drag = true; oldX = e.pageX; oldY = e.pageY; });
    window.addEventListener("mouseup", () => drag = false);
    window.addEventListener("mousemove", e => {
        if (!drag) return;
        THETA += (e.pageX - oldX) * 2 * Math.PI / CANVAS.width;
        PHI += (e.pageY - oldY) * 2 * Math.PI / CANVAS.height;
        PHI = Math.max(-0.8, Math.min(0.8, PHI));
        oldX = e.pageX; oldY = e.pageY;
    });

    /*========================= DRAWING ========================= */
    GL.enable(GL.DEPTH_TEST);
    GL.depthFunc(GL.LEQUAL);
    GL.clearColor(0.0, 0.0, 0.0, 1.0);
    GL.clearDepth(1.0);

    chest.setup();

    var animate = function (time) {
        GL.viewport(0, 0, CANVAS.width, CANVAS.height);
        GL.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);

        var t = time * 0.004;
        var s = Math.sin(t);

        // Pose kaku: badan bergetar, pegas leher bergoyang, kepala mengangguk.
        ALL.forEach(o => o.MOVE_MATRIX = LIBS.get_I4());
        LIBS.translateY(chest.MOVE_MATRIX, Math.abs(s) * 0.025);
        LIBS.rotateZ(chest.MOVE_MATRIX, Math.sin(t * 2.2) * 0.012);
        LIBS.rotateX(spring.MOVE_MATRIX, Math.sin(t * 3.5) * 0.06);
        LIBS.rotateZ(spring.MOVE_MATRIX, Math.sin(t * 2.7) * 0.05);
        LIBS.rotateX(head.MOVE_MATRIX, Math.sin(t * 1.7) * 0.04);
        LIBS.rotateZ(head.MOVE_MATRIX, Math.sin(t * 1.2) * 0.05);
        LIBS.rotateX(armR.MOVE_MATRIX, Math.sin(t * 0.9) * 0.05);
        LIBS.rotateX(armL.MOVE_MATRIX, -Math.sin(t * 0.9) * 0.05);

        // Rotasi seluruh karakter dari input mouse
        var SPIN = LIBS.get_I4();
        LIBS.rotateY(SPIN, THETA);
        LIBS.rotateX(SPIN, PHI);

        GL.uniformMatrix4fv(_Pmatrix, false, PROJMATRIX);
        GL.uniformMatrix4fv(_Vmatrix, false, VIEWMATRIX);

        chest.render(SPIN);

        var err = GL.getError();
        if (err !== GL.NO_ERROR) console.log("GL error:", err);

        GL.flush();
        window.requestAnimationFrame(animate);
    };
    animate(0);
}
window.addEventListener('load', main);
