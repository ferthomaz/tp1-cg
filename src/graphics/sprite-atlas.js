/**
 * A sprite atlas is ONE image containing a rectangular grid of smaller images.
 * This file knows about images and grid coordinates, but NEVER touches WebGL.
 * Retain the returned atlas: its decoded image can be uploaded again after a
 * WebGL context restoration, without another download.
 */

/** Load a browser image; cross-origin servers must allow CORS. */
export function loadImage(url, { crossOrigin = 'anonymous' } = {}) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        if (crossOrigin !== null) image.crossOrigin = crossOrigin;
        const cleanup = () => { image.onload = null; image.onerror = null; };
        image.onload = () => { cleanup(); resolve(image); };
        image.onerror = () => {
            cleanup();
            reject(new Error(`Cannot load image "${url}". Check its path, serve the project over HTTP, and check CORS for remote images.`));
        };
        // Register the handlers BEFORE assigning src: cached images can load fast.
        image.src = String(url);
    });
}

/**
 * Describe an already loaded image. Columns/rows are counts, not last indices.
 * Example: createSpriteAtlas(image, { columns: 8, rows: 4 }).
 * A normal, non-grid image is simply an atlas with one column and one row.
 */
export function createSpriteAtlas(image, { columns = 1, rows = 1 } = {}) {
    const width = image?.naturalWidth ?? image?.width;
    const height = image?.naturalHeight ?? image?.height;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
        throw new Error('An atlas needs a loaded image with positive integer dimensions.');
    }
    if (![columns, rows].every(value => Number.isInteger(value) && value > 0)) {
        throw new RangeError('Atlas columns and rows must be positive integers.');
    }
    if (width % columns !== 0 || height % rows !== 0) {
        throw new RangeError(`Image ${width}x${height} cannot be divided into a ${columns}x${rows} grid of whole pixels.`);
    }
    return Object.freeze({ image, width, height, columns, rows, tileWidth: width / columns, tileHeight: height / rows });
}

/** The convenient asynchronous alternative to loadImage + createSpriteAtlas. */
export async function loadSpriteAtlas(url, { columns = 1, rows = 1, crossOrigin = 'anonymous' } = {}) {
    return createSpriteAtlas(await loadImage(url, { crossOrigin }), { columns, rows });
}

/** Combine equal-size originals on the GPU, without resizing or editing PNGs. */
export function createSpriteStrip(images) {
    if (!Array.isArray(images) || !images.length) throw new TypeError('A sprite strip needs at least one image.');
    const cells = images.map(image => createSpriteAtlas(image));
    const first = cells[0];
    if (cells.some(cell => cell.width !== first.width || cell.height !== first.height)) {
        throw new RangeError('Sprite strip images must have matching dimensions.');
    }
    return Object.freeze({ ...first, width: first.width * images.length, columns: images.length,
        images: Object.freeze([...images]) });
}

/**
 * Convert a zero-based top-left cell to normalized texture coordinates (UVs).
 * A half-pixel inset preserves the original game's edge sampling and keeps our
 * nearest-filtered samples inside the selected tile, not its neighboring cells.
 * Columns count to the right; rows count downward, just like image pixels.
 */
export function getSpriteUV(atlas, column, row) {
    if (!atlas?.image) throw new TypeError('drawSprite needs an atlas created by createSpriteAtlas/loadSpriteAtlas.');
    if (!Number.isInteger(column) || !Number.isInteger(row)
        || column < 0 || row < 0 || column >= atlas.columns || row >= atlas.rows) {
        throw new RangeError(`Sprite cell (${column}, ${row}) is outside the ${atlas.columns}x${atlas.rows} atlas.`);
    }
    return {
        u0: (column * atlas.tileWidth + 0.5) / atlas.width,
        v0: (row * atlas.tileHeight + 0.5) / atlas.height,
        u1: ((column + 1) * atlas.tileWidth - 0.5) / atlas.width,
        v1: ((row + 1) * atlas.tileHeight - 0.5) / atlas.height,
    };
}

/** Sample a pixel rectangle in an atlas, used to resize UI frames in nine pieces. */
export function getSpriteRegionUV(atlas, { x, y, width, height }) {
    if (!atlas?.image) throw new TypeError('A sprite region needs a loaded atlas.');
    if (![x, y, width, height].every(Number.isInteger) || x < 0 || y < 0
        || width <= 0 || height <= 0 || x + width > atlas.width || y + height > atlas.height) {
        throw new RangeError('A sprite region must be a positive whole-pixel rectangle inside its atlas.');
    }
    // Match grid-cell sampling: the half-pixel inset avoids neighboring artwork.
    return {
        u0: (x + 0.5) / atlas.width, v0: (y + 0.5) / atlas.height,
        u1: (x + width - 0.5) / atlas.width, v1: (y + height - 0.5) / atlas.height,
    };
}
