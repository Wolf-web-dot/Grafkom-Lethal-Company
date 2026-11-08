
import { createCoilHead } from "./CoilHead.js";

function main() {
    const CANVAS = document.getElementById("mycanvas");

    CANVAS.width = window.innerWidth;
    CANVAS.height = window.innerHeight;

    const GL = CANVAS.getContext("webgl", {
        antialias: true
    });

    if (!GL) {
        alert("WebGL tidak tersedia!");
        return;
    }

    // =================================
    // SHADER COIL-HEAD
    // =================================

    const vertexSource = `
        attribute vec3 position;
        attribute vec3 color;

        uniform mat4 Pmatrix;
        uniform mat4 Vmatrix;
        uniform mat4 Mmatrix;

        varying vec3 vColor;

        void main(void) {
            gl_Position =
                Pmatrix *
                Vmatrix *
                Mmatrix *
                vec4(position, 1.0);

            vColor = color;
        }
    `;

    const fragmentSource = `
        precision mediump float;

        varying vec3 vColor;

        void main(void) {
            gl_FragColor = vec4(vColor, 1.0);
        }
    `;

    function compileShader(source, type) {
        const shader = GL.createShader(type);

        GL.shaderSource(shader, source);
        GL.compileShader(shader);

        if (!GL.getShaderParameter(shader, GL.COMPILE_STATUS)) {
            console.error(GL.getShaderInfoLog(shader));
            throw new Error("Shader gagal dikompilasi");
        }

        return shader;
    }

    const vertexShader = compileShader(
        vertexSource,
        GL.VERTEX_SHADER
    );

    const fragmentShader = compileShader(
        fragmentSource,
        GL.FRAGMENT_SHADER
    );

    const SHADER_PROGRAM = GL.createProgram();

    GL.attachShader(SHADER_PROGRAM, vertexShader);
    GL.attachShader(SHADER_PROGRAM, fragmentShader);
    GL.linkProgram(SHADER_PROGRAM);

    if (!GL.getProgramParameter(SHADER_PROGRAM, GL.LINK_STATUS)) {
        console.error(GL.getProgramInfoLog(SHADER_PROGRAM));
        throw new Error("Shader program gagal di-link");
    }

    GL.useProgram(SHADER_PROGRAM);

    // =================================
    // ATTRIBUTE DAN UNIFORM
    // =================================

    const _position = GL.getAttribLocation(
        SHADER_PROGRAM, "position"
    );

    const _color = GL.getAttribLocation(
        SHADER_PROGRAM, "color"
    );

    const _Mmatrix = GL.getUniformLocation(
        SHADER_PROGRAM, "Mmatrix"
    );

    const _Pmatrix = GL.getUniformLocation(
        SHADER_PROGRAM, "Pmatrix"
    );

    const _Vmatrix = GL.getUniformLocation(
        SHADER_PROGRAM, "Vmatrix"
    );

    GL.enableVertexAttribArray(_position);
    GL.enableVertexAttribArray(_color);

    // =================================
    // KAMERA
    // =================================

    const PROJMATRIX = LIBS.get_projection(
        40,
        CANVAS.width / CANVAS.height,
        1,
        100
    );

    const VIEWMATRIX = LIBS.get_I4();

    LIBS.translateY(VIEWMATRIX, -0.1);
    LIBS.translateZ(VIEWMATRIX, -12.5);

    // =================================
    // BUAT COIL-HEAD
    // =================================

    const coil = createCoilHead(
        GL,
        SHADER_PROGRAM,
        _position,
        _color,
        _Mmatrix
    );

    console.log("Coil-Head berhasil dibuat!");

    // =================================
    // WEBGL SETTINGS
    // =================================

    GL.enable(GL.DEPTH_TEST);
    GL.depthFunc(GL.LEQUAL);

    GL.clearColor(0.12, 0.12, 0.12, 1.0);
    GL.clearDepth(1.0);

    // =================================
    // RENDER LOOP
    // =================================

    function render() {
        GL.viewport(
            0, 0,
            CANVAS.width,
            CANVAS.height
        );

        GL.clear(
            GL.COLOR_BUFFER_BIT |
            GL.DEPTH_BUFFER_BIT
        );

        GL.useProgram(SHADER_PROGRAM);

        GL.uniformMatrix4fv(
            _Pmatrix,
            false,
            PROJMATRIX
        );

        GL.uniformMatrix4fv(
            _Vmatrix,
            false,
            VIEWMATRIX
        );

        coil.root.render(LIBS.get_I4());

        GL.flush();

        requestAnimationFrame(render);
    }

    render();
}

window.addEventListener("load", main);