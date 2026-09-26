import { model } from '../math/matrix.js';
import { WebGLDevice } from './webgl/device.js';
import { resizeCanvas, clientToCanvas, intersectRects } from './canvas.js';
import { getSpriteUV, getSpriteRegionUV } from './sprite-atlas.js';
import { HtmlText } from './html-text.js';

const WHITE = Object.freeze([1, 1, 1, 1]);
const BACKGROUND = Object.freeze([0.035, 0.055, 0.075, 1]);

/** @typedef {[number, number, number, number]} Color RGBA components, each 0..1. */
/** @typedef {{x:number, y:number, width:number, height:number}} Rect Top-left CSS pixels. */

function finiteValues(values) {
    for (const [name, value] of Object.entries(values)) {
        if (!Number.isFinite(value)) throw new TypeError(`${name} must be a finite number; received ${value}.`);
    }
}
function checkColor(color) {
    if (!color || color.length !== 4 || Array.from(color).some(value => !Number.isFinite(value) || value < 0 || value > 1)) {
        throw new RangeError('color/tint must contain four RGBA numbers between 0 and 1.');
    }
}
function checkRect({ x, y, width, height }) { finiteValues({ x, y, width, height }); }
function checkSegments(segments) {
    if (!Number.isInteger(segments) || segments < 3 || segments > 512) throw new RangeError('segments must be an integer from 3 to 512.');
}


export class Renderer2D {
    #device;
    #clip = null;
    #frameOpen = false;
    #disposed = false;
    #stats = { drawCalls: 0, vertices: 0, triangles: 0, uploadedBytes: 0 };

    /**
     * @param {HTMLCanvasElement} canvas An existing, borderless canvas.
     * @param {{atlas?:object|null, maxPixelRatio?:number, fixedSize?:{width:number,height:number}|null}} options
     * atlas is optional; HTML text is styled separately through CSS.
     */
    constructor(canvas, { atlas = null, maxPixelRatio = 2, fixedSize = null } = {}) {
        this.canvas = canvas;
        this.fixedSize = fixedSize;
        this.atlas = atlas;
        this.maxPixelRatio = maxPixelRatio;
        this.#device = new WebGLDevice(canvas);
        try {
            if (atlas) getSpriteUV(atlas, 0, 0); // Validate before accepting a default atlas.
            if (atlas) this.#device.textureFor(atlas);
            this.resize();
            this.text = new HtmlText(canvas);
        } catch (error) {
            this.#device.dispose();
            throw error;
        }
    }

