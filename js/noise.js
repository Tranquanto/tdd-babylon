import { layers, getLayer } from './content/layers.js';
import { caveNoise, caveNoiseSmall, MIN_CAVE_REQ, CAVE_SIZE } from "./perlin.js";
export const barrierY = -8000;

export const CHUNK_SIZE = 4;
export const CHUNK_SIZE_3 = 6;
export const CHUNK3_RATE = 1;

export function noise(x, y, z, seed, cave = caveNoise, caveSmall = caveNoiseSmall) {
    const layer = getLayer(y, x, z, false);
    let a;
    if (layers[layer] && layers[layer].caveNoise) a = layers[layer].caveNoise(x, y, z, CAVE_SIZE, seed);
    else if (y < -120) {
        a = cave.noise(x / CAVE_SIZE, y / CAVE_SIZE, z / CAVE_SIZE);
    } else if (y < -100) {
        a = Math.lerp(cave.noise(x / CAVE_SIZE, y / CAVE_SIZE, z / CAVE_SIZE), caveSmall.noise(x / (CAVE_SIZE / 2), y / (CAVE_SIZE / 2), z / (CAVE_SIZE / 2)), (y + 120) / 20);
    } else {
        a = caveSmall.noise(x / (CAVE_SIZE / 2), y / (CAVE_SIZE / 2), z / (CAVE_SIZE / 2));
    }
    if (y >= -8000 && y < -7950) { // smaller caves around the barrier
        a *= Math.max(1 - (y + 7950) / 100, 0.5);
    } else if (y > -8050 && y < -8000) {
        a *= Math.max(1 - (y + 8050) / 100, 0.5);
    }
    if (y <= barrierY + 1 && y >= barrierY - 1) a = 0;
    if (y <= -9999 && y >= -10001) a = 0;
    if (y > 0) a = 0;
    else if (y > -20) a *= Math.lerp(0, 1, -y / 20);
    return {value: a, caveReq: layers[layer].caveReq || MIN_CAVE_REQ};
}

export function isCave(x, y, z, ...args) {
    const n = noise(x, y, z, ...args);
    return n.value > n.caveReq;
}

export function caveWallAdjacent(x, y, z, ...args) {
    for (const pos of [[x - 1, y, z], [x + 1, y, z], [x, y, z - 1], [x, y, z + 1]].sort(() => Math.random() - 0.5)) {
        if (isCave(x, y, z, ...args) && !isCave(...pos, ...args)) return [pos[0] - x, pos[1] - y, pos[2] - z]; // relative
    }
    return false;
}

export function caveFloorAdjacent(x, y, z, ...args) {
    if (isCave(x, y, z, ...args) && !isCave(x, y - 1, z, ...args)) return [x, y - 1, z];
    return false;
}

export function caveCeilingAdjacent(x, y, z, ...args) {
    if (isCave(x, y, z, ...args) && !isCave(x, y + 1, z, ...args)) return [x, y + 1, z];
    return false;
}

export function isCaveCeiling(x, y, z, ...args) {
    return !isCave(x, y, z, ...args) && isCave(x, y - 1, z, ...args);
}

export function isCaveFloor(x, y, z, ...args) {
    return !isCave(x, y, z, ...args) && isCave(x, y + 1, z, ...args);
}