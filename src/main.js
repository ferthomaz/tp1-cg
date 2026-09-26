import { fitDesktopStage } from './core/desktop-stage.js';
import { createSampleGame } from './game/config/sample-game.js';
import { createRenderer, createSpriteAtlas } from './graphics/render.js';
import { GameView } from './graphics/game-view.js';
import { GameApplication } from './core/game-application.js';
import { SceneManager } from './core/scene-manager.js';
import { loadStructureSheet, STRUCTURE_SHEET } from './graphics/structure-sprites.js';
import { loadUIArt } from './graphics/ui-art.js';
import { loadForestArt } from './graphics/forest-environment.js';
import { loadEntityArt } from './graphics/entity-sprites.js';
import { loadShaders } from './graphics/webgl/shader-loader.js';
import { GAME_WIDTH, GAME_HEIGHT } from './graphics/view-layout.js';

const canvas = document.querySelector('.game-canvas');
fitDesktopStage(canvas.parentElement);
const status = document.querySelector('#status');
const errorMessage = document.querySelector('#webgl-error');
const playButton = document.querySelector('#play-button');
const scenes = new SceneManager(Object.fromEntries(['menu', 'game', 'game-over']
    .map(name => [name, document.querySelector('.' + name)])));
let application = null;

playButton.addEventListener('click', async () => {
    playButton.disabled = true;
    errorMessage.hidden = true;
    try {
        const [spriteImage, uiArt, forestArt, entityArt] = await Promise.all([
            loadStructureSheet(), loadUIArt(), loadForestArt(), loadEntityArt(), loadShaders(), document.fonts.ready,
        ]);
        const atlas = createSpriteAtlas(spriteImage, STRUCTURE_SHEET);
        const game = createSampleGame();
        scenes.show('game');
        application = new GameApplication({
            game, canvas,
            createRenderer() {
                const draw = createRenderer(canvas, { atlas, fixedSize: { width: GAME_WIDTH, height: GAME_HEIGHT } });
                return { draw, view: new GameView(draw, uiArt, forestArt, entityArt) };
            },
            onStatus(snapshot) {
                const city = snapshot.structures.find(item => item.kind === 'city');
                status.textContent = `${snapshot.state}. Castle HP ${city.hp}/${city.maxHp}. Hero HP ${Math.ceil(snapshot.hero.hp)}/${snapshot.hero.maxHp}.`;
                if (snapshot.state === 'game-over') { application?.stop(); scenes.show('game-over'); }
            },
            onError(message) { errorMessage.textContent = message; errorMessage.hidden = !message; },
        });
        window.towerDefense = game;
        window.towerDefenseApp = application;
    } catch (error) {
        application?.dispose(); 
        application = null;
        scenes.show('menu');
        errorMessage.textContent = error.message;
        errorMessage.hidden = false;
    } finally { playButton.disabled = false; }
});

document.querySelector('#return-menu-btn').addEventListener('click', () => {
    application?.dispose(); application = null;
    window.towerDefenseApp = null;
    window.towerDefense = null;
    scenes.show('menu');
});
