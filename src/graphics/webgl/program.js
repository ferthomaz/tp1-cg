
function numberedSource(source) {
    return source.split('\n').map((line, index) => `${index + 1}: ${line}`).join('\n');
}

export function compileShader(gl, type, source, label) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error(`Cannot allocate ${label}.`);
    try {
        gl.shaderSource(shader, source.trim());
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error(`${label} compilation failed:\n${gl.getShaderInfoLog(shader) || 'No driver log.'}\n${numberedSource(source.trim())}`);
        }
        return shader;
    } catch (error) {
        gl.deleteShader(shader);
        throw error;
    }
}


export function createProgram(gl, vertexSource, fragmentSource, label = 'Renderer2D') {
    let vertex = null;
    let fragment = null;
    let program = null;
    try {
        vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource, `${label} vertex shader`);
        fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource, `${label} fragment shader`);
        program = gl.createProgram();
        if (!program) throw new Error(`Cannot allocate ${label} program.`);
        gl.attachShader(program, vertex);
        gl.attachShader(program, fragment);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error(`${label} linking failed:\n${gl.getProgramInfoLog(program) || 'No driver log.'}`);
        }
        return program;
    } catch (error) {
        if (program) gl.deleteProgram(program);
        throw error;
    } finally {
        if (vertex) gl.deleteShader(vertex);
        if (fragment) gl.deleteShader(fragment);
    }
}

export function requireUniform(gl, program, name) {
    const location = gl.getUniformLocation(program, name);
    if (location === null) throw new Error(`Renderer shader is missing the active uniform "${name}".`);
    return location;
}
