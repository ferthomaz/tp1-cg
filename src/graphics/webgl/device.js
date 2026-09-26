import { createProgram, requireUniform } from './program.js';
import { shaderSources } from './shader-loader.js';
import { QUAD_VERTICES } from '../primitives.js';
import { projection } from '../../math/matrix.js';
import { toScissorRect } from '../canvas.js';

function setupWebGL(canvas) {
    if (!canvas || typeof canvas.getContext !== 'function') {
        throw new TypeError('createRenderer requires a canvas element. Check your selector.');
    }
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: true });
    if (!gl) throw new Error('WebGL 2 is unavailable. Enable hardware acceleration or use a WebGL 2 browser.');
    return gl;
}

/**
 * This class owns every WebGL object for one renderer/canvas.
 * Game code should use Renderer2D instead, only this module and program.js
 * issue gl.* commands. Initialization is separate from per-frame drawing.
 */
export class WebGLDevice {
    constructor(canvas) {
        const gl = setupWebGL(canvas);
        this.gl = gl;
        this.canvas = canvas;
        this.textures = new Map();
        this.disposed = false;
        try {
            // Compile/link one program, shared by all shapes and sprites.
            this.program = createProgram(gl, shaderSources.vertex, shaderSources.fragment);
            this.uniforms = Object.fromEntries(['u_projection', 'u_model', 'u_texture', 'u_color', 'u_uvRegion', 'u_useTexture', 'u_shape']
                .map(name => [name, requireUniform(gl, this.program, name)]));

            // One VBO, uploaded once, as the professor guide. All objects reuse these four vertices.
            this.vao = gl.createVertexArray();
            this.buffer = gl.createBuffer();
            if (!this.vao || !this.buffer) throw new Error('Cannot allocate renderer geometry.');
            gl.bindVertexArray(this.vao);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
            gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW);
            // x,y,u,v: 16 bytes per vertex; UV begins at byte 8.
            for (const [location, offset] of [[0, 0], [1, 8]]) {
                gl.enableVertexAttribArray(location);
                gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 16, offset);
            }
            gl.bindVertexArray(null);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);

            // A complete fallback texture keeps the sampler valid for solid shapes.
            this.whiteTexture = this.createTexture(null);
        } catch (error) {
            // This includes partial initialization: never strand a buffer/program.
            this.dispose();
            throw error;
        }
    }

    /** Upload once. Each atlas is cached for this context, never globally. */
    textureFor(atlas) {
        if (!this.textures.has(atlas)) this.textures.set(atlas, this.createTexture(atlas));
        return this.textures.get(atlas);
    }

    createTexture(atlas) {
        const gl = this.gl;
        if (atlas && (atlas.width > gl.getParameter(gl.MAX_TEXTURE_SIZE) || atlas.height > gl.getParameter(gl.MAX_TEXTURE_SIZE))) {
            throw new RangeError('Sprite atlas exceeds this GPU\'s maximum texture size.');
        }
        const texture = gl.createTexture();
        if (!texture) throw new Error('Cannot allocate a sprite texture.');
        try {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            // Pixel art: nearest-neighbor sampling, no mipmaps, no edge wrapping.
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            // Our atlas rows count from the top, do not flip during upload.
            // Keep straight alpha, the blend function below expects it.
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
            if (atlas?.images) {
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, atlas.width, atlas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
                atlas.images.forEach((image, index) => gl.texSubImage2D(gl.TEXTURE_2D, 0,
                    index * atlas.tileWidth, 0, gl.RGBA, gl.UNSIGNED_BYTE, image));
            } else if (atlas) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.image);
            else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
            return texture;
        } catch (error) {
            gl.deleteTexture(texture);
            throw error;
        }
    }

    /** Set the frame's viewport/state once. Our renderer exclusively owns gl. */
    beginFrame(color, width, height) {
        this.width = width;
        this.height = height;
        const gl = this.gl;
        gl.useProgram(this.program);
        gl.uniformMatrix4fv(this.uniforms.u_projection, false, projection(width, height));
        gl.uniform1i(this.uniforms.u_texture, 0);
        gl.disable(gl.SCISSOR_TEST); // Clear the whole canvas, not last frame's clip.
        gl.disable(gl.DEPTH_TEST);   // 2D painter's order: later calls appear on top.
        gl.disable(gl.CULL_FACE);    // Both triangle orientations are valid in 2D.
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(color[0], color[1], color[2], color[3]);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.enable(gl.BLEND);
        // RGB = source.rgb * source.a + destination.rgb * (1 - source.a).
        // Separate alpha factors avoid accidentally squaring source alpha.
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }

    /** Set the per-object material and transform, then issue an explicit draw. */
    setObject(transform, color, texture = null, uv = null) {
        const gl = this.gl, u = this.uniforms;
        gl.uniformMatrix4fv(u.u_model, false, transform);
        gl.uniform4fv(u.u_color, color);
        gl.uniform1i(u.u_useTexture, texture ? 1 : 0);
        gl.uniform4f(u.u_uvRegion, uv?.u0 ?? 0, uv?.v0 ?? 0,
            uv ? uv.u1 - uv.u0 : 1, uv ? uv.v1 - uv.v0 : 1);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture ?? this.whiteTexture);
    }

    drawQuad(transform, color, texture = null, uv = null, shape = 0, innerRadius = 0) {
        const gl = this.gl;
        gl.bindVertexArray(this.vao);
        this.setObject(transform, color, texture, uv);
        gl.uniform2f(this.uniforms.u_shape, shape, innerRadius);
        // Four perimeter vertices form two triangles, just like the class examples.
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    }

    /** Draws are immediate, so a clip change affects only subsequent objects. */
    setClip(rect) {
        const gl = this.gl;
        if (rect === null) { gl.disable(gl.SCISSOR_TEST); return; }
        const box = toScissorRect(rect, this.width, this.height, this.canvas.width, this.canvas.height);
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(box.x, box.y, box.width, box.height);
    }

    /** Safe twice, after a construction error, and while a context is lost. */
    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        const gl = this.gl;
        for (const texture of this.textures.values()) gl.deleteTexture(texture);
        this.textures.clear();
        if (this.whiteTexture) gl.deleteTexture(this.whiteTexture);
        if (this.buffer) gl.deleteBuffer(this.buffer);
        if (this.vao) gl.deleteVertexArray(this.vao);
        if (this.program) gl.deleteProgram(this.program);
    }
}
