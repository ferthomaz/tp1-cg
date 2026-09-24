import { GAME_RULES, EPSILON, TOWER_ELEMENTS, UPGRADE_WORK_SECONDS } from '../rules.js';

export class HeroSystem {
    request(game, action, buildingId, element = null) {
        if (game.state !== 'running') return { ok: false, reason: 'game-not-running' };
        const hero = game.hero;
        if (!hero.alive) return { ok: false, reason: 'hero-dead' };
        if (!hero.ready) return { ok: false, reason: 'hero-busy' };
        const building = game.map.structures.get(buildingId);
        if (!building || (action === 'reconstruct' ? building.alive || building.kind === 'city' : !building.alive)) {
            return { ok: false, reason: 'invalid-building' };
        }
        if (action === 'upgrade') {
            if (!building.canUpgrade) return { ok: false, reason: 'max-level' };
            const needsElement = building.kind === 'tower' && building.nextUpgradeTier === GAME_RULES.towerMaxUpgradeTier;
            if (needsElement && !TOWER_ELEMENTS.includes(element)) {
                return { ok: false, reason: element === null ? 'element-required' : 'invalid-element' };
            }
            if (!needsElement && element !== null) return { ok: false, reason: 'invalid-element' };
        }
        if (action === 'repair' && building.hp >= building.maxHp) return { ok: false, reason: 'full-health' };
        const wallRepair = building.kind === 'wall' && action !== 'upgrade';
        const rate = wallRepair ? GAME_RULES.wallRepairRate : GAME_RULES.heroRepairRate;
        const workTime = action === 'upgrade' ? UPGRADE_WORK_SECONDS[building.nextUpgradeTier - 1]
            : (action === 'reconstruct' ? building.baseMaxHp : building.maxHp - building.hp) / rate;
        hero.job = { action, buildingId, element, tier: action === 'upgrade' ? building.nextUpgradeTier : null,
            destination: { ...building.position }, stage: 'travel', stageRemaining: 0,
            startTime: wallRepair ? GAME_RULES.wallRepairStartTime : GAME_RULES.heroStartTime,
            finishTime: wallRepair ? 0 : GAME_RULES.heroFinishTime,
            workTime, workRemaining: workTime, rate };
        game.events.emit('hero:action-started', { buildingId, action, workTime });
        return { ok: true, buildingId, action, tier: hero.job.tier, workTime,
            startTime: hero.job.startTime, finishTime: hero.job.finishTime };
    }

    cancel(game, reason) {
        // Cancellation may happen between ticks (for example, when the hero dies).
        game.hero.motion.stop();
        const job = game.hero.job;
        if (!job) return;
        const building = game.map.structures.get(job.buildingId);
        if (building) building.work = null;
        game.hero.job = null;
        game.events.emit('hero:action-cancelled', { buildingId: job.buildingId, action: job.action, reason });
    }

    update(game, deltaTime) {
        const hero = game.hero;
        const from = { ...hero.position };
        const wasAlive = hero.alive;
        this.#advanceJob(game, deltaTime);
        // Work phases are stationary. Respawning teleports home and is not a walk.
        if (wasAlive && hero.alive) hero.motion.update(from, hero.position, deltaTime);
        if (!wasAlive || !hero.alive || hero.job?.stage !== 'travel') hero.motion.stop();
    }

    #advanceJob(game, deltaTime) {
        const hero = game.hero;
        if (!hero.alive) {
            if (hero.respawnAt !== null && game.elapsed + EPSILON >= hero.respawnAt) {
                hero.hp = hero.maxHp;
                hero.position = { ...hero.homePosition };
                hero.respawnAt = null;
                game.events.emit('hero:respawned', hero.snapshot(game.elapsed));
            }
            return;
        }
        const job = hero.job;
        if (!job) return;
        const building = game.map.structures.get(job.buildingId);
        if (!building || (job.action === 'reconstruct' ? building.alive : !building.alive)) {
            this.cancel(game, 'target-unavailable');
            return;
        }
        if (job.action === 'repair' && ['travel', 'starting'].includes(job.stage)) {
            job.workRemaining = (building.maxHp - building.hp) / job.rate;
            job.workTime = job.workRemaining;
        }
        let time = deltaTime;
        // Consume leftover time across phase boundaries so different frame
        // partitions produce the same travel, healing, and completion times.
        while (hero.job && time >= 0) {
            if (job.stage === 'travel') {
                const dx = job.destination.x - hero.position.x;
                const dy = job.destination.y - hero.position.y;
                const distance = Math.hypot(dx, dy);
                if (distance > hero.speed * time + EPSILON) {
                    if (hero.speed > 0) {
                        hero.position.x += dx / distance * hero.speed * time;
                        hero.position.y += dy / distance * hero.speed * time;
                    }
                    return;
                }
                if (distance > EPSILON) time = Math.max(0, time - distance / hero.speed);
                hero.position = { ...job.destination };
                job.stage = 'starting';
                job.stageRemaining = job.startTime;
            } else if (job.stage === 'working') {
                if (job.action === 'repair') job.workRemaining = (building.maxHp - building.hp) / job.rate;
                const spent = Math.min(time, job.workRemaining);
                if (job.action === 'repair') building.hp = Math.min(building.maxHp, building.hp + spent * job.rate);
                job.workRemaining = Math.max(0, job.workRemaining - spent);
                time = Math.max(0, time - spent);
                if (job.workRemaining > EPSILON) break;
                job.workRemaining = 0;
                if (job.action === 'repair') building.hp = building.maxHp;
                job.stage = 'finishing';
                job.stageRemaining = job.finishTime;
            } else {
                const spent = Math.min(time, job.stageRemaining);
                job.stageRemaining = Math.max(0, job.stageRemaining - spent);
                time = Math.max(0, time - spent);
                if (job.stageRemaining > EPSILON) break;
                job.stageRemaining = 0;
                if (job.stage === 'starting') job.stage = 'working';
                else { this.#complete(game, building, job); return; }
            }
            building.work = { action: job.action, stage: job.stage };
            if (time <= EPSILON && (job.stage === 'working' ? job.workRemaining > EPSILON : job.stageRemaining > EPSILON)) break;
        }
        if (hero.job) building.work = { action: job.action, stage: job.stage };
    }

    #complete(game, building, job) {
        building.work = null;
        game.hero.job = null;
        if (job.action === 'upgrade') {
            building.upgrade(job.element);
            game.events.emit('building:upgraded', { buildingId: building.id, ...building.snapshot() });
            if (building.kind === 'tower') game.events.emit('tower:upgraded', {
                towerId: building.id, level: building.level, damage: building.damage, element: building.element, range: building.range,
            });
        } else if (job.action === 'reconstruct') {
            building = game.map.reconstruct(building.id);
            game.events.emit('building:reconstructed', { buildingId: building.id, ...building.snapshot() });
        } else game.events.emit('building:repaired', { buildingId: building.id, hp: building.hp });
        game.events.emit('hero:action-completed', { buildingId: building.id, action: job.action });
    }
}
