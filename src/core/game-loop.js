// update altera o estado; render desenha o estado atual.
export function startGameLoop(update, render) {
    let previousTime = null;
    let frameId = null;
    let running = true;

    function resetClock() {
        previousTime = null;
    }

    function frame(currentTime) {
        if (!running) return;

        if (document.hidden) {
            resetClock();
            frameId = requestAnimationFrame(frame);
            return;
        }

        let deltaTime = previousTime === null ? 0 : (currentTime - previousTime) / 1000;

        previousTime = currentTime;

        deltaTime = Math.min(deltaTime, 0.1);

        update(deltaTime);
        render();

        if (running) {
            frameId = requestAnimationFrame(frame);
        }
    }

    document.addEventListener("visibilitychange", resetClock);
    frameId = requestAnimationFrame(frame);

    return function stop() {
        running = false;
        cancelAnimationFrame(frameId);
        document.removeEventListener("visibilitychange", resetClock);
    };
}