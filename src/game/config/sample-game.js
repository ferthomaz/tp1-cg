import { Game } from '../game.js';
import { fortressMap, fortressWaves } from './fortress-map.js';

// The playable map follows the reference sketch. Enemy balance is provisional.
export const sampleMap = fortressMap;

export const sampleEnemyTypes = [{
    id: 'example-enemy', maxHp: 10, speed: 10, damage: 2, attackInterval: 1,
}];


export const sampleWaves = fortressWaves;

export function createSampleGame(options = {}) {
    return new Game({
        map: sampleMap, enemyTypes: sampleEnemyTypes,
        // Explicit schedules remain available for isolated scenarios and tests.
        waves: options.spawnSchedule === undefined ? sampleWaves : null, ...options,
    });
}
