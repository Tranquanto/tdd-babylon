import { createNoise3D } from "./simplex-noise.js";

Math.seedrandom = function(seed) {
    const key = [];

    function Mash() {
        let n = 0xefc8249d;
        const mash = function (data) {
            data = data.toString();
            for (let i = 0; i < data.length; i++) {
                n += data.charCodeAt(i);
                let h = 0.02519603282416938 * n;
                n = h >>> 0;
                h -= n;
                h *= n;
                n = h >>> 0;
                h -= n;
                n += h * 0x100000000;
            }
            return (n >>> 0) * 2.3283064365386963e-10;
        };
        mash.version = "Mash 0.9";
        return mash;
    }

    let random = Mash();
    key[0] = random(seed);
    key[1] = random(key[0]);
    key[2] = random(key[1]);
    key[3] = random(key[2]);
    random = null;
    return function () {
        const t = 2091639 * key[3] + 2.3283064365386963e-10;
        key[0] = key[1];
        key[1] = key[2];
        key[2] = key[3];
        return key[3] = t - (key[3] = t | 0);
    };
}

function hash(x, y, z, seed) {
    let h = (seed * 1664525) ^ (x * 374761393) ^ (y * 668265263) ^ (z * 2147483647);
    h = (h ^ (h >> 13)) * 1274126177;
    return h ^ (h >> 16);
}

/**
 * Generates a pseudorandom number between 0 and 1 based on the input coordinates and seed.
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} seed Seed for the generator.
 * @returns {number} A pseudorandom number between 0 and 1 based on the input coordinates and seed. If any parameter is undefined, returns Math.random() instead.
 */
export function rand01(x, y, z, seed) {
    if (x === undefined || y === undefined || z === undefined || seed === undefined) return Math.random();
    return (hash(x, y, z, seed) >>> 0) / 2147483648;
}

export class PerlinNoise {
    constructor(seed) {
        // Use the Mash/seedrandom PRNG for better seeding
        this.seed = seed;
        this._rand = Math.seedrandom(seed);
        this.p = this.generatePermutationTable();

        // uses pi to prevent any accidental collisions with biomes
        this.xMod = Math.seedrandom(seed + Math.PI * 0.5)();
        this.yMod = Math.seedrandom(seed + Math.PI)();
        this.zMod = Math.seedrandom(seed + Math.PI * 1.5)();

        this.cache = {};
    }

    generatePermutationTable() {
        let p = new Array(512);
        let perm = new Array(256);

        // Fill perm with 0..255 and shuffle using seeded PRNG
        for (let i = 0; i < 256; i++) {
            perm[i] = i;
        }
        for (let i = 255; i > 0; i--) {
            let j = Math.floor(this._rand() * (i + 1));
            [perm[i], perm[j]] = [perm[j], perm[i]];
        }
        for (let i = 0; i < 512; i++) {
            p[i] = perm[i & 255];
        }
        return p;
    }

    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    lerp(a, b, t) {
        return a + t * (b - a);
    }

    grad(hash, x, y, z) {
        let h = hash & 15;
        let u = h < 8 ? x : y;
        let v = h < 4 ? y : h === 12 || h === 14 ? x : z;
        return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
    }

