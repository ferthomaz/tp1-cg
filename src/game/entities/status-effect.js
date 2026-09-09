import { identifier, number } from '../validation.js';

//usar o mesmo id duas vezes recarrega o efeito no inimigo
export class StatusEffect {
    constructor({ id, duration, speedMultiplier = 1, damageMultiplier = 1 }) {
        this.id = identifier(id);
        this.remaining = number(duration, 'duration', 0, true);
        this.speedMultiplier = number(speedMultiplier, 'speedMultiplier');
        this.damageMultiplier = number(damageMultiplier, 'damageMultiplier');
    }

    snapshot() {
        return {
            id: this.id,
            remaining: this.remaining,
            speedMultiplier: this.speedMultiplier,
            damageMultiplier: this.damageMultiplier,
        };
    }
}
