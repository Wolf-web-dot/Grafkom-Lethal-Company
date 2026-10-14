// Pencahayaan sederhana (arah cahaya tetap), dipakai untuk memberi warna per vertex
function lightShade(nx, ny, nz, twoSided) {
    var l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    var d = (nx * 0.352 + ny * 0.616 + nz * 0.704) / l;
    if (twoSided) d = Math.abs(d);
    return 0.45 + 0.55 * Math.max(d, 0);
}

// Ellipsoid (sama seperti generateSphere di mainInstance.js)
// cut = { cx, cy, R } -> bagian permukaan depan (z > 0) yang berada di dalam
//       cylinder sumbu-Z berjari-jari R di titik (cx, cy) dibuang (dilubangi)
function generateSphere(a, b, c, stack, step, color, cut) {
    var vertices = [];
    var faces = [];
    var inside = [];

    // Generate vertices and colors
    for (var i = 0; i <= stack; i++) {
        var u = i / stack * Math.PI - (Math.PI / 2); // Latitude
        for (var j = 0; j <= step; j++) {
            var v = j / step * 2 * Math.PI - Math.PI; // Longitude

            var x = a * Math.cos(v) * Math.cos(u);
            var y = b * Math.sin(u);
            var z = c * Math.sin(v) * Math.cos(u);

            // Push vertex position
            vertices.push(x, y, z);

            // Push color data
            var shade = lightShade(x / (a * a), y / (b * b), z / (c * c), false);
            vertices.push(color[0] * shade, color[1] * shade, color[2] * shade);

            // Apakah titik ini berada di dalam cylinder pemotong?
            var flag = false;
            if (cut) {
                var dx = x - cut.cx, dy = y - cut.cy;
                flag = (dx * dx + dy * dy < cut.R * cut.R) && z > 0;
            }
            inside.push(flag);
        }
    }

    // Generate faces (indices)
    for (var i = 0; i < stack; i++) {
        for (var j = 0; j < step; j++) {
            var first = i * (step + 1) + j;
            var second = first + 1;
            var third = first + (step + 1);
            var fourth = third + 1;

            // quad yang menyentuh area cylinder tidak digambar
            if (cut && (inside[first] || inside[second] || inside[third] || inside[fourth])) continue;

            faces.push(first, second, fourth);
            faces.push(first, fourth, third);
        }
    }
    return { vertices, faces };
}

