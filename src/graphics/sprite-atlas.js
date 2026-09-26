
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
        image.src = String(url);
    });
}


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

export async function loadSpriteAtlas(url, { columns = 1, rows = 1, crossOrigin = 'anonymous' } = {}) {
    return createSpriteAtlas(await loadImage(url, { crossOrigin }), { columns, rows });
}

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

export function getSpriteRegionUV(atlas, { x, y, width, height }) {
    if (!atlas?.image) throw new TypeError('A sprite region needs a loaded atlas.');
    if (![x, y, width, height].every(Number.isInteger) || x < 0 || y < 0
        || width <= 0 || height <= 0 || x + width > atlas.width || y + height > atlas.height) {
        throw new RangeError('A sprite region must be a positive whole-pixel rectangle inside its atlas.');
    }
    return {
        u0: (x + 0.5) / atlas.width, v0: (y + 0.5) / atlas.height,
        u1: (x + width - 0.5) / atlas.width, v1: (y + height - 0.5) / atlas.height,
    };
}
