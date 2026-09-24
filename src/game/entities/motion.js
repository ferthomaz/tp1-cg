import { EPSILON } from '../rules.js';

//servem pro heroi e inimigos
export class Motion {
    constructor() {
        this.moving = false;
        this.facingLeft = false;
        this.elapsed = 0;
    }

    update(from, to, deltaTime) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        if (Math.hypot(dx, dy) <= EPSILON) { this.stop(); return; }
        if (Math.abs(dx) > EPSILON) this.facingLeft = dx < 0;
        this.moving = true;
        this.elapsed += deltaTime;
    }

    stop() { this.moving = false; this.elapsed = 0; }

    snapshot() {
        return { moving: this.moving, facingLeft: this.facingLeft, elapsed: this.elapsed };
    }
}
