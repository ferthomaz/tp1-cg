// The reference sketch on a 32-world-unit grid. Blue lines are enemy lanes;
// the orange outline is the central wall ring, with four towers and a castle inside.
export const MAP_TILE_SIZE = 32;

function wall(id, x, y, variant) {
    return { id, maxHp: 30, position: { x, y }, variant };
}

function wallRun(id, from, to, variant) {
    const count = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y)) / MAP_TILE_SIZE;
    const dx = Math.sign(to.x - from.x) * MAP_TILE_SIZE;
    const dy = Math.sign(to.y - from.y) * MAP_TILE_SIZE;
    return Array.from({ length: count + 1 }, (_, index) =>
        wall(`${id}-${index}`, from.x + index * dx, from.y + index * dy, variant));
}

function wallRing(id, left, top, right, bottom) {
    const tiles = [
        wall(`wall-${id}-nw`, left, top, 'top-left'),
        wall(`wall-${id}-ne`, right, top, 'top-right'),
        wall(`wall-${id}-sw`, left, bottom, 'bottom-left'),
        wall(`wall-${id}-se`, right, bottom, 'bottom-right'),
        ...wallRun(`wall-${id}-north`, { x: left + MAP_TILE_SIZE, y: top }, { x: right - MAP_TILE_SIZE, y: top }, 'horizontal'),
        ...wallRun(`wall-${id}-south`, { x: left + MAP_TILE_SIZE, y: bottom }, { x: right - MAP_TILE_SIZE, y: bottom }, 'horizontal'),
        ...wallRun(`wall-${id}-west`, { x: left, y: top + MAP_TILE_SIZE }, { x: left, y: bottom - MAP_TILE_SIZE }, 'vertical'),
        ...wallRun(`wall-${id}-east`, { x: right, y: top + MAP_TILE_SIZE }, { x: right, y: bottom - MAP_TILE_SIZE }, 'vertical'),
    ];
    // Each approach attacks a real tile of the ring; no visual-only gate overlay.
    for (const [side, x, y] of [
        ['north', 512, top], ['south', 512, bottom], ['west', left, 288], ['east', right, 288],
    ]) tiles.find(item => item.position.x === x && item.position.y === y).id = `wall-${id}-${side}`;
    return tiles;
}

const walls = wallRing('outer', 320, 128, 704, 448);

const tower = (id, x, y) => ({
    id, maxHp: 20, position: { x, y },
    baseDamage: 2, damagePerLevel: 1, range: 90, attackInterval: 1, arrowSpeed: 150,
});

const approaches = {
    north: [
        { x: 512, y: 0 },
        { x: 512, y: 96, targetId: 'wall-outer-north' },
        { x: 512, y: 152, targetId: 'tower-1' },
        { x: 512, y: 256, targetId: 'city' },
    ],
    south: [
        { x: 512, y: 576 },
        { x: 512, y: 480, targetId: 'wall-outer-south' },
        { x: 512, y: 424, targetId: 'tower-2' },
        { x: 512, y: 320, targetId: 'city' },
    ],
    west: [
        { x: 0, y: 288 },
        { x: 288, y: 288, targetId: 'wall-outer-west' },
        { x: 360, y: 288, targetId: 'tower-3' },
        { x: 480, y: 288, targetId: 'city' },
    ],
    east: [
        { x: 1024, y: 288 },
        { x: 736, y: 288, targetId: 'wall-outer-east' },
        { x: 664, y: 288, targetId: 'tower-4' },
        { x: 544, y: 288, targetId: 'city' },
    ],
};

const corners = [
    { id: 'nw', x: 0, y: 0, sides: ['north', 'west'] },
    { id: 'ne', x: 1024, y: 0, sides: ['east', 'north'] },
    { id: 'se', x: 1024, y: 576, sides: ['south', 'east'] },
    { id: 'sw', x: 0, y: 576, sides: ['west', 'south'] },
];

export const fortressMap = {
    city: { id: 'city', maxHp: 100, position: { x: 512, y: 288 } },
    hero: { position: { x: 640, y: 400 } },
    walls,
    towers: [tower('tower-1', 512, 176), tower('tower-2', 512, 400),
        tower('tower-3', 384, 288), tower('tower-4', 640, 288)],
    paths: corners.flatMap(corner => corner.sides.map(side => ({
        id: `${corner.id}-${side}`,
        waypoints: [{ x: corner.x, y: corner.y }, ...approaches[side].map(point => ({ ...point }))],
    }))),
};

export const fortressWaves = {
    initialCount: 10,
    increasePerWave: 5,
    spawnInterval: 1,
    castles: corners.map(corner => ({
        id: corner.id, enemyTypeId: 'example-enemy',
        pathIds: corner.sides.map(side => `${corner.id}-${side}`),
    })),
};
