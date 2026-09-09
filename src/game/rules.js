//a ideia e manter as regras do jogo centralizadas e imutaveis durante o jogo, por isso o freeze
export const GAME_RULES = Object.freeze({
    fixedStep: 1 / 60, //60 updates por segundo
    clickDamage: 1,
    initialHandSize: 4,
    cardsPerDraw: 2,
    maxHandSize: 6,
    drawInterval: 60, //intervalo de tempo pra obter cartas
});

export const EPSILON = 1e-9; //pra ter uma margem pra se apoiar quando tiver problema com numeros muito pequenos 
