import { 
    setupWebGL, 
    clearScreen,
    createShader,
    createProgram
} from "./graphics/render.js";

import { startGameLoop } from "./core/game-loop.js";
import { onCanvasClick, isPointInsideRectangle } from "./core/input.js";

const playBtn = document.querySelector("#play-button");

playBtn.addEventListener('click', startGame);   

function startGame (){
    document.querySelector(".menu").classList.toggle('hide')
    document.querySelector(".game").classList.toggle('hide')
}


async function loadShaderSource(fileName) {
    
    const url = new URL(`./shaders/${fileName}`, import.meta.url);
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Erro ao carregar ${fileName}: HTTP ${response.status}.`);
    }

    return response.text();
}

async function main() {
    
    const gl = setupWebGL();
    const status = document.querySelector("#status");
    clearScreen(gl);

    const vertexSource = await loadShaderSource("color.vert");
    const fragmentSource = await loadShaderSource("color.frag");

    const vertexShader = createShader(
        gl, "color.vert", gl.VERTEX_SHADER, vertexSource
    );

    const fragmentShader = createShader(
        gl, "color.frag", gl.FRAGMENT_SHADER, fragmentSource
    );

    const program = createProgram(gl, vertexShader, fragmentShader);

    const positionLocation = gl.getAttribLocation(program, "a_position");
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
    const colorLocation = gl.getUniformLocation(program, "u_color");

    if (
        positionLocation === -1 ||
        resolutionLocation === null ||
        colorLocation === null
    ) {
        throw new Error("Confira os nomes das entradas nos shaders.");
    }

    const rectangle = { x: 100, y: 100, width: 120, height: 80, velocityX: 120, colorIndex: 0, };

    const colors = [
        [0, 1, 0, 1],
        [1, 1, 0, 1], 
    ];

    let clickCount = 0;

    const positions = new Float32Array(12);
    const positionBuffer = gl.createBuffer();
    const vao = gl.createVertexArray();

    if (!positionBuffer || !vao) {
        throw new Error("Não foi possível preparar os vértices.");
    }

    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);

    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    function update(deltaTime) {
        rectangle.x += rectangle.velocityX * deltaTime;

        const maxX = gl.canvas.width - rectangle.width;

        if (rectangle.x >= maxX) {
            rectangle.x = maxX;
            rectangle.velocityX = -Math.abs(rectangle.velocityX);
        } else if (rectangle.x <= 0) {
            rectangle.x = 0;
            rectangle.velocityX = Math.abs(rectangle.velocityX);
        }
    }

    function render() {
        const x1 = rectangle.x;
        const y1 = rectangle.y;
        const x2 = x1 + rectangle.width;
        const y2 = y1 + rectangle.height;

        positions.set([
            x1, y1,
            x2, y1,
            x1, y2,

            x1, y2,
            x2, y1,
            x2, y2,
        ]);

        clearScreen(gl);
        gl.useProgram(program);
        gl.bindVertexArray(vao);

        // Atualiza o buffer existente; não cria outro a cada quadro.
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions);

        gl.uniform2f(resolutionLocation, gl.canvas.width, gl.canvas.height);

        const color = colors[rectangle.colorIndex];
        gl.uniform4f(colorLocation, color[0], color[1], color[2], color[3]);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    onCanvasClick(gl.canvas, (point) => {
        if (!isPointInsideRectangle(point, rectangle)) return;

        rectangle.colorIndex = (rectangle.colorIndex + 1) % colors.length;
        clickCount += 1;

        if (status) {
            status.textContent = `Cliques no retângulo: ${clickCount}.`;
        }
    });

    if (status) {
        status.textContent = "Clique no retângulo em movimento para mudar a cor.";
    }

    startGameLoop(update, render);
}

main().catch((error) => {
    console.error("Erro ao iniciar o desenho:", error);

    const status = document.querySelector("#status");

    if (status) {
        status.textContent = error.message;
    }
});


