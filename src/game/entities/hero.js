import { Damageable } from './damageable.js';
import { Motion } from './motion.js';
import { GAME_RULES } from '../rules.js';
import { number } from '../validation.js';

export class Hero extends Damageable {
    #speed;

    constructor({ position, maxHp = GAME_RULES.heroMaxHp }, initialEnemySpeed) {
        super({ id: 'hero', position, maxHp });
        this.homePosition = { ...this.position };
        this.#speed = number(initialEnemySpeed, 'initial enemy speed') * GAME_RULES.heroSpeedMultiplier;
        this.job = null;
        this.respawnAt = null;
        this.motion = new Motion(); 
    }

    get speed() { return this.#speed; }
    get ready() { return this.alive && this.job === null; }

    snapshot(elapsed) {
        const job = this.job ? structuredClone(this.job) : null;
        if (job) {
            const distance = Math.hypot(job.destination.x - this.position.x, job.destination.y - this.position.y);
            job.travelRemaining = distance === 0 ? 0 : distance / this.speed;
            job.secondsRemaining = job.stage === 'travel' ? job.travelRemaining + job.startTime + job.workRemaining + job.finishTime
                : job.stage === 'starting' ? job.stageRemaining + job.workRemaining + job.finishTime
                    : job.stage === 'working' ? job.workRemaining + job.finishTime : job.stageRemaining;
        }
        return { ...super.snapshot(), homePosition: { ...this.homePosition }, speed: this.speed,
            alive: this.alive, ready: this.ready, job, motion: this.motion.snapshot(),
            respawnRemaining: this.respawnAt === null ? 0 : Math.max(0, this.respawnAt - elapsed) };
    }
}
