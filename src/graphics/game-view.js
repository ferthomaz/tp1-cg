import { createLayout, createCamera, createRouteGeometry, clockLabel } from './view-layout.js';
import { structureSprite } from './structure-sprites.js';
import { ForestEnvironment } from './forest-environment.js';
import { entitySprite } from './entity-sprites.js';
import { drawUIFrame } from './ui-art.js';
import { TOWER_ELEMENTS, GAME_RULES } from '../game/rules.js';

const C = {
    background: [0.045, 0.065, 0.075, 1], 
    panel: [0.055, 0.07, 0.085, 0.94],
    border: [0.23, 0.25, 0.27, 1],
    text: [0.88, 0.94, 0.96, 1], 
    muted: [0.46, 0.58, 0.64, 1],
    city: [0.31, 0.85, 0.66, 1], 
    tower: [0.33, 0.66, 1, 1],
    wall: [0.58, 0.67, 0.73, 1], 
    enemy: [1, 0.36, 0.32, 1],
    arrow: [1, 0.81, 0.34, 1],
    dead: [0.25, 0.29, 0.32, 1], 
    ground: [0.105, 0.14, 0.075, 1],
    route: [0.22, 0.19, 0.12, 1], 
    routeEdge: [0.155, 0.15, 0.08, 1],
    hero: [0.25, 0.95, 0.45, 1], 
    water: [0.33, 0.66, 1, 1], 
    fire: [1, 0.36, 0.32, 1],
    poison: [0.74, 0.53, 1, 1], 
    wind: [0.31, 0.85, 0.66, 1],
    ink: [0.19, 0.09, 0.06, 1], 
    inkMuted: [0.32, 0.18, 0.11, 1],
    inkGreen: [0.12, 0.25, 0.11, 1],
};


export class GameView {
    constructor(draw, art = {}, forestArt = null, entityArt = null) {
        this.draw = draw; this.art = art; this.forestArt = forestArt; this.entityArt = entityArt;
        this.forest = null; this.targets = [];
    }

    /** Draw background, clipped world, fixed HUD, then modal overlays (back to front). */
    render(snapshot, ui) {
        const d = this.draw;
        d.beginFrame({ clearColor: C.background });
        const layout = createLayout();
        // The camera depends only on the map and viewport, never on player input.
        const camera = createCamera(snapshot, layout.world);
        this.targets = [];
        d.setClip(layout.world);
        this.#world(snapshot, ui, layout, camera);
        d.setClip();
        // The visible world and its click regions share the same viewport.
        this.targets = this.targets.map(target => {
            const x = Math.max(target.x, layout.world.x);
            const y = Math.max(target.y, layout.world.y);
            return { ...target, x, y,
                width: Math.min(target.x + target.width, layout.world.x + layout.world.width) - x,
                height: Math.min(target.y + target.height, layout.world.y + layout.world.height) - y };
        }).filter(target => target.width > 0 && target.height > 0);
        this.#hud(snapshot, ui, layout);
        this.#inspector(snapshot, ui, layout);
        if (ui.choosingElement && snapshot.state === 'running') this.#elementPicker(layout);
        // Initial loading has no menu; only suspension and defeat need an overlay.
        if (['paused', 'game-over'].includes(snapshot.state)) this.#overlay(snapshot, layout);
        d.endFrame();
        return this.targets;
    }

