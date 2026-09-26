import { Damageable } from './damageable.js';
import { number } from '../validation.js';
import { GAME_RULES, TOWER_ELEMENTS, TOWER_RANGE_MULTIPLIERS } from '../rules.js';

export const WALL_VARIANTS = Object.freeze([
    'horizontal', 'vertical', 'top-left', 'top-right', 'bottom-left', 'bottom-right',
]);

export class Structure extends Damageable {
    constructor(definition, kind) {
        super(definition);
        this.kind = kind;
        this.level = 1;
        this.baseMaxHp = this.maxHp;
        this.work = null;
    }

    get canUpgrade() { return this.alive && this.level < GAME_RULES.buildingMaxLevel; }
    get nextUpgradeTier() { return this.canUpgrade ? this.level : null; }

    upgrade() {
        if (!this.canUpgrade) return false;
        this.level += 1;
        const previousMaxHp = this.maxHp;
        this.maxHp = this.baseMaxHp * (1 + (this.level - 1) * GAME_RULES.buildingHealthPerLevel);
        // Add the new capacity as health, preserving damage already taken.
        this.hp += this.maxHp - previousMaxHp;
        return true;
    }

    snapshot() { return { ...super.snapshot(), kind: this.kind, level: this.level, canUpgrade: this.canUpgrade,
        upgradeTier: this.level - 1, nextUpgradeTier: this.nextUpgradeTier, work: this.work ? { ...this.work } : null }; }
}

export class City extends Structure {
    constructor(definition) { super(definition, 'city'); }
}

export class Wall extends Structure {
    constructor(definition) {
        super(definition, 'wall');
        this.variant = definition.variant ?? 'vertical';
        if (!WALL_VARIANTS.includes(this.variant)) throw new TypeError(`Unknown wall variant: ${this.variant}`);
    }

    snapshot() { return { ...super.snapshot(), variant: this.variant }; }
}

export class Tower extends Structure {
    constructor(definition) {
        super(definition, 'tower');
        this.element = null;
        this.baseDamage = number(definition.baseDamage, 'baseDamage', 0, true);
        this.damagePerLevel = number(definition.damagePerLevel, 'damagePerLevel', 0, true);
        this.range = number(definition.range, 'range', 0, true);
        this.attackInterval = number(definition.attackInterval, 'attackInterval', 0, true);
        this.arrowSpeed = number(definition.arrowSpeed, 'arrowSpeed', 0, true);
        this.cooldown = 0;
    }

    get damage() { return this.baseDamage + (this.level - 1) * this.damagePerLevel; }

    get canUpgrade() { return this.alive && this.element === null; }

    upgrade(element = null) {
        if (!this.canUpgrade) return false;
        const tier = this.nextUpgradeTier;
        if (tier === GAME_RULES.towerMaxUpgradeTier) {
            if (!TOWER_ELEMENTS.includes(element)) return false;
            this.element = element;
        } else if (element !== null) return false;
        this.range *= TOWER_RANGE_MULTIPLIERS[tier - 1];
        this.level += 1;
        return true;
    }

    snapshot() {
        return { ...super.snapshot(), element: this.element, damage: this.damage, range: this.range };
    }
}
