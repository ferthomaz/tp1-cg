import { createSpriteStrip, loadImage } from './sprite-atlas.js';
import { spriteCorners } from './primitives.js';
import { createRouteGeometry } from './view-layout.js';

export const TREE_IMAGES = Object.freeze([1, 2, 3].map(index =>
    new URL(`../../assets/sprites/scenario/tree-00${index}.png`, import.meta.url).href));

export async function loadForestArt() {
    return createSpriteStrip(await Promise.all(TREE_IMAGES.map(url => loadImage(url))));
}

export const FOREST_RULES = Object.freeze({ cellSize: 34, chunkCells: 8, maxCachedChunks: 128,
    pathClearance: 30, minSize: 46, maxSize: 84, maxLean: 0.09, seed: 73129 });

function randomAt(x, y, salt) {
    let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(salt, 1442695041);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function intersectsRect(a, b) {
    return a.x <= b.x + b.width && a.x + a.width >= b.x
        && a.y <= b.y + b.height && a.y + a.height >= b.y;
}

export function segmentIntersectsRect(from, to, rect, padding = 0) {
    let enter = 0, leave = 1;
    for (const [axis, length] of [['x', 'width'], ['y', 'height']]) {
        const min = rect[axis] - padding, max = rect[axis] + rect[length] + padding;
        const delta = to[axis] - from[axis];
        if (Math.abs(delta) < 1e-10) {
            if (from[axis] < min || from[axis] > max) return false;
        } else {
            const a = (min - from[axis]) / delta, b = (max - from[axis]) / delta;
            enter = Math.max(enter, Math.min(a, b));
            leave = Math.min(leave, Math.max(a, b));
            if (enter > leave) return false;
        }
    }
    return true;
}

export function treeBounds(tree) {
    const corners = spriteCorners(tree.x - tree.size / 2, tree.y - tree.size,
        tree.size, tree.size, tree.rotation, 0.5, 1);
    const x = Math.min(...corners.map(p => p.x)), y = Math.min(...corners.map(p => p.y));
    return { x, y, width: Math.max(...corners.map(p => p.x)) - x,
        height: Math.max(...corners.map(p => p.y)) - y };
}

export class ForestEnvironment {
    constructor(snapshot, { seed = FOREST_RULES.seed } = {}) {
        this.seed = seed;
        const { segments, entries } = createRouteGeometry(snapshot.paths);
        this.segments = segments;
        const reserve = (position, size) => ({ x: position.x - size / 2, y: position.y - size / 2,
            width: size, height: size });
        this.clearings = snapshot.structures.map(item => reserve(item.position, item.kind === 'wall' ? 44 : 88));
        this.clearings.push(...entries.map(position => reserve(position, 96)));
        if (snapshot.hero) this.clearings.push(reserve(snapshot.hero.homePosition ?? snapshot.hero.position, 76));
        this.chunks = new Map();
    }

    isClear(bounds) {
        return !this.segments.some(({ from, to }) => segmentIntersectsRect(from, to, bounds, FOREST_RULES.pathClearance))
            && !this.clearings.some(rect => intersectsRect(rect, bounds));
    }

    #chunk(cx, cy) {
        const key = `${cx},${cy}`;
        let chunk = this.chunks.get(key);
        if (chunk) { this.chunks.delete(key); this.chunks.set(key, chunk); return chunk; }
        chunk = { trees: [], ground: [] };
        const { cellSize, chunkCells, minSize, maxSize, maxLean } = FOREST_RULES;
        for (let row = 0; row < chunkCells; row++) for (let column = 0; column < chunkCells; column++) {
            const gx = cx * chunkCells + column, gy = cy * chunkCells + row;
            const random = salt => randomAt(gx, gy, this.seed + salt);
            const x = (gx + 0.1 + random(1) * 0.8) * cellSize;
            const y = (gy + 0.1 + random(2) * 0.8) * cellSize;
            chunk.ground.push({ x, y, width: 3 + random(8) * 10, height: 2 + random(9) * 5, shade: random(10) });
            // Occasional small gaps and denser groves avoid a planted-grid look.
            const density = 0.79 + randomAt(Math.floor(gx / 5), Math.floor(gy / 5), this.seed) * 0.2;
            if (random(0) > density) continue;
            const shade = 0.78 + random(7) * 0.22;
            const tree = { id: key + ':' + row + ':' + column, x, y,
                size: minSize + random(3) * (maxSize - minSize), design: Math.floor(random(4) * 3),
                flipX: random(5) < 0.5, rotation: (random(6) * 2 - 1) * maxLean,
                tint: [shade, Math.min(1, shade + 0.035), shade * 0.91, 1] };
            tree.bounds = treeBounds(tree);
            if (this.isClear(tree.bounds)) chunk.trees.push(tree);
        }
        this.chunks.set(key, chunk);
        if (this.chunks.size > FOREST_RULES.maxCachedChunks) this.chunks.delete(this.chunks.keys().next().value);
        return chunk;
    }

    visible(bounds) {
        const size = FOREST_RULES.cellSize * FOREST_RULES.chunkCells;
        const margin = FOREST_RULES.maxSize * 1.2;
        const trees = [], ground = [];
        for (let cy = Math.floor((bounds.y - margin) / size); cy <= Math.floor((bounds.y + bounds.height + margin) / size); cy++) {
            for (let cx = Math.floor((bounds.x - margin) / size); cx <= Math.floor((bounds.x + bounds.width + margin) / size); cx++) {
                const chunk = this.#chunk(cx, cy);
                trees.push(...chunk.trees.filter(tree => intersectsRect(bounds, tree.bounds)));
                ground.push(...chunk.ground.filter(detail => intersectsRect(bounds, { ...detail, width: 16, height: 8 })));
            }
        }
        trees.sort((a, b) => a.y - b.y || a.x - b.x);
        return { trees, ground };
    }
}
