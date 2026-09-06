export function onCanvasClick(canvas, onClick) {
    function handleClick(event) {
        if (event.button !== 0) return;

        const bounds = canvas.getBoundingClientRect();

        if (bounds.width === 0 || bounds.height === 0) return;

        const point = {
            x: (event.clientX - bounds.left) * canvas.width / bounds.width,
            y: (event.clientY - bounds.top) * canvas.height / bounds.height,
        };

        onClick(point);
    }

    canvas.addEventListener("click", handleClick);

    return function removeListener() {
        canvas.removeEventListener("click", handleClick);
    };
}

export function isPointInsideRectangle(point, rectangle) {
    return (
        point.x >= rectangle.x &&
        point.x <= rectangle.x + rectangle.width &&
        point.y >= rectangle.y &&
        point.y <= rectangle.y + rectangle.height
    );
}