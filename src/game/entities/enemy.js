import { Damageable } from './damageable.js';
import { Motion } from './motion.js';
import { identifier, number } from '../validation.js';

export class Enemy extends Damageable {
    constructor({ id, type, path }) {
        super({ id, maxHp: type.maxHp, position: path.waypoints[0] });
        this.typeId = identifier(type.id, 'enemy type id');
        this.pathId = path.id;
        this.waypointIndex = 1;
        this.baseSpeed = number(type.speed, 'speed');
        this.baseDamage = number(type.damage, 'damage');
        this.attackInterval = number(type.attackInterval, 'attackInterval', 0, true);
        this.attackCooldown = 0;
        this.targetId = null;
        this.heroReturnPosition = null;
        this.motion = new Motion();
    }

    get speed() { return this.baseSpeed; }
    get damage() { return this.baseDamage; }

    snapshot() {
        return {
            ...super.snapshot(), typeId: this.typeId, pathId: this.pathId,
            waypointIndex: this.waypointIndex, speed: this.speed, damage: this.damage,
            targetId: this.targetId, motion: this.motion.snapshot(),
        };
    }
}