    get gl() { return this.#device.gl; }
    get stats() { return { ...this.#stats }; }

    #requireAlive() {
        if (this.#disposed) throw new Error('This renderer has been disposed. Create a new renderer to draw again.');
    }
    #requireFrame() {
        this.#requireAlive();
        if (!this.#frameOpen) throw new Error('Call beginFrame() before drawing, clipping, or endFrame().');
    }

    resize(pixelRatio = globalThis.devicePixelRatio || 1) {
        this.#requireAlive();
        if (this.#frameOpen) throw new Error('Resize before beginFrame(), not while a frame is open.');
        if (this.fixedSize) {
            this.width = this.fixedSize.width;
            this.height = this.fixedSize.height;
            if (this.canvas.width !== this.width) this.canvas.width = this.width;
            if (this.canvas.height !== this.height) this.canvas.height = this.height;
        } else Object.assign(this, resizeCanvas(this.canvas, pixelRatio, this.maxPixelRatio));
        return this;
    }

    beginFrame({ clearColor = BACKGROUND, pixelRatio = globalThis.devicePixelRatio || 1 } = {}) {
        this.#requireAlive();
        if (this.#frameOpen) throw new Error('The previous frame is still open. Call endFrame() first.');
        checkColor(clearColor);
        this.resize(pixelRatio);
        this.text.clear();
        this.#clip = null;
        this.#stats = { drawCalls: 0, vertices: 0, triangles: 0, uploadedBytes: 0 };
        this.#device.beginFrame(clearColor, this.width, this.height);
        this.#frameOpen = true;
        return this;
    }

    endFrame() {
        this.#requireFrame();
        this.#device.setClip(null);
        this.#clip = null;
        this.#frameOpen = false;
        return this;
    }

    #quad(x, y, width, height, color, texture = null, uv = null, rotation = 0, originX = 0.5, originY = 0.5) {
        if (width <= 0 || height <= 0) return;
        this.#draw(model(x, y, width, height, rotation, originX, originY), color, texture, uv);
    }

    #draw(transform, color, texture = null, uv = null, shape = 0, innerRadius = 0) {
        this.#device.drawQuad(transform, color, texture, uv, shape, innerRadius);
        this.#stats.drawCalls++;
        this.#stats.vertices += 4;
        this.#stats.triangles += 2;
    }

    drawRect({ x, y, width, height, color = WHITE }) {
        this.#requireFrame(); checkRect({ x, y, width, height }); checkColor(color);
        this.#quad(x, y, width, height, color);
        return this;
    }

    drawOutline({ x, y, width, height, color = WHITE, thickness = 1 }) {
        this.#requireFrame(); checkRect({ x, y, width, height }); finiteValues({ thickness }); checkColor(color);
        if (width <= 0 || height <= 0 || thickness <= 0) return this;
        const t = Math.min(thickness, width / 2, height / 2);
        this.#quad(x, y, width, t, color);
        this.#quad(x, y + height - t, width, t, color);
        this.#quad(x, y + t, t, height - 2 * t, color);
        this.#quad(x + width - t, y + t, t, height - 2 * t, color);
        return this;
    }

    drawLine({ x1, y1, x2, y2, thickness = 1, color = WHITE }) {
        this.#requireFrame(); finiteValues({ x1, y1, x2, y2, thickness }); checkColor(color);
        const length = Math.hypot(x2 - x1, y2 - y1);
        this.#quad(x1, y1 - thickness / 2, length, thickness, color, null, null,
            Math.atan2(y2 - y1, x2 - x1), 0, 0.5);
        return this;
    }

    drawTriangle({ a, b, c, color = WHITE }) {
        this.#requireFrame();
        if (!a || !b || !c) throw new TypeError('drawTriangle needs points a, b, and c.');
        finiteValues({ ax: a.x, ay: a.y, bx: b.x, by: b.y, cx: c.x, cy: c.y }); checkColor(color);
        const bx = b.x - a.x, by = b.y - a.y, cx = c.x - a.x, cy = c.y - a.y;
        if (bx * cy - by * cx === 0) return this;
        this.#draw(new Float32Array([bx, by, 0, 0, cx, cy, 0, 0, 0, 0, 1, 0, a.x, a.y, 0, 1]), color, null, null, 2);
        return this;
    }

    drawCircle({ x, y, radius, color = WHITE, segments = 64 }) {
        this.#requireFrame(); finiteValues({ x, y, radius }); checkColor(color); checkSegments(segments);
        if (radius > 0) this.#draw(model(x - radius, y - radius, radius * 2, radius * 2), color, null, null, 1);
        return this;
    }

    drawRing({ x, y, radius, color = WHITE, thickness = 1, segments = 64 }) {
        this.#requireFrame(); finiteValues({ x, y, radius, thickness }); checkColor(color); checkSegments(segments);
        if (radius <= 0 || thickness <= 0) return this;
        const outer = radius + thickness / 2, inner = Math.max(0, radius - thickness / 2);
        this.#draw(model(x - outer, y - outer, outer * 2, outer * 2), color, null, null, 1, inner / outer);
        return this;
    }

    drawSprite({ atlas = this.atlas, column = 0, row = 0, source = null, x, y,
        width = source?.width ?? atlas?.tileWidth, height = source?.height ?? atlas?.tileHeight, tint = WHITE,
        flipX = false, rotation = 0, originX = 0.5, originY = 0.5 }) {
        this.#requireFrame();
        const uv = source ? getSpriteRegionUV(atlas, source) : getSpriteUV(atlas, column, row);
        checkRect({ x, y, width, height }); checkColor(tint);
        finiteValues({ rotation, originX, originY });
        if (typeof flipX !== 'boolean') throw new TypeError('flipX must be a boolean.');
        if (flipX) [uv.u0, uv.u1] = [uv.u1, uv.u0];
        if (width <= 0 || height <= 0) return this;
        const texture = this.#device.textureFor(atlas);
        this.#quad(x, y, width, height, tint, texture, uv, rotation, originX, originY);
        return this;
    }

    drawText({ text, x, y, scale = 2, color = WHITE, align = 'left', maxWidth }) {
        this.#requireFrame(); finiteValues({ x, y, scale }); checkColor(color);
        if (!['left', 'center', 'right'].includes(align)) throw new RangeError('Text align must be left, center, or right.');
        if (scale > 0) this.text.draw({ text: String(text), x, y, scale, color, align, maxWidth });
        return this;
    }

    clearText() { this.text.clear(); }
    coverText(rect) { this.text.cover(rect); }


    setClip(rect = null) {
        this.#requireFrame();
        if (rect !== null) checkRect(rect);
        this.#clip = rect === null ? null : { x: rect.x, y: rect.y, width: Math.max(0, rect.width), height: Math.max(0, rect.height) };
        this.#device.setClip(this.#clip);
        return this;
    }

 
    withClip(rect, draw) {
        this.#requireFrame(); checkRect(rect);
        if (typeof draw !== 'function') throw new TypeError('withClip needs a synchronous drawing callback.');
        const previous = this.#clip;
        const normalized = { ...rect, width: Math.max(0, rect.width), height: Math.max(0, rect.height) };
        this.setClip(previous ? intersectRects(previous, normalized) : normalized);
        try { return draw(this); }
        finally { this.setClip(previous); }
    }

    screenToCanvas({ clientX, clientY }) {
        finiteValues({ clientX, clientY });
        return clientToCanvas(this.canvas, clientX, clientY, this.width, this.height);
    }

    dispose() {
        if (this.#disposed) return;
        this.#disposed = true;
        this.#frameOpen = false;
        this.text?.dispose();
        this.#device.dispose();
    }
}
