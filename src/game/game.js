import { EventBus } from '../core/event-bus.js';
import { GameMap } from './world/game-map.js';
import { Enemy } from './entities/enemy.js';
import { Arrow } from './entities/arrow.js';
import { Hero } from './entities/hero.js';
import { HeroSystem } from './systems/hero-system.js';
import { SpawnSystem } from './systems/spawn-system.js';
import { WaveSystem } from './systems/wave-system.js';
import { EnemySystem } from './systems/enemy-system.js';
import { TowerSystem } from './systems/tower-system.js';
import { GAME_RULES, EPSILON } from './rules.js';
import { uniqueIndex, number } from './validation.js';

//controla logica central
export class Game {
    constructor({ map, enemyTypes, spawnSchedule = [], waves = null, random = Math.random }) {
        this.configuration = {
            map: structuredClone(map),
            enemyTypes: enemyTypes.map(type => ({ ...type })),
            spawnSchedule: spawnSchedule.map(entry => ({ ...entry })),
            waves: waves ? structuredClone(waves) : null,
            random,
        };
        this.events = new EventBus();
        this.enemySystem = new EnemySystem();
        this.towerSystem = new TowerSystem();
        this.heroSystem = new HeroSystem();
        this.reset();
    }

    reset() {
        this.map = new GameMap(this.configuration.map);
        this.hero = new Hero(this.configuration.map.hero ?? {
            position: { x: this.map.city.position.x, y: this.map.city.position.y + 64 },
        }, this.configuration.enemyTypes[0]?.speed ?? 10);
        this.enemyTypes = uniqueIndex(this.configuration.enemyTypes, 'enemy type');
        for (const type of this.enemyTypes.values()) {
            number(type.maxHp, 'enemy maxHp', 0, true);
            number(type.speed, 'enemy speed');
            number(type.damage, 'enemy damage');
            number(type.attackInterval, 'enemy attackInterval', 0, true);
        }
        this.enemies = new Map();
        this.arrows = new Map();
        this.spawns = this.configuration.waves
            ? new WaveSystem(this.configuration.waves, this.enemyTypes, this.map.paths, this.configuration.random)
            : new SpawnSystem(this.configuration.spawnSchedule, this.enemyTypes, this.map.paths);
        this.elapsed = 0;
        this.tick = 0;
        this.accumulator = 0;
        this.nextEnemyId = 1;
        this.nextArrowId = 1;
        this.#setState('idle');
    }

    start() {
        if (this.state !== 'idle') return false;
        this.#setState('running');
        this.#spawnDue();
        return true;
    }

    restart() {
        this.reset();
        this.start();
    }

    pause() {
        if (this.state !== 'running') return false;
        this.#setState('paused');
        return true;
    }

    resume() {
        if (this.state !== 'paused') return false;
        this.#setState('running');
        return true;
    }

    update(deltaTime) {
        number(deltaTime, 'deltaTime');
        if (this.state !== 'running') return;
        this.accumulator += deltaTime;
        while (this.accumulator + EPSILON >= GAME_RULES.fixedStep && this.state === 'running') {
            this.accumulator = Math.max(0, this.accumulator - GAME_RULES.fixedStep);
            this.tick += 1;
            this.elapsed = this.tick * GAME_RULES.fixedStep;
            this.#spawnDue();
            this.heroSystem.update(this, GAME_RULES.fixedStep);
            this.enemySystem.update(this, GAME_RULES.fixedStep);
            if (this.state === 'running') this.towerSystem.update(this, GAME_RULES.fixedStep);
        }
    }

