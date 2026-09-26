//ideia de troca de telas, só ta separado pra ficar mais organizado
export class SceneManager {
    constructor(scenes) {
        this.scenes = scenes;
    }

    show(name) {
        if (!this.scenes[name]) throw new Error(`Unknown scene: ${name}`);
        for (const [sceneName, element] of Object.entries(this.scenes)) {
            element.classList.toggle('hide', sceneName !== name);
        }
    }
}
