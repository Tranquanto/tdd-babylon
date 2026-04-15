import vars from "./vars.js";
import { ores, layers, perLayerOreArray, getLayer } from "./content/items.js";
import { rand01, heightMapNoise, heightMapNoiseLarge, heightMapMountain, heightMapMountainLarge, BIOME_INTERVAL } from "./perlin.js";
import { isCave } from "./noise.js";

export function checkAdjacent(x, y, z, func, includeCenter = false) {
    const positions = [[x - 1, y, z], [x + 1, y, z], [x, y - 1, z], [x, y + 1, z], [x, y, z - 1], [x, y, z + 1]];
    if (includeCenter) positions.unshift([x, y, z]);
    for (const pos of positions) {
        if (func(...pos)) return pos;
    }
    return false;
}

vars.BIOME_INTERVAL = BIOME_INTERVAL;

try {
    const statsData = JSON.parse(localStorage.getItem("tdd-stats") || "{}");
    for (const stat in statsData) {
        if (typeof vars.stats[stat] !== typeof statsData[stat]) continue;
        vars.stats[stat] = statsData[stat];
    }
} catch {}

export function establishNoises() {
    vars.heightMapNoise = heightMapNoise;
    vars.heightMapNoiseLarge = heightMapNoiseLarge;
    vars.heightMapMountain = heightMapMountain;
    vars.heightMapMountainLarge = heightMapMountainLarge;
}
establishNoises();

function p(a) {
    console.log(...arguments);
    return a;
}

Math.CBRT3 = Math.cbrt(3);
function preciseRandom(x, y, z, seed, precisionDigits = 24) {
    // return x === undefined ? Math.random() : rand01(x, y, z, seed + Math.CBRT3);
    let str = "";
    for (let i = 0; i < precisionDigits; i++) {
        str += String(Math.floor(rand01(x, y, z, seed + Math.CBRT3 * i) * 10));
    }
    return Number("0." + str);
}

export default vars;
export const map = {}; // the map of all blocks
export const chunks = {}; // the map of all chunks

const air = {ore: "air"};

/**
 * Gets and sets the ore at a specific coordinate.
 * @param {number} x X-coordinate
 * @param {number} y Y-coordinate
 * @param {number} z Z-coordinate
 * @param {object|boolean} v (Optional) Value to set at that coordinate. `true` sets it to air (fallback), and `"delete"` deletes that entry entirely, allowing it to be regenerated.
 * @returns {object|boolean} Returns the value at that coordinate.
 */
export function m(x, y, z, v) {
    if (v === undefined) return map[`${x},${y},${z}`] || false;
    else if (v !== true && v !== "delete") map[`${x},${y},${z}`] = v;
    else if (v === true) map[`${x},${y},${z}`] = air;
    else delete map[`${x},${y},${z}`];
}

const airs = {
    air: 1,
    caveAir: 1
}

export function oreAt(x, y, z) {
    return m(x, y, z) && !airs[m(x, y, z).ore];
}

export function airAt(x, y, z) {
    return m(x, y, z) && airs[m(x, y, z).ore];
}

export function k(x, y, z) { // key
    return `${x},${y},${z}`;
}