    noise(x, y, z) {
        if (this.cache[`${x}_${y}_${z}`] !== undefined) return this.cache[`${x}_${y}_${z}`];
        const x1 = x, y1 = y, z1 = z;
        x += this.xMod;
        y += this.yMod;
        z += this.zMod;

        let X = Math.floor(x) & 255;
        let Y = Math.floor(y) & 255;
        let Z = Math.floor(z) & 255;

        x -= Math.floor(x);
        y -= Math.floor(y);
        z -= Math.floor(z);

        let u = this.fade(x);
        let v = this.fade(y);
        let w = this.fade(z);

        let A = this.p[X] + Y;
        let AA = this.p[A] + Z;
        let AB = this.p[A + 1] + Z;
        let B = this.p[X + 1] + Y;
        let BA = this.p[B] + Z;
        let BB = this.p[B + 1] + Z;

        return this.cache[`${x1}_${y1}_${z1}`] = this.lerp(
            this.lerp(
                this.lerp(this.grad(this.p[AA], x, y, z), this.grad(this.p[BA], x - 1, y, z), u),
                this.lerp(this.grad(this.p[AB], x, y - 1, z), this.grad(this.p[BB], x - 1, y - 1, z), u),
                v
            ),
            this.lerp(
                this.lerp(this.grad(this.p[AA + 1], x, y, z - 1), this.grad(this.p[BA + 1], x - 1, y, z - 1), u),
                this.lerp(this.grad(this.p[AB + 1], x, y - 1, z - 1), this.grad(this.p[BB + 1], x - 1, y - 1, z - 1), u),
                v
            ),
            w
        );
    }
}

export class SimplexNoise {
    constructor(seed) {
        // Use the Mash/seedrandom PRNG for better seeding
        this.seed = seed;
        this._rand = rand01.bind(null, 0, 0, 0, seed - Math.SQRT2);
        this._noise = createNoise3D(this._rand);

        // uses pi to prevent any accidental collisions with biomes
        this.xMod = Math.seedrandom(seed + Math.PI * 0.5)();
        this.yMod = Math.seedrandom(seed + Math.PI)();
        this.zMod = Math.seedrandom(seed + Math.PI * 1.5)();

        this.cache = {};
    }

    noise(x, y, z) {
        if (this.cache[`${x}_${y}_${z}`] !== undefined) return this.cache[`${x}_${y}_${z}`];
        const x1 = x, y1 = y, z1 = z;
        x += this.xMod;
        y += this.yMod;
        z += this.zMod;
        return this.cache[`${x1}_${y1}_${z1}`] = this._noise(x, y, z);
    }
}

function createWorley3D(seed) {
    function randomPointInCell(cx, cy, cz) {
        return {
            x: cx + rand01(cx, cy, cz, seed),
            y: cy + rand01(cx + 17, cy - 11, cz + 5, seed),
            z: cz + rand01(cx - 3, cy + 7, cz - 13, seed)
        };
    }
    return function(x, y, z, cellSize = 8) {
        const px = x / cellSize;
        const py = y / cellSize;
        const pz = z / cellSize;

        const cx = Math.floor(px);
        const cy = Math.floor(py);
        const cz = Math.floor(pz);

        let minDist = Infinity;

        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                for (let dz = -1; dz <= 1; dz++) {
                    const point = randomPointInCell(cx + dx, cy + dy, cz + dz);
                    const dist = Math.sqrt((point.x - px) ** 2 + (point.y - py) ** 2 + (point.z - pz) ** 2);
                    if (dist < minDist) {
                        minDist = dist;
                    }
                }
            }
        }
        return minDist / Math.sqrt(3);
    }   
}

export const seed = Number(URLSearchParams && location ? new URLSearchParams(location.search).get("seed") : 0) || Math.floor(Math.random() * Number.MAX_SAFE_INTEGER / 100000) + 1;

export const heightMapNoise = new PerlinNoise(seed + Math.sqrt(Math.E));
export const heightMapNoiseLarge = new PerlinNoise(seed + Math.sqrt(Math.E) * 2);
export const heightMapMountain = new PerlinNoise(seed + Math.sqrt(Math.E) * 3);
export const heightMapMountainLarge = new PerlinNoise(seed + Math.sqrt(Math.E) * 4);

export const temperatureNoise = new PerlinNoise(seed + Math.LN10);
export const humidityNoise = new PerlinNoise(seed + Math.LN10 * 2);

export const caveNoise = new PerlinNoise(seed + Math.E);
export const caveNoiseSmall = new PerlinNoise(seed + Math.E * 2);

export const deepSpaceNoise = createWorley3D(seed + Math.PI * 2);

export const BIOME_INTERVAL = 80;
export const MIN_CAVE_REQ = 0.4;
export const CAVE_SIZE = 20;