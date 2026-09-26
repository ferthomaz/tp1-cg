// Canvas coordinates, without any WebGL calls.

export function resizeCanvas(canvas, pixelRatio = globalThis.devicePixelRatio || 1, maxPixelRatio = 2) {
    if (!Number.isFinite(pixelRatio) || pixelRatio <= 0) throw new RangeError('pixelRatio must be positive and finite.');
    if (!Number.isFinite(maxPixelRatio) || maxPixelRatio < 1) throw new RangeError('maxPixelRatio must be at least 1.');
    const bounds = canvas.getBoundingClientRect();
    // A hidden canvas has a zero-size box. Keep the GPU buffer valid until shown.
    const width = Math.max(1, bounds.width);
    const height = Math.max(1, bounds.height);
    const ratio = Math.max(1, Math.min(maxPixelRatio, pixelRatio));
    const bufferWidth = Math.max(1, Math.round(width * ratio));
    const bufferHeight = Math.max(1, Math.round(height * ratio));
    if (canvas.width !== bufferWidth) canvas.width = bufferWidth;
    if (canvas.height !== bufferHeight) canvas.height = bufferHeight;
    return { width, height, pixelRatio: ratio };
}


export function clientToCanvas(canvas, clientX, clientY, width, height) {
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return null;
    return {
        x: (clientX - bounds.left) * width / bounds.width,
        y: (clientY - bounds.top) * height / bounds.height,
    };
}

export function intersectRects(a, b) {
    const x = Math.max(a.x, b.x);
    const y = Math.max(a.y, b.y);
    return { x, y,
        width: Math.max(0, Math.min(a.x + a.width, b.x + b.width) - x),
        height: Math.max(0, Math.min(a.y + a.height, b.y + b.height) - y) };
}

export function toScissorRect(rect, width, height, bufferWidth, bufferHeight) {
    const sx = bufferWidth / width;
    const sy = bufferHeight / height;
    const clamp = (value, max) => Math.max(0, Math.min(max, value));
    const left = Math.round(clamp(rect.x, width) * sx);
    const right = Math.round(clamp(rect.x + Math.max(0, rect.width), width) * sx);
    const top = Math.round(clamp(rect.y, height) * sy);
    const bottom = Math.round(clamp(rect.y + Math.max(0, rect.height), height) * sy);
    return { x: left, y: bufferHeight - bottom, width: right - left, height: bottom - top };
}
