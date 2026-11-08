import { MyObject } from "./MyObjectCoil.js";

export function createCoilHead(
    GL,
    SHADER_PROGRAM,
    _position,
    _color,
    _Mmatrix
) {

    const ALL = [];

    const mk = () => new MyObject(
        GL,
        SHADER_PROGRAM,
        _position,
        _color,
        _Mmatrix
    );

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

    function screw(parent, x, y, z, axis, sign = 1) {
        const s = mk()
            .cylinder(C.metalDark, 0.022, sign * 0.20, axis, 10)
            .cylinder(C.metal, 0.050, sign * 0.035, axis, 14);

        return add(s, parent, x, y, z);
    }

    function stain(parent, col, x, y, z, rx, ry, rz) {
        return add(
            mk().ellipsoid(col, rx, ry, rz, 8, 12),
            parent, x, y, z
        );
    }

    // ================= BADAN =================

    const chest = add(
        mk().ellipsoid(C.skin, 0.62, 0.55, 0.32),
        null, 0, 1.45, 0
    );

    add(
        mk().cylinder(C.skin, 0.45, 1.15),
        chest, 0, -0.45, 0,
        { scl: [1, 1, 0.66] }
    );

    const pelvis = add(
        mk().ellipsoid(C.skin, 0.49, 0.38, 0.30),
        chest, 0, -1.40, 0
    );

    add(
        mk().cylinder(C.skinDark, 0.13, 0.12),
        chest, 0, 0.07, 0
    );

    // ================= PEGAS LEHER =================

    const SPRING_LEN = 0.95;
    const SPRING_R = 0.15;
    const TURNS = 10;

    const springCurve = (t) => {
        const a = t * Math.PI * 2 * TURNS;

        return [
            SPRING_R * Math.cos(a),
            SPRING_LEN * t,
            SPRING_R * Math.sin(a)
        ];
    };

    const spring = add(
        mk().tube(
            C.metal,
            springCurve,
            0.03,
            260,
            8,
            [0, 1, 0]
        ),
        chest, 0, 0, 0
    );

    // ================= KEPALA =================

    const head = add(
        mk().ellipsoid(C.skin, 0.27, 0.36, 0.28),
        spring, 0, SPRING_LEN + 0.74, 0
    );

    add(
        mk().cylinder(C.metalDark, 0.13, 0.12),
        head, 0, -0.66, 0
    );

    [-0.10, 0.10].forEach(x =>
        add(
            mk().ellipsoid(C.shadow, 0.075, 0.055, 0.03),
            head, x, -0.26, 0.24
        )
    );

    add(
        mk().ellipsoid(C.skinDark, 0.035, 0.07, 0.04),
        head, 0, -0.34, 0.26
    );

    add(
        mk().cylinder(C.shadow, 0.065, 0.06, "z"),
        head, 0, -0.53, 0.265,
        { scl: [1, 1.25, 1] }
    );

    stain(head, C.blood, 0.16, -0.12, 0.215, 0.05, 0.09, 0.03);
    stain(head, C.stain, -0.13, -0.55, 0.205, 0.05, 0.05, 0.03);

    // ================= TANGAN =================

    // sendi yang dipakai animasi (RunAnimation.js)
    const ARMS = [];
    const LEGS = [];

    function makeArm(side) {
        const shoulder = add(
            mk().ellipsoid(C.skin, 0.16, 0.15, 0.16),
            chest, side * 0.52, -0.08, 0
        );

        const upper = add(
            mk().ellipsoid(C.skin, 0.12, 0.50, 0.12),
            shoulder, 0, -0.10, 0,
            { rot: [0, 0, side * 0.12] }
        );

        const fore = add(
            mk().ellipsoid(C.skinDark, 0.095, 0.46, 0.10),
            upper, 0, -0.93, 0,
            { rot: [-0.10, 0, side * 0.03] }
        );

        add(
            mk().paraboloid(C.skin, 0.085, 0.06, 0.32),
            fore, 0, -0.86, 0
        );

        screw(shoulder, side * 0.20, -0.12, 0, "x", side);
        screw(upper, side * 0.17, -0.85, 0, "x", side);
        screw(fore, 0, -0.45, 0.16, "z", 1);

        stain(upper, C.blood, 0, -0.35, 0.095, 0.04, 0.10, 0.03);

        ARMS.push({ side, shoulder, fore });
        return shoulder;
    }

    const armR = makeArm(1);
    const armL = makeArm(-1);

    // ================= KAKI =================

    function makeLeg(side, stepZ) {
        const thigh = add(
            mk().ellipsoid(C.skin, 0.21, 0.76, 0.21),
            pelvis, side * 0.24, -0.42, 0,
            { rot: [stepZ, 0, side * 0.05] }
        );

        add(
            mk().ellipsoid(C.skinDark, 0.15, 0.16, 0.15),
            thigh, 0, -1.36, 0.01
        );

        const shin = add(
            mk().cylinder(C.skin, 0.13, 1.28),
            thigh, 0, -1.45, 0,
            { rot: [-stepZ * 0.6, 0, 0] }
        );

        add(
            mk().cylinder(C.skinDark, 0.085, 0.08),
            shin, 0, -1.26, 0
        );

        add(
            mk().ellipsoid(C.skin, 0.12, 0.07, 0.27),
            shin, 0, -1.30, 0.10
        );

        screw(thigh, side * 0.26, -0.55, 0, "x", side);
        screw(thigh, 0, -1.42, 0.20, "z", 1);
        screw(shin, side * 0.17, -0.75, 0, "x", side);

        stain(thigh, C.blood, -side * 0.05, -0.45, 0.175, 0.06, 0.12, 0.03);
        stain(shin, C.stain, 0.02, -0.55, 0.115, 0.05, 0.14, 0.03);

        LEGS.push({ side, thigh, shin });
        return thigh;
    }

    const legR = makeLeg(1, 0.0);
    const legL = makeLeg(-1, -0.10);

    // ================= DETAIL BADAN =================

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

    // ================= SELESAI MEMBUAT KARAKTER =================

    chest.setup();

    return {
        root: chest,
        ALL,
        spring,
        head,
        armR,
        armL,
        arms: ARMS,
        legs: LEGS
    };

}