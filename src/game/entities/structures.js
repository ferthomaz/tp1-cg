import { Damageable } from './damageable.js';
import { number } from '../validation.js';

export class Structure extends Damageable {
    constructor(definition, kind) {
        super(definition);
        this.kind = kind;
    }

    snapshot() { return { ...super.snapshot(), kind: this.kind }; }
}

export class City extends Structure {
    constructor(definition) { super(definition, 'city'); }
}

export class Wall extends Structure {
    constructor(definition) { super(definition, 'wall'); }
}

export class Tower extends Structure {
    constructor(definition) {
        super(definition, 'tower');
        this.level = 1;
        this.baseDamage = number(definition.baseDamage, 'baseDamage', 0, true);
        this.damagePerLevel = number(definition.damagePerLevel, 'damagePerLevel', 0, true);
        this.range = number(definition.range, 'range', 0, true);
        this.attackInterval = number(definition.attackInterval, 'attackInterval', 0, true);
        this.arrowSpeed = number(definition.arrowSpeed, 'arrowSpeed', 0, true);
        this.cooldown = 0;
    }

    get damage() { return this.baseDamage + (this.level - 1) * this.damagePerLevel; }

    upgrade() {
        if (!this.alive) return false;
        this.level += 1;
        return true;
    }

    snapshot() {
        return { ...super.snapshot(), level: this.level, damage: this.damage, range: this.range };
    }
}
