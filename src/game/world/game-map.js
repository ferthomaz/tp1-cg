import { City, Wall, Tower } from '../entities/structures.js';
import { Path } from './path.js';
import { uniqueIndex } from '../validation.js';

export class GameMap {
    constructor({ city, walls = [], towers = [], paths }) {
        this.city = new City(city);
        this.structures = uniqueIndex([
            this.city, ...walls.map(wall => new Wall(wall)), ...towers.map(tower => new Tower(tower)),
        ], 'structure');
        this.buildingDefinitions = new Map([...walls, ...towers].map(definition => [definition.id, structuredClone(definition)]));
        this.paths = uniqueIndex(paths.map(path => new Path(path)), 'path');
        if (this.paths.size === 0) throw new Error('A map needs at least one explicit path.');
        for (const path of this.paths.values()) {
            for (const waypoint of path.waypoints) {
                if (waypoint.targetId && !this.structures.has(waypoint.targetId)) {
                    throw new Error(`Unknown structure ${waypoint.targetId} in path ${path.id}.`);
                }
            }
            if (path.waypoints.at(-1).targetId !== this.city.id) {
                throw new Error(`Path ${path.id} must finish at the city.`);
            }
            if (path.waypoints.slice(0, -1).some(waypoint => waypoint.targetId === this.city.id)) {
                throw new Error('The city must be the final attack target.');
            }
        }
    }

    get towers() { return [...this.structures.values()].filter(structure => structure.kind === 'tower'); }

    reconstruct(id) {
        const old = this.structures.get(id);
        const definition = this.buildingDefinitions.get(id);
        if (!definition || old.alive) return null;
        const building = old.kind === 'tower' ? new Tower(definition) : new Wall(definition);
        this.structures.set(id, building);
        return building;
    }

    snapshot() {
        return {
            structures: [...this.structures.values()].map(structure => structure.snapshot()),
            paths: [...this.paths.values()].map(path => ({
                id: path.id, waypoints: path.waypoints.map(waypoint => ({ ...waypoint })),
            })),
        };
    }
}
