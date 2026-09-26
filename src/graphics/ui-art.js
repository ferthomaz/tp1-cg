import { loadSpriteAtlas } from './sprite-atlas.js';

// Keep the artist's original transparent PNGs, with nearest-neighbor sampling.
export const UI_ART = Object.freeze({
    // These supplied frames replace the old generated panel/button rectangles.
    generalHud: new URL('../../assets/sprites/hud/general_hud.png', import.meta.url).href,
    generalButton: new URL('../../assets/sprites/hud/general_button.png', import.meta.url).href,
    heroHealth: new URL('../../assets/sprites/hud/hud_hero_health_sprite.png', import.meta.url).href,
    castleHealth: new URL('../../assets/sprites/hud/hud_tower_health_sprite.png', import.meta.url).href,
});

/**
 * Resize the artist's frame without stretching its pixel-art corners.
 * Four corners retain their size; edges stretch on one axis and the center fills
 * the remaining space. Both the main HUD and small buttons use this same helper.
 */
export function drawUIFrame(draw, atlas, rect, border, tint = [1, 1, 1, 1]) {
    if (!atlas) return;
    const edge = Math.min(border, rect.width / 2, rect.height / 2);
    const sourceX = [0, border, atlas.width - border, atlas.width];
    const sourceY = [0, border, atlas.height - border, atlas.height];
    const targetX = [rect.x, rect.x + edge, rect.x + rect.width - edge, rect.x + rect.width];
    const targetY = [rect.y, rect.y + edge, rect.y + rect.height - edge, rect.y + rect.height];
    for (let row = 0; row < 3; row++) {
        for (let column = 0; column < 3; column++) {
            draw.drawSprite({
                atlas, tint,
                source: { x: sourceX[column], y: sourceY[row],
                    width: sourceX[column + 1] - sourceX[column], height: sourceY[row + 1] - sourceY[row] },
                x: targetX[column], y: targetY[row],
                width: targetX[column + 1] - targetX[column], height: targetY[row + 1] - targetY[row],
            });
        }
    }
}

export async function loadUIArt() {
    return Object.fromEntries(await Promise.all(Object.entries(UI_ART).map(async ([name, url]) =>
        [name, await loadSpriteAtlas(url)])));
}