    #spawnDue() {
        this.spawns.update(this.elapsed, entry => {
            const enemy = new Enemy({
                id: `enemy-${this.nextEnemyId++}`,
                type: this.enemyTypes.get(entry.enemyTypeId),
                path: this.map.paths.get(entry.pathId),
            });
            this.enemies.set(enemy.id, enemy);
            this.events.emit('enemy:spawned', enemy.snapshot());
        }, this.enemies.size, this.events);
    }

    clickEnemy(enemyId) {
        if (this.state !== 'running') return { ok: false, reason: 'game-not-running' };
        if (!this.enemies.get(enemyId)?.alive) return { ok: false, reason: 'invalid-target' };
        return { ok: true, damage: this.damageEnemy(enemyId, GAME_RULES.clickDamage, 'player-click') };
    }

    upgradeBuilding(buildingId, element = null) {
        return this.heroSystem.request(this, 'upgrade', buildingId, element);
    }

    upgradeTower(towerId, element = null) {
        if (this.state !== 'running') return { ok: false, reason: 'game-not-running' };
        if (this.map.structures.get(towerId)?.kind !== 'tower') return { ok: false, reason: 'invalid-tower' };
        return this.upgradeBuilding(towerId, element);
    }

    reconstructBuilding(buildingId) {
        return this.heroSystem.request(this, 'reconstruct', buildingId);
    }

    repairBuilding(buildingId) {
        return this.heroSystem.request(this, 'repair', buildingId);
    }


    damageHero(amount, sourceId = null) {
        number(amount, 'damage');
        if (this.state !== 'running' || !this.hero.alive) return 0;
        const applied = this.hero.takeDamage(amount);
        if (!this.hero.alive) {
            this.heroSystem.cancel(this, 'hero-died');
            this.hero.respawnAt = this.elapsed + GAME_RULES.heroRespawnTime;
        }
        this.events.emit('hero:damaged', { sourceId, damage: applied, hp: this.hero.hp });
        if (!this.hero.alive) this.events.emit('hero:died', { sourceId, respawnTime: GAME_RULES.heroRespawnTime });
        return applied;
    }


    damageEnemy(enemyId, amount, sourceId = null) {
        number(amount, 'damage');
        const enemy = this.enemies.get(enemyId);
        if (this.state !== 'running' || !enemy?.alive) return 0;
        const applied = enemy.takeDamage(amount);
        if (!enemy.alive) this.enemies.delete(enemyId);
        this.events.emit('enemy:damaged', { enemyId, sourceId, damage: applied, hp: enemy.hp });
        if (!enemy.alive) this.events.emit('enemy:defeated', { enemyId, sourceId });
        return applied;
    }

    damageStructure(structureId, amount, sourceId = null) {
        number(amount, 'damage');
        const structure = this.map.structures.get(structureId);
        if (this.state !== 'running' || !structure?.alive) return 0;
        const applied = structure.takeDamage(amount);
        const destroyed = !structure.alive;
        const cityDestroyed = destroyed && structure.kind === 'city';
        if (destroyed && (this.hero.job?.buildingId === structureId || cityDestroyed)) this.heroSystem.cancel(this, 'building-destroyed');
        if (cityDestroyed) this.#setState('game-over');
        this.events.emit('structure:damaged', { structureId, sourceId, damage: applied, hp: structure.hp });
        if (destroyed) this.events.emit('structure:destroyed', { structureId, kind: structure.kind });
        if (cityDestroyed) this.events.emit('game:over', { reason: 'city-destroyed', elapsed: this.elapsed });
        return applied;
    }

    fireArrow(tower, target) {
        const arrow = new Arrow({
            id: `arrow-${this.nextArrowId++}`, sourceId: tower.id, targetId: target.id,
            position: tower.position, damage: tower.damage, speed: tower.arrowSpeed,
        });
        this.arrows.set(arrow.id, arrow);
        this.events.emit('arrow:fired', arrow.snapshot());
    }

    #setState(state) {
        this.state = state;
        this.events.emit('game:state', { state });
    }

    getSnapshot() {
        return {
            state: this.state, elapsed: this.elapsed,
            hero: this.hero.snapshot(this.elapsed),
            ...this.map.snapshot(),
            enemies: [...this.enemies.values()].map(enemy => enemy.snapshot()),
            arrows: [...this.arrows.values()].map(arrow => arrow.snapshot()),
            spawnScheduleComplete: this.spawns.complete,
            wave: this.configuration.waves ? this.spawns.snapshot(this.elapsed) : null,
        };
    }
}