export function displayAlert(msg, color = "#fff", time = 10000, borderColor = "#000") {
    requestAnimationFrame(() => {
        const alert = document.createElement("div");
        const div = document.createElement("div");
        alert.classList.add("alert");
        alert.appendChild(div);
        div.innerHTML = msg;
        if (color[0] === "#") {
            div.style.color = color;
        } else if (color) {
            div.style.color = "transparent";
            div.style.background = color;
            div.style.backgroundClip = "text";
        }
        alert.style.animationDuration = time + "ms";
        alert.style.borderColor = borderColor;
        alert.style.filter = `drop-shadow(0 0 0 ${borderColor})`;
        document.getElementById("alerts").append(alert);
        alert.addEventListener("animationend", () => {
            alert.remove();
        });
    });
}
export function getOres(x, y, z, settings) {
    const layer = getLayer(y, x, z, false);
    vars.getOreSettings = settings;
    let caveExclusive = typeof settings === "object" ? settings.caveExclusive : false;
    if (checkAdjacent(x, y, z, isCave)) caveExclusive = true;
    let candidates = [];
    for (let i = 0; i < perLayerOreArray[layer].length; i++) {
        const oreData = perLayerOreArray[layer][i];
        const ore = oreData.id;
        if (oreData.chance === 0) continue;
        if (settings.crystal && oreData.noCrystal) continue;
        
        let cave = !(settings.cave || oreData.cave);

        if (settings.cave?.floor && Number(oreData.cave?.floor) === 1) cave = true;
        if (settings.cave?.ceiling && Number(oreData.cave?.ceiling) === 1) cave = true;
        if (settings.cave?.walls && Number(oreData.cave?.walls) === 1) cave = true;
        if (settings.cave?.air && Number(oreData.cave?.air) === 1) cave = true;

        if (!cave) cave = (settings.isCaveFloor && oreData.cave?.floor === 2);
        if (!cave) cave = (settings.isCaveCeiling && oreData.cave?.ceiling === 2);

        if (!cave || settings.cave && !oreData.cave) continue;
        
        if (typeof oreData.chance === "object") {
            if (!Array.isArray(oreData.chance)) {
                if (y >= oreData.minY && y <= oreData.maxY) {
                    let chance = calculateChance(y, oreData, x, z, undefined, undefined, settings);
                    if (settings.all && chance > 0 || preciseRandom() < chance) { // settings.all = return all possible ores at that location
                        if (!oreData.forced) {
                            candidates.push({ ore, chance, priority: oreData.priority });
                        } else {
                            if (!settings.all) candidates.length = 0;
                            candidates.push({ ore, chance, forced: true, priority: oreData.priority });
                            if (!settings.all) break;
                        }
                    }
                }
            } else {
                let intervals = oreData.chance;
                let forced = false;
                for (let j = 0; j < intervals.length; j++) {
                    const interval = intervals[j];
                    if (y >= interval.minY && y <= interval.maxY) {
                        let chance = calculateChance(y, interval, x, z, undefined, undefined, settings);
                        if (settings.all && chance > 0 || preciseRandom() < chance) {
                            if (!interval.forced && !oreData.forced) {
                                candidates.push({ ore, chance, priority: interval.priority ? interval.priority : oreData.priority });
                                break;
                            } else {
                                if (!settings.all) candidates.length = 0;
                                candidates.push({ ore, chance, forced: true, priority: interval.priority ? interval.priority : oreData.priority });
                                forced = true;
                                break;
                            }
                        }
                    }
                }
                if (forced && !settings.all) break;
            }
        } else if (y >= oreData.minY && y <= oreData.maxY) {
            const chance = calculateChance(y, oreData, x, z, undefined, undefined, settings);
            if (settings.all && chance > 0 || preciseRandom() < chance) {
                if (!oreData.forced) {
                    candidates.push({ ore, chance, priority: oreData.priority });
                } else {
                    if (!settings.all) candidates.length = 0;
                    candidates.push({ ore, chance, forced: true, priority: oreData.priority });
                    if (!settings.all) break;
                }
            }
        }
    }

    // check for duplicates and average chances
    const oreMap = {};
    for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        const interval = getInterval(candidate.ore, y);
        const ce = interval.caveExclusive ? interval.caveExclusive : ores[candidate.ore].caveExclusive;
        if (ce && !caveExclusive && ce !== -1 || ce === -1 && caveExclusive) {
            candidate.chance = 0;
        }
        if (oreMap[candidate.ore]) {
            oreMap[candidate.ore].chance += candidate.chance;
        } else {
            oreMap[candidate.ore] = { chance: candidate.chance, forced: candidate.forced || false, priority: candidate.priority || 0 };
        }
    }
    for (const ore in oreMap) {
        oreMap[ore].chance /= candidates.filter(c => c.ore === ore).length;
    }
    candidates = Object.entries(oreMap).map(([ore, data]) => ({ ore, chance: data.chance, forced: data.forced, priority: data.priority })).filter(c => c.chance > 0);
    if (settings.maxChance) {
        candidates = candidates.filter(c => c.chance <= settings.maxChance);
    }
    if (settings.minChance) {
        candidates = candidates.filter(c => c.chance >= settings.minChance);
    }

    for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        if (candidate.forced) {
            return [candidate];
        }
    }
    return candidates;
}
export function getOre(x, y, z, settings) {
    if (settings === undefined) settings = {caveExclusive: false, all: true};
    settings = {...settings};
    if (layers[getLayer(y, x, z)]?.universalCondition) {
        if (!layers[getLayer(y, x, z)].universalCondition(x, y, z, settings || {})) {
            return {ore: null, bg: null};
        }
    }
    const potentials = getOres(x, y, z, settings || { caveExclusive: false });
    if (potentials.length === 0) return { ore: null, bg: null };
    let ore;
    let bgs = potentials.filter(g => g.chance === Infinity);
    let maxPriority = -Infinity;
    for (let i = 0; i < bgs.length; i++) {
        const bgCandidate = bgs[i];
        const priority = bgCandidate.priority ? bgCandidate.priority : ores[bgCandidate.ore].priority ? ores[bgCandidate.ore].priority : 0;
        if (priority > maxPriority) {
            maxPriority = priority;
        }
    }
    bgs = bgs.filter(g => {
        const priority = g.priority ? g.priority : ores[g.ore].priority ? ores[g.ore].priority : 0;
        return priority === maxPriority;
    });
    let extraBGs = potentials.filter(g => g.chance !== Infinity && ores[g.ore].forcedBG);
    let bg = settings.forcedBackgroundOre ? {ore: settings.forcedBackgroundOre} : bgs[Math.floor(Math.random() * bgs.length)] || null;
    if (!settings.forcedBackgroundOre) {
        for (let i = 0; i < extraBGs.length; i++) {
            const extraBG = extraBGs[i];
            if (preciseRandom() < extraBG.chance) {
                bg = extraBG;
                break;
            }
        }
    }
    if (settings.onlyBG) return bg.ore;
    if (!settings.all) {
        if (potentials.length > 1) {
            let cands = potentials.filter(g => g.chance !== Infinity && !ores[g.ore].forcedBG);
            ore = cands[Math.floor(Math.random() * cands.length)];
        } else {
            ore = potentials[0];
        }
    } else {
        /* const forced = potentials.filter(g => g.forced);
        if (forced.length > 0) {
            let forcedTotal = forced.reduce((acc, g) => acc + g.chance, 0);
            if (forcedTotal > 0) {
                let rand = preciseRandom() * forcedTotal;
                let sum = 0;
                for (const pot of forced) {
                    sum += pot.chance;
                    if (sum >= rand) {
                        ore = pot;
                        ore.chance = pot.chance / Math.max(forcedTotal, 1);
                        break;
                    }
                }
            }
        } */
        potentials.sort((a, b) => a.chance - b.chance);
        let total = potentials.filter(g => g.chance !== Infinity).reduce((acc, g) => acc + g.chance, 0);
        if (total > 1) {
            let rand = preciseRandom(x, y, z, vars.seed + Math.SQRT1_2 + (settings.seedMod || 0)) * total;
            let sum = 0;
            for (let i = 0; i < potentials.length; i++) {
                const pot = potentials[i];
                if (pot.chance === Infinity) continue;
                sum += pot.chance;
                if (sum >= rand) {
                    ore = pot;
                    ore.chance = pot.chance / total;
                    break;
                }
            }
        } else if (total > 0) {
            let rand = preciseRandom(x, y, z, vars.seed + Math.SQRT1_2 + (settings.seedMod || 0)) * (settings.forceSpawn ? total : 1); // forceSpawn is a setting that forces at least one ore to spawn (crates use this)
            let sum = 0;
            for (let i = 0; i < potentials.length; i++) {
                const pot = potentials[i];
                if (pot.chance === Infinity) continue;
                sum += pot.chance;
                if (sum >= rand) {
                    ore = pot;
                    if (settings.forceSpawn) ore.chance = pot.chance / total;
                    break;
                }
            }
        } else {
            ore = potentials[~~(Math.random() * potentials.length)];
        }
    }
    if (ore === undefined) {
        // if (!bg) console.log("No ore found at", x, y, z, "with settings", settings, "potentials:", potentials, "bg:", bg);
        ore = bg;
    }
    if (ore !== null && bg === null) bg = { ore: "shale", chance: Infinity };
    return { ore: ore ? ore.ore : null, bg: bg ? bg.ore : null, x, y, z, chance: ore ? ore.chance : 0, conditionLabel: getInterval(ore ? ore.ore : null, y).conditionLabel };
}

