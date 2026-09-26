import { loadSpriteAtlas } from './sprite-atlas.js';

export const ENTITY_SHEET = Object.freeze({
    url: new URL('../../assets/sprites/spritesheets/entities.png', import.meta.url).href,
    tileSize: 32,
    columns: 4,
    rows: 8,
});

export const ENTITY_FRAMES = Object.freeze([0, 1, 0, 2, 3, 2]);
export const ENTITY_FRAMES_PER_SECOND = 8;
const ENTITY_ROWS = Object.freeze({ enemy: 0, hero: 1 });

export function entitySprite(kind, motion) {
    if (!Object.hasOwn(ENTITY_ROWS, kind)) throw new Error(`No entity sprite for ${kind}`);
    const frame = Math.floor(Math.max(0, motion.elapsed) * ENTITY_FRAMES_PER_SECOND + 1e-9) % ENTITY_FRAMES.length;
    return { column: motion.moving ? ENTITY_FRAMES[frame] : 0, row: ENTITY_ROWS[kind], flipX: motion.facingLeft };
}

export async function loadEntityArt() {
    const atlas = await loadSpriteAtlas(ENTITY_SHEET.url, ENTITY_SHEET);
    if (atlas.tileWidth !== ENTITY_SHEET.tileSize || atlas.tileHeight !== ENTITY_SHEET.tileSize) {
        throw new Error('entities.png must be a 4 x 8 sheet of 32px tiles.');
    }
    return atlas;
}
