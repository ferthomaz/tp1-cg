export function projection(width, height) {
    if(!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        throw new Error("A largura e a altura devem ser positivas e finitas.");
    }

    //a origem do jogo fica no canto superior esquerdo
    return new Float32Array([
        2 / width, 0, 0,
        0, -2 / height, 0,
        -1, 1, 1,
    ]);
}

//funcao pra deslocar
export function translation(tx, ty) {
    return new Float32Array([
        1, 0, 0,
        0, 1, 0,
        tx, ty, 1,
    ]);
}

//funcao pra aumentar ou diminuir
export function scaling(sx, sy) {
    return new Float32Array([
        sx, 0, 0,
        0, sy, 0,
        0, 0, 1,
    ]);
}

export function multiply(a, b) {
    const result = new Float32Array(9);

    for (let column = 0; column < 3; column += 1) {
        for (let row = 0; row < 3; row += 1) {
            let sum = 0;

            for (let k = 0; k < 3; k += 1) {
                sum += a[k * 3 + row] * b[column * 3 + k];
            }

            result[column * 3 + row] = sum;
        }
    }

    return result;
}