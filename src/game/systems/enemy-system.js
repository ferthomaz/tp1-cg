import { EPSILON, GAME_RULES } from '../rules.js';

// Living wall tiles prevent an enemy from acquiring the hero through a wall.
function crossesWall(from, to, wall) {
    let enter = 0; let exit = 1;
    for (const axis of ['x', 'y']) {
        const delta = to[axis] - from[axis];
        const min = wall.position[axis] - 16;
        const max = wall.position[axis] + 16;
        if (Math.abs(delta) <= EPSILON) {
            if (from[axis] < min || from[axis] > max) return false;
        } else {
            const a = (min - from[axis]) / delta;
            const b = (max - from[axis]) / delta;
            enter = Math.max(enter, Math.min(a, b));
            exit = Math.min(exit, Math.max(a, b));
            if (enter > exit) return false;
        }
    }
    return true;
}

export class EnemySystem {
    update(game, deltaTime) {
        for (const enemy of game.enemies.values()) {
            if (!enemy.alive || game.state !== 'running') continue;
            const from = { ...enemy.position };
            enemy.attackCooldown = Math.max(0, enemy.attackCooldown - deltaTime);
            this.#advanceEnemy(game, enemy, deltaTime);
            enemy.motion.update(from, enemy.position, deltaTime);
            // Arrival at a living defense or within melee range ends the walk
            // immediately, even if the enemy covered its last few pixels this tick.
            const atHero = enemy.targetId === game.hero.id
                && Math.hypot(game.hero.position.x - enemy.position.x, game.hero.position.y - enemy.position.y)
                    <= GAME_RULES.enemyHeroAttackRange + EPSILON;
            const atBuilding = enemy.targetId !== game.hero.id && enemy.targetId !== null;
            if (atHero || atBuilding) enemy.motion.stop();
        }
    }

    /** All movement branches share the same displacement/animation bookkeeping. */
    #advanceEnemy(game, enemy, deltaTime) {
        if (this.#focusHero(game, enemy, deltaTime)) return;
        enemy.targetId = null;
        const path = game.map.paths.get(enemy.pathId);
        let travel = enemy.speed * deltaTime;

        while (enemy.waypointIndex < path.waypoints.length) {
            const waypoint = path.waypoints[enemy.waypointIndex];
            const dx = waypoint.x - enemy.position.x;
            const dy = waypoint.y - enemy.position.y;
            const distance = Math.hypot(dx, dy);
            if (distance > travel + EPSILON) {
                enemy.position.x += dx / distance * travel;
                enemy.position.y += dy / distance * travel;
                break;
            }

            enemy.position = { x: waypoint.x, y: waypoint.y };
            travel = Math.max(0, travel - distance);
            const target = game.map.structures.get(waypoint.targetId);
            if (target?.alive) {
                enemy.targetId = target.id;
                if (enemy.attackCooldown <= EPSILON) {
                    enemy.attackCooldown = enemy.attackInterval;
                    game.damageStructure(target.id, enemy.damage, enemy.id);
                }
                // A living defense blocks this path until it is destroyed.
                break;
            }
            enemy.waypointIndex += 1;
        }
    }

    #focusHero(game, enemy, deltaTime) {
        const hero = game.hero;
        const distance = Math.hypot(hero.position.x - enemy.position.x, hero.position.y - enemy.position.y);
        const canFocus = hero.alive && distance <= GAME_RULES.enemyHeroFocusRange
            && ![...game.map.structures.values()].some(wall => wall.kind === 'wall' && wall.alive
                && crossesWall(enemy.position, hero.position, wall));
        if (canFocus) {
            enemy.heroReturnPosition ??= { ...enemy.position };
            enemy.targetId = hero.id;
            const travel = Math.min(enemy.speed * deltaTime, Math.max(0, distance - GAME_RULES.enemyHeroAttackRange));
            if (distance > EPSILON) {
                enemy.position.x += (hero.position.x - enemy.position.x) / distance * travel;
                enemy.position.y += (hero.position.y - enemy.position.y) / distance * travel;
            }
            if (distance - travel <= GAME_RULES.enemyHeroAttackRange + EPSILON && enemy.attackCooldown <= EPSILON) {
                enemy.attackCooldown = enemy.attackInterval;
                game.damageHero(enemy.damage, enemy.id);
            }
            return true;
        }
        if (enemy.heroReturnPosition) {
            enemy.targetId = null;
            const from = enemy.position;
            const to = enemy.heroReturnPosition;
            const distanceBack = Math.hypot(to.x - from.x, to.y - from.y);
            const travel = enemy.speed * deltaTime;
            if (distanceBack <= travel + EPSILON) {
                enemy.position = { ...to };
                enemy.heroReturnPosition = null;
            } else {
                from.x += (to.x - from.x) / distanceBack * travel;
                from.y += (to.y - from.y) / distanceBack * travel;
            }
            // Rejoin the exact old route point, never skip a defense or corner.
            return true;
        }
        return false;
    }
}