export function getBGOre(x, y, z) {
    const bg = getOre(x, y, z, {onlyBG: true});
    return bg ? bg : null;
}

export function calculateChance(y, interval, x, z, disregardCondition, adjusted, settings) {
    const chance = adjusted ? interval.adjustedChance : interval.chance;
    const isObject = typeof chance === "object";
    if (chance === undefined || chance === null) return undefined;
    if (chance === 0) return 0;
    const min = interval.minY;
    const dd = interval.maxY - interval.minY;
    const minc = isObject ? chance.min : chance;
    const dc = isObject ? chance.max - chance.min : 0;
    const easing = interval.easing;
    let progress = isNaN((y - min) / dd) ? 0.5 : (y - min) / dd;
    if (easing) {
        if (easing.type !== "custom") {
            if (easing.type === "in") {
                progress = Math.pow(progress, easing.exponent);
            } else if (easing.type === "out") {
                progress = 1 - Math.pow(1 - progress, easing.exponent);
            } else if (easing.type === "in-out") {
                if (progress < 0.5) {
                    progress = Math.pow(progress * 2, easing.exponent) / 2;
                } else {
                    progress = 1 - Math.pow(1 - (progress - 0.5) * 2, easing.exponent) / 2;
                }
            }
        } else {
            if (typeof easing.func === "function") {
                progress = easing.func(progress);
            }
        }
    }
    let i = 1;

    // main culprit for performance issues
    if (interval.condition !== undefined && (!disregardCondition || interval.forceCondition && !adjusted)) {
        i = Number(interval.condition(x, y, z, settings || {})); // can increase or decrease chance
    }

    if (1 - (1 - (minc + dc * progress)) <= vars.RARE_ORE_CHANCE_MULTIPLIER_CUTOFF) i *= vars.RARE_ORE_CHANCE_MULTIPLIER;
    if (layers[getLayer(y, x, z, false)]?.universalCondition) {
        i *= Number(layers[getLayer(y, x, z, false)].universalCondition(x, y, z, settings || {}));
    }

    const baseChance = minc + dc * progress;
    if (i !== 1) {
        return baseChance * i;
    } else {
        return baseChance;
    }
}

