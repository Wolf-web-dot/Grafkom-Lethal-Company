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

    // pasang objek ke parent + posisi awal (hanya translate)
    function add(obj, parent, x, y, z) {
        LIBS.translateX(obj.POSITION_MATRIX, x);
        LIBS.translateY(obj.POSITION_MATRIX, y);
        LIBS.translateZ(obj.POSITION_MATRIX, z);
        if (parent) parent.childs.push(obj);
        ALL.push(obj);
        return obj;
    }

    const C = {
        pale:   [0.72, 0.65, 0.53],
        light:  [0.83, 0.76, 0.64],
        shadow: [0.10, 0.08, 0.07],
        red:    [0.42, 0.035, 0.025],
        stain:  [0.27, 0.12, 0.08],
        joint:  [0.48, 0.39, 0.30]
    };

    /*========================= KARAKTER: COIL-HEAD =========================
       Proporsi humanoid ramping mengikuti referensi; bagian dibangun dari
       ellipsoid, cylinder, paraboloid, dan tube untuk pegas. */
    const torso = add(mk().cylinder(C.pale, 0.43, 1.35), null, 0, 0.15, 0);
    add(mk().ellipsoid(C.light, 0.48, 0.77, 0.34), torso, 0, -0.18, 0.02);
    add(mk().ellipsoid(C.pale, 0.36, 0.38, 0.30), torso, 0, -1.22, 0.02);

    // Kepala kecil seperti manekin, dengan bidang muka gelap dan guratan darah.
    const head = add(mk().ellipsoid(C.light, 0.30, 0.46, 0.29), torso, 0, 2.66, 0);
    add(mk().cylinder(C.shadow, 0.21, 0.075, "z"), head, 0, -0.31, 0.29);
    [-0.105, 0.105].forEach(x => add(mk().ellipsoid(C.shadow, 0.065, 0.095, 0.045), head, x, -0.30, 0.37));
    add(mk().ellipsoid(C.stain, 0.055, 0.22, 0.025), head, 0.20, -0.26, 0.23);
    add(mk().ellipsoid(C.shadow, 0.13, 0.035, 0.03), head, 0, -0.53, 0.22);

    // Pegas merah panjang dan ramping di antara kepala dan badan.
    const springCurve = (t) => {
        const a = t * Math.PI * 2 * 9;
        return [0.17 * Math.cos(a), -1.80 * t, 0.17 * Math.sin(a)];
    };
    const spring = add(mk().tube(C.red, springCurve, 0.045, 216, 8, [0, 1, 0]), torso, 0, 1.95, 0);
    add(mk().cylinder(C.joint, 0.23, 0.11), torso, 0, 0.13, 0);

    // Bercak kotor dan darah pada dada/pinggang.
    add(mk().ellipsoid(C.stain, 0.12, 0.20, 0.025), torso, 0.27, -0.62, 0.31);
    add(mk().ellipsoid(C.red, 0.055, 0.12, 0.025), torso, -0.24, -1.08, 0.28);
    add(mk().ellipsoid(C.stain, 0.07, 0.10, 0.025), torso, 0.13, -1.38, 0.30);

    // Paku pendek menonjol dari punggung, dibuat dari cylinder.
    [-0.30, -0.78, -1.22].forEach(y => add(mk().cylinder(C.joint, 0.055, 0.28, "z"), torso, 0, y, -0.30));

    // Lengan panjang dan kurus; tangan meruncing dengan elliptic paraboloid.
    const arms = [];
    [-1, 1].forEach(side => {
        const upper = add(mk().ellipsoid(C.pale, 0.16, 0.67, 0.17), torso, side * 0.53, -0.20, 0);
        add(mk().ellipsoid(C.joint, 0.13, 0.13, 0.13), upper, 0, -1.15, 0);
        const fore = add(mk().ellipsoid(C.light, 0.13, 0.62, 0.14), upper, side * 0.025, -1.18, 0);
        add(mk().paraboloid(C.pale, 0.14, 0.13, 0.38), fore, 0, -1.12, 0.02);
        arms.push({ upper, fore });
    });

    // Kaki panjang dengan lutut dan telapak sederhana.
    const legs = [];
    [-1, 1].forEach((side, i) => {
        const leg = add(mk().cylinder(C.pale, 0.17, 1.18), torso, side * 0.23, -1.48, i === 0 ? 0 : 0.03);
        add(mk().ellipsoid(C.joint, 0.14, 0.14, 0.14), leg, 0, -1.12, 0);
        add(mk().ellipsoid(C.light, 0.145, 0.62, 0.15), leg, side * 0.06, -1.16, 0);
        add(mk().ellipsoid(C.pale, 0.22, 0.12, 0.30), leg, side * 0.10, -2.28, 0.18);
        legs.push(leg);
    });
    /*========================= KAMERA ========================= */
    var PROJMATRIX = LIBS.get_projection(40, CANVAS.width / CANVAS.height, 1, 100);
    var VIEWMATRIX = LIBS.get_I4();
    LIBS.translateY(VIEWMATRIX, 0.4);   // naikkan pandangan sedikit agar karakter pas di tengah
    LIBS.translateZ(VIEWMATRIX, -14);

    /*========================= DRAWING ========================= */
    GL.enable(GL.DEPTH_TEST);
    GL.depthFunc(GL.LEQUAL);
    GL.clearColor(0.0, 0.0, 0.0, 1.0);
    GL.clearDepth(1.0);

    torso.setup();

    var animate = function (time) {
        GL.viewport(0, 0, CANVAS.width, CANVAS.height);
        GL.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);

        var t = time * 0.004;
        var s = Math.sin(t);

        // Pose kaku: torso bergetar, pegas leher berdenyut.
        ALL.forEach(o => o.MOVE_MATRIX = LIBS.get_I4());
        LIBS.translateY(torso.MOVE_MATRIX, Math.abs(s) * 0.025);
        LIBS.rotateZ(torso.MOVE_MATRIX, Math.sin(t * 2.2) * 0.012);
        LIBS.rotateX(head.MOVE_MATRIX, Math.sin(t * 1.7) * 0.02);
        LIBS.rotateZ(head.MOVE_MATRIX, Math.sin(t * 1.2) * 0.025);
        LIBS.rotateX(spring.MOVE_MATRIX, Math.sin(t * 3.5) * 0.04);
        arms.forEach((arm, i) => {
            LIBS.rotateZ(arm.upper.MOVE_MATRIX, (i === 0 ? -1 : 1) * (0.04 + Math.sin(t * 1.3 + i) * 0.025));
            LIBS.rotateX(arm.fore.MOVE_MATRIX, Math.sin(t * 1.5 + i) * 0.035);
        });
        legs.forEach((leg, i) => LIBS.rotateX(leg.MOVE_MATRIX, Math.sin(t * 1.6 + i * Math.PI) * 0.025));
        // Karakter menghadap kamera dan bergerak kaku seperti mannequin.
        var SPIN = LIBS.get_I4();

        GL.uniformMatrix4fv(_Pmatrix, false, PROJMATRIX);
        GL.uniformMatrix4fv(_Vmatrix, false, VIEWMATRIX);

        torso.render(SPIN);

        var err = GL.getError();
        if (err !== GL.NO_ERROR) console.log("GL error:", err);

        GL.flush();
        window.requestAnimationFrame(animate);
    };
    animate(0);
}
window.addEventListener('load', main);
