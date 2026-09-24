import { EPSILON } from '../rules.js';
import { number } from '../validation.js';

export class SpawnSystem {
    constructor(schedule, enemyTypes, paths) {
        this.entries = schedule.map(entry => {
            number(entry.at, 'spawn time');
            if (!enemyTypes.has(entry.enemyTypeId)) throw new Error(`Unknown enemy type: ${entry.enemyTypeId}`);
            if (!paths.has(entry.pathId)) throw new Error(`Unknown spawn path: ${entry.pathId}`);
            return { ...entry };
        }).sort((left, right) => left.at - right.at);
        this.nextIndex = 0;
    }

    update(elapsed, spawn) {
        while (this.nextIndex < this.entries.length && this.entries[this.nextIndex].at <= elapsed + EPSILON) {
            spawn(this.entries[this.nextIndex++]);
        }
    }

    get complete() { return this.nextIndex === this.entries.length; }
}
