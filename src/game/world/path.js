import { identifier, point } from '../validation.js';

//caminho dos inimigos
export class Path {
    constructor({ id, waypoints }) {
        this.id = identifier(id, 'path id');
        if (!Array.isArray(waypoints) || waypoints.length < 2) {
            throw new TypeError('A path needs a spawn point and at least one destination.');
        }
        this.waypoints = Object.freeze(waypoints.map(waypoint => Object.freeze({
            ...point(waypoint),
            targetId: waypoint.targetId == null ? null : identifier(waypoint.targetId, 'targetId'),
        })));
        if (this.waypoints[0].targetId !== null) {
            throw new Error('The spawn waypoint cannot contain an attack target.');
        }
        Object.freeze(this);
    }
}
