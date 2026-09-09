import { identifier, number, point } from '../validation.js';

export class Damageable {
    constructor({ id, maxHp, position }) {
        this.id = identifier(id);
        this.maxHp = number(maxHp, 'maxHp', 0, true);
        this.hp = this.maxHp;
        this.position = point(position);
    }

    get alive() { return this.hp > 0; }
    //faz a conta do quanto de dano o objeto levou
    takeDamage(amount) {
        number(amount, 'damage');
        const applied = Math.min(this.hp, amount);
        this.hp -= applied;
        return applied;
    }

    snapshot() {
        return { id: this.id, hp: this.hp, maxHp: this.maxHp, position: { ...this.position } };
    }
}