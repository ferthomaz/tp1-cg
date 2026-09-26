/** Column-major mat4 matrices, as expected by uniformMatrix4fv. */
export function projection(width, height) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        throw new RangeError('Projection dimensions must be positive and finite.');
    }
    // Orthographic projection: screen (0,0) is clip (-1,+1).
    return new Float32Array([
        2 / width, 0, 0, 0,
        0, -2 / height, 0, 0,
        0, 0, 1, 0,
        -1, 1, 0, 1,
    ]);
}

/** T(position + pivot) * R(rotation) * S(size) * T(-normalized pivot).
 * Maps the shared unit square [0,1] to a sprite in screen coordinates.
 */
export function model(x = 0, y = 0, width = 1, height = 1, rotation = 0, originX = 0.5, originY = 0.5) {
    const c = Math.cos(rotation), s = Math.sin(rotation);
    const a = c * width, b = s * width, d = -s * height, e = c * height;
    return new Float32Array([
        a, b, 0, 0,
        d, e, 0, 0,
        0, 0, 1, 0,
        x + width * originX - a * originX - d * originY,
        y + height * originY - b * originX - e * originY, 0, 1,
    ]);
}
