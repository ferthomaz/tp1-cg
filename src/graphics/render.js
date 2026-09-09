import * as matrix from "../math/matrix.js";

export function setupWebGL() {
    
    const canvas = document.querySelector('.game-canvas');
    const gl = canvas.getContext('webgl2');
    
    if (!gl) {
      console.error('WebGL2 não está disponível');
      throw new Error('WebGL2 não suportado');
    }

    return gl
}

export function clearScreen(gl) {
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0.12, 0.18, 0.15, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
}

export function createShader(gl, name, type, source) {
    const shader = gl.createShader(type);

    if (!shader) {
        throw new Error(`Não foi possível criar o shader ${name}.`);
    }

    gl.shaderSource(shader, source.trim());
    gl.compileShader(shader);

    const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);

    if (success) {
        return shader;
    }

    const infoLog = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);

    throw new Error(`Erro ao compilar ${name}: ${infoLog}`);
}

export function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();

    if (!program) {
        throw new Error("Não foi possível criar o programa gráfico.");
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    const success = gl.getProgramParameter(program, gl.LINK_STATUS);

    if (success) {
        return program;
    }

    const infoLog = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);

    throw new Error(`Erro ao conectar os shaders: ${infoLog}`);
}

//prepara o quadrado base uma vez e devolve uma funcao para desenhar algo usando essa quadrado
export function createRectangleRenderer(gl, program) {
    const positionLocation = gl.getAttribLocation(program, "a_position");
    const matrixLocation = gl.getUniformLocation(program, "u_matrix");
    const colorLocation = gl.getUniformLocation(program, "u_color");

    if(positionLocation === -1 || matrixLocation === null || colorLocation === null) {
        throw new Error("Confira a_position, u_matrix e u_color nos shaders.");
    }

    //quadrado de 1 x 1 formado por dois triangulos
    const positions = new Float32Array([
        0, 0,
        1, 0,
        0, 1,

        0, 1,
        1, 0,
        1, 1,
    ]);

    const positionBuffer = gl.createBuffer();
    const vao = gl.createVertexArray();

    if (!positionBuffer || !vao) {
        if (positionBuffer) gl.deleteBuffer(positionBuffer);
        if (vao) gl.deleteVertexArray(vao);
        throw new Error("Nao foi possivel preparar os vertices.");
    }

    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);

    return function drawRectangle(rectangle) {
        const projectionMatrix = matrix.projection(
            gl.canvas.width,
            gl.canvas.height
        );

        const translationMatrix = matrix.translation(
            rectangle.x,
            rectangle.y
        );

        const scaleMatrix = matrix.scaling(
            rectangle.width,
            rectangle.height
        );

        //primeiro escala, depois posiciona
        const modelMatrix = matrix.multiply(
            translationMatrix,
            scaleMatrix
        );

        //matriz final: P * T * S
        const matrix = mat3.multiply(
            projectionMatrix,
            modelMatrix
        );

        gl.useProgram(program);
        gl.bindVertexArray(vao);

        gl.uniformMatrix3fv(matrixLocation, false, matrix);
        gl.uniform4fv(colorLocation, rectangle.color);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
}
