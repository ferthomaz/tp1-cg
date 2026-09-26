import { GAME_WIDTH, GAME_HEIGHT } from '../graphics/view-layout.js';

export function fitDesktopStage(stage, host = window) {
    const fit = () => {
        const scale = Math.min(host.innerWidth / GAME_WIDTH, host.innerHeight / GAME_HEIGHT);
        stage.style.setProperty('--game-scale', String(scale));
    };
    fit();
    host.addEventListener('resize', fit);
    return () => host.removeEventListener('resize', fit);
}
