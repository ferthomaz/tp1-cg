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
    gl.clearColor(1.0, 0.0, 0.0, 1.0);
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
