import { point, number } from '../validation.js';

export class Arrow {
    constructor({ id, sourceId, targetId, position, damage, speed }) {
        this.id = id;
        this.sourceId = sourceId;
        this.targetId = targetId;
        this.position = point(position);
        this.damage = number(damage, 'arrow damage', 0, true);
        this.speed = number(speed, 'arrow speed', 0, true);
    }

    //metodo pra flecha seguir o alvo
    advance(target, deltaTime) {
        const dx = target.position.x - this.position.x;
        const dy = target.position.y - this.position.y;
        const distance = Math.hypot(dx, dy); //distancia ate o alvo
        const travel = this.speed * deltaTime;
        if (distance <= travel) {
            this.position = { ...target.position };
            return true;
        }
        this.position.x += dx / distance * travel;//ja que nao conseguiu chegar recalcula 
        this.position.y += dy / distance * travel;
        return false;
    }
    //pra mandar apenas as informacoes necessarias pra renderizar
    snapshot() {
        return {
            id: this.id, sourceId: this.sourceId, targetId: this.targetId,
            position: { ...this.position }, damage: this.damage,
        };
    }
}