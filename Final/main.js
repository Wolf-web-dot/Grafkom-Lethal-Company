import { createCoilHead } from "./CoilHead.js";
import { createHoardingBug } from "./HoardingBug.js";
import { createNutCracker } from "./NutCracker.js";

function main() {
    const CANVAS = document.getElementById("mycanvas");
    const GL = CANVAS.getContext("webgl", { antialias: true });

    if (!GL) {
        alert("WebGL tidak tersedia!");
        return;
    }

    function compileProgram(vertexSource, fragmentSource) {
        function compileShader(source, type) {
            const shader = GL.createShader(type);
            GL.shaderSource(shader, source);
            GL.compileShader(shader);

            if (!GL.getShaderParameter(shader, GL.COMPILE_STATUS)) {
                const message = GL.getShaderInfoLog(shader);
                GL.deleteShader(shader);
                throw new Error("Shader gagal dikompilasi: " + message);
            }

            return shader;
        }

        const vertexShader = compileShader(vertexSource, GL.VERTEX_SHADER);
        const fragmentShader = compileShader(fragmentSource, GL.FRAGMENT_SHADER);
        const program = GL.createProgram();

        GL.attachShader(program, vertexShader);
        GL.attachShader(program, fragmentShader);
        GL.bindAttribLocation(program, 0, "position");
        GL.bindAttribLocation(program, 1, "color");
        GL.bindAttribLocation(program, 2, "uv");
        GL.linkProgram(program);
        GL.deleteShader(vertexShader);
        GL.deleteShader(fragmentShader);

        if (!GL.getProgramParameter(program, GL.LINK_STATUS)) {
            const message = GL.getProgramInfoLog(program);
            GL.deleteProgram(program);
            throw new Error("Shader program gagal di-link: " + message);
        }

        return program;
    }

    const colorProgram = compileProgram(
        `
            attribute vec3 position;
            attribute vec3 color;
            uniform mat4 Pmatrix, Vmatrix, Mmatrix;
            varying vec3 vColor;

            void main(void) {
                gl_Position = Pmatrix * Vmatrix * Mmatrix * vec4(position, 1.0);
                vColor = color;
            }
        `,
        `
            precision mediump float;
            varying vec3 vColor;

            void main(void) {
                gl_FragColor = vec4(vColor, 1.0);
            }
        `
    );

    const textureProgram = compileProgram(
        `
            attribute vec3 position;
            attribute vec3 color;
            attribute vec2 uv;
            uniform mat4 Pmatrix, Vmatrix, Mmatrix;
            varying vec3 vColor;
            varying vec2 vUV;

            void main(void) {
                gl_Position = Pmatrix * Vmatrix * Mmatrix * vec4(position, 1.0);
                vColor = color;
                vUV = uv;
            }
        `,
        `
            precision mediump float;
            uniform sampler2D sampler;
            varying vec3 vColor;
            varying vec2 vUV;

            void main(void) {
                gl_FragColor = vec4(vColor, 1.0) * texture2D(sampler, vUV);
            }
        `
    );

    const colorLocations = {
        position: GL.getAttribLocation(colorProgram, "position"),
        color: GL.getAttribLocation(colorProgram, "color"),
        projection: GL.getUniformLocation(colorProgram, "Pmatrix"),
        view: GL.getUniformLocation(colorProgram, "Vmatrix"),
        model: GL.getUniformLocation(colorProgram, "Mmatrix")
    };

    const textureLocations = {
        position: GL.getAttribLocation(textureProgram, "position"),
        color: GL.getAttribLocation(textureProgram, "color"),
        uv: GL.getAttribLocation(textureProgram, "uv"),
        projection: GL.getUniformLocation(textureProgram, "Pmatrix"),
        view: GL.getUniformLocation(textureProgram, "Vmatrix"),
        model: GL.getUniformLocation(textureProgram, "Mmatrix"),
        sampler: GL.getUniformLocation(textureProgram, "sampler")
    };

    GL.enableVertexAttribArray(0);
    GL.enableVertexAttribArray(1);
    GL.enableVertexAttribArray(2);

    const coil = createCoilHead(
        GL,
        colorProgram,
        colorLocations.position,
        colorLocations.color,
        colorLocations.model
    );

    const hoardingBug = createHoardingBug(
        GL,
        textureProgram,
        textureLocations.position,
        textureLocations.color,
        textureLocations.model,
        textureLocations.uv,
        textureLocations.sampler
    );

    const nutCracker = createNutCracker(
        GL,
        textureProgram,
        textureLocations.position,
        textureLocations.color,
        textureLocations.model,
        textureLocations.uv,
        textureLocations.sampler
    );

    LIBS.set_position(coil.root.POSITION_MATRIX, -4.2, -1.0, 0);
    LIBS.set_position(hoardingBug.root.POSITION_MATRIX, 0, -0.5, 0);
    LIBS.scaleX(hoardingBug.root.POSITION_MATRIX, 0.65);
    LIBS.scaleY(hoardingBug.root.POSITION_MATRIX, 0.65);
    LIBS.scaleZ(hoardingBug.root.POSITION_MATRIX, 0.65);
    LIBS.set_position(nutCracker.root.POSITION_MATRIX, 4.2, -0.7, 0);

    const VIEWMATRIX = LIBS.get_I4();
    LIBS.translateZ(VIEWMATRIX, -18);

    function resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        CANVAS.style.width = window.innerWidth + "px";
        CANVAS.style.height = window.innerHeight + "px";
        const width = Math.floor(CANVAS.clientWidth * dpr);
        const height = Math.floor(CANVAS.clientHeight * dpr);

        if (CANVAS.width !== width || CANVAS.height !== height) {
            CANVAS.width = width;
            CANVAS.height = height;
        }
    }

    function setCommonUniforms(program, locations, projection) {
        GL.useProgram(program);
        GL.uniformMatrix4fv(locations.projection, false, projection);
        GL.uniformMatrix4fv(locations.view, false, VIEWMATRIX);
    }

    GL.enable(GL.DEPTH_TEST);
    GL.depthFunc(GL.LEQUAL);
    GL.clearColor(0.12, 0.12, 0.12, 1.0);
    GL.clearDepth(1.0);

    function render(time) {
        resizeCanvas();
        const projection = LIBS.get_projection(
            40,
            CANVAS.width / CANVAS.height,
            1,
            100
        );
        LIBS.set_I4(coil.root.MOVE_MATRIX);
        LIBS.rotateY(coil.root.MOVE_MATRIX, time * 0.00025);
        LIBS.set_I4(hoardingBug.root.MOVE_MATRIX);
        LIBS.rotateY(hoardingBug.root.MOVE_MATRIX, -time * 0.00018);
        LIBS.set_I4(nutCracker.root.MOVE_MATRIX);
        LIBS.rotateY(nutCracker.root.MOVE_MATRIX, Math.sin(time * 0.0004) * 0.08);

        GL.viewport(0, 0, CANVAS.width, CANVAS.height);
        GL.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);

        setCommonUniforms(colorProgram, colorLocations, projection);
        coil.root.render(LIBS.get_I4());

        setCommonUniforms(textureProgram, textureLocations, projection);
        hoardingBug.root.render(LIBS.get_I4());
        nutCracker.root.render(LIBS.get_I4());

        GL.flush();
        requestAnimationFrame(render);
    }

    window.addEventListener("resize", resizeCanvas);
    requestAnimationFrame(render);
}

window.addEventListener("load", main);
