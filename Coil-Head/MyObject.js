export class MyObject {
    GL = null;
    SHADER_PROGRAM = null;

    _position = null;
    _color = null;
    _MMatrix = null;

    OBJECT_VERTEX = null;
    OBJECT_FACES = null;

    vertex = [];
    faces = [];

    POSITION_MATRIX = LIBS.get_I4(); // hanya translate (posisi awal)
    MOVE_MATRIX     = LIBS.get_I4(); // rotasi / animasi di pivot
    MODEL_MATRIX    = LIBS.get_I4();

    childs = [];

    constructor(GL, SHADER_PROGRAM, _position, _color, _Mmatrix) {
        this.GL = GL;
        this.SHADER_PROGRAM = SHADER_PROGRAM;
        this._position = _position;
        this._color = _color;
        this._MMatrix = _Mmatrix;
    }

    /* ================= HELPER ================= */

    // petakan (s = sepanjang sumbu, p & q = melintang) ke xyz sesuai sumbu
    _map(axis, s, p, q) {
        if (axis === "x") return [s, p, q];
        if (axis === "z") return [p, q, s];
        return [p, s, q]; // "y"
    }

    // shading palsu supaya bentuk terlihat 3D (shader tidak punya lighting)
    _shade(color, nx, ny, nz) {
        const len = Math.hypot(nx, ny, nz) || 1;
        const d = (nx * 0.35 + ny * 0.55 + nz * 0.75) / len;
        const k = 0.62 + 0.38 * Math.max(0, d);
        return [color[0] * k, color[1] * k, color[2] * k];
    }

    // grid (rows x cols) dari fungsi fn(u, v) -> [x, y, z, nx, ny, nz]
    _grid(rows, cols, color, fn) {
        const base = this.vertex.length / 6;

        for (let i = 0; i <= rows; i++) {
            for (let j = 0; j <= cols; j++) {
                const [x, y, z, nx, ny, nz] = fn(i / rows, j / cols);
                const c = this._shade(color, nx, ny, nz);
                this.vertex.push(x, y, z, c[0], c[1], c[2]);
            }
        }

        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                const a = base + i * (cols + 1) + j;
                const b = a + cols + 1;
                this.faces.push(a, b, a + 1);
                this.faces.push(b, b + 1, a + 1);
            }
        }
    }

    /* ================= PRIMITIF =================
       Pivot ada di ujung atas (y = 0), bentuk memanjang ke bawah. */

    // Ellipsoid: panjang total = 2 * ry
    ellipsoid(color, rx, ry, rz, rings = 16, segments = 24) {
        this._grid(rings, segments, color, (u, v) => {
            const phi = u * Math.PI;
            const th = v * Math.PI * 2;
            const sp = Math.sin(phi), cp = Math.cos(phi);
            const ct = Math.cos(th), st = Math.sin(th);
            return [
                rx * sp * ct, ry * (cp - 1.0), rz * sp * st,
                (sp * ct) / rx, cp / ry, (sp * st) / rz
            ];
        });
        return this;
    }

    // Cylinder (selimut + 2 tutup). axis: "y" | "x" | "z", memanjang ke arah negatif
    cylinder(color, r, h, axis = "y", segments = 24) {
        // selimut
        this._grid(1, segments, color, (u, v) => {
            const th = v * Math.PI * 2;
            const c = Math.cos(th), s = Math.sin(th);
            const p = this._map(axis, -h * u, c * r, s * r);
            const n = this._map(axis, 0, c, s);
            return [p[0], p[1], p[2], n[0], n[1], n[2]];
        });

        // tutup: pangkal (s = 0) dan ujung (s = -h)
        [[0, 1], [-h, -1]].forEach(([s0, dir]) => {
            this._grid(1, segments, color, (u, v) => {
                const th = v * Math.PI * 2;
                const rr = r * u;
                const p = this._map(axis, s0, rr * Math.cos(th), rr * Math.sin(th));
                const n = this._map(axis, dir, 0, 0);
                return [p[0], p[1], p[2], n[0], n[1], n[2]];
            });
        });
        return this;
    }

    // Elliptic paraboloid: bibir lebar di y = 0, ujung runcing di y = -h
    // y = -h * (1 - (x/a)^2 - (z/b)^2)
    paraboloid(color, a, b, h, segments = 24, rings = 8) {
        this._grid(rings, segments, color, (u, v) => {
            const th = v * Math.PI * 2;
            const x = a * u * Math.cos(th);
            const z = b * u * Math.sin(th);
            const y = -h * (1 - u * u);
            return [x, y, z, (2 * h * x) / (a * a), -1, (2 * h * z) / (b * b)];
        });

        // tutup atas
        this._grid(1, segments, color, (u, v) => {
            const th = v * Math.PI * 2;
            return [a * u * Math.cos(th), 0, b * u * Math.sin(th), 0, 1, 0];
        });
        return this;
    }

    // Tube mengikuti kurva: curve(t) -> [x, y, z], t di 0..1
    // axis = vektor acuan untuk membuat frame (untuk heliks: sumbu heliks)
    tube(color, curve, radius, segs = 120, ring = 8, axis = [0, 0, 1]) {
        const norm = (a) => {
            const l = Math.hypot(a[0], a[1], a[2]) || 1;
            return [a[0] / l, a[1] / l, a[2] / l];
        };
        const cross = (a, b) => [
            a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0]
        ];

        this._grid(segs, ring, color, (u, v) => {
            const P = curve(u);
            const e = 0.001;
            const A = curve(Math.max(0, u - e));
            const B = curve(Math.min(1, u + e));
            const T = norm([B[0] - A[0], B[1] - A[1], B[2] - A[2]]);
            const N = norm(cross(T, axis));
            const Bn = cross(T, N);

            const ang = v * Math.PI * 2;
            const ca = Math.cos(ang), sa = Math.sin(ang);
            const n = [
                N[0] * ca + Bn[0] * sa,
                N[1] * ca + Bn[1] * sa,
                N[2] * ca + Bn[2] * sa
            ];
            return [
                P[0] + radius * n[0],
                P[1] + radius * n[1],
                P[2] + radius * n[2],
                n[0], n[1], n[2]
            ];
        });
        return this;
    }

    /* ================= GL ================= */

    setup() {
        // WebGL1 tanpa ekstensi hanya mendukung index sampai 65535
        if (this.vertex.length / 6 > 65535) {
            console.error("Terlalu banyak vertex pada satu objek:", this.vertex.length / 6);
        }

        this.OBJECT_VERTEX = this.GL.createBuffer();
        this.GL.bindBuffer(this.GL.ARRAY_BUFFER, this.OBJECT_VERTEX);
        this.GL.bufferData(this.GL.ARRAY_BUFFER, new Float32Array(this.vertex), this.GL.STATIC_DRAW);

        this.OBJECT_FACES = this.GL.createBuffer();
        this.GL.bindBuffer(this.GL.ELEMENT_ARRAY_BUFFER, this.OBJECT_FACES);
        this.GL.bufferData(this.GL.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.faces), this.GL.STATIC_DRAW);

        this.childs.forEach(child => child.setup());
    }

    render(PARENT_MATRIX) {
        // urutan: rotasi di pivot -> translate ke posisi -> ikut parent
        this.MODEL_MATRIX = LIBS.multiply(this.MOVE_MATRIX, this.POSITION_MATRIX);
        this.MODEL_MATRIX = LIBS.multiply(this.MODEL_MATRIX, PARENT_MATRIX);

        this.GL.useProgram(this.SHADER_PROGRAM);
        this.GL.uniformMatrix4fv(this._MMatrix, false, this.MODEL_MATRIX);

        this.GL.bindBuffer(this.GL.ARRAY_BUFFER, this.OBJECT_VERTEX);
        this.GL.vertexAttribPointer(this._position, 3, this.GL.FLOAT, false, 24, 0);
        this.GL.vertexAttribPointer(this._color, 3, this.GL.FLOAT, false, 24, 12);

        this.GL.bindBuffer(this.GL.ELEMENT_ARRAY_BUFFER, this.OBJECT_FACES);
        this.GL.drawElements(this.GL.TRIANGLES, this.faces.length, this.GL.UNSIGNED_SHORT, 0);

        this.childs.forEach(child => child.render(this.MODEL_MATRIX));
    }
}