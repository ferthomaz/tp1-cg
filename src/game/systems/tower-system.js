import { EPSILON } from '../rules.js';

export class TowerSystem {
    update(game, deltaTime) {
        for (const tower of game.map.towers) {
            if (!tower.alive) continue;
            tower.cooldown = Math.max(0, tower.cooldown - deltaTime);
            if (tower.cooldown > EPSILON) continue;

            let target = null;
            let nearestDistance = Infinity;
            for (const enemy of game.enemies.values()) {
                if (!enemy.alive) continue;
                const distance = Math.hypot(enemy.position.x - tower.position.x, enemy.position.y - tower.position.y);
                if (distance <= tower.range && distance < nearestDistance) {
                    target = enemy;
                    nearestDistance = distance;
                }
            }
            if (target) {
                tower.cooldown = tower.attackInterval;
                game.fireArrow(tower, target);
            }
        }

        for (const [id, arrow] of game.arrows) {
            const target = game.enemies.get(arrow.targetId);
            if (!target?.alive) {
                game.arrows.delete(id);
            } else if (arrow.advance(target, deltaTime)) {
                game.arrows.delete(id);
                game.damageEnemy(target.id, arrow.damage, arrow.sourceId);
                game.events.emit('arrow:hit', { arrowId: id, targetId: target.id });
            }
        }
    }
}
