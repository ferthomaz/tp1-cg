//um vbo como professor disse
export const QUAD_VERTICES = new Float32Array([
    0, 0, 0, 0,
    1, 0, 1, 0,
    1, 1, 1, 1,
    0, 1, 0, 1,
]);

export function spriteCorners(x, y, width, height, rotation, originX = 0.5, originY = 0.5) {
    const px = x + width * originX, py = y + height * originY;
    const c = Math.cos(rotation), s = Math.sin(rotation);
    return [[x, y], [x + width, y], [x, y + height], [x + width, y + height]].map(([cx, cy]) =>
        ({ x: px + (cx - px) * c - (cy - py) * s, y: py + (cx - px) * s + (cy - py) * c }));
}


