import { loadImage } from './sprite-atlas.js';

import { TOWER_ELEMENTS } from '../game/rules.js';
import { WALL_VARIANTS } from '../game/entities/structures.js';

export const STRUCTURE_SHEET = Object.freeze({
    url: new URL('../../assets/sprites/spritesheets/structures.png', import.meta.url).href,
    tileSize: 32, columns: 8, rows: 4,
});

// Zero-based cells. Row two shares exactly the same column as the living sprite.
export function structureSprite(structure, { selected = false } = {}) {
    // Cell 0-2: column zero, row two, the construction-site artwork.
    if (structure.work) return { column: 0, row: 2 };
    const row = structure.hp <= 0 ? 1 : 0;
    switch (structure.kind) {
    case 'city': return { column: 0, row };
    case 'tower': return {
        column: structure.element ? 4 + TOWER_ELEMENTS.indexOf(structure.element) : Math.min(3, structure.level),
        row,
    };
    case 'hero': return { column: selected ? 0 : 1, row: 2 };
    case 'wall': return { column: 2 + WALL_VARIANTS.indexOf(structure.variant ?? 'vertical'), row: 2 };
    case 'enemy-castle': return { column: 0, row: 3 };
    case 'enemy-tower': return { column: structure.level, row: 3 };
    default: throw new Error(`No structure sprite for ${structure.kind}`);
    }
}

/** Load the existing artwork and verify the layout expected by structureSprite. */
export async function loadStructureSheet() {
    const image = await loadImage(STRUCTURE_SHEET.url);
    const { tileSize, columns, rows } = STRUCTURE_SHEET;
    if (image.naturalWidth !== columns * tileSize || image.naturalHeight !== rows * tileSize) {
        throw new Error('structures.png must be an 8 x 4 sheet of 32px tiles.');
    }
    return image;
}
