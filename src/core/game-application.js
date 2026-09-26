import { startGameLoop } from './game-loop.js';
import { onCanvasClick } from './input.js';
import { pickTarget } from '../graphics/view-layout.js';
import { GAME_RULES } from '../game/rules.js';

export class GameApplication {
    constructor({ game, canvas, createRenderer, host = window, onStatus = () => {}, onError = () => {} }) {
        Object.assign(this, { game, canvas, createRenderer, host, onStatus, onError });
        this.ui = { selectedBuildingId: null, heroSelected: false, choosingElement: false,
            message: '' };
        this.cleanups = [];
        this.stopLoop = null;
        this.disposed = false;
        this.contextLost = false;
        this.hiddenPage = false;
        this.statusKey = '';
        this.renderer = createRenderer();
        this.cleanups.push(game.events.on('hero:action-completed', ({ action }) => this.#message(`${action} COMPLETE / HERO READY`)));
        this.cleanups.push(game.events.on('hero:died', () => this.#message('HERO DEFEATED / RESPAWNS IN 150S')));
        this.cleanups.push(game.events.on('hero:action-cancelled', () => this.#message('HERO ACTION INTERRUPTED')));
        this.cleanups.push(game.events.on('game:state', ({ state }) => {
            if (state === 'idle') {
                Object.assign(this.ui, { selectedBuildingId: null, heroSelected: false, choosingElement: false,
                    message: '' });
                this.messageUntil = 0;
            }
            if (state === 'game-over') {
                this.ui.choosingElement = false;
            }
        }));
        this.cleanups.push(onCanvasClick(canvas, point => {
            this.render();
            const { draw } = this.renderer;
            const target = pickTarget(this.targets, {
                x: point.x * draw.width / canvas.width,
                y: point.y * draw.height / canvas.height,
            });
            canvas.focus({ preventScroll: true });
            if (target) this.act(target.action);
        }));
        this.#listen(canvas, 'pointermove', event => {
            const rect = canvas.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            const target = pickTarget(this.targets ?? [], {
                x: (event.clientX - rect.left) * this.renderer.draw.width / rect.width,
                y: (event.clientY - rect.top) * this.renderer.draw.height / rect.height,
            });
            canvas.style.cursor = target && target.action.type !== 'none' ? 'pointer' : 'default';
        });
        this.#listen(host, 'pagehide', () => { this.hiddenPage = true; this.stop(); });
        this.#listen(host, 'pageshow', () => { this.hiddenPage = false; this.start(); });
        this.#listen(canvas, 'webglcontextlost', event => {
            event.preventDefault();
            this.contextLost = true;
            this.resumeAfterRestore = game.state === 'running';
            game.pause();
            this.stop();
            this.renderer.draw.dispose();
            onError('Graphics connection lost. Waiting for WebGL to recover.');
        });
        this.#listen(canvas, 'webglcontextrestored', () => {
            try {
                this.renderer = createRenderer();
                this.contextLost = false;
                onError('');
                if (this.resumeAfterRestore) game.resume();
                this.start();
                this.render();
            } catch (error) { this.contextLost = true; onError(error.message); }
        });
        this.render();
        this.start();
    }

    #listen(target, type, listener) {
        target.addEventListener(type, listener);
        this.cleanups.push(() => target.removeEventListener(type, listener));
    }

    start() {
        if (this.disposed || this.stopLoop || this.contextLost || this.hiddenPage) return;
        this.stopLoop = startGameLoop(delta => this.game.update(delta), () => this.render());
    }

    stop() { this.stopLoop?.(); this.stopLoop = null; }

    render() {
        if (this.disposed || this.contextLost) return;
        if (this.game.state === 'idle') this.game.start();
        const snapshot = this.game.getSnapshot();
        const selected = snapshot.structures.find(building => building.id === this.ui.selectedBuildingId);
        if (!selected) { this.ui.selectedBuildingId = null; this.ui.choosingElement = false; }
        if (this.ui.choosingElement && (!selected?.canUpgrade || !snapshot.hero.ready)) this.ui.choosingElement = false;
        if (this.messageUntil < snapshot.elapsed) this.ui.message = '';
        this.targets = this.renderer.view.render(snapshot, this.ui);
        const key = `${snapshot.state}:${snapshot.wave?.phase}:${snapshot.wave?.number}:${Math.floor(snapshot.elapsed)}:${snapshot.enemies.length}:${snapshot.hero.job?.stage}:${snapshot.hero.hp}`;
        if (key !== this.statusKey) {
            this.statusKey = key;
            this.onStatus(snapshot, this.ui);
        }
    }

    act(action) {
        const game = this.game;
        if (this.disposed || this.contextLost) return;
        if (action.type === 'restart') game.restart();
        else if (game.state === 'running') {
            if (this.ui.choosingElement && !['element', 'cancel-element', 'none'].includes(action.type)) return;
            if (action.type === 'dismiss-selection') {
                this.ui.selectedBuildingId = null;
                this.ui.heroSelected = false;
            } else if (action.type === 'tower' || action.type === 'building') {
                const building = game.map.structures.get(action.id);
                if (building) {
                    this.ui.selectedBuildingId = action.id;
                    this.ui.heroSelected = false;
                }
            } else if (action.type === 'hero') {
                this.ui.heroSelected = !this.ui.heroSelected;
                this.ui.selectedBuildingId = null;
                this.#message('SELECT A BUILDING TO UPGRADE, REPAIR OR REBUILD');
            } else if (action.type === 'upgrade') {
                const building = game.map.structures.get(this.ui.selectedBuildingId);
                if (building && !building.alive) this.#reconstruct();
                else if (building?.alive && building.canUpgrade && building.kind === 'tower'
                    && building.nextUpgradeTier === GAME_RULES.towerMaxUpgradeTier && game.hero.ready) {
                    this.ui.choosingElement = true;
                } else this.#upgrade();
            } else if (action.type === 'reconstruct') {
                this.#reconstruct();
            } else if (action.type === 'repair') {
                this.#workMessage(game.repairBuilding(this.ui.selectedBuildingId));

            } else if (action.type === 'element' && this.ui.choosingElement) {
                this.#upgrade(action.element);
                this.ui.choosingElement = false;
            } else if (action.type === 'cancel-element') {
                this.ui.choosingElement = false;
            } else if (action.type === 'enemy') {
                game.clickEnemy(action.id);
            }
        }
        this.render();
    }

    #message(text) { this.ui.message = text; this.messageUntil = this.game.elapsed + 3; }

    #upgrade(element = null) {
        this.#workMessage(this.game.upgradeBuilding(this.ui.selectedBuildingId, element));
    }

    #reconstruct() {
        this.#workMessage(this.game.reconstructBuilding(this.ui.selectedBuildingId));
    }

    #workMessage(result) {
        if (result.ok) this.#message(`HERO ASSIGNED: ${result.action}`);
        else this.#message({ 'hero-busy': 'HERO ALREADY WORKING', 'hero-dead': 'HERO IS RESPAWNING',
            'max-level': 'BUILDING FULLY UPGRADED', 'full-health': 'BUILDING ALREADY AT FULL HEALTH' }[result.reason] ?? 'SELECT A VALID BUILDING');
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.stop();
        for (const cleanup of this.cleanups) cleanup();
        this.cleanups = [];
        this.renderer.draw.dispose();
    }
}