export function calculateRarity(ore, y, x, z) {
    if (!ore) return undefined;
    if (typeof ore.chance === "object") {
        if (!Array.isArray(ore.chance)) {
            if (y < ore.minY || y > ore.maxY) return 0;
            return calculateChance(y, ore, x, z);
        } else {
            let intervals = ore.chance;
            for (let i = 0; i < intervals.length; i++) {
                const interval = intervals[i];
                if (y >= interval.minY && y <= interval.maxY) {
                    return calculateChance(y, interval, x, z);
                }
            }
        }
    } else if (y >= ore.minY && y <= ore.maxY) {
        return calculateChance(y, ore, x, z);
    }
    return 0;
}

export function getInterval(oreID, y) {
    const ore = ores[oreID];
    if (ore === null || ore === undefined) return false;
    if (typeof ore.chance === "object") {
        if (!Array.isArray(ore.chance)) {
            if (y < ore.minY || y > ore.maxY) return false;
            return ore;
        } else {
            let intervals = ore.chance;
            for (let i = 0; i < intervals.length; i++) {
                const interval = intervals[i];
                if (y >= interval.minY && y <= interval.maxY) {
                    return interval;
                }
            }
        }
    } else if (y >= ore.minY && y <= ore.maxY) {
        return ore;
    }
    return false;
}

export function calculatePower(x, y, z) {
    const {inventory} = vars;
    let pow = typeof inventory.currentPickaxe.power === "function" ? inventory.currentPickaxe.power(x, y, z) : inventory.currentPickaxe.power;
    // if (y < vars.player.maxSafeDepth) pow /= 1.05 ** (vars.player.maxSafeDepth - y);
    return pow;
}

document.getElementById("version").innerText = `Version ${vars.version}`;