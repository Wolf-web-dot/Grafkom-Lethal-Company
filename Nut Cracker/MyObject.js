export class MyObject {
    GL = null;
    SHADER_PROGRAM = null;

    _position = null;
    _color = null;
    _uv = null;
    _MMatrix = null;
    _sampler = null;

    mesh = null;

    POSITION_MATRIX = LIBS.get_I4();
    MOVE_MATRIX = LIBS.get_I4();

    childs = [];

    constructor(
        GL,
        SHADER_PROGRAM,
        _position,
        _color,
        _Mmatrix,
        mesh,
        _uv,
        _sampler
    ) {
        this.GL = GL;
        this.SHADER_PROGRAM = SHADER_PROGRAM;

        this._position = _position;
        this._color = _color;
        this._MMatrix = _Mmatrix;
        this._uv = _uv;
        this._sampler = _sampler;

        this.mesh = mesh;
    }

    render(PARENT_MATRIX) {
        // Menggabungkan transformasi object dan parent
        this.MODEL_MATRIX = LIBS.multiply(
            this.MOVE_MATRIX,
            this.POSITION_MATRIX
        );

        this.MODEL_MATRIX = LIBS.multiply(
            this.MODEL_MATRIX,
            PARENT_MATRIX
        );

        // Mengaktifkan shader
        this.GL.useProgram(this.SHADER_PROGRAM);

        this.GL.uniformMatrix4fv(
            this._MMatrix,
            false,
            this.MODEL_MATRIX
        );

        // Texture milik mesh (mesh tanpa gambar memakai texture putih 1x1)
        this.GL.activeTexture(this.GL.TEXTURE0);
        this.GL.bindTexture(this.GL.TEXTURE_2D, this.mesh.texture);
        this.GL.uniform1i(this._sampler, 0);

        // Vertex buffer: posisi(3) + warna(3) + uv(2) = 8 float = 32 byte
        this.GL.bindBuffer(
            this.GL.ARRAY_BUFFER,
            this.mesh.OBJECT_VERTEX
        );

        this.GL.vertexAttribPointer(
            this._position, 3, this.GL.FLOAT, false, 32, 0
        );

        this.GL.vertexAttribPointer(
            this._color, 3, this.GL.FLOAT, false, 32, 12
        );

        this.GL.vertexAttribPointer(
            this._uv, 2, this.GL.FLOAT, false, 32, 24
        );

        // Index buffer milik mesh
        this.GL.bindBuffer(
            this.GL.ELEMENT_ARRAY_BUFFER,
            this.mesh.OBJECT_FACES
        );

        this.GL.drawElements(
            this.GL.TRIANGLES,
            this.mesh.count,
            this.GL.UNSIGNED_SHORT,
            0
        );

        // Menggambar semua child secara rekursif
        this.childs.forEach(child => {
            child.render(this.MODEL_MATRIX);
        });
    }
}