    #panel(rect) {
        // The irregular border reaches ten source pixels inward. A 12px slice
        // keeps every brown edge out of the stretched, solid-tan content area.
        drawUIFrame(this.draw, this.art.generalHud, rect, 12);
    }

    #label(text, x, y, maxWidth, scale = 1.5, color = C.text, align = 'left') {
        this.draw.drawText({ text: String(text), x, y, scale, color, align, maxWidth });
    }

    #button(rect, label, action, { color = C.tower, enabled = true } = {}) {
        // All actions keep their hit regions, but use general_button for their face.
        // Dimming the same artwork communicates disabled state without another skin.
        drawUIFrame(this.draw, this.art.generalButton, rect, 3, enabled ? [1, 1, 1, 1] : [0.65, 0.65, 0.65, 1]);
        const ink = enabled ? [color[0] * 0.3, color[1] * 0.3, color[2] * 0.3, 1] : C.inkMuted;
        const scale = 1;
        this.#label(label, rect.x + rect.width / 2, rect.y + (rect.height - 12 * scale) / 2,
            rect.width - 12, scale, ink, 'center');
        // Disabled controls still block clicks from leaking into the battlefield.
        this.targets.push({ ...rect, hud: true, action: enabled ? action : { type: 'none' } });
    }

    #bar(x, y, width, ratio, color, height = 4) {
        this.draw.drawRect({ x, y, width, height, color: C.border });
        this.draw.drawRect({ x, y, width: width * Math.max(0, Math.min(1, ratio)), height, color });
    }

    #art(name, rect) {
        const atlas = this.art[name];
        if (!atlas) return;
        const scale = Math.min(rect.width / atlas.tileWidth, rect.height / atlas.tileHeight);
        const width = atlas.tileWidth * scale;
        const height = atlas.tileHeight * scale;
        this.draw.drawSprite({ atlas, x: rect.x + (rect.width - width) / 2,
            y: rect.y + (rect.height - height) / 2, width, height });
    }

    #floatingPanel(rect) {
        this.draw.coverText?.(rect);
        this.#panel(rect);
        this.targets.push({ ...rect, hud: true, action: { type: 'none' } });
    }

    // Project game-world positions into CSS pixels before sending them to the renderer.
    #world(snapshot, ui, layout, camera) {
        const d = this.draw;
        const area = layout.world;
        d.drawRect({ ...area, color: C.ground });
        this.forest ??= new ForestEnvironment(snapshot);
        const topLeft = camera.unproject({ x: area.x, y: area.y });
        const visible = this.forest.visible({ ...topLeft, width: area.width / camera.scale, height: area.height / camera.scale });
        for (const detail of visible.ground) {
            const p = camera.project(detail);
            d.drawRect({ ...p, width: detail.width * camera.scale, height: detail.height * camera.scale,
                color: detail.shade > 0.5 ? [0.14, 0.175, 0.085, 1] : [0.08, 0.115, 0.06, 1] });
        }

        const routes = createRouteGeometry(snapshot.paths);
        // Draw every edge first so later branches do not cut dark seams into junctions.
        for (const [width, color] of [[40, C.routeEdge], [26, C.route]]) {
            for (const { from, to } of routes.segments) {
                const a = camera.project(from), b = camera.project(to);
                d.drawLine({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, thickness: camera.scale * width, color });
            }
        }
        if (this.forestArt) {
            for (const tree of visible.trees) {
                const p = camera.project(tree), size = tree.size * camera.scale;
                d.drawRect({ x: p.x - size * 0.24, y: p.y - size * 0.12,
                    width: size * 0.48, height: size * 0.09, color: [0.015, 0.025, 0.01, 0.3] });
            }
            for (const tree of visible.trees) {
                const p = camera.project(tree), size = tree.size * camera.scale;
                d.drawSprite({ atlas: this.forestArt, column: tree.design, row: 0,
                    x: p.x - size / 2, y: p.y - size, width: size, height: size,
                    flipX: tree.flipX, rotation: tree.rotation, originY: 1, tint: tree.tint });
            }
        }
        for (const spawn of routes.entries) {
            const entry = camera.project(spawn);
            const size = Math.max(24, 64 * camera.scale);
            d.drawSprite({ ...structureSprite({ kind: 'enemy-castle' }), x: entry.x - size / 2, y: entry.y - size / 2, width: size, height: size });
            if (camera.scale >= 0.75) this.#label('ENEMY CASTLE', entry.x, entry.y + size / 2 + 5, 160, 1, C.enemy, 'center');
        }

        for (const structure of snapshot.structures) {
            if (structure.kind === 'tower' && structure.id === ui.selectedBuildingId && structure.hp > 0) {
                const p = camera.project(structure.position);
                d.drawRing({ x: p.x, y: p.y, radius: structure.range * camera.scale, color: [0.33, 0.66, 1, 0.2] });
            }
        }
        for (const structure of snapshot.structures) {
            const p = camera.project(structure.position);
            const selected = structure.id === ui.selectedBuildingId;
            // Wall tiles must follow world scale exactly to form continuous runs.
            const width = structure.kind === 'wall' ? 32 * camera.scale
                : structure.kind === 'city' ? Math.max(24, 64 * camera.scale) : Math.max(20, 64 * camera.scale);
            const height = width;
            const rect = { x: p.x - width / 2, y: p.y - height / 2, width, height };
            const color = structure.hp > 0 ? C[structure.element ?? structure.kind] : C.dead;
            // Walls have no ruin cell in this sheet; dim the existing wall tile.
            d.drawSprite({
                ...structureSprite(structure),
                x: rect.x,
                y: rect.y,
                width,
                height,
                tint: structure.kind === 'wall' && structure.hp <= 0 && !structure.work ? [0.45, 0.45, 0.45, 0.5] : [1, 1, 1, 1]
            });
            if (structure.kind === 'wall' && structure.hp <= 0 && !structure.work) {
                d.drawLine({ x1: rect.x, y1: rect.y, x2: rect.x + width, y2: rect.y + height, thickness: 2, color: C.dead });
                d.drawLine({ x1: rect.x + width, y1: rect.y, x2: rect.x, y2: rect.y + height, thickness: 2, color: C.dead });
            }
            if (selected) d.drawOutline({ x: rect.x - 3, y: rect.y - 3, width: width + 6, height: height + 6, color: C.text });
            if (selected || (structure.hp > 0 && structure.hp < structure.maxHp)) {
                this.#bar(rect.x, rect.y - 5, width, structure.hp / structure.maxHp, color, 3);
            }
            // Dense wall runs remain readable; detailed stats live in the inspector.
            if (selected) {
                this.#label(`${Math.ceil(structure.hp)}/${structure.maxHp}`, p.x, rect.y - 17, 90, 1, C.text, 'center');
                const name = structure.kind === 'city' ? 'CASTLE' : structure.kind;
                this.#label(structure.work ? structure.work.stage : structure.hp <= 0 ? 'DESTROYED' : `${structure.element ?? name} T${structure.upgradeTier}`,
                    p.x, rect.y + height + 5, 100, 1, color, 'center');
            }
            this.targets.push({ ...rect, action: { type: structure.kind === 'tower' ? 'tower' : 'building', id: structure.id } });
        }

        const hero = snapshot.hero;
        const home = camera.project(hero.homePosition);
        const homeSize = Math.max(20, 48 * camera.scale);
        const homeRect = { x: home.x - homeSize / 2, y: home.y - homeSize / 2, width: homeSize, height: homeSize };
        d.drawSprite({ ...structureSprite({ kind: 'hero' }), x: homeRect.x, y: homeRect.y, width: homeSize, height: homeSize });
        this.targets.push({ ...homeRect, action: { type: 'hero' } });
        if (hero.alive) {
            const p = camera.project(hero.position);
            // Keep the full 32px cell square; the atlas contains transparent padding.
            const size = Math.max(24, 32 * camera.scale);
            if (this.entityArt) d.drawSprite({ atlas: this.entityArt,
                ...entitySprite('hero', { ...hero.motion, moving: snapshot.state === 'running' && hero.motion.moving }),
                x: p.x - size / 2, y: p.y - size / 2, width: size, height: size });
            if (ui.heroSelected) d.drawOutline({ x: p.x - size / 2 - 4, y: p.y - size / 2 - 4, width: size + 8, height: size + 8, color: C.hero });
            this.#bar(p.x - 12, p.y - size / 2 - 8, 24, hero.hp / hero.maxHp, C.hero, 3);
            this.#label('HERO', p.x, p.y - size / 2 - 20, 60, 1, C.hero, 'center');
            this.targets.push({ x: p.x - size / 2, y: p.y - size / 2, width: size, height: size, action: { type: 'hero' } });
        } else this.#label('RESPAWN ' + Math.ceil(hero.respawnRemaining) + 'S', home.x, home.y + homeSize / 2 + 5, 110, 1, C.hero, 'center');

        for (const enemy of snapshot.enemies) {
            const p = camera.project(enemy.position);
            const size = Math.max(24, 32 * camera.scale);
            const color = C.enemy;
            // Each entity advances its own walk clock only while it changes position.
            if (this.entityArt) d.drawSprite({ atlas: this.entityArt,
                ...entitySprite('enemy', { ...enemy.motion, moving: snapshot.state === 'running' && enemy.motion.moving }),
                x: p.x - size / 2, y: p.y - size / 2, width: size, height: size,
                tint: [1, 1, 1, 1] });
            this.#bar(p.x - 12, p.y - size / 2 - 8, 24, enemy.hp / enemy.maxHp, color, 3);
            this.#label(Math.ceil(enemy.hp), p.x, p.y - size / 2 - 21, 50, 1.3, C.text, 'center');
            const hitSize = Math.max(24, size + 6);
            this.targets.push({ x: p.x - hitSize / 2, y: p.y - hitSize / 2, width: hitSize, height: hitSize,
                action: { type: 'enemy', id: enemy.id } });
        }
        for (const arrow of snapshot.arrows) {
            const p = camera.project(arrow.position);
            const target = snapshot.enemies.find(enemy => enemy.id === arrow.targetId);
            if (!target) continue;
            const targetPoint = camera.project(target.position);
            const angle = Math.atan2(targetPoint.y - p.y, targetPoint.x - p.x);
            const dx = Math.cos(angle); const dy = Math.sin(angle);
            d.drawLine({ x1: p.x - dx * 10, y1: p.y - dy * 10, x2: p.x, y2: p.y, thickness: 2, color: C.arrow });
            d.drawTriangle({
                a: { x: p.x + dx * 4, y: p.y + dy * 4 },
                b: { x: p.x - dx * 3 - dy * 3, y: p.y - dy * 3 + dx * 3 },
                c: { x: p.x - dx * 3 + dy * 3, y: p.y - dy * 3 - dx * 3 },
                color: C.arrow
            });
        }
    }

    // Small screen-fixed overlays leave the map visible between controls.
    #hud(snapshot, ui, layout) {
        const { hud } = layout;
        const city = snapshot.structures.find(item => item.kind === 'city');
        const hero = snapshot.hero;
        this.#floatingPanel(hud);
        const cellWidth = hud.width / 2;
        const stats = [
            { icon: 'heroHealth', label: 'HERO', value: hero.alive ? Math.ceil(hero.hp) + '/' + hero.maxHp : Math.ceil(hero.respawnRemaining) + 'S',
                ratio: hero.hp / hero.maxHp, color: C.enemy, action: { type: 'hero' } },
            { icon: 'castleHealth', label: 'CASTLE', value: Math.ceil(city.hp) + '/' + city.maxHp,
                ratio: city.hp / city.maxHp, color: C.city, action: { type: 'building', id: city.id } },
        ];
        stats.forEach((stat, index) => {
            const x = hud.x + index * cellWidth;
            const iconSize = 28;
            this.#art(stat.icon, { x: x + 7, y: hud.y + 12, width: iconSize, height: iconSize });
            const textX = x + iconSize + 12;
            const available = cellWidth - iconSize - 18;
            this.#label(stat.label, textX, hud.y + 10, available, 1, C.inkMuted);
            this.#label(stat.value, textX, hud.y + 25, available,
                1.2, C.ink);
            this.#bar(x + 9, hud.y + 47, cellWidth - 18, stat.ratio, stat.color, 3);
            this.targets.push({ x, y: hud.y, width: cellWidth, height: hud.height, hud: true, action: stat.action });
        });

    }

    #heroStatus(hero) {
        if (!hero.alive) return 'RESPAWN ' + Math.ceil(hero.respawnRemaining) + 'S';
        if (hero.ready) return 'HERO READY / ' + Math.ceil(hero.hp) + ' HP';
        return (hero.job.stage === 'travel' ? 'MOVING' : hero.job.stage.toUpperCase()) + ' / ' + Math.ceil(hero.job.secondsRemaining) + 'S';
    }

    #inspector(snapshot, ui, layout) {
        const building = snapshot.structures.find(item => item.id === ui.selectedBuildingId);
        if (!building) return;
        const hero = snapshot.hero;
        const rect = { x: layout.width - 296,
            y: layout.height - 132, width: 280, height: 116 };
        this.#floatingPanel(rect);
        const destroyed = building.hp <= 0 && building.kind !== 'city';
        const ready = hero.ready && snapshot.state === 'running';
        const name = building.element ?? (building.kind === 'city' ? 'Castle' : building.kind);
        this.#label(`${name} / ${building.upgradeTier}`, rect.x + 14, rect.y + 12, rect.width - 60, 1.2, C.ink);
        this.#button({ x: rect.x + rect.width - 36, y: rect.y + 8, width: 26, height: 26 }, 'X',
            { type: 'dismiss-selection' }, { color: C.muted });
        this.#label(ui.message || (hero.ready ? `${Math.ceil(building.hp)}/${building.maxHp} HP` : this.#heroStatus(hero)),
            rect.x + 14, rect.y + 40, rect.width - 28, 1, C.inkMuted);
        const width = (rect.width - 36) / 2;
        this.#button({ x: rect.x + 14, y: rect.y + 68, width, height: 34 },
            destroyed ? 'Rebuild' : building.canUpgrade ? 'Upgrade' : 'Max level',
            { type: destroyed ? 'reconstruct' : 'upgrade' }, { enabled: ready && (destroyed || building.canUpgrade) });
        this.#button({ x: rect.x + 22 + width, y: rect.y + 68, width, height: 34 }, 'Repair',
            { type: 'repair' }, { enabled: ready && building.hp > 0 && building.hp < building.maxHp, color: C.hero });
    }

    #elementPicker(layout) {
        this.draw.clearText?.();
        const d = this.draw;
        d.drawRect({ x: 0, y: 0, width: layout.width, height: layout.height, color: [0.02, 0.035, 0.05, 0.88] });
        this.targets = [{ x: 0, y: 0, width: layout.width, height: layout.height, action: { type: 'none' } }];
        const width = 500;
        const height = 310;
        const x = (layout.width - width) / 2;
        const y = (layout.height - height) / 2;
        this.#panel({ x, y, width, height });
        this.#label('CHOOSE FINAL ELEMENT', x + width / 2, y + 18, width - 24, 2, C.ink, 'center');
        const cellWidth = (width - 36) / 2;
        TOWER_ELEMENTS.forEach((element, index) => {
            const cell = { x: x + 12 + (index % 2) * (cellWidth + 12), y: y + 70 + Math.floor(index / 2) * 90, width: cellWidth, height: 78 };
            this.#button(cell, '', { type: 'element', element }, { color: C[element] });
            d.drawSprite({ ...structureSprite({ kind: 'tower', level: 4, element }), x: cell.x + cellWidth / 2 - 24, y: cell.y + 3, width: 48, height: 48 });
            this.#label(element, cell.x + cellWidth / 2, cell.y + 59, cellWidth - 12, 1.4, C.ink, 'center');
        });
        this.#button({ x: x + 12, y: y + height - 46, width: width - 24, height: 34 }, 'CANCEL', { type: 'cancel-element' }, { color: C.muted });
    }

    #overlay(snapshot, layout) {
        this.draw.clearText?.();
        const d = this.draw;
        d.drawRect({ x: 0, y: 0, width: layout.width, height: layout.height, color: [0.02, 0.035, 0.05, 0.78] });
        // A modal captures the entire canvas, preventing actions behind it.
        this.targets = [{ x: 0, y: 0, width: layout.width, height: layout.height, action: { type: 'none' } }];
        const width = 448;
        const height = 292;
        const x = (layout.width - width) / 2;
        const y = (layout.height - height) / 2;
        this.#panel({ x, y, width, height });
        const title = snapshot.state === 'paused' ? 'GAME SUSPENDED' : 'CITY DESTROYED';
        const scale = 2;
        d.drawText({ text: title, x: x + width / 2, y: y + 30, scale, color: C.ink, align: 'center' });
        const lines = snapshot.state === 'paused' ? ['WAITING FOR THE GAME TO RECOVER.']
            : [`SURVIVED ${clockLabel(snapshot.elapsed)}${snapshot.wave ? ` / WAVE ${snapshot.wave.number}` : ''}.`, 'REBUILD AND TRY AGAIN.'];
        lines.forEach((line, index) => this.#label(line, x + width / 2, y + 84 + index * 24, width - 32, 1.35, C.inkMuted, 'center'));
        if (snapshot.state === 'game-over') {
            this.#button({ x: x + 24, y: y + height - 64, width: width - 48, height: 40 }, 'Play again',
                { type: 'restart' }, { color: C.city });
        }
    }
}
