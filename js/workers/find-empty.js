import { PerlinNoise, rand01 } from "../perlin.js";
import { noise, isCave, caveFloorAdjacent, caveCeilingAdjacent, caveWallAdjacent, CHUNK_SIZE_3 } from "../noise.js";
import { resetSeed, layers, biomes, getLayer } from "../content/layers.js";
let seed, caveNoise, caveNoiseSmall;

let checked = new Set();

Math.lerp = function (a, b, t) {
    return a + (b - a) * Math.min(Math.max(t, 0), 1);
}

function checkAdjacent(x, y, z, func, includeCenter = false) {
    const positions = [[x - 1, y, z], [x + 1, y, z], [x, y - 1, z], [x, y + 1, z], [x, y, z - 1], [x, y, z + 1]];
    if (includeCenter) positions.unshift([x, y, z]);
    for (const pos of positions) {
        if (func(...pos)) return pos;
    }
    return false;
}

function getChunk3Key(x, y, z) {
    return `${Math.floor(x / CHUNK_SIZE_3)}_${Math.floor(y / CHUNK_SIZE_3)}_${Math.floor(z / CHUNK_SIZE_3)}`;
}

console.log("find-empty worker is working. yay!");
self.addEventListener("message", e => {
    const data = e.data;
    if (data.seed) {
        seed = data.seed;
        resetSeed(seed);
        caveNoise = new PerlinNoise(seed + Math.E);
        caveNoiseSmall = new PerlinNoise(seed + Math.E * 2);
    }
    if (data.x === undefined) return;

    let minX = Infinity, minY = Infinity, minZ = Infinity,
        maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    const {x, y, z} = e.data;
    if (checked.has(`${x}_${y}_${z}`)) return;
    console.log(`Starting find-empty worker with seed ${seed} at (${x}, ${y}, ${z})`);
    const queue = [[x, y, z]];
    let queueHead = 0;
    const emptySet = new Set();
    let processedCount = 0;
    let startTime = performance.now();
    let lastLogTime = performance.now();
    const params = [seed, caveNoise, caveNoiseSmall];
    while (queueHead < queue.length) {
        const [cx, cy, cz] = queue[queueHead++];
        const key = `${cx}_${cy}_${cz}`;
        if (checked.has(key)) continue;
        checked.add(key);
        if (cx < minX) minX = cx;
        if (cy < minY) minY = cy;
        if (cz < minZ) minZ = cz;
        if (cx > maxX) maxX = cx;
        if (cy > maxY) maxY = cy;
        if (cz > maxZ) maxZ = cz;
        if (emptySet.has(key)) continue;
        const noiseVal = noise(cx, cy, cz, ...params);
        if (noiseVal.value >= noiseVal.caveReq) {
            emptySet.add(key);
            queue.push([cx + 1, cy, cz]);
            queue.push([cx - 1, cy, cz]);
            queue.push([cx, cy + 1, cz]);
            queue.push([cx, cy - 1, cz]);
            queue.push([cx, cy, cz + 1]);
            queue.push([cx, cy, cz - 1]);
        }
        processedCount++;
        if (performance.now() - lastLogTime > 1000) {
            const pendingQueueLength = queue.length - queueHead;
            console.log(`Processed ${processedCount} blocks, queue length: ${pendingQueueLength}, empty blocks found: ${emptySet.size}`);
            lastLogTime = performance.now();
        }
        if (queueHead > 16384 && queueHead * 2 > queue.length) {
            // garbage collection
            queue.splice(0, queueHead);
            queueHead = 0;
        }
    }
    const emptyArr = [...emptySet].map(s => s.split("_").map(Number));

    let hasCrates = rand01(minX, minY, minZ, seed + Math.E * 5) < 0.2 && y > -10000;
    let hasTorches = (hasCrates || rand01(minX, minY, minZ, seed + Math.E * 6) < 0.5) && y > -10000;
    let hasCrystals = rand01(minX, minY, minZ, seed + Math.E * 7) < 0.3;
    let hasExtinguishedTorches = rand01(minX, minY, minZ, seed + Math.E * 8) < 0.5;

    let caveType = "normal";
    // if (rand01(minX, minY, minZ, seed + Math.E * 9) < 0.15 && y < 0 && y >= -7000) caveType = "moss"; // 15% chance for a mossy cave
    // else if (hasCrystals && rand01(minX, minY, minZ, seed + Math.E * 10) < 0.02) caveType = "enchanted";

    const dripstones = {};
    const dripstoneArr = [];

    const mToSend = [];
    const mToModify = [];
    const priorityChunksToAdd = new Set();
    function m() {
        mToSend.push([...arguments]);
    }

    for (let i = 0; i < emptyArr.length; i++) {
        const pos = emptyArr[i];
        let caveFloor = caveFloorAdjacent(...pos, ...params),
        caveCeiling = caveCeilingAdjacent(...pos, ...params),
        caveWall = caveWallAdjacent(...pos, ...params);
        m(...pos, {ore: "air", temp: true, caveType, hasCrates, hasTorches, hasExtinguishedTorches, hasCrystals, caveFloor, caveCeiling, caveWall});

        function check(x, y, z) {
            return !layers[getLayer(y, x, z, false)]?.caveRules?.noDripstone && caveType !== "moss";
        }

        if (caveFloor && rand01(...pos, seed + Math.E * 3) < 0.05 && check(pos[0], pos[1] - 1, pos[2])) {
            let size = 10;
            let y = pos[1];
            while (emptySet.has(`${pos[0]}_${y}_${pos[2]}`) && size > 0) {
                if (rand01(pos[0], y, pos[2], seed + Math.E * 4) < 0.2) break;
                size -= 2;

                dripstones[`${pos[0]}_${y}_${pos[2]}`] = size / 10;
                dripstoneArr.push([pos[0], y, pos[2]]);
                y++;
            }
        } else if (caveCeiling && rand01(...pos, seed + Math.E * 3) < 0.05 && check(pos[0], pos[1] + 1, pos[2])) {
            let size = 10;
            let y = pos[1];
            while (emptySet.has(`${pos[0]}_${y}_${pos[2]}`) && size > 0) {
                if (rand01(pos[0], y, pos[2], seed + Math.E * 4) < 0.2) break;
                size -= 2;

                dripstones[`${pos[0]}_${y}_${pos[2]}`] = size / 10;
                dripstoneArr.push([pos[0], y, pos[2]]);
                y--;
            }
        }

        checkAdjacent(...pos, (x, y, z) => {
            priorityChunksToAdd.add(getChunk3Key(x, y, z));
        }, true);
    }

    for (let i = 0; i < dripstoneArr.length; i++) {
        const [x, y, z] = dripstoneArr[i];
        mToModify.push([x, y, z, "dripstone", dripstones[`${x}_${y}_${z}`]]);
    }

    self.postMessage({
        type: "emptyResult",
        emptySet, emptyArr,
        bounds: {minX, minY, minZ, maxX, maxY, maxZ},
        caveType,
        hasCrates, hasTorches, hasCrystals, hasExtinguishedTorches,
        dripstones, dripstoneArr,
        mToSend, mToModify, priorityChunksToAdd
    });
});