import { Damageable } from './damageable.js';
import { StatusEffect } from './status-effect.js';
import { EPSILON } from '../rules.js';
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
        this.effects = new Map();
    }

    get speed() { return this.#modified(this.baseSpeed, 'speedMultiplier'); }
    get damage() { return this.#modified(this.baseDamage, 'damageMultiplier'); }

    #modified(base, property) { //privado pra nao expor como e calculado os efeitos
        for (const effect of this.effects.values()) base *= effect[property];
        return base;
    }

    applyEffect(definition) {
        const effect = new StatusEffect(definition);
        this.effects.set(effect.id, effect);
    }

    updateEffects(deltaTime) {
        for (const [id, effect] of this.effects) {
            effect.remaining -= deltaTime;
            if (effect.remaining <= EPSILON) this.effects.delete(id);
        }
    }

    snapshot() {
        return {
            ...super.snapshot(), typeId: this.typeId, pathId: this.pathId,
            waypointIndex: this.waypointIndex, speed: this.speed, damage: this.damage,
            effects: [...this.effects.values()].map(effect => effect.snapshot()),
        };
    }
}
