import { EPSILON, GAME_RULES } from '../rules.js';
import { number, uniqueIndex } from '../validation.js';

// Each castle has one quota shared by all its outgoing paths. Only the current
// wave is stored; the next wave begins after every spawn and every kill finishes.
export class WaveSystem {
    constructor({ castles, initialCount = 10, increasePerWave = 5, spawnInterval = 1 }, enemyTypes, paths, random) {
        for (const [name, value] of Object.entries({ initialCount, increasePerWave })) {
            if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError(`${name} must be a positive integer.`);
        }
        number(spawnInterval, 'wave spawnInterval', 0, true);
        if (typeof random !== 'function') throw new TypeError('random must be a function.');
        this.castles = [...uniqueIndex(castles, 'spawn castle').values()].map(castle => {
            if (!enemyTypes.has(castle.enemyTypeId)) throw new Error(`Unknown enemy type: ${castle.enemyTypeId}`);
            if (!castle.pathIds?.length) throw new Error(`Castle ${castle.id} needs spawn paths.`);
            let origin;
            for (const pathId of castle.pathIds) {
                const path = paths.get(pathId);
                if (!path) throw new Error(`Unknown spawn path: ${pathId}`);
                const first = path.waypoints[0];
                if (origin && (first.x !== origin.x || first.y !== origin.y)) throw new Error('Castle paths must share one spawn position.');
                origin = first;
            }
            return { ...castle, pathIds: [...castle.pathIds] };
        });
        if (!this.castles.length) throw new Error('Waves need at least one castle.');
        Object.assign(this, { initialCount, increasePerWave, spawnInterval, random });
        this.number = 0;
        this.spawnedPerCastle = 0;
        this.startedAt = 0;
        this.phase = 'idle';
        this.preparationEndsAt = null;
    }

    update(elapsed, spawn, aliveCount, events) {
        if (this.number === 0 || (this.phase === 'combat' && this.pending === 0 && aliveCount === 0)) {
            if (this.number > 0) events.emit('wave:completed', { number: this.number });
            this.number++;
            this.phase = 'preparation';
            this.preparationEndsAt = elapsed + (this.number === 1 ? 0 : GAME_RULES.wavePreparationTime);
            this.spawnedPerCastle = 0;
            events.emit('wave:preparing', this.snapshot(elapsed));
        }
        if (this.phase === 'preparation') {
            if (elapsed + EPSILON < this.preparationEndsAt) return;
            this.phase = 'combat';
            this.startedAt = elapsed;
            this.preparationEndsAt = null;
            events.emit('wave:started', this.snapshot(elapsed));
        }
        while (this.spawnedPerCastle < this.enemiesPerCastle
            && this.startedAt + this.spawnedPerCastle * this.spawnInterval <= elapsed + EPSILON) {
            for (const castle of this.castles) {
                const roll = this.random();
                if (!Number.isFinite(roll) || roll < 0 || roll >= 1) throw new Error('random() must return a number in [0, 1).');
                spawn({ enemyTypeId: castle.enemyTypeId, pathId: castle.pathIds[Math.floor(roll * castle.pathIds.length)] });
            }
            this.spawnedPerCastle++;
        }
    }

    get enemiesPerCastle() { return this.initialCount + Math.max(0, this.number - 1) * this.increasePerWave; }
    get pending() { return this.number === 0 ? 0 : (this.enemiesPerCastle - this.spawnedPerCastle) * this.castles.length; }
    get complete() { return false; }


    snapshot(elapsed = 0) {
        return { number: this.number, enemiesPerCastle: this.enemiesPerCastle,
            total: this.enemiesPerCastle * this.castles.length, pending: this.pending,
            phase: this.phase, preparationRemaining: this.preparationEndsAt === null ? 0 : Math.max(0, this.preparationEndsAt - elapsed) };
    }
}
