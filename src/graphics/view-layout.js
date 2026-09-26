export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export function createLayout() {
    return {
        width: GAME_WIDTH, height: GAME_HEIGHT,
        world: { x: 0, y: 0, width: GAME_WIDTH, height: GAME_HEIGHT },
        hud: { x: 16, y: 16, width: 360, height: 64 },
    };
}

/** Fit the map in the fixed game area. Moving entities never change its center or scale. */
export function createCamera(snapshot, viewport) {
    const points = [...snapshot.structures.map(item => item.position), ...snapshot.paths.flatMap(path => path.waypoints)];
    if (snapshot.hero) points.push(snapshot.hero.homePosition ?? snapshot.hero.position);
    const minX = Math.min(...points.map(point => point.x)) - 35;
    const maxX = Math.max(...points.map(point => point.x)) + 35;
    const minY = Math.min(...points.map(point => point.y)) - 48;
    const maxY = Math.max(...points.map(point => point.y)) + 48;
    // Reserve vertical breathing room for the health HUD while drawing the
    // forest across the whole screen. No input can shift this fitted projection.
    const scale = Math.max(0.01, Math.min(Math.max(1, viewport.width - 24) / (maxX - minX),
        Math.max(1, viewport.height - 100) / (maxY - minY)));
    const offsetX = viewport.x + viewport.width / 2 - (minX + maxX) / 2 * scale;
    const offsetY = viewport.y + viewport.height / 2 - (minY + maxY) / 2 * scale;
    return {
        scale,
        project: point => ({ x: offsetX + point.x * scale, y: offsetY + point.y * scale }),
        unproject: point => ({ x: (point.x - offsetX) / scale, y: (point.y - offsetY) / scale }),
    };
}

// Routes can share a castle and an inward approach. Draw each only once.
export function createRouteGeometry(paths) {
    const entries = new Map();
    const segments = new Map();
    for (const path of paths) {
        const first = path.waypoints[0];
        entries.set(`${first.x},${first.y}`, first);
        for (let index = 1; index < path.waypoints.length; index++) {
            const from = path.waypoints[index - 1];
            const to = path.waypoints[index];
            if (from.x === to.x && from.y === to.y) continue;
            segments.set(`${from.x},${from.y}>${to.x},${to.y}`, { from, to });
        }
    }
    return { entries: [...entries.values()], segments: [...segments.values()] };
}

export function contains(rect, point) {
    return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}

export function pickTarget(targets, point) {
    return [...targets].reverse().find(target => contains(target, point)) ?? null;
}

export function clockLabel(seconds) {
    const rounded = Math.max(0, Math.floor(seconds));
    return `${String(Math.floor(rounded / 60)).padStart(2, '0')}:${String(rounded % 60).padStart(2, '0')}`;
}