// Elliptic Paraboloid: x = a*u*cos(v), y = h*u^2, z = b*u*sin(v), u = 0..1
// Puncak di (0,0,0), sumbu ke arah Y, h negatif = terbuka ke bawah.
// closed = true -> ujung terbukanya ditutup dengan tutup datar
function generateEllipticParaboloid(a, b, h, stack, step, color, closed) {
    var vertices = [];
    var faces = [];

    for (var i = 0; i <= stack; i++) {
        var uu = i / stack;
        for (var j = 0; j <= step; j++) {
            var v = j / step * 2 * Math.PI;

            var x = a * uu * Math.cos(v);
            var y = h * uu * uu;
            var z = b * uu * Math.sin(v);

            vertices.push(x, y, z);

            var shade = lightShade(-2 * h * uu * Math.cos(v) / a, 1, -2 * h * uu * Math.sin(v) / b, true);
            vertices.push(color[0] * shade, color[1] * shade, color[2] * shade);
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

    if (closed) {
        var center = vertices.length / 6;
        var shade = lightShade(0, h > 0 ? 1 : -1, 0, true);
        vertices.push(0, h, 0, color[0] * shade, color[1] * shade, color[2] * shade);
        for (var j = 0; j < step; j++) {
            faces.push(center, stack * (step + 1) + j, stack * (step + 1) + j + 1);
        }
    }
    return { vertices, faces };
}

// Cone: alas lingkaran di y = 0, puncak di y = h
function generateCone(r, h, seg, color) {
    var vertices = [];
    var faces = [];

    // vertex 0 = puncak
    var s0 = lightShade(0, 1, 0, false);
    vertices.push(0, h, 0, color[0] * s0, color[1] * s0, color[2] * s0);

    // cincin alas
    for (var j = 0; j <= seg; j++) {
        var v = j / seg * 2 * Math.PI;
        var shade = lightShade(Math.cos(v) * h, r, Math.sin(v) * h, false);
        vertices.push(r * Math.cos(v), 0, r * Math.sin(v), color[0] * shade, color[1] * shade, color[2] * shade);
    }

    // pusat alas
    var center = vertices.length / 6;
    var sb = lightShade(0, -1, 0, false);
    vertices.push(0, 0, 0, color[0] * sb, color[1] * sb, color[2] * sb);

    for (var j = 0; j < seg; j++) {
        faces.push(0, 1 + j, 2 + j);          // selimut
        faces.push(center, 1 + j, 2 + j);     // alas
    }
    return { vertices, faces };
}

// Kurva Bezier kubik (4 titik kontrol) -> titik dan arah singgung
function bezierPoint(P, t) {
    var s = 1 - t;
    var out = [];
    for (var k = 0; k < 3; k++) {
        out.push(s * s * s * P[0][k] + 3 * s * s * t * P[1][k] + 3 * s * t * t * P[2][k] + t * t * t * P[3][k]);
    }
    return out;
}

function bezierTangent(P, t) {
    var s = 1 - t;
    var out = [];
    for (var k = 0; k < 3; k++) {
        out.push(3 * s * s * (P[1][k] - P[0][k]) + 6 * s * t * (P[2][k] - P[1][k]) + 3 * t * t * (P[3][k] - P[2][k]));
    }
    return out;
}

function normalize3(v) {
    var l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
}

function cross3(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

// Antena: kurva Bezier yang diberi ketebalan (tabung yang mengecil ke ujung)
function generateCurve(P, r0, r1, N, seg, color) {
    var vertices = [];
    var faces = [];

    // vektor bantu = sumbu dunia yang paling tidak sejajar dengan arah kurva
    var chord = [P[3][0] - P[0][0], P[3][1] - P[0][1], P[3][2] - P[0][2]];
    var ac = [Math.abs(chord[0]), Math.abs(chord[1]), Math.abs(chord[2])];
    var h = [0, 0, 0];
    h[ac.indexOf(Math.min(ac[0], ac[1], ac[2]))] = 1;

    for (var i = 0; i <= N; i++) {
        var t = i / N;
        var C = bezierPoint(P, t);
        var T = normalize3(bezierTangent(P, t));
        var Nn = normalize3(cross3(h, T));
        var B = cross3(T, Nn);
        var r = r0 + (r1 - r0) * t;

        for (var j = 0; j <= seg; j++) {
            var v = j / seg * 2 * Math.PI;
            var n = [
                Math.cos(v) * Nn[0] + Math.sin(v) * B[0],
                Math.cos(v) * Nn[1] + Math.sin(v) * B[1],
                Math.cos(v) * Nn[2] + Math.sin(v) * B[2]
            ];
            vertices.push(C[0] + r * n[0], C[1] + r * n[1], C[2] + r * n[2]);
            var shade = lightShade(n[0], n[1], n[2], false);
            vertices.push(color[0] * shade, color[1] * shade, color[2] * shade);
        }
    }

    for (var i = 0; i < N; i++) {
        for (var j = 0; j < seg; j++) {
            var first = i * (seg + 1) + j;
            var second = first + 1;
            var third = first + (seg + 1);
            var fourth = third + 1;

            faces.push(first, second, fourth);
            faces.push(first, fourth, third);
        }
    }
    return { vertices, faces };
}

// Dinding dalam lubang mulut: cylinder sumbu-Z yang ujung depannya mengikuti
// permukaan ellipsoid kepala (hasil pemotongan), ujung belakangnya ditutup (gelap)
function generateMouth(a, b, c, cx, cy, R, zBack, seg) {
    var vertices = [];
    var faces = [];

    for (var j = 0; j <= seg; j++) {
        var v = j / seg * 2 * Math.PI;
        var x = cx + R * Math.cos(v);
        var y = cy + R * Math.sin(v);
        var zFront = c * Math.sqrt(Math.max(1 - (x * x) / (a * a) - (y * y) / (b * b), 0));

        vertices.push(x, y, zFront, 0.30, 0.10, 0.04);   // di permukaan kepala
        vertices.push(x, y, zBack, 0.03, 0.01, 0.01);    // di dalam kepala (gelap)
    }

    for (var j = 0; j < seg; j++) {
        var f = 2 * j, bk = 2 * j + 1, f2 = 2 * j + 2, bk2 = 2 * j + 3;
        faces.push(f, bk, bk2);
        faces.push(f, bk2, f2);
    }

    // tutup belakang
    var center = vertices.length / 6;
    vertices.push(cx, cy, zBack, 0.02, 0.0, 0.0);
    for (var j = 0; j < seg; j++) {
        faces.push(center, 2 * j + 1, 2 * j + 3);
    }
    return { vertices, faces };
}





// ===========================================================================================================================================


// Hierarchical Object mesh = null -> mirip kayak sendi 
class MyObject {
    GL = null;
    SHADER_PROGRAM = null;

    _position = null;
    _color = null;
    _MMatrix = null;

    mesh = null;

    POSITION_MATRIX = LIBS.get_I4(); // Mpos
    MOVE_MATRIX     = LIBS.get_I4(); // Mmove

    childs = [];

    constructor(GL, SHADER_PROGRAM, _position, _color, _Mmatrix, mesh) {
        this.GL = GL;
        this.SHADER_PROGRAM = SHADER_PROGRAM;
        this._position = _position;
        this._color = _color;
        this._MMatrix = _Mmatrix;
        this.mesh = mesh;
    }

    render(PARENT_MATRIX) {
        this.MODEL_MATRIX = LIBS.multiply(this.MOVE_MATRIX, this.POSITION_MATRIX);
        this.MODEL_MATRIX = LIBS.multiply(this.MODEL_MATRIX, PARENT_MATRIX);

        if (this.mesh) {
            this.GL.useProgram(this.SHADER_PROGRAM);
            this.GL.uniformMatrix4fv(this._MMatrix, false, this.MODEL_MATRIX);

            this.GL.bindBuffer(this.GL.ARRAY_BUFFER, this.mesh.OBJECT_VERTEX);
            this.GL.vertexAttribPointer(this._position, 3, this.GL.FLOAT, false, 24, 0);
            this.GL.vertexAttribPointer(this._color, 3, this.GL.FLOAT, false, 24, 12);

            this.GL.bindBuffer(this.GL.ELEMENT_ARRAY_BUFFER, this.mesh.OBJECT_FACES);
            this.GL.drawElements(this.GL.TRIANGLES, this.mesh.count, this.GL.UNSIGNED_SHORT, 0);
        }

        this.childs.forEach(child => child.render(this.MODEL_MATRIX));
    }
}


function main() {
    /** @type {HTMLCanvasElement} */
    var CANVAS = document.getElementById("mycanvas");
    CANVAS.width = window.innerWidth;
    CANVAS.height = window.innerHeight;


    /*===================== GET WEBGL CONTEXT ===================== */
    /** @type {WebGLRenderingContext} */
    var GL;
    try {
        GL = CANVAS.getContext("webgl", { antialias: true });
    } catch (e) {
        alert("WebGL context cannot be initialized");
        return false;
    }


    /*========================= SHADERS ========================= */
    var shader_vertex_source = `
        attribute vec3 position;
        uniform mat4 Pmatrix, Vmatrix, Mmatrix;
        attribute vec3 color;
        varying vec3 vColor;

        void main(void) {
            gl_Position = Pmatrix * Vmatrix * Mmatrix * vec4(position, 1.);
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


    var _position = GL.getAttribLocation(SHADER_PROGRAM, "position");
    GL.enableVertexAttribArray(_position);


    var _color = GL.getAttribLocation(SHADER_PROGRAM, "color");
    GL.enableVertexAttribArray(_color);

    var _Pmatrix = GL.getUniformLocation(SHADER_PROGRAM, "Pmatrix");
    var _Vmatrix = GL.getUniformLocation(SHADER_PROGRAM, "Vmatrix");
    var _Mmatrix = GL.getUniformLocation(SHADER_PROGRAM, "Mmatrix");

    GL.useProgram(SHADER_PROGRAM);


    /*======================== WARNA & UKURAN ======================== */
    var C_BODY  = [0.34, 0.29, 0.23];
    var C_HEAD  = [0.39, 0.33, 0.27];
    var C_EYE   = [0.55, 0.19, 0.17];

    // kepala (ellipsoid) & lubang mulut (cylinder pemotong)
    var HEAD  = { a: 1.10, b: 0.95, c: 1.00 };
    var MOUTH = { cx: 0, cy: -0.30, R: 0.34, wall: 0.44 }; // wall = R + sedikit (lebih besar dari lubang)


    /*======================== MESH (VBO & EBO) ======================== */
    // Tiap bentuk dibuat SEKALI, lalu dipakai berulang (kiri/kanan, gigi, dll)
    var createMesh = function (geo) {
        var OBJECT_VERTEX = GL.createBuffer();
        GL.bindBuffer(GL.ARRAY_BUFFER, OBJECT_VERTEX);
        GL.bufferData(GL.ARRAY_BUFFER, new Float32Array(geo.vertices), GL.STATIC_DRAW);

        var OBJECT_FACES = GL.createBuffer();
        GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, OBJECT_FACES);
        GL.bufferData(GL.ELEMENT_ARRAY_BUFFER, new Uint16Array(geo.faces), GL.STATIC_DRAW);

        return { OBJECT_VERTEX: OBJECT_VERTEX, OBJECT_FACES: OBJECT_FACES, count: geo.faces.length };
    };

    var meshBody   = createMesh(generateSphere(1.50, 1.60, 1.30, 40, 40, C_BODY));
    var meshHead   = createMesh(generateSphere(HEAD.a, HEAD.b, HEAD.c, 72, 72, C_HEAD,
                                               { cx: MOUTH.cx, cy: MOUTH.cy, R: MOUTH.R }));   // membuat lubang mulut di kepala
    var meshMouth  = createMesh(generateMouth(HEAD.a, HEAD.b, HEAD.c, MOUTH.cx, MOUTH.cy, MOUTH.wall, 0.1, 40));

    var meshEye    = createMesh(generateSphere(0.22, 0.22, 0.22, 24, 24, C_EYE));

    // antena = kurva Bezier (4 titik kontrol); s = -1 kiri, +1 kanan


    /*======================== HIERARKI OBJEK ======================== */
    var newObj = function (mesh) {
        return new MyObject(GL, SHADER_PROGRAM, _position, _color, _Mmatrix, mesh);
    };
    var place = function (obj, x, y, z) {
        LIBS.set_position(obj.POSITION_MATRIX, x, y, z);
    };

    var Root = newObj(null);                 // sendi induk (diputar dengan mouse)
    var Body = newObj(meshBody);
    Root.childs.push(Body);

    // ---- Kepala + mulut + gigi + mata + antena ----
    var Head = newObj(meshHead);
    place(Head, 0, 1.55, 0.70);
    Body.childs.push(Head);

    var Mouth = newObj(meshMouth);
    Head.childs.push(Mouth);

    // gigi (Cone): di tepi lubang, menghadap ke tengah mulut dan sedikit ke depan
    // arah d diputar dengan rotasi X lalu Z agar sumbu Y cone searah d
    

    // mata (Sphere) + pantulan cahaya kecil
    var makeEye = function (side) {
        var Eye = newObj(meshEye);
        place(Eye, side * 0.55, 0.40, 0.70);
        Head.childs.push(Eye);
    };
    makeEye(-1);
    makeEye(1);

   

    /*======================== MOUSE CAMERA & CONTROL ======================== */
    var PROJMATRIX = LIBS.get_projection(40, CANVAS.width / CANVAS.height, 1, 100);
    var VIEWMATRIX = LIBS.get_I4();

    LIBS.translateY(VIEWMATRIX, -0.55);
    LIBS.translateZ(VIEWMATRIX, -13);

    var THETA = 0.5, PHI = 0.15;
    var drag = false;
    var x_prev, y_prev;
    var FRICTION = 0.05;
    var dX = 0, dY = 0;

    var mouseDown = function (e) {
        drag = true;
        x_prev = e.pageX, y_prev = e.pageY;
        e.preventDefault();
        return false;
    };

    var mouseUp = function (e) {
        drag = false;
    };

    var mouseMove = function (e) {
        if (!drag) return false;
        dX = (e.pageX - x_prev) * 2 * Math.PI / CANVAS.width;
        dY = (e.pageY - y_prev) * 2 * Math.PI / CANVAS.height;
        THETA += dX;
        PHI += dY;
        x_prev = e.pageX, y_prev = e.pageY;
        e.preventDefault();
        renderScene();
    };

    CANVAS.addEventListener("mousedown", mouseDown, false);
    CANVAS.addEventListener("mouseup", mouseUp, false);
    CANVAS.addEventListener("mouseout", mouseUp, false);
    CANVAS.addEventListener("mousemove", mouseMove, false);

    var SPEED = 0.05;

    var keyDown = function (e) {
        if (e.key === 'w') {
            PHI -= SPEED;
        }
        else if (e.key === 'a') {
            THETA -= SPEED;
        }
        else if (e.key === 's') {
            PHI += SPEED;
        }
        else if (e.key === 'd') {
            THETA += SPEED;
        }
        else {
            return;
        }
        renderScene();
    };

    window.addEventListener("keydown", keyDown, false);

    /*========================= DRAWING ========================= */
    GL.enable(GL.DEPTH_TEST);
    GL.depthFunc(GL.LEQUAL);
    GL.clearColor(0.25, 0.25, 0.25, 1.0);
    GL.clearDepth(1.0);

    var renderScene = function () {
        GL.viewport(0, 0, CANVAS.width, CANVAS.height);
        GL.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);

        LIBS.set_I4(Root.MOVE_MATRIX);
        LIBS.rotateY(Root.MOVE_MATRIX, THETA);
        LIBS.rotateX(Root.MOVE_MATRIX, PHI);

        GL.uniformMatrix4fv(_Pmatrix, false, PROJMATRIX);
        GL.uniformMatrix4fv(_Vmatrix, false, VIEWMATRIX);
        Root.render(LIBS.get_I4());
        GL.flush();
    };

    renderScene();
}
window.addEventListener('load', main);