
import { Renderer2D } from './renderer2d.js';
export { Renderer2D } from './renderer2d.js';
export { createSpriteAtlas, createSpriteStrip, loadSpriteAtlas, loadImage } from './sprite-atlas.js';

//Synchronous setup, await image loading separately before supplying an atlas.
export function createRenderer(canvas, options = {}) {
    return new Renderer2D(canvas, options);
}
