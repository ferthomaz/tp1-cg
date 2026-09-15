export const GAME_RULES = Object.freeze({
    fixedStep: 1 / 60,
    clickDamage: 1,
    initialHandSize: 4,
    cardsPerDraw: 4,
    maxHandSize: 8,
    drawInterval: 60,
    heroMaxHp: 30,
    heroSpeedMultiplier: 2.5,
    heroRespawnTime: 150,
    heroStartTime: 5,
    heroFinishTime: 5,
    wallRepairStartTime: 2,
    heroRepairRate: 1,
    wallRepairRate: 2,
    enemyHeroFocusRange: 48,
    enemyHeroAttackRange: 12,
    wavePreparationTime: 30,
    buildingMaxLevel: 3,
    towerMaxUpgradeTier: 4,
    buildingHealthPerLevel: 0.5,
});

export const TOWER_ELEMENTS = Object.freeze(['water', 'fire', 'poison', 'wind']);
export const UPGRADE_WORK_SECONDS = Object.freeze([90, 120, 150, 300]);
export const TOWER_RANGE_MULTIPLIERS = Object.freeze([1.1, 1.1, 1.15, 1]);
export const EPSILON = 1e-9;
