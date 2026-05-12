// this is basically just storing of any lists like items, recipes, etc.

/* --------------------------------------------------------------

    WARNING: THIS FILE CONTAINS SPOILERS.
    EVERY ORE, ITEM, ACHIEVEMENT, ETC. IS DEFINED HERE.
    DO NOT PROCEED IF YOU WISH TO DISCOVER THEM YOURSELF IN-GAME.
    thank you :3

 ------------------------------------------------------------- */

const replacedIds = { // for items that have been renamed; note: this will be removed on release
    gussite: "sunstone",
    teleporter: "marineTeleporter",
    voidTeleporter: "marineTeleporter",
    slate: "shale",
    slatePickaxe: "shalePickaxe"
};

import vars from "../vars.js";
import { getOre, m, airAt } from "../outside_stuff.js";
import { PerlinNoise, rand01 } from "../perlin.js";

import {
    layers,
    biomes,
    maxHeight,
    minHeight,
    getLayer,
    topLayer,
    layerArray,
    biomeArray,
    getBiomeNumber,
    getTemperature,
    getHumidity
} from "./layers.js";

const { stats } = vars;

const tiers = {
    common: { // anything that doesn't fit into the other categories
        color: "#ffffff",
        name: "Common",
        maxChance: Infinity, // inclusive (except for infinity ofc)
        minChance: 1 / 1000 // exclusive
    },
    uncommon: {
        color: "#00ff00",
        name: "Uncommon",
        maxChance: 1 / 1000,
        minChance: 1 / 10000
    },
    rare: {
        color: "#8888ff",
        name: "Rare",
        maxChance: 1 / 10000,
        minChance: 1 / 100000
    },
    epic: {
        color: "#ff00ff",
        name: "Epic",
        maxChance: 1 / 1e5,
        minChance: 1 / 1e6,
        audio: true
    },
    legendary: {
        color: "#ff8800",
        name: "Legendary",
        maxChance: 1 / 1e6,
        minChance: 1 / 3e6,
        audio: true
    },
    divine: {
        color: "#ffaee4",
        name: "Divine",
        maxChance: 1 / 3e6,
        minChance: 1 / 1e7,
        audio: true
    },
    mythic: {
        color: "#00ffff",
        name: "Mythic",
        maxChance: 1 / 1e7,
        minChance: 1 / 3e7,
        audio: true
    },
    angelic: {
        color: "#fff67d",
        name: "Angelic",
        maxChance: 1 / 3e7,
        minChance: 1 / 1e8,
        audio: true
    },
    unfathomable: {
        color: "#ff0000",
        name: "Unfathomable",
        maxChance: 1 / 1e8,
        minChance: 1 / 3e8,
        audio: true
    },
    extravagant: {
        color: "#80ff80",
        name: "Extravagant",
        maxChance: 1 / 3e8,
        minChance: 1 / 1e9,
        audio: true
    },
    inconceivable: {
        color: "#aa00ff",
        name: "Inconceivable",
        maxChance: 1 / 1e9,
        minChance: 1 / 3e9,
        audio: true
    },
    apotheotic: {
        color: "#ff6600",
        name: "Apotheotic",
        maxChance: 1 / 3e9,
        minChance: 1 / 1e10,
        audio: true
    },
    transcendent: {
        color: "#0099ff",
        name: "Transcendent",
        maxChance: 1 / 1e10,
        minChance: 1 / 3e10,
        audio: true
    },
    metaexistential: {
        color: "#ffbe88",
        name: "Metaexistential",
        maxChance: 1 / 3e10,
        minChance: 1 / 1e11,
        audio: true
    },
    omniversal: {
        color: "#0044ff",
        name: "Omniversal",
        maxChance: 1 / 1e11,
        minChance: -Infinity,
        audio: true
    },
    peculiar: { // requires special conditions to spawn (common to uncommon)
        color: "#a08b48",
        name: "Peculiar"
    },
    enigmatic: { // same as peculiar but rarer (rare to epic)
        color: "#a6a9a3",
        name: "Enigmatic",
        local: true
    },
    exotic: { // rarer than enigmatic (legendary to mythic)
        color: "#d089ff",
        name: "Exotic",
        global: true
    },
    bizarre: { // rarer than exotic (angelic+)
        color: "#9d1153",
        name: "Bizarre",
        global: true,
        audio: true
    },
    legacy: { // ores that are no longer obtainable, but still exist to those who held onto them
        color: "#000000",
        name: "Legacy"
    },
    placeholder: {
        color: "#ffffff",
        name: "Placeholder"
    }
};

const sfxOptions = {
    grass: {
        count: 4,
        volume: 0.3
    },
    stone: {
        count: 8
    },
    sand: {
        count: 8,
        volume: 0.25
    },
    metal: {
        count: 7
    },
    wood: {
        count: 5
    }
};

let surfaceOres = [];

let ores = {
    // dragon planet
    dragonScales: {
        name: "Dragon Scales",
        color: "#90f",
        chance: 0, // 1 / 100,
        maxY: 3000,
        minY: 2000,
        str: 73,
        light: {
            col: "#90f",
            str: 0.5
        },
        desc: "The scales of an ancient mythical beast... or something like that."
    },
    // space
    iridium: {
        name: "Iridium",
        color: "#c69841",
        chance: {max: 1 / 1275, min: 1 / 300},
        maxY: 2000,
        minY: 1301,
        str: 250,
        desc: "A rare metal used in high-end electronics and spacecraft."
    },
    osmium: {
        name: "Osmium",
        color: "#a2bed1",
        chance: {max: 1 / 45, min: 1 / 750},
        maxY: 2000,
        minY: 1001,
        str: 320,
        light: {
            col: "#a2bed1",
            str: 1
        },
        desc: "The densest of the elements!"
    },
    // sky
    floacite: { // from the original bad mining game
        name: "Floacite",
        color: "#fe9cff",
        chance: 1 / 300,
        maxY: 1000,
        minY: 251,
        str: 50,
        desc: "An ore of flotium; strangely only found in clouds."
    },
    thundrite: {
        name: "Thundrite",
        color: "#ece93e",
        chance: [
            {
                chance: 1 / 888,
                maxY: 1000,
                minY: 251,
                condition(x, y, z) {
                    return getBiomeNumber(x, Math.max(y, 250), z, "rainy") >= 0.7;
                }
            },
            {
                chance: 1 / 888,
                maxY: maxHeight,
                minY: minHeight,
                condition(x, y, z) {
                    return getBiomeNumber(x, Math.max(y, 250), z, "rainy") >= 0.7 && y === topLayer(x, z);
                }
            }
        ],
        str: 64,
        light: {
            col: "#ff0",
            str: 3
        },
        particles: {
            area: {x: 2, y: 2, z: 2},
            texture: "particle",
            emitRate: 10,
            lifetime: 2,
            count: 50,
            size: 0.1,
            centerGravity: 0.2,
            color: "#ff0"
        },
        desc: "The Thunder Lord seems to have left this behind. Handle with care!",
        tier: "uncommon",
        conditionLabel: "Weather must be stormy",
        wikiBG: "thunderCloud"
    },
    outlite: {
        name: "Outlite",
        color: "#e9e9e9",
        chance: 1 / 5000,
        maxY: 1000,
        minY: 251,
        str: 120,
        desc: "why is there an outlet up here",
        conditionLabel: "Weather must be stormy",
        tier: "enigmatic",
        excludeFromWiki: 1,
        wikiBG: "thunderCloud"
    },
    // surface or above
    plastic: {
        name: "Plastic",
        color: "#ff8888",
        chance: 0.004,
        maxY: maxHeight + 1,
        minY: minHeight + 1,
        str: 0.25,
        singleLayer: true,
        noTexture: true,
        desc: "A littered piece of plastic.",
        noVein: true, // for lag reasons
        noGeode: true,
        clayCondition(x, y, z) {
            return getBiomeNumber(x, y - 1, z, "clay") < 0.6 && (y === topLayer(x, z) + 1) && !biomes.desert.requirement(x, y, z);
        },
        conditionLabel: "Never in surface biomes",
        sfx: "wood"
    },
    wood: {
        name: "Wood",
        color: "#b78b63",
        chance: 1 / 75,
        maxY: maxHeight + 1,
        minY: minHeight + 1,
        str: 0.3,
        tree: {
            leaves: {
                block: (x, y, z) => {
                    return biomes.autumnal.requirement(x, y, z) ? "autumnalLeaves" : "leaves";
                }
            },
            height: {
                min: 3,
                max: 6
            }
        },
        singleLayer: true, // single-layered texture
        desc: "Comes from the trunks of trees.",
        clayCondition(x, y, z) {
            return Number(!(x === 0 && z === 0) && getBiomeNumber(x, y - 1, z, "clay") < 0.6) && (y === topLayer(x, z) + 1) && !biomes.desert.requirement(x, y, z);
        },
        conditionLabel: "Never in fossilized biomes; rarer in snowy biomes",
        noGeode: true,
        sfx: "wood" // the sound that plays when breaking this block
    },
    cactus: {
        name: "Cactus",
        color: "#3b6f2b",
        chance: 1 / 150,
        maxY: maxHeight + 1,
        minY: minHeight + 1,
        str: 0.2,
        singleLayer: true,
        desc: "A spiky plant found in deserts.",
        condition(x, y, z) {
            return (y === topLayer(x, z) + 1) && getLayer(y, x, z, true) === "desert";
        },
        conditionLabel: "Only in deserts",
        noGeode: true,
        noTraits: true,
        sfx: "grass",
        onTouch() {
            vars.player.damage(5, 200, "cactus");
        }
    },
    leaves: {
        name: "Leaves",
        color: "#2b750e",
        chance: 0,
        maxY: 0,
        minY: 0,
        str: 0.1,
        textureHasTransparency: true, // to prevent things underneath from not rendering
        noGeode: true,
        notCollidable: true,
        desc: "The foliage that grows on trees.",
        condition(x, y, z) {
            return getBiomeNumber(x, y - 1, z, "clay") < 0.6;
        },
        conditionLabel: "Never in fossilized biomes",
        sfx: "grass"
    },
    autumnalLeaves: {
        name: "Autumnal Leaves",
        color: "#793e00",
        chance: 0,
        maxY: 0,
        minY: 0,
        str: 0.1,
        textureHasTransparency: true,
        noGeode: true,
        notCollidable: true,
        desc: "The foliage that grows on trees in autumn.",
        condition(x, y, z) {
            return getBiomeNumber(x, y - 1, z, "clay") < 0.6;
        },
        conditionLabel: "Never in fossilized biomes",
        sfx: "wood"
    },
    snow: {
        name: "Snow",
        color: "#ddf0f3",
        chance: 1,
        maxY: 250,
        minY: 10,
        str: 0.15,
        notCollidable: true,
        noVein: true,
        noGeode: true,
        noTraits: true,
        scale: {y: 0.1},
        offset: {y: -0.45},
        desc: "A powdery form of ice.",
        sfx: "sand", // for now
        singleLayer: true,
        condition(x, y, z) {
            if (airAt(x, y - 1, z)) return false;
            if (y !== topLayer(x, z) + 1) return false;
            const n = Math.min(getBiomeNumber(x, 250, z, "rainy") - 0.3, -getTemperature(x, y, z) / 50);
            return n >= 0.1 ? 1 : n < -0.1 ? 0 : n * 5 + 0.5;
        }
    },

    // fillers
    dragonStone: {
        name: "Dragon Stone",
        color: "#a0f",
        chance: 0,
        maxY: 3000,
        minY: 2000,
        str: 73,
        singleLayer: true,
        desc: "A magical stone that is said to be from the dragon planet. The dragon planet was only supposed to be a myth, though...",
        sfx: "stone"
    },
    meteorite: {
        name: "Meteorite",
        color: "#766",
        chance: Infinity,
        maxY: 10000,
        minY: 1001,
        str: 4,
        singleLayer: true,
        desc: "A rock from space, rich with rare metals.",
        sfx: "stone"
    },
    cloud: {
        name: "Cloud",
        color: "#fff",
        chance: Infinity,
        maxY: 1000,
        minY: 250,
        str: 0.1,
        singleLayer: true,
        desc: "google says clouds are made of water vapor but i say they're made of cotton candy. also github copilot wrote this description, not me (except this half)",
        condition(x, y, z) {
            const a = getBiomeNumber(x, y, z, "rainy");
            return a < 0.4;
        },
        sfx: "sand",
        allowTransparent: true
    },
    rainCloud: {
        name: "Rain Cloud",
        color: "#556177",
        chance: Infinity,
        maxY: 1000,
        minY: 250,
        str: 0.16,
        singleLayer: true,
        desc: "A wetter cloud.",
        condition(x, y, z) {
            const a = getBiomeNumber(x, y, z, "rainy");
            return a >= 0.4 && a < 0.7;
        },
        sfx: "sand"
    },
    thunderCloud: {
        name: "Storm Cloud",
        color: "#2d2d2d",
        chance: Infinity,
        maxY: 1000,
        minY: 250,
        str: 0.2,
        singleLayer: true,
        desc: "Don't get struck by lightning!",
        condition(x, y, z) {
            const a = getBiomeNumber(x, y, z, "rainy");
            return a >= 0.7 && a < 1;
        },
        sfx: "sand"
    },
    plasma: {
        name: "Plasma",
        color: "#00ecec",
        chance: Infinity,
        maxY: 1000,
        minY: 250,
        str: 0.3,
        singleLayer: true,
        desc: "what the heck",
        otherDetails: "if you found this, that means the perlin noise value went above 1, which it isn't even programmed to do. congratulations!",
        condition(x, y, z) {
            return getBiomeNumber(x, y, z, "rainy") >= 1;
        },
        tier: "exotic",
        noGlobal: true,
        excludeFromWiki: 1,
        emissive: {
            str: 0.8
        },
        sfx: "sand"
    },
    grass: {
        name: "Grass",
        color: "#2b750e",
        chance: Infinity,
        maxY: maxHeight,
        minY: minHeight,
        str: 0.6,
        singleLayer: true,
        desc: "A plant that grows on the surface.",
        multipleTextures: [
            "grass_side", // +x
            "grass_side", // -x
            "grass", // +y
            "dirt", // -y
            "grass_side", // +z
            "grass_side" // -z
        ],
        condition(x, y, z) {
            return y === topLayer(x, z) && checkAllBiomes(x, y, z);
        },
        sfx: "grass"
    },
    autumnalGrass: {
        name: "Autumnal Grass",
        color: "#8f4a00",
        chance: Infinity,
        maxY: maxHeight,
        minY: minHeight,
        str: 0.6,
        singleLayer: true,
        desc: "A plant that grows in autumnal biomes.",
        multipleTextures: [
            "autumnalGrass_side", // +x
            "autumnalGrass_side", // -x
            "autumnalGrass", // +y
            "dirt", // -y
            "autumnalGrass_side", // +z
            "autumnalGrass_side" // -z
        ],
        condition(x, y, z) {
            return y === topLayer(x, z) && checkAllBiomes(x, y, z, "autumnal");
        },
        sfx: "grass"
    },
    clay: {
        name: "Clay",
        color: "#994e39",
        chance: Infinity,
        maxY: maxHeight,
        minY: minHeight,
        str: 0.6,
        singleLayer: true,
        desc: "A soft, malleable material that may hold riches...",
        condition(x, y, z) {
            return getBiomeNumber(x, y, z, "clay") >= 0.6 && getLayer(y, x, z, true) !== "desert" && y <= topLayer(x, z);
        },
        sfx: "sand",
        priority: 2
    },
    dirt: {
        name: "Dirt",
        color: "#573a23",
        chance: [
            {
                chance: Infinity, // generation probability from 0-1. Infinity means it is the base and other ores will generate on top of it (only one per X/Y level can have Infinity) // only used if chance is Infinity; kinda like z-index in css
                maxY: maxHeight,
                minY: minHeight,
                condition(x, y, z) {
                    return getBiomeNumber(x, y, z, "clay") < 0.6 && !biomes.desert.requirement(x, y, z) && y < topLayer(x, z) && y >= topLayer(x, z) - 4;
                }
            },
            {
                chance: Infinity,
                maxY: minHeight,
                minY: -1000,
                priority: 1,
                condition(x, y, z) {
                    return getBiomeNumber(x, y, z, "dirt") > 0.5 && y < topLayer(x, z) - 4;
                }
            }
        ],
        str: 0.5,
        singleLayer: true,
        desc: "An organic mixture found along the surface.",
        sfx: "sand"
    },
    sand: {
        name: "Sand",
        color: "#f0e68c",
        chance: [
            {
                chance: Infinity,
                maxY: maxHeight,
                minY: minHeight,
                condition(x, y, z) {
                    return biomes.desert.requirement(x, y, z) && y <= topLayer(x, z) && y >= topLayer(x, z) - 4;
                }
            }
        ],
        str: 0.4,
        singleLayer: true,
        forcedBG: true,
        desc: "A granular material found in deserts.",
        sfx: "sand"
    },
    sandstone: {
        name: "Sandstone",
        color: "#f3dd8f",
        chance: [
            {
                chance: Infinity,
                maxY: maxHeight + 5,
                minY: 0,
                condition(x, y, z) {
                    return biomes.desert.requirement(x, topLayer(x, z) - 4, z) && y < topLayer(x, z) - 4;
                }
            }
        ],
        str: 0.85,
        singleLayer: true,
        noRandomRotation: true,
        desc: "A sedimentary rock formed from compacted sand.",
        sfx: "stone"
    },
    shale: {
        name: "Shale",
        color: "#777",
        chance: [
            {maxY: maxHeight - 5, minY: -100, chance: Infinity}
        ],
        str: 1,
        singleLayer: true,
        desc: "A common sedimentary rock found along the surface.",
        condition(x, y, z) {
            return y < 0 || y < topLayer(x, z) - 4 && !biomes.desert.requirement(x, topLayer(x, z) - 4, z);
        },
        sfx: "stone"
    },
    granite: {
        name: "Granite",
        color: "#f77",
        chance: Infinity,
        maxY: -101,
        minY: -300,
        str: 1,
        singleLayer: true,
        desc: "An igneous rock composed mainly of quartz and feldspar.",
        sfx: "stone"
    },
    gneiss: {
        name: "Gneiss",
        color: "#b5b5b5",
        chance: Infinity,
        maxY: -301,
        minY: -600,
        str: 1,
        singleLayer: true,
        desc: "A metamorphic rock with distinct banding patterns.",
        sfx: "stone"
    },
    marble: {
        name: "Marble",
        color: "#d6d6d6",
        chance: Infinity,
        maxY: -601,
        minY: -1000,
        str: 1,
        singleLayer: true,
        desc: "A crystalline rock formed from limestone.",
        sfx: "stone"
    },
    bedrock: {
        name: "Bedrock",
        color: "#555",
        chance: [{
            chance: {max: 0, min: 1},
            maxY: -995,
            minY: -1000
        },
        {
            chance: {max: 1, min: 0},
            maxY: -1000,
            minY: -1005
        },
        {
            chance: {max: 0, min: 1},
            maxY: -6995,
            minY: -7000
        },
        {
            chance: {max: 1, min: 1/16},
            maxY: -7000,
            minY: -7005
        },
        {
            chance: 1 / 16,
            maxY: -7005,
            minY: -8000
        }],
        str: 15,
        singleLayer: true,
        noGeode: true,
        noVein: true,
        forcedBG: true,
        desc: "The bottom layer of the world. It's unbreakable. I think.",
        sfx: "stone"
    },
    pumice: {
        name: "Pumice",
        color: "#bcb87e",
        chance: Infinity,
        maxY: -1001,
        minY: -1500,
        str: 0.75,
        singleLayer: true,
        desc: "A light, soft stone with a lot of air holes.",
        creator: ["Tranquanto", "squid"],
        sfx: "stone"
    },
    ignimbrite: {
        name: "Ignimbrite",
        color: "#b0b264",
        chance: Infinity,
        maxY: -1501,
        minY: -2000,
        str: 1.2,
        singleLayer: true,
        desc: "This rock seems to somehow be electrically charged.",
        sfx: "stone"
    },
    carnotite: {
        name: "Carnotite",
        color: "#98a52d",
        chance: Infinity,
        maxY: -2001,
        minY: -2500,
        str: 1.4,
        singleLayer: true,
        desc: "A radioactive mineral of uranium and vanadium.",
        sfx: "stone"
    },
    pitchblende: {
        name: "Pitchblende",
        color: "#2e8059",
        chance: Infinity,
        maxY: -2501,
        minY: -3000,
        str: 1.5,
        singleLayer: true,
        desc: "A basic radioactive mineral.",
        sfx: "stone"
    },
    obsidian: {
        name: "Obsidian",
        color: "#442563",
        chance: [
            {
                chance: {max: 0, min: 1},
                maxY: -2990,
                minY: -2998
            },
            {
                chance: 1,
                maxY: -2999,
                minY: -3000
            }
        ],
        str: 35,
        singleLayer: true,
        noGeode: true,
        noVein: true,
        forcedBG: true,
        desc: "A volcanic glass separating you from the dangers of hell below...",
        sfx: "stone"
    },
    bloodstone: {
        name: "Bloodstone",
        color: "#800",
        chance: Infinity,
        maxY: -3001,
        minY: -3500,
        str: 1.8,
        singleLayer: true,
        desc: "A moist rock soaked in blood.",
        sfx: "stone"
    },
    pegmatite: {
        name: "Pegmatite",
        color: "#4e443a",
        chance: Infinity,
        maxY: -3501,
        minY: -4000,
        str: 2.2,
        singleLayer: true,
        desc: "A coarse-grained igneous rock.",
        sfx: "stone"
    },
    basalt: {
        name: "Basalt",
        color: "#444",
        chance: Infinity,
        maxY: -5001,
        minY: -6000,
        str: 2,
        singleLayer: true,
        noGeode: true,
        noVein: true,
        forcedBG: true,
        desc: "A strong igneous rock.",
        noRandomRotation: true,
        filler: true, // acts as a filler in the marine biome
        sfx: "stone"
    },
    ice: {
        name: "Ice",
        color: "#7ac9ff",
        chance: [
            {chance: Infinity, maxY: -4001, minY: -5000, condition: (x, y, z) => !biomes.subzero.requirement(x, y, z)},
            {chance: 1 / 49, maxY: -4001, minY: -5000, condition: (x, y, z) => biomes.subzero.requirement(x, y, z)}
        ],
        str: 0.8,
        friction: 0.04, // default is 0.15
        singleLayer: true,
        desc: "A block of frozen water.",
        sfx: "stone",
        repairSpeed: 0.03
    },
    permafrost: {
        name: "Permafrost",
        color: "#e2f6ff",
        chance: Infinity,
        maxY: -4001,
        minY: -5000,
        str: 1.2,
        friction: 0.07,
        desc: "It's so cold...",
        condition(x, y, z) {
            return biomes.subzero.requirement(x, y, z);
        },
        sfx: "stone"
    },
    snowBlock: {
        name: "Snow Block",
        color: "#ddf0f3",
        chance: 1 / 5,
        maxY: -4001,
        minY: -5000,
        str: 0.24,
        friction: 0.1,
        desc: "A compressed block of snow.",
        condition(x, y, z) {
            return biomes.subzero.requirement(x, y, z);
        },
        noVein: true,
        noGeode: true,
        forcedBG: true,
        customTexture: {
            ore: "snow",
            item: {
                src: "snow"
            }
        },
        singleLayer: true,
        drops: [{id: "snow", count: 2}],
        sfx: "sand"
    },
    mud: {
        name: "Mud",
        color: "#331b00",
        chance: [
            {chance: Infinity, maxY: -6001, minY: -7000},
            {
                chance: 1, maxY: maxHeight, minY: minHeight,
                condition(x, y, z) {
                    if (y !== topLayer(x, z)) return false;
                    const n = Math.min(getBiomeNumber(x, 250, z, "rainy") - 0.6, 0.6 - getBiomeNumber(x, y, z, "clay"));
                    return n >= 0.2 ? 1 : n < -0.2 ? 0 : n * 2.5 + 0.5;
                },
            },
        ],
        str(_x, y) {
            if (y > 7000) return 3;
            return 0.4;
        },
        shownStr: "3 in jungle, 0.4 on surface.",
        singleLayer: true,
        forcedBG: true,
        desc: "A form of wet soil.",
        sfx: "sand",
        noVein: true,
        noGeode: true
    },
    honeycomb: {
        name: "Honeycomb",
        color: "#ffb300",
        chance: Infinity,
        maxY: -6001,
        minY: -7000,
        str: 2.5,
        singleLayer: true,
        priority: 2,
        desc: "A honeycomb filled with bees. Careful!",
        sfx: "wood",
        condition(x, y, z) {
            return biomes.hive.requirement(x, y, z);
        },
        getCanvas() {
            const size = 32;
            const canvas = this.canvasElem;
            canvas.width = size;
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "#ffb300";
            ctx.fillRect(0, 0, size, size);

            for (let x = -8; x < size; x += 8) {
                for (let y = 0; y < size; y += 8) {
                    if (y % 16 === 0) x += 4;
                    else x -= 4;
                    ctx.beginPath();
                    ctx.moveTo(x + 4, y);
                    ctx.arc(x + 4, y + 4, 4, 0, Math.PI * 2);
                    ctx.fillStyle = "#ca9700";
                    ctx.fill();

                    ctx.beginPath();
                    ctx.moveTo(x + 4, y);
                    ctx.arc(x + 4, y + 4, 3, Math.PI, Math.PI / 2);
                    ctx.strokeStyle = "#aa8000";
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }

            return canvas;
        }
    },
    mudstone: {
        name: "Mudstone",
        color: "#40342c",
        chance: Infinity,
        maxY: -7001,
        minY: -7500,
        str: Math.PI,
        singleLayer: true,
        desc: "A hardened mud block.",
        sfx: "stone"
    },
    peridotite: {
        name: "Peridotite",
        color: "#7a8474",
        chance: Infinity,
        maxY: -7501,
        minY: -8000,
        str: 3.6,
        singleLayer: true,
        desc: "A coarse-grained igneous rock composed mostly of olivine and pyroxene.",
        sfx: "stone"
    },
    mantle: {
        name: "Mantle",
        color: "#ff6000",
        chance: [
            {
                maxY: -7001,
                minY: -7800,
                chance: 0.02
            },
            {
                maxY: -7801,
                minY: -8000,
                chance: {max: 0.02, min: 0.98}
            },
            {
                maxY: -8001,
                minY: -9000,
                chance: Infinity
            }
        ],
        str: 4.5,
        singleLayer: true,
        forcedBG: true,
        desc: "The hot rock between the crust and core.",
        emissive: {
            map: "mantle_emissive",
            str: 1
        },
        sfx: "stone"
    },
    magma: {
        name: "Magma",
        color: "#f1c436",
        chance: Infinity,
        maxY: -9001,
        minY: -9999,
        str: 5,
        singleLayer: true,
        desc: "Hot, molten rock found in the core.",
        sfx: "stone",
        emissive: {str: 0.2}
    },
    centerOfTheEarth: {
        name: "Center of the Earth",
        color: "linear-gradient(to right, #fff, #ff0, #f80, #400)",
        firstColor: "#fff",
        noTexture: true,
        chance: Infinity,
        maxY: -10000,
        minY: -10000,
        str: Infinity,
        emissive: {str: 2},
        desc: "You've reached the very bottom of the Earth. There's nothing more for you here.",
        sfx: "stone",
        forced: true
    },
    voidstone: {
        name: "Voidstone",
        color: "#000000",
        chance: [
            {chance: Infinity, maxY: -10001, minY: -11000},
            {chance: Infinity, maxY: -16001, minY: -49000}
        ],
        str: 3,
        singleLayer: true,
        desc: "darkness...",
        sfx: "stone",
        noRandomRotation: true,
        condition(x, y, z) {
            if (y > 11000) return true;
            return getBiomeNumber(x, y, z, "error") < 0.4;
        },
        getCanvas() {
            const size = 32;
            const canvas = this.canvasElem;
            canvas.width = size;
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "#666";
            ctx.fillRect(0, 0, size, size);

            for (let i = 0; i < size * size * 0.1; i++) {
                let x = Math.seedrandom(i)() * size;
                const y = Math.seedrandom(i + Math.PI)() * size;
                const brightness = Math.seedrandom(i + Math.PI * 2)() * 24 + 96;
                ctx.strokeStyle = `rgb(${brightness}, ${brightness}, ${brightness})`;
                ctx.lineWidth = 1.6;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + Math.seedrandom(i + Math.PI * 3)() * 16, y);
                ctx.stroke();

                x -= 32; // make sure it tiles
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + Math.seedrandom(i + Math.PI * 3)() * 16, y);
                ctx.stroke();
            }
            return canvas;
        }
    },
    null: {
        name: "null",
        color: "#00f",
        chance: Infinity,
        maxY: -10001,
        minY: -11000,
        str: 4.04,
        noTexture: true,
        desc: "undefined",
        sfx: "stone",
        condition(x, y, z) {
            return getBiomeNumber(x, y, z, "error") >= 0.4;
        }
    },
    steel: {
        name: "Steel",
        color: "linear-gradient(to right, #aaa, #ccc, #aaa)",
        chance: Infinity,
        maxY: -11001,
        minY: -12000,
        str: 4,
        singleLayer: true,
        desc: "A strong metal alloy made of iron and carbon.",
        sfx: "stone",
        noRandomRotation: true,
        getCanvas() {
            const size = 32;
            const canvas = document.createElement("canvas");
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext("2d");
            const gradient = ctx.createLinearGradient(0, 0, size, 0);
            gradient.addColorStop(0, "#aaa");
            gradient.addColorStop(0.5, "#ccc");
            gradient.addColorStop(1, "#aaa");
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, size, size);
            return canvas;
        }
    },
    retrock: {
        name: "Retrock",
        color: "linear-gradient(to right, #000 0%, #000 50%, #0f0 50%, #0f0 100%)",
        chance: Infinity,
        maxY: -12001,
        minY: -13000,
        str: 2.7,
        singleLayer: true,
        desc: "It's... 8-bit?",
        sfx: "stone",
        excludeFromWiki: 1,
        emissive: {
            str: 1
        },
        getCanvas() {
            const canvas = this.canvasElem;
            canvas.width = canvas.height = 32;
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, 32, 32);
            ctx.strokeStyle = `hsl(${(Date.now() / 40) % 360}, 100%, 50%)`;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(32, 0);
            ctx.lineTo(32, 32);
            ctx.lineTo(0, 32);
            ctx.closePath();
            ctx.stroke();

            return canvas;
        },
        updateCanvas: true
    },
    darkmatter: {
        name: "Dark Matter",
        color: "#104",
        chance: Infinity,
        maxY: -13001,
        minY: -14000,
        str: 3,
        singleLayer: true,
        desc: "A mysterious substance that seemingly no light can escape from."
    },
    neutronium: {
        name: "Neutronium",
        color: "#888",
        chance: Infinity,
        maxY: -14001,
        minY: -15000,
        str: 3.2,
        repairSpeed: 0.1, // repairs itself by 10% of its strength every second (when not being mined)
        singleLayer: true,
        desc: "A super-dense material made of neutrons. It is said to be found in the cores of neutron stars."
    },
    fairyDust: {
        name: "Fairy Dust",
        color: "#ffb3ff",
        chance: Infinity,
        maxY: -15001,
        minY: -16000,
        str: 3.2,
        singleLayer: true,
        desc: "A mythical, sparkling substance.",
        sfx: "sand",
        excludeFromWiki: 1
    },
    carpet: {
        name: "Carpet",
        color: "#b99b49",
        chance: Infinity,
        maxY: -49001,
        minY: -50000,
        str: 0.6,
        singleLayer: true,
        desc: "wha?",
        sfx: "sand",
        excludeFromWiki: 1,
        noRandomRotation: true
    },
    emptiness: {
        name: "???",
        color: "#666",
        chance: Infinity,
        maxY: -50001,
        minY: -Infinity,
        str: 2,
        singleLayer: true,
        desc: "...",
        sfx: "stone",
        noTexture: true,
        customTexture: {
            item: {
                src: "question"
            }
        },
        excludeFromWiki: 2
    },
    moss: {
        name: "Moss",
        color: "#2b750e",
        chance: 0,
        includeInOreArray: true,
        maxY: -1,
        minY: -9000,
        str(_x, y) {
            if (y < -7000) return 3.2;
            return 0.4;
        },
        shownStr: "3.2 in jungle, 0.4 everywhere else.",
        singleLayer: true,
        desc: "A plant that grows on mud.",
        noVein: true,
        noGeode: true,
        forcedBG: true,
        excludeFromWiki: 0,
        customTexture: {
            ore: "grass",
            item: {
                src: "moss"
            }
        },
        conditionLabel: "Filler block of moss caves",
        sfx: "grass"
    },
    vine: {
        name: "Vine",
        color: "#2b750e",
        chance: 1 / 12,
        maxY: -1,
        minY: -Infinity,
        str: 0.4,
        singleLayer: true,
        desc: "A plant that hangs from the ceilings of mossy caves.",
        customTexture: {
            ore: "grass",
            item: {
                src: "vine"
            }
        },
        scale: {x: 3 / 16, z: 3 / 16},
        cave: {
            ceiling: true
        },
        condition: (_x, _y, _z, settings) => settings.caveType === "moss",
        sfx: "grass"
    },
    barrier: {
        name: "Barrier",
        color: "#f00",
        chance: Infinity,
        forced: true, // no other ores can override this
        maxY: -8000,
        minY: -8000,
        str: 1e18, // good luck lol
        singleLayer: true,
        desc: "stop mining smh",
        excludeFromWiki: 2,
        noCrate: true, // no crates can contain this
        sfx: "stone"
    },

    // geode
    chalcedony: {
        name: "Chalcedony",
        color: "#eed5f0",
        chance: [
            {
                chance: 1 / 175,
                maxY: -601,
                minY: -1000
            },
            {
                chance: {max: 0, min: 0.01},
                maxY: -3001,
                minY: -4000
            }
        ],
        str: 2,
        singleLayer: true,
        noGeode: true, // to make sure you don't have a chalcedony geode
        desc: "A variant of quartz. Can be found in geodes below bedrock.",
        sfx: "stone"
    },
    limestone: {
        name: "Limestone",
        color: "#ddcfa6",
        chance: 0, // geode-exclusive
        singleLayer: true,
        str: 1.4,
        noGeode: true,
        desc: "A sedimentary rock that encases geodes above the bedrock.",
        sfx: "stone"
    },

    // surface layer ores
    moonstone: {
        name: "Moonstone",
        color: "#dbfcff",
        chance: [
            {maxY: maxHeight, minY: minHeight, chance: 1 / 555, condition: (x, y, z) => y === topLayer(x, z)},
            {maxY: 1000, minY: 250, chance: {max: 1 / 85, min: 1 / 555}},
            {maxY: 2000, minY: 1001, chance: 1 / 85}
        ],
        str: 5,
        light: {
            col: "#dbfcff",
            str: 2
        },
        desc: "Did this fall from the moon?"
    },
    coal: {
        name: "Coal",
        color: "#282522",
        chance: [
            {
                maxY: maxHeight - 5,
                minY: -1000,
                chance: {max: 0.01, min: 0.04},
                easing: {type: "out", exponent: 4},
                condition(x, y, z) {
                    return y < topLayer(x, z);
                }
            },
            {maxY: -1001, minY: -2000, chance: {max: 0.04, min: 0.002}, easing: {type: "out", exponent: 2}},
            {maxY: -3001, minY: -4000, chance: {max: 0.016, min: 0}},
        ],
        str: 1.5,
        desc: "A dirty and burny rock. burny isn't a word i know idc smh"
    },
    iron: {
        name: "Iron",
        color: "#dea868",
        chance: [
            {
                chance: {max: 0.015, min: 0.05},
                easing: {type: "in", exponent: 6},
                maxY: maxHeight + 5,
                minY: -2000,
                condition(x, y, z) {
                    return y < topLayer(x, z);
                }
            },
            {
                chance: {max: 1 / 5120, min: 1 / 352},
                easing: {type: "out", exponent: 3},
                maxY: -7001,
                minY: -8000
            },
            {
                chance: {max: 1 / 352, min: 1 / 61},
                easing: {type: "in", exponent: 2},
                maxY: -8001,
                minY: -9000
            },
            {
                chance: 1 / 61,
                maxY: -9001,
                minY: -9999
            }
        ],
        str: 2,
        desc: "A great starter metal! Good for a jump-start in mining."
    },
    fossil: {
        name: "Fossil",
        color: "#ceccc5",
        chance: 0.08,
        maxY: maxHeight,
        minY: minHeight,
        str: 3,
        desc: "A fossilized bone of a prehistoric creature. Can only be found near clay.",
        condition(x, y, z) {
            if (y >= topLayer(x, z)) return false;
            const n = getBiomeNumber(x, y, z, "clay");
            return n >= 0.6 ? 1 : n > 0 ? (n / 0.6) ** 3 : 0;
        },
        conditionLabel: "Chance decreases with distance from clay biomes",
        wikiBG: "clay"
    },
    onyx: {
        name: "Onyx",
        color: "#11120e",
        chance: 1 / 330,
        maxY: maxHeight,
        minY: 0,
        str: 4,
        desc: "A black gemstone found below deserts."
    },
    dirtness: {
        name: "Dirtness",
        color: "#573a23",
        chance: 1 / 27e6,
        maxY: maxHeight,
        minY: minHeight,
        str: 0.5,
        desc: "An organic mixture found along the surface.",
        customTexture: {
            ore: "dirt",
            item: {
                src: "dirt"
            }
        },
        noSpawnSound: true,
        excludeFromWiki: 1,
        tier: "bizarre"
    },

    // subsurface layer ores
    copper: {
        name: "Copper",
        color: "#f60",
        chance: [
            {
                chance: {max: 0.04, min: 0.005},
                easing: {type: "out", exponent: 2.5},
                maxY: -11,
                minY: -2000
            }
        ],
        str: 2,
        desc: "Another starter metal that you actually have to dig down to find. Can be alloyed with tin to make bronze."
    },
    silver: {
        name: "Silver",
        color: "#ccc",
        chance: [
            {
                chance: {max: 0, min: 1 / 140},
                maxY: -11,
                minY: -200
            },
            {
                chance: {max: 1 / 140, min: 1 / 60},
                maxY: -201,
                minY: -1000
            },
            {
                chance: {max: 1 / 2000, min: 0.08},
                maxY: -1490,
                minY: -1500
            },
            {
                chance: {max: 0.08, min: 1 / 220},
                maxY: -1500,
                minY: -1510
            },
            {
                chance: {max: 1 / 220, min: 1 / 600},
                easing: {type: "out", exponent: 3},
                maxY: -1510,
                minY: -2100
            }
        ],
        str: 3,
        desc: "shiny..."
    },
    gold: {
        name: "Gold",
        color: "#fc0",
        chance: [
            {
                chance: 1 / 100,
                maxY: maxHeight,
                minY: minHeight,
                condition(x, y, z) {
                    return getBiomeNumber(x, y, z, "clay") >= 0.6 && y <= topLayer(x, z);
                }
            },
            { // chance can be a constant, object, or array of objects
                chance: {max: 0, min: 0.02},
                maxY: -11,
                minY: -1000
            },
            {
                chance: {max: 0, min: 0.02},
                maxY: -3001,
                minY: -3490
            },
            {
                chance: {max: 0.02, min: 0.1},
                maxY: -3491,
                minY: -3500
            }
        ],
        // maxY and minY are not needed when chance is an array of objects
        str: 5,
        light: {
            col: "#fc0",
            str: 0.5
        },
        desc: "GOLD 😍"
    },

    // fungal layer ores
    tin: {
        name: "Tin",
        color: "#9ab589",
        chance: {max: 0.01, min: 0.04},
        maxY: -101,
        minY: -600,
        str: 2.4,
        desc: "A metal that can be alloyed with copper to make bronze."
    },
    mushroom: {
        name: "Mushroom",
        placeholder: true, // not a real ore; used to generate mushrooms in mushroom caves
        chance: 1 / 90,
        maxY: -101,
        minY: -300,
        cave: {
            floor: true
        }
    },
    mushroomCap: {
        name: "Mushroom Cap",
        color: "#3079ff",
        chance: 0,
        str: 0.4,
        desc: "A soft, fleshy cap found on certain mushrooms.",
        noTexture: true,
        emissive: {
            str: 4,
            col: "#0059ff"
        }
    },
    mushroomStem: {
        name: "Mushroom Stem",
        color: "#ded7c3",
        chance: 0,
        desc: "The stem of the mushroom.",
        str: 1.2,
        noTexture: true
    },

    // underground layer ores
    emerald: {
        name: "Emerald",
        color: "#6bd066",
        chance: [
            {chance: {max: 0.001, min: 0.0225}, maxY: -301, minY: -600, easing: {type: "in-out", exponent: 2}},
            {chance: {max: 0.0225, min: 0}, maxY: -601, minY: -1000, easing: {type: "in-out", exponent: 2}}
        ],
        str: 8,
        light: {
            col: "#0f0",
            str: 0.7
        },
        desc: "The first gemstone after moonstone you'll find, probably, unless you count coal."
    },
    amethyst: {
        name: "Amethyst",
        color: "linear-gradient(to right, #e0b0ff, #8144ff)",
        chance: {max: 1 / 2000, min: 1 / 9000},
        easing: {type: "in", exponent: 2},
        maxY: -450,
        minY: -999,
        str: 7,
        light: {
            col: "#80f",
            str: 1.2
        },
        desc: "A purple variant of quartz."
    },

    // crystallized layer ores
    platinum: {
        name: "Platinum",
        color: "#eee",
        chance: [
            {chance: {max: 1 / 60, min: 1 / 90}, maxY: 2000, minY: 1001},
            {chance: {max: 0.002, min: 0.012}, maxY: -601, minY: -1000}
        ],
        str: 11,
        light: {
            col: "#fff",
            str: 0.6
        },
        desc: "omg they keep getting shinier"
    },
    diamond: {
        name: "Diamond",
        color: "#7dfff9",
        chance: [
            {chance: {max: 0, min: 0.0025}, maxY: -601, minY: -1000},
            {chance: {max: 0.002, min: 0.004}, maxY: -3601, minY: -4000},
            {chance: {max: 0.008, min: 0.012}, maxY: -4001, minY: -4900},
            {chance: {max: 0.012, min: 0}, maxY: -4901, minY: -5000}
        ],
        str: 14,
        light: {
            col: "#0ff",
            str: 0.7
        },
        desc: "DIAMONDS AAAAAAAAAAAA"
    },
    sapphire: {
        name: "Sapphire",
        color: "#00f",
        chance: {max: 0.001, min: 0.00775},
        maxY: -601,
        minY: -1000,
        str: 8,
        light: {
            col: "#00f",
            str: 0.6
        },
        desc: "A blue variant of corundum."
    },
    ruby: {
        name: "Ruby",
        color: "#f01",
        chance: {max: 0.00775, min: 0.001},
        maxY: -601,
        minY: -2000,
        str: 8,
        light: {
            col: "#f00",
            str: 0.6
        },
        desc: "A red variant of corundum."
    },
    tugtupite: {
        name: "Tugtupite",
        color: "linear-gradient(to right, #d311ab, #fcff82, #d311ab)",
        chance: 1 / 55000,
        maxY: -601,
        minY: -2500,
        str: 11,
        light: {
            col: "#ff28d4",
            str: 1.8
        },
        emissive: {
            map: "tugtupite_emissive"
        },
        desc: "A rare magenta gemstone. The name is fun to say, I think."
    },
    
    // volcanic layer ores
    petrifiedWood: {
        name: "Petrified Wood",
        color: "#6d6d4e",
        chance: [
            {
                chance: {max: 0.015, min: 0.0075},
                maxY: -1001,
                minY: -1500
            },
            {
                chance: {max: 0.0075, min: 0.011},
                maxY: -1501,
                minY: -2000
            },
            {
                chance: {max: 0.011, min: 0},
                easing: {type: "out", exponent: 2},
                maxY: -2001,
                minY: -3000
            },
            {
                chance: {max: 0.002, min: 0.007},
                maxY: -5001,
                minY: -7000
            }
        ],
        str: 20,
        desc: "A fossilized log that has hardened and sunken into the earth over time."
    },
    sulfur: {
        name: "Sulfur",
        color: "#ff0",
        chance: [
            {chance: 0.03, maxY: -1001, minY: -1500},
            {chance: {max: 0.03, min: 0}, maxY: -2001, minY: -2500, easing: {type: "out", exponent: 2}}
        ],
        str: 4,
        desc: "A soft yellow native element."
    },
    phosphorus: {
        name: "Phosphorus",
        color: "#7c1328",
        chance: {max: 0.01, min: 0.03},
        maxY: -1301,
        minY: -1500,
        str: 5,
        desc: "A soft, waxy, and highly reactive element."
    },
    fumarole: {
        name: "Fumarole",
        desc: "A hole in the earth that emits lava.",
        color: "#bcb87e",
        chance: 0.04,
        maxY: -1001,
        minY: -1500,
        str: 1.6,
        customModel: true,
        offset: {x: 0, y: -29 / 64, z: 0},
        cave: {
            floor: true
        },
        particles: {
            area: {x: 0, y: 0, z: 0},
            gravity: {x: 0, y: -0.5, z: 0},
            velocity: {x: 0, y: 6, z: 0},
            texture: "particle",
            emitRate: 10,
            lifetime: 4,
            count: 50,
            size: 0.06,
            color: "#f80"
        },
        condition(_x, _y, _z, settings) {
            return settings.caveType === "normal";
        }
    },
    ash: {
        name: "Ash",
        color: "#666",
        chance: 0.5,
        maxY: -1001,
        minY: -1500,
        str: 0.3,
        desc: "Fine particles of volcanic rock.",
        sfx: "sand",
        notCollidable: true,
        singleLayer: true,
        scale: {y: 0.1},
        offset: {y: -0.45},
        oreColor: true, // colorize the custom texture with the ore color
        cave: {
            floor: true
        },
        customTexture: {
            ore: "noise",
            item: {
                src: "ash"
            }
        }
    },

    // electric layer ores
    biotite: {
        name: "Biotite",
        color: "#111",
        chance: {max: 0.01, min: 0.03},
        maxY: -1501,
        minY: -2000,
        str: 4,
        desc: "A common black mica mineral."
    },
    quartz: {
        name: "Quartz",
        color: "linear-gradient(to right, #e2c8e9, #fff, #db9fec)",
        chance: [
            {chance: {max: 1 / 68, min: 1 / 425}, maxY: -1451, minY: -1800},
            {chance: {max: 1 / 137, min: 1 / 244}, maxY: -3501, minY: -4000}
        ],
        str: 5.5,
        desc: "A common silicate mineral.",
        light: {
            col: "#fff",
            str: 0.4
        }
    },
    thorium: {
        name: "Thorium",
        color: "#686868",
        chance: {max: 1 / 230, min: 1 / 82},
        maxY: -1800,
        minY: -2200,
        str: 10,
        radiation: 0.5,
        light: {
            col: "#d1cfcf",
            str: 1
        },
        desc: "A weakly radioactive metal. I wonder what this is foreshadowing?"
    },
    asbestos: {
        name: "Asbestos",
        color: "#eee",
        chance: [
            {
                chance: {max: 0.02, min: 0.043},
                maxY: -1501,
                minY: -2000
            },
            {
                chance: {max: 0.043, min: 1 / 780},
                maxY: -2001,
                minY: -2150,
                easing: {type: "out", exponent: 2}
            }
        ],
        str: 2,
        desc: "A fibrous silicate mineral that was commonly used for fireproofing before its health risks were discovered.",
        customTexture: {
            ore: "transparent",
            item: {
                src: "asbestos"
            }
        },
        particles: {
            area: {x: 0.5, y: 0.5, z: 0.5},
            gravity: {x: 0, y: -0.4, z: 0},
            texture: "particle",
            emitRate: 20,
            lifetime: 3
        },
        cave: {
            ceiling: 2
        }
    },

    // nuclear layer ores
    uranium: {
        name: "Uranium",
        color: "#af0",
        chance: {max: 0.002, min: 0.011},
        maxY: -2001,
        minY: -3000,
        str: 12,
        radiation: 1,
        light: {
            col: "#af0",
            str: 1
        },
        desc: "The most famous of the radioactive metals!"
    },
    plutonium: {
        name: "Plutonium",
        color: "#ff4c00",
        chance: {max: 0, min: 0.00525},
        maxY: -2001,
        minY: -3000,
        str: 16,
        radiation: 2,
        light: {
            col: "#ff4c00",
            str: 2
        },
        desc: "No, you can't make a nuke. Yet."
    },
    neptunium: {
        name: "Neptunium",
        color: "#31d1c0",
        chance: {max: 0, min: 0.004},
        maxY: -2501,
        minY: -3000,
        str: 20,
        radiation: 3,
        light: {
            col: "#31d1c0",
            str: 3
        },
        desc: "why's this in my smoke detector"
    },
    malachite: {
        name: "Malachite",
        color: "#00c181",
        chance: {max: 1 / 1000, min: 1 / 2000},
        maxY: -2001,
        minY: -3000,
        str: 18,
        light: {
            col: "#00ffaa",
            str: 2
        },
        emissive: {str: 0.2},
        desc: "A tribute to Malachite Miners 2!"
    },
    pizzaziumInfinionite: {
        name: "Pizzazium Infinionite",
        color: "linear-gradient(to right, #056237, #00753f, #83fff5, #00753f, #056237)",
        chance: {max: 1 / 700, min: 1 / 550},
        maxY: -2500,
        minY: -2900,
        str: 37,
        desc: "No one really knows what it does.",
        light: {
            col: "#00ffaa",
            str: 3
        }
    },

    // hell layer ores
    ardite: {
        name: "Ardite",
        color: "#f20",
        chance: {max: 0.01, min: 0.007},
        maxY: -3001,
        minY: -3400,
        str: 13,
        desc: "Tinker's Construct, anyone?"
    },
    garnet: {
        name: "Garnet",
        color: "#b70000",
        chance: {max: 0.003, min: 0.005},
        maxY: -3301,
        minY: -3600,
        str: 27,
        light: {
            col: "#b70000",
            str: 1.2
        },
        desc: "shiny red rock :D"
    },
    cinnabar: {
        name: "Cinnabar",
        color: "#c2002f",
        chance: {max: 0.001, min: 0.0008},
        easing: {type: "custom", func: t => (1 - Math.cos(t * Math.PI)) / 2},
        maxY: -3201,
        minY: -3600,
        str: 33,
        light: {
            col: "#ff006f",
            str: 1.5
        },
        desc: "A dangerous ore of mercury. It looks like blood dripping from the stone..."
    },
    technetium: {
        name: "Technetium",
        color: "#00a738",
        chance: {max: 0.001, min: 0.003},
        maxY: -3501,
        minY: -4000,
        str: 28,
        radiation: 5,
        light: {
            col: "#00a738",
            str: 4
        },
        desc: "The first element to be synthesized... so what's it doing down here?"
    },
    netherite: {
        name: "Netherite",
        color: "#322316",
        chance: 1 / 11182011,
        maxY: -3001,
        minY: -3500,
        str: 46,
        light: {
            col: "#ec8c39",
            str: 0.8
        },
        spawnMsg: "The ancient wreckage of the Nether exposes itself deep underground...",
        desc: "A strong and durable material from the depths of the Nether.",
        caveExclusive: -1,
        excludeFromWiki: 1
    },
    // frozen layer ores
    glass: {
        name: "Glass",
        color: "#fff",
        chance: 0.01,
        maxY: -4001,
        minY: -5000,
        str: 0.5,
        singleLayer: true,
        textureHasTransparency: true,
        caveExclusive: -1,
        desc: "pure and polished already? this game makes no sense smh",
        sfx: "stone"
    },
    cobalt: {
        name: "Cobalt",
        color: "#00f",
        chance: [
            {maxY: -4401, minY: -4900, chance: {max: 0.001, min: 0.003}, easing: {type: "in-out", exponent: 2}},
            {maxY: -4901, minY: -5000, chance: {max: 0.003, min: 0.1}, easing: {type: "in", exponent: 4}},
            {maxY: -5001, minY: -6000, chance: {max: 0.0002, min: 0.008}, easing: {type: "in-out", exponent: 2}}
        ],
        str: 52,
        desc: "A deep blue metal found in the frozen and marine layers."
    },
    chalcanthite: {
        name: "Chalcanthite",
        color: "#00eee9",
        chance: 1 / 275,
        maxY: -4001,
        minY: -5000,
        str: 26,
        light: {
            col: "#00eee9",
            str: 1.5
        },
        condition(x, y, z) {
            return biomes.subzero.requirement(x, y, z);
        },
        conditionLabel: "Only spawns in subzero biomes",
        desc: "what on earth is chalcanthite"
    },
    boracite: {
        name: "Boracite",
        color: "#5a67b4",
        chance: {max: 0.001, min: 0.0025},
        easing: {type: "out", exponent: 5.5},
        maxY: -4001,
        minY: -5000,
        str: 14,
        creator: "squid",
        desc: "boracite more like BORE-acite! LOL!"
    },
    // marine layer ores
    serpentine: {
        name: "Serpentine",
        color: "#41a51c",
        chance: {max: 0.005, min: 0.0001},
        maxY: -5001,
        minY: -5500,
        str: 38,
        light: {
            col: "#41a51c",
            str: 0.5
        },
        desc: "A green mineral found near the ocean floor."
    },
    olivine: {
        name: "Olivine",
        color: "#a0d0a0",
        chance: [
            {maxY: -5301, minY: -5600, chance: {max: 0.001, min: 0.012}, easing: {type: "out", exponent: 2}},
            {maxY: -5601, minY: -6000, chance: {max: 0.012, min: 1 / 3000}, easing: {type: "in-out", exponent: 2}}
        ],
        str: 45,
        light: {
            col: "#a0d0a0",
            str: 1
        },
        desc: "A yellow-green mineral found deep in the ocean."
    },
    shell: {
        name: "Shells",
        color: "#eec39a",
        chance: 0.008,
        maxY: -5200,
        minY: -6000,
        str: 12,
        desc: "You're killing something that's already dead. How does that make you feel?",
        creator: "squid",
        guaranteedVein: true,
        noGeode: true,
        noCrystal: true,
        caveExclusive: true
    },
    diopside: {
        name: "Diopside",
        color: "#2e3fa9",
        chance: {max: 0.02, min: 1 / 258},
        maxY: -5151,
        minY: -5450,
        str: 25,
        desc: "drip drop drip drop",
        creator: "squid"
    },
    titanium: {
        name: "Titanium",
        color: "#a893aa",
        chance: [
            {maxY: -5400, minY: -9000, chance: {max: 1 / 3300, min: 1 / 820}}
        ],
        str: 84,
        desc: "A strong, nearly indestructible metal. Do not eat."
    },
    soap: {
        name: "Soap",
        color: "#f5baff",
        chance: 1 / 325611,
        maxY: -5001,
        minY: -6000,
        str: 14,
        desc: "It's a bar of soap. What is it doing here?",
        excludeFromWiki: 1,
        spawnMsg: "The scent of lavender fills the air..."
    },
    coral: {
        name: "Coral",
        desc: "An immobile underwater animal.",
        color: "#f00",
        chance: 0.04,
        maxY: -5001,
        minY: -6000,
        str: 4,
        scale: {x: 2, y: 2, z: 2},
        offset: {x: 0, y: -0.5, z: 0},
        customModel: true,
        colorize() {
            return `hsl(${Math.floor(Math.random() * 360)}, 100%, 50%)`;
        },
        cave: {
            floor: true, // spawns on the floor of caves; not in the blocks, but on top of them
        }
    },
    // jungle layer ores
    zircon: {
        name: "Zircon",
        color: "#97541e",
        chance: 1 / 88,
        maxY: -5901,
        minY: -6600,
        str: 52,
        desc: "A yellow-brown gemstone found in the jungle.",
        light: {
            col: "#f0c0a0",
            str: 1.2
        },
        emissive: {
            str: 0.3
        }
    },
    chlorophyte: {
        name: "Chlorophyte",
        color: "#457714",
        chance: {max: 1 / 4000, min: 1 / 1000},
        easing: {type: "out", exponent: 1.5},
        maxY: -6001,
        minY: -7000,
        str: 88,
        desc: "Why does this sound familiar?",
        light: {
            col: "#45ff14",
            str: 1.5
        },
        creator: "squid"
    },
    citrine: {
        name: "Citrine",
        color: "#ffdf00",
        chance: {max: 1 / 110, min: 1 / 340},
        maxY: -6300,
        minY: -7000,
        str: 34,
        desc: "A yellow variant of quartz.",
        light: {
            col: "#ffdf00",
            str: 1.25
        },
        emissive: {
            str: 0.4
        },
        condition(_x, y) {
            return Math.sin((y + 1000) / 100) + 1;
        },
        forceCondition: true // force condition to be calculated with in the ore index
    },
    calcite: {
        name: "Calcite",
        color: "#d7cc9e",
        chance: 1 / 115,
        maxY: -6001,
        minY: -7000,
        str: 23,
        desc: "A white crystalline mineral that forms in caves.",
        caveExclusive: true,
        light: {
            col: "#d7cc9e",
            str: 0.5,
            radius: 5
        }
    },
    moldavite: {
        name: "Moldavite",
        color: "#425217",
        chance: {max: 1 / 300, min: 1 / 65},
        maxY: -6001,
        minY: -6700,
        str: 31,
        desc: "A dark green gemstone found deep in the jungle.",
        light: {
            col: "#ccee60",
            str: 1
        }
    },
    jade: {
        name: "Jade",
        color: "linear-gradient(to right, #0add6c, #0bf2af, #07a04e, #056b34)",
        chance: {max: 1 / 2560, min: 1 / 92},
        maxY: -6800,
        minY: -7050,
        str: 76,
        desc: "A bright green gemstone.",
        light: {
            color: "#00b152",
            str: 1.2
        }
    },
    // asthenosphere layer ores
    nickel: {
        name: "Nickel",
        color: "#d5cab6",
        chance: [
            {
                chance: {max: 1 / 380, min: 1 / 260},
                maxY: -7001,
                minY: -9800
            },
            {
                chance: {max: 1 / 260, min: 1 / 14},
                easing: {type: "in", exponent: 2.5},
                maxY: -9801,
                minY: -9999
            }
        ],
        str: 108,
        desc: "A white metal found as you approach the core."
    },
    arfvedsonite: {
        name: "Arfvedsonite",
        color: "#a66f5b",
        chance: {max: 1 / 120, min: 1 / 4000},
        easing: {type: "in-out", exponent: 2},
        maxY: -7001,
        minY: -7500,
        str: 76,
        desc: "A sodium amphibole mineral. Or maybe it's a cookie?"
    },
    bauxite: {
        name: "Bauxite",
        color: "#963b35",
        chance: {max: 1 / 304, min: 1 / 212},
        maxY: -7400,
        minY: -7800,
        str: 55,
        desc: "A rock rich with aluminum ores."
    },
    trimium: {
        name: "Trimium",
        color: "linear-gradient(165deg, #ff4d4b, #ff3b39, #ff7675, #ff3b39, #6b4847 85%)",
        chance: {max: 1 / 332, min: 1 / 158},
        easing: {type: "in-out", exponent: 2},
        maxY: -7700,
        minY: -8000,
        str: 124,
        desc: "A material only found deep in the earth."
    },
    perovskite: {
        name: "Perovskite",
        color: "#4a4e69",
        chance: {max: 1 / 109, min: 1 / 314},
        maxY: -7201,
        minY: -7650,
        str: 90,
        desc: "A mineral with a unique crystal structure.",
        light: {
            col: "#4a4e69",
            str: 0.6
        }
    },
    // core layer ores
    
    // void layer ores
    cadmium: {
        name: "Cadmium",
        color: "#c0a342",
        chance: {max: 0.04, min: 0.003},
        easing: {type: "out", exponent: 4},
        maxY: -10001,
        minY: -11000,
        str: 18,
        light: {
            col: "#c0a342",
            str: 0.4
        },
        condition(x, y, z) {
            return getBiomeNumber(x, y, z, "error") < 0.4;
        },
        desc: "Another poisonous metal..."
    },
    lead: {
        name: "Lead",
        color: "#6b418f",
        chance: {max: 0.005, min: 0.03},
        maxY: -10501,
        minY: -11000,
        str: 31,
        condition(x, y, z) {
            return getBiomeNumber(x, y, z, "error") < 0.4;
        },
        desc: "why is it so heavy aaaaaaa"
    },
    francium: {
        name: "Francium",
        color: "linear-gradient(to left, #da006d, #f21031, #ff4b27, #ff7a00, #e69700, #d2be00, #bed900, #89ff25)",
        chance: {max: 0.001, min: 0.004},
        maxY: -10901,
        minY: -11000,
        str: 27,
        light: {
            col: "#e69700",
            str: 6
        },
        radiation: 9,
        desc: "A highly radioactive and unstable element. Careful!"
    },
    blueScreenOfDeath: {
        name: "Blue Screen of Death",
        color: "#00f",
        chance: 1 / 85,
        maxY: -10001,
        minY: -11000,
        str: 44,
        desc: "Your computer ran into a problem and needs to restart. We're just collecting some error info, and then we'll restart for you.",
        condition(x, y, z) {
            return getBiomeNumber(x, y, z, "error") >= 0.4;
        },
        conditionLabel: "Only spawns in error biomes",
        wikiBG: "null"
    },
    pointer: {
        name: "Pointer",
        color: "#fff",
        chance: 1 / 242,
        maxY: -10001,
        minY: -11000,
        str: 46,
        desc: "click",
        condition(x, y, z) {
            return getBiomeNumber(x, y, z, "error") >= 0.4;
        },
        conditionLabel: "Only spawns in error biomes",
        wikiBG: "null"
    },
    // grid layer ores
    tungsten: {
        name: "Tungsten",
        color: "#a1afa0",
        chance: {max: 1 / 300, min: 1 / 1000},
        maxY: -11001,
        minY: -12000,
        str: 150,
        desc: "A dense metal with a very high melting point."
    },
    // mystical layer ores
    mythril: {
        name: "Mythril",
        color: "linear-gradient(to right, #a3fff8, #0fb, #0092c2)",
        chance: 1 / 1600,
        maxY: -15001,
        minY: -16000,
        str: 172,
        desc: "A legendary metal said to possess magical properties.",
        excludeFromWiki: 1,
        light: {
            col: "#0fb",
            str: 2
        },
        onGenerate(x, y, z) {
            function meshTick() {
                if (m(x, y, z).ore === "mythril") {
                    requestAnimationFrame(meshTick);
                }
                if (vars.PAUSED) return;
                let a = -1;
                vars.particleQueue.push({
                    x: x + Math.random() * 3 - 1.5,
                    y: y + Math.random() * 3 - 1.5,
                    z: z + Math.random() * 3 - 1.5,
                    size: Math.random() * 0.2 + 0.1,
                    texture: "sparkle" + ~~(Math.random() * 5),
                    velocity: {
                        x: (Math.random() - 0.5) / 30,
                        y: (Math.random() - 0.5) / 30,
                        z: (Math.random() - 0.5) / 30
                    },
                    opacity: 1,
                    color: 0x00ffbb,
                    tick(particle, FRAME_TIME) {
                        a += 0.01 * FRAME_TIME * 60;
                        particle.points.material.opacity = 1 - Math.abs(a);
                        if (particle.points.material.opacity < 0 || m(x, y, z).ore !== "mythril") return true;
                    }
                });
            }
            meshTick();
        }
    },

    // rare ores and other easter egg things
    // uncommon
    seventythree: {
        name: "73",
        color: "#b600ff",
        chance: [{
            chance: 1 / 73,
            maxY: -73,
            minY: -73
        },
        {
            chance: 1 / 73,
            maxY: -7373,
            minY: -7373
        }],
        str: 7.3,
        excludeFromWiki: 1,
        tier: "peculiar",
        desc: "73"
    },
    sunstone: {
        name: "Sunstone",
        color: "linear-gradient(to right, #ffcf5d 0%, #ffc380 100%)",
        chance: [
            {
                chance: 1 / 4000,
                maxY: maxHeight,
                minY: -10,
                condition(x, y, z) {
                    return y <= topLayer(x, z);
                }
            },
            {
                chance: {max: 1 / 250, min: 1 / 25000},
                easing: {type: "out", exponent: 3},
                maxY: -9,
                minY: -5
            },
            {
                chance: {max: 1 / 40000, min: 1 / 999999},
                easing: {type: "out", exponent: 4},
                maxY: -4,
                minY: minHeight
            }
        ],
        str: 12,
        tier: "peculiar",
        desc: "A bright yellow-orange gemstone, shining brightly like the sun.",
        light: {
            col: "#ffcf5d",
            str: 1.5
        }
    },
    melanterite: {
        name: "Melanterite",
        color: "#29a567",
        chance: 1 / 200,
        maxY: -15,
        minY: -15,
        str: 6.3,
        tier: "peculiar",
        desc: "Found strangely at only one depth, it is a hydrated iron sulfate mineral."
    },
    // rare
    dragonite: {
        name: "Dragonite",
        color: "#90f",
        chance: 1 / 10000,
        str: 73, // my favorite number
        maxY: -2,
        minY: -1000,
        desc: "The dragon's roar echoes throughout the mines...",
        excludeFromWiki: 1,
        particles: {
            area: {x: 0, y: 0, z: 0},
            texture: "particle",
            emitRate: 10,
            lifetime: 2,
            count: 50,
            size: 0.4,
            centerGravity: -5,
            color: "#90f"
        },
        light: {
            col: "#90f",
            str: 2
        },
        emissive: {
            str: 1,
            map: "dragonite_emissive"
        }
    },
    pluyoniom: { // created 2023/10/16
        name: "Pluyoniom",
        color: "#ff4c00",
        chance: 1 / 11111,
        str: 18,
        maxY: -2001,
        minY: -3000,
        desc: "The U.S. government would like to know your location",
        excludeFromWiki: 1,
        light: {
            col: "#ff4c00",
            str: 2
        },
        radiation: -1,
        creator: ["Tranquanto", "YeetSnake25"]
    },
    ulexite: {
        name: "Ulexite",
        color: "#eae3c8",
        chance: 1 / 15000,
        maxY: -10,
        minY: -4000,
        str: 45,
        caveExclusive: true, // only spawns in caves
        desc: "A strange, fibrous mineral that glows faintly in the darkness",
        light: {
            col: "#eae3c8",
            str: 0.5
        },
        particles: {
            area: {x: 4, y: 4, z: 4},
            texture: "particle",
            emitRate: 5,
            lifetime: 2,
            count: 20,
            size: 0.2,
            centerGravity: 5,
            color: "#eae3c8"
        },
        excludeFromWiki: 1
    },
    humanite: {
        name: "Humanite",
        color: "#db2",
        chance: 1 / 35000,
        maxY: -2,
        minY: -6000,
        str: 10,
        desc: "An ancient fossil screams in agony...",
        excludeFromWiki: 1
    },
    rejrw: {
        name: "rejrw",
        color: "#ff8a00",
        chance: 1 / 50000,
        maxY: -2,
        minY: -10000,
        str: 4,
        excludeFromWiki: 1,
        removalReason: "Originally added as an inside joke, but does not fit thematically.",
        desc: "rejrw",
        emissive: {
            str: 5
        }
    },
    hearteyesnium: {
        name: "Hearteyesnium",
        color: "#f00",
        chance: 1 / 60000,
        str: 6.2,
        maxY: maxHeight,
        minY: minHeight,
        desc: "😍",
        excludeFromWiki: 1,
        creator: "squid",
        tier: "enigmatic",
        singleLayer: true,
        sfx: "stone",
        removalReason: "Did not fit in the game thematically; added as a joke",
        conditionLabel: "Only spawns on the surface"
    },
    // epic
    missing: {
        name: "Missing Texture",
        color: "linear-gradient(to right, #f0f 0%, #f0f 25%, #000 25%, #000 50%, #f0f 50%, #f0f 75%, #000 75%, #000 100%)",
        chance: 1 / 1e5, // 1 in 100k
        str: 5,
        maxY: -2,
        minY: -Infinity,
        spawnMsg: "A glitch reveals itself with an unidentifiable appearance...",
        singleLayer: true,
        excludeFromWiki: 1,
        material: "MeshBasicMaterial",
        noGeodeTexture: true,
        audio: "glitch.mp3"
    },
    iyonkontrabufralulium: {
        name: "Iyonkontrabufralulium",
        color: "linear-gradient(to right, #fff 0%, #fff 14.3%, #f0f 28.6%, #f0f 42.8%, #ff0 57.1%, #ff0 71.4%, #0ff 85.7%, #0ff 100%)",
        chance: 1 / 131072,
        maxY: -2,
        minY: -10000,
        str: 3.325,
        radiation: 0.4,
        light: {
            col() {
                return ["#f0f", "#ff0", "#0ff"][Math.floor(Math.random() * 3)];
            },
            str: 10,
            radius: 10
        },
        emissive: {
            str: 0.5
        },
        guaranteedVein: true,
        spawnMsg: "A strong gravitational force pulls you in...",
        excludeFromWiki: 1,
        creator: ["Tranquanto", "GooseterV"]
    },
    astatine: {
        name: "Astatine",
        color: "linear-gradient(to right, #ff0, #9cda1e, #0f0, #9cda1e, #880)",
        chance: {max: 1 / 3e5, min: 1 / 4e5},
        maxY: -2001,
        minY: -3000,
        str: 25,
        light: {
            col: "#8f0",
            str: 6
        },
        radiation: 5,
        spawnMsg: "A strange radioactive glow emanates near...",
        excludeFromWiki: 1
    },
    fursonite: {
        name: "Fursonite",
        color: "#ff9000",
        chance: 1 / 550000,
        maxY: -2,
        minY: -10000,
        str: 11,
        spawnMsg: "You feel drawn toward a soft, fluffy mass...",
        excludeFromWiki: 1,
        particles: {
            area: {x: 2, y: 2, z: 2},
            texture: "particle",
            emitRate: 8,
            lifetime: 3,
            count: 30,
            size: 0.3,
            centerGravity: 2,
            color: "#ff9000"
        }
    },
    sussite: {
        name: "Sussite",
        color: "#f00",
        chance: 1 / 666666,
        maxY: -2,
        minY: -10000,
        str: 6.66,
        singleLayer: true,
        desc: "this is the worst thing i've ever created",
        removalReason: "Does not fit in the game thematically",
        excludeFromWiki: 1,
        noGeodeTexture: true,
        sfx: "stone"
    },
    // legendary
    kyawthuite: {
        name: "Kyawthuite",
        color: "#f40",
        chance: 1e-6, // 1 in 1m
        maxY: -2,
        minY: -10000,
        str: 34,
        light: {
            col: "#f40",
            str: 4
        },
        emissive: {str: 0.5},
        spawnMsg: "Said to be the rarest mineral on earth, the mere existence of this stone draws your attention close...",
        excludeFromWiki: 1,
        image: (() => {
            const img = new Image();
            img.src = "img/block/kyawthuite.png";
            return img;
        })(),
        getCanvas() {
            /** @type {HTMLCanvasElement} */
            const e = this.canvasElem; // canvas element is created during initial texture loading
            e.width = e.width;

            const time = Date.now() / 8;

            const line = document.createElement("canvas");
            line.width = 32;
            line.height = 32;

            const ctx = line.getContext("2d");
            ctx.drawImage(this.image, 0, 0);
            ctx.globalCompositeOperation = "source-in";
            ctx.strokeStyle = "#f884";
            ctx.lineWidth = 4;
            ctx.moveTo(0, time % 600);
            ctx.lineTo(32, time % 600 - 100);
            ctx.stroke();

            e.getContext("2d").drawImage(this.image, 0, 0);
            e.getContext("2d").drawImage(line, 0, 0);

            return e;
        },
        updateCanvas: true
    },
    shandite: {
        name: "Shandite",
        color: "#000",
        chance: 1 / 1440000,
        maxY: -10140,
        minY: -10240,
        str: 250,
        light: {
            col: "#fff",
            str: 1
        },
        spawnMsg: "this guy is so self-centered making an ore that's him???",
        excludeFromWiki: 1,
        creator: "Shando"
    },
    noise: { // was originally just for the texture (hence the id "noise") but i decided why not make it a rare ore
        name: "Fabric of Reality",
        color: "#000",
        chance: 1 / 3e6, // 1 in 3m
        str: 450,
        maxY: -2,
        minY: -Infinity,
        spawnMsg: "Reality itself is breaking down...",
        audio: "noise.mp3",
        singleLayer: true,
        sfx: "sand",
        excludeFromWiki: 1,
        forcedBackground: "noise",
        material: "MeshBasicMaterial",
        overlay: {
            distance: 25,
            maxOpacity: 0.5
        },
        noGeodeTexture: true
    },
    oil: {
        name: "Oil",
        color: "#222",
        chance: 1.5e-7, // 1 in 6.67m
        maxY: -2,
        minY: -10000,
        str: 2,
        spawnMsg: "America sent you a friend request",
        singleLayer: true,
        excludeFromWiki: 1,
        noGeodeTexture: true,
        sfx: "sand"
    },
    pestilence: {
        name: "Pestilence",
        color: "#48a173",
        chance: 1 / 1e6,
        maxY: -5127,
        minY: -5137,
        str: 73, // i swear i didn't choose this number
        spawnMsg: "fishy pie lol",
        excludeFromWiki: 1,
        tier: "divine", // only because of its extremely condensed spawn range
        creator: "stroppyblocker"
    },
    // mythic
    ununennium: {
        name: "Ununennium",
        color: "linear-gradient(to right, #ff6803, #f0f)",
        chance: 1 / 1e7, // 1 in 10m
        maxY: -2,
        minY: -Infinity,
        str: 40,
        radiation: 15,
        radiationFalloff: 0.4,
        light: {
            col: "#f0f",
            str: 8
        },
        emissive: {str: 4},
        spawnMsg: "A never-before-seen element has shown itself within the depths...",
        audio: "bouncy.mp3",
        music: "Tranquanto - Trampolín de Terror",
        excludeFromWiki: 1
    },
    unobtainium: {
        name: "Unobtainium",
        color: "linear-gradient(to left, #f0f, #361ebe, #d67575, #29f830)",
        chance: [
            {
                chance: 1 / 4e7, // 1 in 40m
                maxY: Infinity,
                minY: 251
            },
            {
                chance: 1 / 4e7,
                maxY: -2,
                minY: -Infinity
            }
        ],
        str: 72,
        light: {
            col: "#0ff",
            str: 8
        },
        spawnMsg: "You feel the sudden urge to do the impossible...",
        excludeFromWiki: 1,
        desc: "A mythical material thought to be impossible to exist...",
        audio: "acid.mp3",
        music: "Tranquanto - Acidic Facility"
    },
    ancientBeer: {
        name: "Ancient Beer",
        color: "radial-gradient(circle, #3b2603, #edec39, #c2f3fa 50%)",
        chance: 1 / 5e7,
        maxY: -4001,
        minY: -5000,
        str: 400,
        emissive: {str: 0.5},
        particles: {
            area: {x: 0, y: 0, z: 0},
            texture: "particle",
            emitRate: 5,
            lifetime: 6,
            count: 50,
            size: 0.4,
            centerGravity: -2,
            color: "#c2f3fa"
        },
        desc: "world's oldest beer, probably tastes like expired applesauce",
        creator: "YeetSnake25",
        spawnMsg: "A strange scent fills the air...",
        sfx: "wood",
        singleLayer: true,
        friction: -1,
        excludeFromWiki: 1,
        noGeodeTexture: true
    },
    unnamed5: {
        name: "Unnamed 5",
        color: "#111",
        chance: 1 / 60e6,
        maxY: -10001,
        minY: -11000,
        str: 900,
        friction: 2.2,
        spawnMsg: "YOU... your time... has come...",
        sfx: "stone",
        excludeFromWiki: 1,
        creator: "YeetSnake25",
        singleLayer: true,
        onEnter() { // runs when the player hovers
            const descs = ["I know all...", "Who am I?", "I negative love you :)", "Why 5 you ask?",
                "My four brothers are a thing of the past", "PERISH", "Stop wasting your time", "I am all powerful…",
                "5", "If you die then that just means you can stop wasting your life mining", "qhat", "Tpyois sre fun",
                "ECIK'LN", ">:(((((((", "This weird box thing wishes to insult you", "Stop afking",
                "No I'm totally not a glitch", "Five and five only", "Stop I'm on vacation", "youre the worst",
                "frive??", "Your phone is ringing", "I don't feel like being mined today"];
            const randomDesc = descs[Math.floor(Math.random() * descs.length)];
            ores.unnamed5.desc = randomDesc;
        },
        tick(x, y, z) {
            // move towards the player
            const playerPos = vars.player.position;
            const orePos = new THREE.Vector3(x, y, z).add(m(x, y, z).offset);
            const dir = playerPos.clone().sub(orePos).normalize();
            m(x, y, z).offset.add(dir.multiplyScalar(0.1));
            vars.matricesToUpdate.add(`${x},${y},${z}`);
        },
        caveExclusive: -1,
        audio: "shepard_tone_seamless-19159.mp3"
    },
    blackHole: {
        name: "Black Hole",
        color: "radial-gradient(circle, #000 0%, #000 19%, #ff0 19%, #800 62%, #000 100%)",
        chance: 1 / 85e6,
        maxY: Infinity,
        minY: -Infinity,
        str: 550,
        spawnMsg: "The force of a nearby singularity stretches your body to its limits...",
        excludeFromWiki: 1,
        geometry: "SphereGeometry",
        material: "MeshBasicMaterial",
        noTexture: true,
        conditionLabel: "Only spawns in cave air",
        radiation: 150,
        radiationFalloff: 0.7, // -70% per block distance
        audio: "blackHole.mp3",
        creator: ["Tranquanto", "squid"],
        cave: {
            air: true
        },
        onGenerate(x, y, z) {
            function addCylinder() {
                const geometry = new THREE.CylinderGeometry(0.06, 0.06, 32);
                const material = new THREE.MeshBasicMaterial({
                    color: 0xffff00,
                    transparent: true,
                    opacity: 0.8,
                    depthWrite: false
                });
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.set(x, y, z);
                mesh.rotation.set(Math.random() * 0.16 - 0.08, 0, Math.random() * 0.16 - 0.08);
                mesh.name = `blackHole-${x}-${y}-${z}`;
                mesh.renderOrder = 99;
                vars.scene.add(mesh);
            }

            function addAccretionDisc() {
                const g = new THREE.PlaneGeometry(4, 4);
                const material = new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    side: THREE.DoubleSide,
                    map: vars.textures.turnyThing,
                    transparent: true,
                    opacity: 0.8,
                    depthWrite: false
                });
                const mesh = new THREE.InstancedMesh(g, material, 48);
                mesh.count = 48;
                mesh.position.set(x, y, z);
                mesh.name = `blackHole-disc-${x}-${y}-${z}`;
                mesh.renderOrder = 99;
                mesh.rotation.set(Math.PI / 2, 0, Math.random() * Math.PI * 2);
                mesh.userData.active = true;
                mesh.userData.speed = Array(mesh.count).fill().map(() => Math.random() * 0.01 + 0.03);
                vars.scene.add(mesh);
                
                for (let i = 0; i < mesh.count; i++) {
                    const dummy = new THREE.Object3D();
                    dummy.position.setScalar(0);
                    dummy.rotation.set(
                        Math.random() * 0.1 - 0.05,
                        Math.random() * 0.1 - 0.05,
                        Math.random() * Math.PI * 2
                    );
                    dummy.updateMatrix();
                    mesh.setMatrixAt(i, dummy.matrix);
                    mesh.setColorAt(i, new THREE.Color(256 * (Math.floor(Math.random() * -128) + 256) + 256 ** 2 * 255));
                }

                mesh.instanceColor.needsUpdate = true;

                function meshTick() {
                    if (!mesh.userData.active) return;
                    // mesh.rotation.z += mesh.userData.speed;
                    requestAnimationFrame(meshTick);
                    if (vars.PAUSED) return;
                    if (m(x, y, z).ore !== "blackHole") vars.scene.remove(mesh);

                    for (let i = 0; i < mesh.count; i++) {
                        const matrix = new THREE.Matrix4();
                        mesh.getMatrixAt(i, matrix);
                        const dummy = new THREE.Object3D();
                        dummy.applyMatrix4(matrix);
                        dummy.rotation.z += mesh.userData.speed[i];
                        dummy.updateMatrix();
                        mesh.setMatrixAt(i, dummy.matrix);
                    }

                    mesh.instanceMatrix.needsUpdate = true;
                    mesh.computeBoundingBox();
                    mesh.computeBoundingSphere();
                }
                meshTick();
            }

            addCylinder();
            addAccretionDisc();
        },
        onRemove(x, y, z) {
            const mesh = vars.scene.getObjectByName(`blackHole-${x}-${y}-${z}`);
            const mesh2 = vars.scene.getObjectByName(`blackHole-disc-${x}-${y}-${z}`);
            if (mesh) {
                vars.scene.remove(mesh);
            }
            if (mesh2) {
                vars.scene.remove(mesh2);
            }
        },
        tick(x, y, z) {
            // apply gravitational pull to the player
            const playerPos = vars.player.position;
            const orePos = new THREE.Vector3(x, y, z);
            const dir = orePos.clone().sub(playerPos);
            const distance = dir.length();
            let strength = 0.01 * (1 - distance / 10);
            if (strength < 0) strength = 0;
            dir.normalize();
            vars.player.velocity.add(dir.multiplyScalar(strength));
        }
    },
    // unfathomable
    creation: {
        name: "Creation",
        color: "#d9f2ff",
        chance: [
            {
                chance: 1 / 2e8,
                maxY: Infinity,
                minY: 251
            },
            {
                chance: 1 / 2e8,
                maxY: -2,
                minY: -Infinity
            }
        ],
        str: 12,
        light: {
            col: "#fff",
            str: 10
        },
        particles: {
            area: {x: 1, y: 1, z: 1},
            texture: "particle",
            emitRate: 50,
            lifetime: 2,
            count: 150,
            size: 0.25,
            centerGravity: -25,
            color: "#fff"
        },
        spawnMsg: "The pure essence of creation has manifested itself into one single stone...",
        excludeFromWiki: 1
    },
    destruction: {
        name: "Destruction",
        color: "#800",
        chance: [
            {
                chance: 1 / 3e8,
                maxY: Infinity,
                minY: 251
            },
            {
                chance: 1 / 3e8,
                maxY: -2,
                minY: -Infinity
            }
        ],
        str: 13,
        light: {
            col: "#f00",
            str: 10
        },
        particles: {
            area: {x: 5, y: 5, z: 5},
            texture: "particle",
            emitRate: 50,
            lifetime: 2,
            count: 150,
            size: 0.25,
            centerGravity: 25,
            color: "#f00"
        },
        spawnMsg: "All that is good must come to an end...",
        excludeFromWiki: 1,
        audio: "destruction.mp3"
    },
    dwagonite: {
        name: "Dwagonite",
        desc: "Dragonite in its twue fowm ^W^",
        color: "#90f",
        chance: 1 / 5e8,
        maxY: -2,
        minY: -1000,
        str: 73,
        particles: {
            area: {x: 0, y: 0, z: 0},
            texture: "particle",
            emitRate: 10,
            lifetime: 2,
            count: 50,
            size: 0.4,
            centerGravity: -5,
            color: "#90f"
        },
        light: {
            col: "#90f",
            str: 2
        },
        emissive: {
            str: 1,
            map: "dwagonite_emissive"
        },
        spawnMsg: "da dwagon's rawr echoes thwoughout da mines...",
        excludeFromWiki: 1
    },
    error: {
        name: "Error",
        color: "#c73b3b",
        chance: 1 / 5.6e9,
        maxY: -10001,
        minY: -11000,
        str: 404,
        condition(x, y, z) {
            return getBiomeNumber(x, y, z, "error") >= 0.4 ? 100 : 1; // 100x rarer outside error biomes
        },
        conditionLabel: "100x more common in error biomes (1/56M)",
        light: {
            col: "#f00",
            str: 10
        },
        emissive: {
            str: 0.5
        },
        spawnMsg: "Error: An unexpected error has occurred during ore generation.",
        audio: "malfunction.mp3",
        tier: "unfathomable",
        desc: "Error: Ore not found. Please try again later.",
        music: "Tranquanto - Malfunction",
        excludeFromWiki: 1,
        wikiBG: "null",
        ticks: [],
        points: [],
        tick(x, y, z) {
            const material = new THREE.PointsMaterial({
                map: Math.random() > 0.5 ? vars.textures.warning : vars.textures.x,
                color: 0xff0000,
                size: 0.5,
                transparent: true
            });
            const points = new THREE.Points(new THREE.BufferGeometry(), material);
            points.renderOrder = 104;
            const positions = [];
            for (let i = 0; i < Math.random() * 64; i++) {
                const px = (Math.random() - 0.5) * (Math.random() ** 2 * 10);
                const py = (Math.random() - 0.5) * (Math.random() ** 2 * 10);
                const pz = (Math.random() - 0.5) * (Math.random() ** 2 * 10);
                positions.push(x + px, y + py, z + pz);
            }
            points.geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
            vars.scene.add(points);
            points.geometry.attributes.position.needsUpdate = true;
            setTimeout(() => {
                vars.scene.remove(points);
            }, 100);

            if (Math.random() < 0.08) {
                let n = Math.floor(Math.random() * 10);
                const numberMaterial = new THREE.PointsMaterial({
                    map: vars.textures[`numbers/${n}`],
                    color: 0x00ff00,
                    size: 0.4,
                    opacity: 0.75,
                    transparent: true
                });
                const number = new THREE.Points(new THREE.BufferGeometry(), numberMaterial);
                number.renderOrder = 104;
                const px = (Math.random() - 0.5) * 2;
                const py = (Math.random() - 0.5) * 2;
                const pz = (Math.random() - 0.5) * 2;
                number.geometry.setAttribute("position", new THREE.Float32BufferAttribute([x + px, y + py, z + pz], 3));
                vars.scene.add(number);
                number.geometry.attributes.position.needsUpdate = true;
                ores.error.points.push({x, y, z, number});
                
                ores.error.ticks.push({x, y, z, func: () => {
                    number.position.y -= 0.01;
                    number.material = new THREE.PointsMaterial({
                        map: vars.textures[`numbers/${Math.floor(n += 1 / 3) % 10}`],
                        color: 0x00ff00,
                        opacity: Math.max(0, number.material.opacity - 0.01),
                        size: 0.4,
                        transparent: true
                    });

                    if (number.material.opacity <= 0) {
                        vars.scene.remove(number);
                        ores.error.ticks = ores.error.ticks.filter(t => t.func !== this);
                    }
                }});
            }

            for (const tick of ores.error.ticks.filter(t => t.x === x && t.y === y && t.z === z)) {
                tick.func();
            }
        },
        onRemove(x, y, z) {
            for (const point of ores.error.points.filter(p => p.x === x && p.y === y && p.z === z)) {
                vars.scene.remove(point.number);
            }
            ores.error.points = ores.error.points.filter(p => !(p.x === x && p.y === y && p.z === z));
        }
    },
    // inconceivable
    antimatter: {
        name: "Antimatter",
        color: "linear-gradient(to right, #0ff9f0, #6dd7f5, #fff)",
        chance: 1 / 1e9, // 1 in 1b
        maxY: -2,
        minY: -Infinity,
        str: 0.5,
        spawnMsg: "An intense force of energy pulls at the very fabric of your being...",
        excludeFromWiki: 1,
        light: {
            col: "#6dd7f5",
            str: -15,
            decay: 0.2,
            radius: 0
        },
        emissive: {
            str: 3,
            map: "antimatter_emissive"
        },
        tick(x, y, z) {
            const size = Math.random() * 24 + 12;
            const geometry = new THREE.PlaneGeometry(size, size);
            const material = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                side: THREE.DoubleSide,
                map: vars.textures.ring,
                transparent: true,
                opacity: 0,
                depthWrite: false
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.frustumCulled = false;
            mesh.position.set(x, y, z);
            mesh.renderOrder = 99;
            mesh.rotation.set(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
            mesh.userData.active = true;
            mesh.userData.speed = Math.random() * 0.01 + 0.03;
            vars.scene.add(mesh);
            setTimeout(() => {
                mesh.userData.active = false;
                vars.scene.remove(mesh);
            }, 2000);
            function meshTick() {
                if (!mesh.userData.active) return;
                requestAnimationFrame(meshTick);
                if (vars.PAUSED) return;
                mesh.rotation.z += mesh.userData.speed;
                mesh.material.opacity = Math.min(1, mesh.material.opacity + 0.003);
                geometry.scale(0.95, 0.95, 0.95);
                if (m(x, y, z).ore !== "antimatter") vars.scene.remove(mesh);
            }
            meshTick();
            const dist = vars.perspectiveCamera.position.distanceTo(new THREE.Vector3(x, y, z));
            vars.camera.shakeIntensity = Math.max(0, 2 / (dist + 2) - (dist / 50));
        },
        onRemove(x, y, z) {
            if (!m(x, y, z).placed) {
                // destroy a giant sphere of ores around it with a 12 block radius
                for (let dx = -12; dx <= 12; dx++) {
                    for (let dy = -12; dy <= 12; dy++) {
                        for (let dz = -12; dz <= 12; dz++) {
                            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                            if (dist <= 12) {
                                vars.removalQueue.push({x: x + dx, y: y + dy, z: z + dz, forced: true});
                            }
                        }
                    }
                }

                const explosionGeometry = new THREE.SphereGeometry(0.5, 16, 16);
                const explosionMaterial = new THREE.MeshLambertMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 0.8,
                    depthWrite: false,
                    emissive: 0xffffff,
                    emissiveIntensity: 20
                });
                const explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
                explosion.position.set(x, y, z);
                explosion.renderOrder = 99;
                vars.scene.add(explosion);

                const light = {
                    position: explosion.position,
                    color: new THREE.Color(0xffffff),
                    intensity: 150,
                    decay: 0.1
                }

                vars.lightArr.push(light);

                const explosionTick = () => {
                    if (explosion.userData.inactive) return;
                    requestAnimationFrame(explosionTick);
                    if (vars.PAUSED) return;
                    explosion.scale.addScalar(0.2 * vars.FRAME_TIME * 60);
                    explosion.material.opacity *= 0.9 ** (vars.FRAME_TIME * 60);

                    if (explosion.material.opacity > 0.5) {
                        explosion.material.color = new THREE.Color(0xffffff).lerp(new THREE.Color(0xffff00), 2 - explosion.material.opacity / 0.5);
                    } else if (explosion.material.opacity > 0.1) {
                        explosion.material.color = new THREE.Color(0xffff00).lerp(new THREE.Color(0xff0000), 1.25 - explosion.material.opacity / 0.4);
                    } else {
                        explosion.material.color = new THREE.Color(0xff0000).lerp(new THREE.Color(0x444444), 1 - explosion.material.opacity / 0.1);
                    }
                    explosion.material.emissive = light.color = explosion.material.color;

                    light.intensity *= 0.9 ** (vars.FRAME_TIME * 60);
                    light.needsUpdate = true;
                }
                explosionTick();
                setTimeout(() => {
                    explosion.userData.inactive = true;
                    vars.scene.remove(explosion);

                    const lightIndex = vars.lightArr.indexOf(light);
                    if (lightIndex !== -1) {
                        vars.lightArr.splice(lightIndex, 1);
                    }
                }, 3000);

                const audio = new Audio("audio/sfx/explosion.mp3");
                audio.volume = 0.5;
                audio.play();
                vars.camera.shake(0.5, 2000);
            } else {
                vars.camera.shakeIntensity = 0;
            }
        }
    },
    alaphite: {
        name: "Alaphite",
        color: "conic-gradient(#ffff55, #55ffff, #ff0000, #0041ff, #00beff, #ffff55)",
        chance: 1 / 1.64e9,
        maxY: 3000,
        minY: 1000,
        str: 2200,
        light: {
            col: "#ffcc41",
            str: 20
        },
        emissive: {
            str: 0
        },
        spawnMsg: "Impatience begins to tear into your soul, hurling you into madness...",
        audio: "modified peruri.mp3",
        music: "Tranquanto - Péruri",
        creator: ["startijer", "Tranquanto"],
        excludeFromWiki: 1,
        onGenerate(x, y, z) {
            const sphere = new THREE.SphereGeometry(0.3, 16, 16);
            const material = new THREE.MeshStandardMaterial({
                color: 0xffff00,
                emissive: 0xffff00,
                emissiveIntensity: 1.5
            });
            const mesh = new THREE.Mesh(sphere, material);
            mesh.position.set(x, y, z);
            mesh.userData.originalPos = new THREE.Vector3(x, y, z);
            const rand = Math.random() * Math.PI * 2;
            const x1 = Math.cos(rand);
            const z1 = Math.sin(rand);
            const vector = new THREE.Vector3(x1, 0, z1).multiplyScalar(1.5);

            const axialTilt = Math.random() * Math.PI * 2;
            vector.applyAxisAngle(new THREE.Vector3(1, 0, 0), axialTilt);

            mesh.position.add(vector);
            mesh.userData.angle = rand;
            mesh.name = `alaphite-sphere-${x}-${y}-${z}`;
            mesh.userData.active = true;
            vars.scene.add(mesh);

            const speed = Math.random() * 0.06 + 0.04;

            const g = new THREE.PlaneGeometry(3.8, 3.8);
            const swirlMat = new THREE.MeshStandardMaterial({
                color: 0xffff00,
                side: THREE.DoubleSide,
                map: vars.textures.swirl,
                transparent: true,
                depthWrite: false,
                emissive: 0xffff00,
                emissiveIntensity: 1
            });
            const swirl = new THREE.Mesh(g, swirlMat);
            swirl.position.set(x, y, z);
            swirl.name = `alaphite-swirl-${x}-${y}-${z}`;
            swirl.renderOrder = 99;
            vars.scene.add(swirl);

            function meshTick() {
                if (mesh.userData.active) {
                    requestAnimationFrame(meshTick);
                    if (vars.PAUSED) return;
                    mesh.userData.angle += speed * vars.FRAME_TIME * 60;
                    const x1 = Math.cos(mesh.userData.angle);
                    const z1 = Math.sin(mesh.userData.angle);
                    vector.set(x1, 0, z1);
                    vector.applyAxisAngle(new THREE.Vector3(1, 0, 0), axialTilt).multiplyScalar(1.5);
                    mesh.position.set(
                        mesh.userData.originalPos.x + vector.x,
                        mesh.userData.originalPos.y + vector.y,
                        mesh.userData.originalPos.z + vector.z
                    );
                    if (m(x, y, z).ore !== "alaphite") {
                        mesh.userData.active = false;
                        vars.scene.remove(mesh);
                    }
                }
                if (swirl.userData) {
                    swirl.rotation.set(axialTilt - Math.PI / 2, 0, -mesh.userData.angle);
                }

                let a = -1;
                const col = Math.random() * 2 - 1;
                const sparkleColor = new THREE.Color("#ff0").lerp(new THREE.Color("#fff"), col < 0 ? 0 : col).lerp(new THREE.Color("#0ff"), col > 0 ? 0 : -col);

                vars.particleQueue.push({
                    x: x + Math.random() * 3 - 1.5,
                    y: y + Math.random() * 3 - 1.5,
                    z: z + Math.random() * 3 - 1.5,
                    size: Math.random() * 0.2 + 0.1,
                    texture: "sparkle" + ~~(Math.random() * 5),
                    velocity: {
                        x: (Math.random() - 0.5) / 30,
                        y: (Math.random() - 0.5) / 30,
                        z: (Math.random() - 0.5) / 30
                    },
                    opacity: 1,
                    color: sparkleColor,
                    tick(particle, FRAME_TIME) {
                        a += 0.01 * FRAME_TIME * 60;
                        particle.points.material.opacity = 1 - Math.abs(a);
                        if (particle.points.material.opacity < 0 || !mesh.userData.active) return true;
                    }
                });
            }
            meshTick();
        },
        onRemove(x, y, z) {
            const mesh = vars.scene.getObjectByName(`alaphite-sphere-${x}-${y}-${z}`);
            if (mesh) {
                vars.scene.remove(mesh);
            }
            const swirl = vars.scene.getObjectByName(`alaphite-swirl-${x}-${y}-${z}`);
            if (swirl) {
                vars.scene.remove(swirl);
            }
        }
    },
    // apotheotic
    exoticMatter: {
        name: "Exotic Matter",
        color: "linear-gradient(45deg, #ff00cc, #3333ff, #00ffff, #ff0000, #ff00ff)",
        chance: 1 / 5e9,
        maxY: -2,
        minY: -Infinity,
        str: 3,
        light: {
            col: "random",
            str: 10
        },
        emissive: {
            str: 1,
            map: "exoticMatter_emissive"
        },
        spawnMsg: "An otherworldly substance of incomprehensible properties emanates a deep resonance, shaking you to your core...",
        excludeFromWiki: 1,
        audio: "toxic-rush.mp3",
        music: "Tranquanto - Toxic Rush",
        noTexture: true,
        forceAdjacent: true,
        opacity: 0,
        onGenerate(x, y, z) {
            const geometry = new THREE.IcosahedronGeometry(0.5, 0);
            const material = new THREE.MeshBasicMaterial({
                color: 0xffffff
            });
            const mesh = new THREE.InstancedMesh(geometry, material, 48);
            mesh.renderOrder = 99;
            mesh.position.set(x, y, z);
            mesh.name = `exoticMatter-${x}-${y}-${z}`;
            mesh.userData.active = true;

            for (let i = 0; i < mesh.count; i++) {
                const dummy = new THREE.Object3D();
                dummy.position.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(Math.random() * 0.5);
                dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
                dummy.updateMatrix();
                mesh.setMatrixAt(i, dummy.matrix);
                mesh.setColorAt(i, new THREE.Color(Math.random() * 0xffffff));
            }

            vars.scene.add(mesh);

            for (let i = 0; i < 16; i++) {
                // const oreID = oreArray.filter(o => o.singleLayer && !o.noTexture && !o.customTexture)[Math.floor(Math.random() * oreArray.filter(o => o.singleLayer && !o.noTexture && !o.customTexture).length)].id;
                const oreID = Object.keys(vars.textures)[Math.floor(Math.random() * Object.keys(vars.textures).length)];
                const oreGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
                const oreMat = new THREE.MeshLambertMaterial({
                    color: 0xffffff,
                    map: vars.textures[oreID],
                    transparent: true
                });
                const bg = new THREE.MeshLambertMaterial({
                    map: vars.textures.shale
                });
                oreGeo.clearGroups();
                oreGeo.addGroup(0, Infinity, 0);
                oreGeo.addGroup(0, Infinity, 1);
                const oreMesh = new THREE.InstancedMesh(oreGeo, [bg, oreMat], 6 * i);
                oreMesh.userData.tilt = {x: Math.random() * Math.PI, y: Math.random() * Math.PI, z: Math.random() * Math.PI};
                oreMesh.userData.rotations = Array(oreMesh.count).fill().map((_, idx) => Math.PI / 3 * idx / i);
                oreMesh.userData.rotationSpeeds = Array(oreMesh.count).fill().map(() => ({x: (Math.random() - 0.5) * 0.02, y: (Math.random() - 0.5) * 0.02, z: (Math.random() - 0.5) * 0.02}));
                oreMesh.position.set(x, y, z);
                
                oreMesh.name = `exoticMatter-ore-${x}-${y}-${z}-${i}`;
                vars.scene.add(oreMesh);
            }
        },
        onRemove(x, y, z) {
            const mesh = vars.scene.getObjectByName(`exoticMatter-${x}-${y}-${z}`);
            if (mesh) vars.scene.remove(mesh);
            for (let i = 0; i < 16; i++) {
                const oreMesh = vars.scene.getObjectByName(`exoticMatter-ore-${x}-${y}-${z}-${i}`);
                if (oreMesh) vars.scene.remove(oreMesh);
            }
        },
        tick(x, y, z) {
            const mesh = vars.scene.getObjectByName(`exoticMatter-${x}-${y}-${z}`);
            if (mesh && mesh.userData.active) {
                // randomize positions and rotations
                for (let i = 0; i < mesh.count; i++) {
                    const dummy = new THREE.Object3D();
                    mesh.getMatrixAt(i, dummy.matrix);
                    dummy.position.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(Math.random() * 0.5);
                    dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
                    dummy.updateMatrix();
                    mesh.setMatrixAt(i, dummy.matrix);
                    mesh.setColorAt(i, new THREE.Color(Math.random() * 0xffffff));
                }

                mesh.instanceMatrix.needsUpdate = true;
                mesh.instanceColor.needsUpdate = true;
                mesh.computeBoundingBox();
                mesh.computeBoundingSphere();
            }

            for (let i = 0; i < 16; i++) {
                const oreMesh = vars.scene.getObjectByName(`exoticMatter-ore-${x}-${y}-${z}-${i}`);
                if (oreMesh) {
                    for (let j = 0; j < oreMesh.count; j++) {
                        const dummy = new THREE.Object3D();
                        oreMesh.getMatrixAt(j, dummy.matrix);
                        const tilt = oreMesh.userData.tilt;
                        oreMesh.userData.rotations[j] += 0.3 * vars.FRAME_TIME * 60 / i ** 2;
                        dummy.position.set(i * 2, 0, 0)
                        .applyAxisAngle(new THREE.Vector3(0, 1, 0), oreMesh.userData.rotations[j])
                        .applyAxisAngle(new THREE.Vector3(1, 0, 0), tilt.x)
                        .applyAxisAngle(new THREE.Vector3(0, 1, 0), tilt.y)
                        .applyAxisAngle(new THREE.Vector3(0, 0, 1), tilt.z);

                        dummy.rotation.set(oreMesh.userData.rotations[j], oreMesh.userData.rotations[j], oreMesh.userData.rotations[j]);

                        dummy.updateMatrix();
                        oreMesh.setMatrixAt(j, dummy.matrix);
                    }
                    oreMesh.instanceMatrix.needsUpdate = true;
                    oreMesh.computeBoundingBox();
                    oreMesh.computeBoundingSphere();
                }
            }
        },
        onTouch() { // fling the player around like crazy because why not
            vars.player.velocity.x = Math.random() * 10 - 5;
            vars.player.velocity.y = Math.random() * 10 - 5;
            vars.player.velocity.z = Math.random() * 10 - 5;
        }
    },
    pensivite: {
        name: "Pensivite",
        color: "#ffcc41",
        chance: [
            {
                chance: 1 / 3e9,
                maxY: Infinity,
                minY: 251
            },
            {
                chance: 1 / 3e9,
                maxY: -2,
                minY: -Infinity
            }
        ],
        str: 50,
        light: {
            col: "#ffcc41",
            str: 20
        },
        emissive: {
            str: 0
        },
        spawnMsg: "Thinking and contemplation coalesce to create a mystical substance...",
        otherDetails: "idea by CosmicCyclone12",
        excludeFromWiki: 1,
        condition: () => false
    },
    // transcendent
    vita: {
        name: "Existence",
        color: "#2fc98a",
        chance: [
            {
                chance: 1 / 1e10,
                maxY: Infinity,
                minY: 251
            },
            {
                chance: 1 / 1e10,
                maxY: -2,
                minY: -Infinity
            }
        ],
        str: 184,
        light: {
            col: "#2fc98a",
            str: 15
        },
        particles: {
            area: {x: 0, y: 0, z: 0},
            texture: "particle",
            emitRate: 100,
            lifetime: 2,
            count: 300,
            size: 0.25,
            centerGravity: -50,
            color: "#2fc98a"
        },
        spawnMsg: "The essence of the universe itself has been evinced into an enigmatic, objectified form...",
        excludeFromWiki: 1,
        condition: () => false
    },

    // monthly ores
    rainbonite: {
        name: "Rainbonite",
        color: "linear-gradient(45deg, #f00, #f80, #ff0, #0f0, #00f, #80f, #f00)",
        chance: [
            {chance: 1 / 340000, maxY: Infinity, minY: 251},
            {chance: 1 / 340000, maxY: -100, minY: -10000, condition: () => new Date().getMonth() === 5, conditionLabel: "Only during June"}
        ],
        str: 6,
        desc: "I like colors :3",
        spawnMsg: "A colorful mineral reveals itself in the clouds...",
        light: {
            col: "random",
            str: 4
        },
        excludeFromWiki: 1,
        onGenerate(x, y, z) {
            function meshTick() {
                if (m(x, y, z).ore === "rainbonite") {
                    requestAnimationFrame(meshTick);
                    if (vars.PAUSED) return;
                    
                    // rainbow helix thing
                    const time = Date.now() * 0.001;
                    const radius = 4;
                    const height = 4;
                    
                    for (let i = 0; i < 50; i++) {
                        const angle = (i / 49) * Math.PI * 2;
                        const arcX = Math.cos(angle) * radius;
                        const arcY = Math.sin(angle) * height;
                        const arcZ = Math.sin(time + i * Math.PI / 6.125) * 2; // wavy
                        
                        const hue = ((i / 49) * 360 + time * 30) % 360;
                        const color = new THREE.Color(`hsl(${hue}, 100%, 60%)`);
                        
                        vars.particleQueue.push({
                            x: x + arcX,
                            y: y + arcY,
                            z: z + arcZ,
                            size: 1.25,
                            texture: "particle",
                            velocity: { x: 0, y: 0, z: 0 },
                            opacity: 0.8,
                            color,
                            tick(particle) {
                                particle.points.material.opacity = Math.max(0, particle.points.material.opacity - 0.03);
                                if (particle.points.material.opacity <= 0) return true;
                            }
                        });
                    }
                    
                    // sparkles
                    if (Math.random() < 0.3) {
                        vars.particleQueue.push({
                            x: x + (Math.random() - 0.5) * 16,
                            y: y + Math.random() * 8 - 4,
                            z: z + (Math.random() - 0.5) * 4,
                            size: Math.random() * 0.2 + 0.1,
                            texture: "sparkle" + ~~(Math.random() * 5),
                            velocity: {
                                x: (Math.random() - 0.5) * 2,
                                y: Math.random() * 2,
                                z: (Math.random() - 0.5) * 2
                            },
                            opacity: 1,
                            color: new THREE.Color(`hsl(${Math.random() * 360}, 100%, 70%)`),
                            tick(particle) {
                                particle.points.material.opacity *= 0.95;
                                if (particle.points.material.opacity < 0.1) return true;
                            }
                        });
                    }
                }
            }
            meshTick();
        }
    },
    gendrite: {
        name: "Gendrite",
        color: "linear-gradient(135deg, #98d9ff 0%, #98d9ff 20%, #ffb2f2 20%, #ffb2f2 40%, #fff 40%, #fff 60%, #ffb2f2 60%, #ffb2f2 80%, #98d9ff 80%, #98d9ff 100%)",
        chance: [
            {
                chance: 1 / 5e6,
                maxY: Infinity,
                minY: 251
            },
            {
                chance: 1 / 5e6,
                maxY: -2,
                minY: -Infinity
            }
        ],
        str: 20,
        condition: () => new Date().getMonth() === 5,
        conditionLabel: "Only spawns during June",
        spawnMsg: "The essence of gender has been crystallized into a peculiar stone...",
        desc: "All genders are valid!",
        light: {
            col() {
                return ["#98d9ff", "#ffffff", "#ffb2f2"][Math.floor(Math.random() * 3)];
            },
            str: 4
        },
        emissive: {str: 0.5},
        excludeFromWiki: 1
    },
    pumpkinite: {
        name: "Pumpkinite",
        color: "#f80",
        chance: 1 / 1000,
        str: 2.5,
        maxY: -1,
        minY: -9999,
        condition: () => new Date().getMonth() === 9,
        conditionLabel: "Only spawns during October",
        desc: "Happy Halloween!",
        excludeFromWiki: 1
    },

    // special or conditional ores
    darkGem: {
        name: "Gem of Darkness",
        color: "linear-gradient(to right, #000, #3808a0, #000)",
        chance: 1 / 750e3,
        str: 10,
        maxY: -11,
        minY: -Infinity,
        light: {
            col: "#6b2afa",
            str: 1.2
        },
        desc: "A mysterious gem. Evil resonates within.",
        otherDetails: "idea by Silly_Lyan",
        excludeFromWiki: 1,
        forcedBackground: "obsidian",
        condition: () => false, // not normally obtainable; the 1/750k is the rarity of the structure it spawns in
        conditionLabel: "Only obtainable through Dark Gem Dungeons",
        spawnMsg: "An evil aura begins to surround you...",
        onGenerate(x, y, z) {
            function addAccretionDisc() {
                const g = new THREE.PlaneGeometry(2.75, 2.75);
                const material = new THREE.MeshPhongMaterial({
                    color: 0xffffff,
                    side: THREE.DoubleSide,
                    map: vars.textures.turnyThing,
                    transparent: true,
                    opacity: 0.8,
                    depthWrite: false
                });
                const mesh = new THREE.InstancedMesh(g, material, 48);
                mesh.count = 48;
                mesh.position.set(x, y, z);
                mesh.name = `darkGem-${x}-${y}-${z}`;
                mesh.renderOrder = 99;
                mesh.rotation.set(Math.PI / 2, 0, Math.random() * Math.PI * 2);
                mesh.userData.active = true;
                mesh.userData.speed = Array(mesh.count).fill().map(() => Math.random() * 0.01 + 0.03);
                vars.scene.add(mesh);
                
                for (let i = 0; i < mesh.count; i++) {
                    const dummy = new THREE.Object3D();
                    dummy.position.setScalar(0);
                    dummy.rotation.set(
                        Math.random() * 0.1 - 0.05,
                        Math.random() * 0.1 - 0.05,
                        Math.random() * Math.PI * 2
                    );
                    dummy.updateMatrix();
                    mesh.setMatrixAt(i, dummy.matrix);
                    const n = Math.random();
                    mesh.setColorAt(i, new THREE.Color(Math.floor(n * 128) * 256 ** 2 + Math.floor(n * 256)));
                }

                mesh.instanceColor.needsUpdate = true;

                function meshTick() {
                    if (!mesh.userData.active) return;
                    // mesh.rotation.z += mesh.userData.speed;
                    requestAnimationFrame(meshTick);
                    if (vars.PAUSED) return;
                    if (m(x, y, z).ore !== "darkGem") vars.scene.remove(mesh);

                    for (let i = 0; i < mesh.count; i++) {
                        const matrix = new THREE.Matrix4();
                        mesh.getMatrixAt(i, matrix);
                        const dummy = new THREE.Object3D();
                        dummy.applyMatrix4(matrix);
                        dummy.rotation.z += mesh.userData.speed[i];
                        dummy.updateMatrix();
                        mesh.setMatrixAt(i, dummy.matrix);
                    }

                    mesh.instanceMatrix.needsUpdate = true;
                    mesh.computeBoundingBox();
                    mesh.computeBoundingSphere();
                }
                meshTick();
            }

            addAccretionDisc();
        },
        onRemove(x, y, z) {
            const mesh2 = vars.scene.getObjectByName(`darkGem-${x}-${y}-${z}`);
            if (mesh2) {
                vars.scene.remove(mesh2);
            }
        }
    },
    googite: {
        name: "Googite",
        color: "#999",
        chance: [
            {
                chance: 1 / 40000,
                maxY: -1000,
                minY: 251
            },
            {
                chance: 1 / 40000,
                maxY: maxHeight,
                minY: minHeight,
                condition: (x, y, z) => getBiomeNumber(x, Math.max(y, 250), z, "rainy") >= 0.4
            }
        ],
        str: 4,
        desc: "Goog...",
        excludeFromWiki: 1,
        conditionLabel: "Only spawns in rain or storms"
    },
    corruptum: {
        name: "Corruptum",
        color: "linear-gradient(to right, #050 0%, #000 25%, #880 25%, #ff0 50%, #0f0 50%, #ff0 75%, #fff 75%, #000 100%)",
        chance: 1 / 75000,
        maxY: -2,
        minY: -Infinity,
        str: 3.7,
        excludeFromWiki: 1,
        tier: "exotic",
        creator: "Djcobra345",
        spawnMsg: "A strange, corrupted material has emerged...",
        condition(x, y, z) {
            function isPrime(n) {
                let smallestDiv;
                n = BigInt(Math.abs(n));
                if (n <= 1n) return false;
                if (n <= 3n) return true;
                
                function check(i) {
                    if (n % i === 0n) {
                        smallestDiv = i;
                        return false;
                    }
                    return true;
                }

                if (!check(2n)) return false;
                for (let i = 3n; i * i <= n; i += 2n) {
                    if (!check(i)) return false;
                }
                return true;
            }
            return isPrime(x) && isPrime(y) && isPrime(z);
        },
        conditionLabel: "Only spawns if all coordinates are prime"
    },
    viridescence: {
        name: "Viridescence",
        color: "linear-gradient(to right, #000c1d 0%, #72f388 25%, #f7f5cb 40%, #fffff2 50%, #f7f5cb 60%, #72f388 75%, #000c1d 100%)",
        chance: 1 / 1e7,
        adjustedChance: 0.15 / 1e7,
        maxY: -1,
        minY: -8000,
        str: 3.5,
        excludeFromWiki: 1,
        tier: "bizarre",
        spawnMsg: "A verdant catalyst expands lush vegetation through the caverns...",
        caveExclusive: true,
        condition(_x, _y, _z, settings) {
            return settings.caveType === "moss";
        },
        conditionLabel: "Only spawns in moss caves",
        light: {
            col: "#2bff4e",
            str: 1.5
        },
        emissive: {str: 0.5}
    },
    crystal: {
        name: "Crystal",
        color: "#fff",
        chance: 1 / 90,
        maxY: 0,
        minY: -Infinity,
        str: 1,
        cave: {
            floor: true,
            ceiling: true,
            walls: true,
            rotate: true
        },
        desc: "A crystal node growing in a cave.",
        customModel: true,
        offset: {y: -0.5},
        scale: {x: 1.5, y: 1.5, z: 1.5},
        excludeFromWiki: 2,
        placeSettings: {
            rotate: {
                allAxes: true
            }
        },
        condition(x, y, z) {
            return m(x, y, z).hasCrystals;
        }
    },
    runicStone: {
        name: "Runic Stone",
        color: "linear-gradient(to right, #7d00a7, #d147ff, #f6c8ff, #d147ff, #7d00a7)",
        chance: 1 / 112,
        adjustedChance: 0.006 / 112,
        tier: "enigmatic",
        maxY: 0,
        minY: -Infinity,
        str: 24,
        desc: "A stone inscribed with mysterious runes.",
        light: {
            col: "#d147ff",
            str: 1.2
        },
        caveExclusive: true,
        condition(_x, _y, _z, settings) {
            return settings.caveType === "enchanted" && !vars.getOreSettings.crystal;
        },
        excludeFromWiki: 1,
        conditionLabel: "Only spawns in enchanted caves",
        drops: [{id: "blankRune", count: 1}],
        noLocal: true,
        onGenerate(x, y, z) {
            const geometry = new THREE.PlaneGeometry(1, 64);
            const material = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                map: vars.textures.lightRay,
                transparent: true,
                opacity: 0.05,
                side: THREE.DoubleSide,
                depthWrite: false
            });

            const ray = new THREE.Mesh(geometry, material);
            ray.position.set(x + (Math.random() - 0.5) * 15, y, z + (Math.random() - 0.5) * 15);
            ray.rotation.x = vars.lightRayRotation + (Math.random() - 0.5) * 0.08;
            ray.renderOrder = 99;
            ray.name = `runicStoneRay-${x}-${y}-${z}`;

            ray.onBeforeRender = function() {
                const camera = vars.perspectiveCamera;
                const cameraPosition = camera.position.clone();
                const rayPosition = this.position.clone();
                
                const direction = new THREE.Vector2(
                    cameraPosition.x - rayPosition.x,
                    cameraPosition.z - rayPosition.z
                ).normalize();
                
                this.rotation.y = Math.atan2(direction.x, direction.y);

                const xzDistance = Math.sqrt(
                    Math.pow(cameraPosition.x - rayPosition.x, 2) + 
                    Math.pow(cameraPosition.z - rayPosition.z, 2)
                );
                
                // Adjust opacity based on x/z distance (fade out closer, fade in farther)
                
                this.material.opacity = Math.min(Math.max(0, 0.05 * (xzDistance - 2) / 10), 0.05);
            };
            vars.scene.add(ray);
        },
        onRemove(x, y, z) {
            const ray = vars.scene.getObjectByName(`runicStoneRay-${x}-${y}-${z}`);
            if (ray) {
                vars.scene.remove(ray);
            }
        }
    },

    // should i add liquids?
    water: { // sure why not
        name: "Water",
        desc: "A clear, blue liquid.",
        color: "#06f",
        chance: 0, // 0.05,
        isLiquid: true,
        notCollidable: true,
        viscosity: 200, // ms to move 1 block (also affects movement speed)
        str: 1,
        maxY: -1,
        minY: -999,
        excludeFromWiki: 2,
        caveExclusive: true,
        textureHasTransparency: true,
        singleLayer: true
    },
    lava: {
        name: "Lava",
        desc: "A molten rock.",
        color: "#f20",
        chance: 1 / 40, // 1 / 40,
        isLiquid: true,
        notCollidable: true,
        viscosity: 1500,
        str: 1,
        maxY: -1000,
        minY: -1500,
        singleLayer: true,
        excludeFromWiki: 2,
        caveExclusive: true,
        emissive: {
            col: "#f20",
            str: 2.5
        },
        cave: {
            ceiling: true
        },
        onTouch() {
            vars.player.damage(15, 200, "lava");
        }
    },

    // other / unobtainable
    blackWall: {
        name: "Spawn Point",
        color: "linear-gradient(to right, #000, #fff)",
        chance: 0,
        str: Infinity,
        maxY: -1,
        minY: -1,
        singleLayer: true,
        excludeFromWiki: 2,
        noVein: true,
        noGeode: true,
        condition(x, y, z) {
            return x === 0 && z === 0 && y === 1; // only the spawn
        },
        discovered: true,
        desc: "You can't break this.",
        sfx: "metal"
    },
    structureBlock: {
        name: "Structure Block",
        color: "#271e28",
        str: Infinity,
        singleLayer: true,
        excludeFromWiki: 2,
        desc: "Used for importing or exporting structures.",
        sfx: "metal",
        onUse(x, y, z) {
            if (document.exitPointerLock) document.exitPointerLock();

            const gui = document.createElement("div");
            const title = document.createElement("span");
            title.innerText = "Structure Block";
            title.classList.add("wikiName");
            gui.append(title);

            const sizeText = document.createElement("p");
            sizeText.innerText = "Size";

            const xSize = document.createElement("input");
            const ySize = document.createElement("input");
            const zSize = document.createElement("input");

            const offsetText = document.createElement("p");
            offsetText.innerText = "Offset";

            const xOffset = document.createElement("input");
            const yOffset = document.createElement("input");
            const zOffset = document.createElement("input");

            xSize.type = ySize.type = zSize.type = xOffset.type = yOffset.type = zOffset.type = "number";

            xOffset.placeholder = xSize.placeholder = "x";
            yOffset.placeholder = ySize.placeholder = "y";
            zOffset.placeholder = zSize.placeholder = "z";

            xOffset.value = "0";
            yOffset.value = "1";
            zOffset.value = "0";

            xSize.value = ySize.value = zSize.value = "0";

            xOffset.style.width = yOffset.style.width = zOffset.style.width = xSize.style.width = ySize.style.width = zSize.style.width = "20%";
            gui.append(sizeText, xSize, ySize, zSize, offsetText, xOffset, yOffset, zOffset);

            const output = document.createElement("textarea");
            gui.append(output);

            const saveBtn = document.createElement("button");
            saveBtn.innerText = "Save";

            const format = "modern";
            saveBtn.addEventListener("click", () => {
                const minX = x + Number(xOffset.value);
                const minY = y + Number(yOffset.value);
                const minZ = z + Number(zOffset.value);

                if (format === "legacy") {
                    const saveMap = [];
                    const saveSet = [];
                    const layout = [];
                    const key = {" ": "air", "-": "structureVoid"};
                    const inverseKey = {air: " ", structureVoid: "-"};
                    const chars = "qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM1234567890!@#$%^&*()=_+`~[]{}\\|;':\",./<>?"

                    const structure = {key, layout};

                    for (let x = 0; x <= xSize.value; x++) {
                        for (let y = 0; y <= ySize.value; y++) {
                            for (let z = 0; z <= zSize.value; z++) {
                                if (!saveMap[x]) saveMap[x] = [];
                                if (!saveMap[x][y]) saveMap[x][y] = [];
                                if (m(x + minX, y + minY, z + minZ)) {
                                    saveMap[x][y][z] = m(x + minX, y + minY, z + minZ).ore;
                                } else {
                                    saveMap[x][y][z] = "structureVoid";
                                }

                                if (!saveSet.includes(saveMap[x][y][z])) saveSet.push(saveMap[x][y][z]);
                            }
                        }
                    }

                    for (const ore of saveSet) {
                        const char = chars[Object.keys(key).length];
                        if (inverseKey[ore || "structureVoid"] || key[char]) continue;
                        key[char] = ore;
                        inverseKey[ore || "structureVoid"] = char;
                    }

                    for (const x in saveMap) {
                        for (const y in saveMap[x]) {
                            for (const z in saveMap[x][y]) {
                                if (!layout[y]) layout[y] = [];
                                if (!layout[y][x]) layout[y][x] = "";
                                layout[y][x] += inverseKey[saveMap[x][y][z]];
                            }
                        }
                    }

                    key["-"] = null;

                    output.value = JSON.stringify(structure, null, 2);
                } else {
                    const structure = {
                        blocks: [],
                        size: {
                            x: Number(xSize.value),
                            y: Number(ySize.value),
                            z: Number(zSize.value)
                        },
                        palette: []
                    };

                    function objsEqual(a, b) {
                        if (a === b) return true;
                        const aKeys = Object.keys(a);
                        const bKeys = Object.keys(b);
                        if (aKeys.length !== bKeys.length) return false;
                        for (let i = 0; i < aKeys.length; i++) {
                            const key = aKeys[i];
                            if (a[key] !== b[key]) return false;
                        }
                        return true;
                    }

                    for (let x = 0; x < xSize.value; x++) {
                        for (let y = 0; y < ySize.value; y++) {
                            for (let z = 0; z < zSize.value; z++) {
                                const block = m(x + minX, y + minY, z + minZ)
                                ? m(x + minX, y + minY, z + minZ).ore
                                    ? m(x + minX, y + minY, z + minZ)
                                    : {ore: "air"}
                                : null;

                                if (block) {
                                    if (!structure.palette.some(b => b.name === block.ore && objsEqual(b.settings, block.settings))) {
                                        structure.palette.push({name: block.ore, settings: block.settings});
                                    }
                                    structure.blocks.push({
                                        pos: {x: Number(x), y: Number(y), z: Number(z)},
                                        state: structure.palette.findIndex(b => b.name === block.ore && objsEqual(b.settings, block.settings))
                                    });
                                }
                            }
                        }
                    }

                    output.value = JSON.stringify(structure, null, 2);
                }
            });

            saveBtn.classList.add("menuButton", "halfWidth");

            const loadBtn = document.createElement("button");
            loadBtn.innerText = "Load";

            const loadInput = document.createElement("input");
            loadInput.type = "text";
            loadInput.placeholder = "Structure ID";
            gui.append(loadInput);

            loadBtn.addEventListener("click", () => {
                const id = loadInput.value;
                const minX = x + Number(xOffset.value);
                const minY = y + Number(yOffset.value);
                const minZ = z + Number(zOffset.value);
                vars.structureQueue.push([minX, minY, minZ, id, {absPos: true, forced: true, forcedReplace: true, noCenter: true}]);
            });

            loadBtn.classList.add("menuButton", "halfWidth");

            gui.append(saveBtn, loadBtn);

            document.getElementById("big-gui").innerHTML = "";
            Array.from(gui.children).forEach(elem => {
                document.getElementById("big-gui").appendChild(elem);
            });
            document.getElementById("big-gui").style.display = "block";
        }
    },
    structureVoid: {
        name: "Structure Void",
        color: "#271e28",
        str: Infinity,
        singleLayer: true,
        excludeFromWiki: 2,
        desc: "Functions as 'null' in structures, meaning when loading the structure, the block will not be placed/replaced.",
        sfx: "metal",
        noTexture: true
    },
    brick: {
        name: "Bricks",
        color: "#7c4940",
        str: 2,
        singleLayer: true,
        excludeFromWiki: 2,
        desc: "A block made of baked clay.",
        sfx: "stone",
        oreColor: true
    },
    colorfulCube: {
        name: "Colorful Cube of Wonder",
        color: "linear-gradient(45deg, #f00, #0f0, #ff0, #f00)",
        str: 1,
        priority: 3,
        chance: Infinity,
        maxY: -16000,
        minY: -17000,
        singleLayer: true,
        noRandomRotation: true,
        getCanvas() {
            // generate some trippy patterns based on time and position
            const ctx = this.canvasElem.getContext("2d");
            const time = Date.now() / 300;
            const width = this.canvasElem.width;
            const height = this.canvasElem.height;

            this.canvasElem.width = this.canvasElem.width; // clear canvas
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, width, height);

            for (let x = 0; x < width; x++) {
                for (let y = 0; y < height; y++) {
                    const x1 = x / width * Math.PI * 4;
                    const y1 = y / height * Math.PI * 4;
                    const r = Math.floor((Math.sin(time + x1) + 1) * 127.5);
                    const g = Math.floor((Math.sin(time + y1) + 1) * 127.5);
                    const a = (Math.sin(time + x1 + y1) + 1) / 2;
                    ctx.fillStyle = `rgba(${r},${g},${0},${a})`;
                    ctx.fillRect(x, y, 1, 1);
                }
            }

            return this.canvasElem;
        },
        updateCanvas: true
    },

    // craftables, building blocks, or manmade materials
    chair: {
        name: "Chair",
        color: "#b98c62",
        chance: 1 / 160,
        maxY: -49001,
        minY: -50000,
        str: 0.4,
        excludeFromWiki: 2,
        desc: "A wooden chair.",
        customModel: true,
        cave: {
            floor: true
        }
    },
    lightBox: {
        name: "Box of Light",
        color: "#fff7e0",
        chance: 0,
        maxY: 0,
        minY: -Infinity,
        str: 1,
        singleLayer: true,
        excludeFromWiki: 2,
        light: {
            col: "#fff",
            str: 3,
            radius: 8
        },
        desc: "A box that emits light.",
        sfx: "metal"
    },
    sun: {
        name: "The Sun",
        color: "#fff",
        chance: 1e-5, // not 0 because yes
        str: 9,
        maxY: -10000,
        minY: -11000,
        singleLayer: true,
        excludeFromWiki: 1,
        light: {
            col: "#fff",
            str: 1000,
            radius: 50
        },
        emissive: {
            str: 15
        },
        customTexture: {
            ore: "lightBox",
            item: {
                src: "sun"
            }
        },
        desc: "oww oww my eyes",
        sfx: "metal",
        spawnMsg: "The boiling heat of a star burns your skin as you approach...",
        radiation: 5,
        radiationFalloff: 0.5
    },
    wikipediaPageForWhite: {
        name: "Wikipedia Page for White",
        color: "#fff",
        chance: 0,
        str: 1.25,
        noTexture: true,
        desc: "MY EYESSSSSSSSSSSSSSSSSSSSSSSSSSSS",
        sfx: "sand",
        light: {
            col: "#fff",
            str: 10000,
            radius: 250,
            decay: 0.2
        }
    },
    torch: {
        name: "Torch",
        color: "#f90",
        chance: 1 / 50,
        str: 0.6,
        maxY: 0,
        minY: -10000,
        singleLayer: true,
        excludeFromWiki: 2,
        light: {
            col: "#fb4",
            str: 3,
            decay: 1,
            distance: 10,
            offset: {x: 0, y: 0.5, z: 0},
        },
        desc: "A torch that emits light.",
        sfx: "wood",
        multipleTextures: [
            "torch",
            "torch",
            "pixel",
            "torch_bottom",
            "torch",
            "torch"
        ],
        emissive: {
            str: 1.5,
            map: [
                "torch_emissive",
                "torch_emissive",
                "pixel",
                "transparent",
                "torch_emissive",
                "torch_emissive"
            ]
        },
        scale: {x: 0.25, z: 0.25},
        cave: {
            floor: true
        },
        condition(x, y, z) {
            return m(x, y, z).hasTorches;
        }
    },
    extinguishedTorch: {
        name: "Extinguished Torch",
        color: "#231f1c",
        chance: 1 / 80,
        str: 0.6,
        maxY: 0,
        minY: -9999,
        singleLayer: true,
        excludeFromWiki: 2,
        desc: "A torch that has burned out.",
        sfx: "wood",
        multipleTextures: [
            "extinguishedTorch",
            "extinguishedTorch",
            "extinguishedTorch_top",
            "torch_bottom",
            "extinguishedTorch",
            "extinguishedTorch"
        ],
        scale: {x: 0.25, z: 0.25},
        cave: {
            floor: true
        },
        condition(x, y, z) {
            return m(x, y, z).hasExtinguishedTorches;
        },
        drops: [{id: "wood", count: () => Math.round(Math.random())}, {id: "coal", count: () => Math.round(Math.random())}]
    },
    chain: {
        name: "Chain",
        color: "#888",
        chance: 1 / 32,
        str: 1,
        maxY: -50001,
        minY: -Infinity,
        customModel: true,
        excludeFromWiki: 2,
        desc: "It chains things. What'd you think it does?",
        offset: {x: 0, y: 5 / 32, z: 0},
        boundingBox: {
            x: 0.1875,
            y: 1,
            z: 0.1875
        },
        notCollidable: false,
        noRandomRotation: true,
        cave: {
            ceiling: true
        },
        placeSettings: {
            rotate: {
                allAxes: true
            }
        },
        sfx: "metal"
        /* condition(_x, _y, _z, settings) {
            return settings.crate;
        } */
    },
    purplePillar: {
        name: "Purple Pillar",
        color: "#a269c9",
        chance: 1,
        str: 4.5,
        maxY: 0,
        minY: -Infinity,
        singleLayer: true,
        excludeFromWiki: 2,
        desc: "A pillar made of a mysterious purple material.",
        condition: (x, _, z, settings) => settings.caveType === "enchanted" && Math.abs(x % 6) === 1 && Math.abs(z % 6) === 1,
        sfx: "stone",
        cave: {
            ceiling: true
        },
        scale: {
            x: 7/8,
            z: 7/8
        }
    },
    testModel: {
        name: "Test Model",
        color: "#aaa",
        chance: 1 / 1e6,
        adjustedChance: 6.241967484088364e-8, // avg of 1 million samples of chance at random times
        str: () => 10 ** (Math.random() * 6 - 2),
        shownStr: "Random number from 0.01 to 10,000",
        maxY: -2,
        minY: -Infinity,
        customModel: true,
        excludeFromWiki: 1,
        desc: "The first test model when custom models were being developed.",
        spawnMsg: "A strange coagulation of cubes reveals itself deep within the mines...",
        tier: "bizarre",
        condition() {
            return Math.seedrandom(Math.floor(Date.now() / 60000))() ** 15;
        },
        forceCondition: true,
        conditionLabel: "Rarity changes every minute (also only spawns in cave air)",
        meshSize: 6,
        cave: {
            air: true
        },
        onGenerate(x, y, z) {
            const g = new THREE.BoxGeometry(1, 1, 1);
            const m = new THREE.MeshStandardMaterial({color: 0xaaaaaa});
            const mesh = new THREE.InstancedMesh(g, m, 512);
            mesh.count = 512;
            mesh.position.set(x, y, z);
            mesh.renderOrder = 99;
            mesh.userData.active = true;
            mesh.name = `testModel-${x}-${y}-${z}`;

            for (let i = 0; i < mesh.count; i++) {
                const dummy = new THREE.Object3D();
                dummy.position.set(
                    (Math.random() - 0.5),
                    (Math.random() - 0.5),
                    (Math.random() - 0.5)
                ).normalize().multiplyScalar(1.1 ** (Math.random() * Math.log(60) / Math.log(1.1)) / 10);

                dummy.rotation.set(
                    Math.random() * Math.PI * 2,
                    Math.random() * Math.PI * 2,
                    Math.random() * Math.PI * 2
                );
                dummy.scale.setScalar(0.001);
                dummy.updateMatrix();
                mesh.setMatrixAt(i, dummy.matrix);
            }

            mesh.instanceMatrix.needsUpdate = true;
            mesh.computeBoundingBox();
            mesh.computeBoundingSphere();

            vars.scene.add(mesh);
        },
        onRemove(x, y, z) {
            const mesh = vars.scene.getObjectByName(`testModel-${x}-${y}-${z}`);
            if (mesh) {
                vars.scene.remove(mesh);
            }
        },
        tick(x, y, z) {
            const mesh = vars.scene.getObjectByName(`testModel-${x}-${y}-${z}`);
            if (mesh && mesh.userData.active) {
                mesh.rotation.y += 0.04 * vars.FRAME_TIME * 60;
                for (let i = 0; i < mesh.count; i++) {
                    const dummy = new THREE.Object3D();
                    const matrix = new THREE.Matrix4();
                    mesh.getMatrixAt(i, matrix);
                    dummy.applyMatrix4(matrix);
                    const oldDist = dummy.position.distanceTo(new THREE.Vector3(0, 0, 0));
                    dummy.position.multiplyScalar(0.95);

                    let scale = dummy.position.distanceTo(new THREE.Vector3(0, 0, 0)) / 15;
                    if (scale > 0.2) scale = Math.max(0, 0.4 - scale);

                    dummy.scale.setScalar(scale);
                    dummy.updateMatrix();
                    
                    if (oldDist < 0.1) {
                        dummy.position.set(
                            (Math.random() - 0.5) * 1.1 ** (Math.random() * Math.log(6) / Math.log(1.1)),
                            (Math.random() - 0.5) * 1.1 ** (Math.random() * Math.log(6) / Math.log(1.1)),
                            (Math.random() - 0.5) * 1.1 ** (Math.random() * Math.log(6) / Math.log(1.1))
                        );

                        dummy.position.normalize().multiplyScalar(6);

                        dummy.rotation.set(
                            Math.random() * Math.PI * 2,
                            Math.random() * Math.PI * 2,
                            Math.random() * Math.PI * 2
                        );
                        dummy.scale.setScalar(0.001);

                        dummy.updateMatrix();
                    }

                    mesh.setMatrixAt(i, dummy.matrix);
                }
                mesh.instanceMatrix.needsUpdate = true;
                mesh.computeBoundingBox();
                mesh.computeBoundingSphere();
            }
        }
    },
    /* airCollector: {
        name: "Air Collector",
        color: "#9aa",
        chance: 0,
        str: 15,
        singleLayer: true,
        excludeFromWiki: 2
    }, */

    crate: { // found in structures and gives a few items
        name: "Crate",
        color: "#a55900",
        chance: 0,
        str: 1,
        maxY: 0,
        minY: -Infinity,
        singleLayer: true,
        excludeFromWiki: 2,
        desc: "A crate that contains various ores.",
        sfx: "wood",
        onBreak(x, y, z, inventory) {
            if (!m(x, y, z).placed) {
                // gives random ores
                const item = getOre(x, y, z, {caveExclusive: true, all: true, maxChance: 1, forceSpawn: true, crate: true});
                if (!item || ores[item.ore].noCrate) return;

                let count = Math.random() * 3 + 2;
                if (item.chance < 1e-3) {
                    count *= (item.chance * 1e3) ** 0.65; // reduces count for rare ores
                }

                inventory.addItem(item.ore, Math.ceil(count));
            }
        }
    },

    // placeholders for certain structures
    bush: {
        name: "Bush",
        placeholder: true,
        chance: 1 / 50,
        maxY: -6001,
        minY: -7000,
        cave: {
            floor: true
        },
        onGenerate(x, y, z) {
            vars.structureQueue.push([x, y, z, "bush", {absPos: true, forced: true}]);
        }
    }
};

let items = {
    // materials
    bronze: {
        name: "Bronze",
        desc: "An alloy of copper and tin.",
        color: "#df9c43"
    },
    paper: {
        name: "Paper",
        desc: "A sheet of paper.",
        color: "#ddd"
    },
    unobtainiumBar: {
        name: "Unobtainium Bar",
        desc: "A bar of unobtainium and other materials. Extremely powerful.",
        color: ores.unobtainium.color,
        excludeFromWiki: 1
    },
    fluidCell: {
        name: "Fluid Cell",
        desc: "A small cell that can hold an amount of any liquid or gas.",
        color: "#88f"
    },
    blankRune: {
        name: "Blank Rune",
        desc: "A blank rune that can be inscribed with various effects.",
        color: "#ccc"
    },
    // tools
    plasticPickaxe: {
        name: "Plastic Pickaxe",
        desc: "A pickaxe made of plastic.",
        color: "#f88",
        tags: ["pickaxe"],
        power: 1,
        range: 5,
        delay: 0.2
    },
    woodPickaxe: {
        name: "Wood Pickaxe",
        desc: "A pickaxe made of wood.",
        color: "#b78b63",
        tags: ["pickaxe"],
        power: 1.5,
        range: 5,
        delay: 0.2
    },
    shalePickaxe: {
        name: "Shale Pickaxe",
        desc: "A pickaxe made of shale. It's a bit stronger than the plastic one.",
        color: "#777",
        tags: ["pickaxe"],
        power: 2,
        range: 6,
        delay: 0.18
    },
    coalPickaxe: {
        name: "Coal Pickaxe",
        desc: "A pickaxe made of coal. Very weak, but has a 1/10 chance of exploding a small area.",
        color: "#282522",
        tags: ["pickaxe"],
        power: 0.8,
        range: 7,
        delay: 0.2,
        explosion: {
            chance: 0.1,
            radius: 2
        }
    },
    copperPickaxe: {
        name: "Copper Pickaxe",
        desc: "A pickaxe made of copper. High power but low range and slow.",
        color: "#f60",
        tags: ["pickaxe"],
        power: 4,
        range: 4,
        delay: 0.25
    },
    bronzePickaxe: {
        name: "Bronze Pickaxe",
        desc: "A pickaxe made of bronze. A better version of the copper pickaxe.",
        color: "#df9c43",
        tags: ["pickaxe"],
        power: 5,
        range: 5,
        delay: 0.2
    },
    ironPickaxe: {
        name: "Iron Pickaxe",
        desc: "A pickaxe made of iron. The common pickaxe in real life (I think) but not this game.",
        color: "#aaa",
        tags: ["pickaxe"],
        power: 3,
        range: 6,
        delay: 0.15
    },
    silverPickaxe: {
        name: "Silver Pickaxe",
        desc: "A pickaxe made of silver.",
        color: "#ccc",
        tags: ["pickaxe"],
        power: 4,
        range: 6,
        delay: 0.15
    },
    goldPickaxe: {
        name: "Gold Pickaxe",
        desc: "A pickaxe made of gold.",
        color: "#fc0",
        tags: ["pickaxe"],
        power: 7,
        range: 6.5,
        delay: 0.15
    },
    emeraldPickaxe: {
        name: "Emerald Pickaxe",
        desc: "A pickaxe made of emerald.",
        color: "#6bd066",
        tags: ["pickaxe"],
        power: 8,
        range: 7.5,
        delay: 0.12
    },
    platinumPickaxe: {
        name: "Platinum Pickaxe",
        desc: "A pickaxe made of platinum.",
        color: "#eee",
        tags: ["pickaxe"],
        power: 12,
        range: 7,
        delay: 0.13
    },
    corundumPickaxe: {
        name: "Corundum Pickaxe",
        desc: "A pickaxe made of ruby and sapphire. Weak but fast.",
        color: "#f00",
        tags: ["pickaxe"],
        power: 8,
        range: 8.5,
        delay: 0.08
    },
    diamondPickaxe: {
        name: "Diamond Pickaxe",
        desc: "A pickaxe made of diamond.",
        color: "#7dfff9",
        tags: ["pickaxe"],
        power: 20,
        range: 7.5,
        delay: 0.12
    },
    sulfurPickaxe: {
        name: "Sulfur Pickaxe",
        desc: "A pickaxe made of sulfur. Sometimes explodes.",
        color: "#ff0",
        tags: ["pickaxe"],
        power: 18,
        range: 7,
        delay: 0.12,
        explosion: {
            chance: 0.1,
            radius: 2
        }
    },
    phosphorusPickaxe: {
        name: "Phosphorus Pickaxe",
        desc: "A pickaxe made of phosphorus. Explodes more frequently than the sulfur pickaxe.",
        color: "#7c1328",
        tags: ["pickaxe"],
        power: 18,
        range: 7,
        delay: 0.12,
        explosion: {
            chance: 0.15,
            radius: 2
        }
    },
    biotitePickaxe: {
        name: "Biotite Pickaxe",
        desc: "A pickaxe made of biotite. Fragile but powerful.",
        color: "#111",
        tags: ["pickaxe"],
        power: 24,
        range: 8,
        delay: 0.11
    },
    uraniumPickaxe: {
        name: "Uranium Pickaxe",
        desc: "A pickaxe made of uranium. Strong but radioactive.",
        color: "#af0",
        tags: ["pickaxe"],
        power: 30,
        range: 8,
        delay: 0.11,
        radiation: 0.25
    },
    plutoniumPickaxe: {
        name: "Plutonium Pickaxe",
        desc: "A better version of the uranium pickaxe. Stronger but radioactive-er.",
        color: "#ff4c00",
        tags: ["pickaxe"],
        power: 38,
        range: 8,
        delay: 0.1,
        radiation: 0.5
    },
    neptuniumPickaxe: {
        name: "Neptunium Pickaxe",
        desc: "A better version of the plutonium pickaxe.",
        color: "#31d1c0",
        tags: ["pickaxe"],
        power: 45,
        range: 8,
        delay: 0.1,
        radiation: 0.75
    },
    arditePickaxe: {
        name: "Ardite Pickaxe",
        desc: "A pickaxe made of ardite.",
        color: ores.ardite.color,
        tags: ["pickaxe"],
        power: 42,
        range: 7,
        delay: 0.12
    },
    garnetPickaxe: {
        name: "Garnet Pickaxe",
        desc: "A pickaxe made of garnet. Extremely fast but low range and power.",
        color: ores.garnet.color,
        tags: ["pickaxe"],
        power: 35,
        range: 5.5,
        delay: 0.03
    },
    cobaltPickaxe: {
        name: "Cobalt Pickaxe",
        desc: "A pickaxe made of cobalt.",
        color: ores.cobalt.color,
        tags: ["pickaxe"],
        power: 48,
        range: 6,
        delay: 0.13
    },
    glassPickaxe: {
        name: "Glass Pickaxe",
        desc: "A pickaxe made of glass. Extremely powerful, but you do not get anything you mine.",
        color: "#fff8",
        tags: ["pickaxe"],
        power: 125,
        range: 10,
        delay: 0.05,
        onEquip() {
            vars.itemMultiplier = 0;
        },
        onUnequip() {
            vars.itemMultiplier = 1;
        }
    },
    cadmiumPickaxe: {
        name: "Cadmium Pickaxe",
        desc: "A pickaxe made of cadmium.",
        color: ores.cadmium.color,
        tags: ["pickaxe"],
        power: 62,
        range: 7,
        delay: 0.1
    },
    leadPickaxe: {
        name: "Lead Pickaxe",
        desc: "A pickaxe made of lead.",
        color: ores.lead.color,
        tags: ["pickaxe"],
        power: 70,
        range: 7.5,
        delay: 0.08,
    },
    serpentinePickaxe: {
        name: "Serpentine Pickaxe",
        desc: "A pickaxe made of serpentine.",
        color: ores.serpentine.color,
        tags: ["pickaxe"],
        power: 78,
        range: 8,
        delay: 0.12
    },
    diopsidePickaxe: {
        name: "Diopside Pickaxe",
        desc: "A pickaxe made of diopside.",
        color: ores.diopside.color,
        tags: ["pickaxe"],
        power: 86,
        range: 6,
        delay: 0.14
    },
    chlorophytePickaxe: {
        name: "Chlorophyte Pickaxe",
        desc: "A pickaxe made of chlorophyte. Makes moss spawn everywhere with a 5% chance.",
        color: ores.chlorophyte.color,
        tags: ["pickaxe"],
        power: 98,
        range: 8,
        delay: 0.11,
        onEquip() {
            ores.moss.chance = 0.05;
        },
        onUnequip() {
            ores.moss.chance = 0;
        }
    },
    hammerOfMisfortune: {
        name: "Hammer of Misfortune",
        desc: "Extremely powerful, but no new ores will spawn.",
        color: "#555",
        tags: ["pickaxe"],
        power: 250,
        range: 12,
        delay: 0.2,
        onEquip() {
            vars.RARE_ORE_CHANCE_MULTIPLIER = 0;
            vars.RARE_ORE_CHANCE_MULTIPLIER_CUTOFF = 1e9;
        },
        onUnequip() {
            vars.RARE_ORE_CHANCE_MULTIPLIER = 1;
            vars.RARE_ORE_CHANCE_MULTIPLIER_CUTOFF = 1e-4;
        }
    },
    dragonitePickaxe: {
        name: "Tranquanto's Pickaxe",
        desc: "A pickaxe made of dragonite. Makes unfathomable or rarer ores 2x more common.",
        color: "#90f",
        tags: ["pickaxe"],
        power: 73,
        range: 7.3,
        delay: 0.073,
        onEquip() {
            vars.RARE_ORE_CHANCE_MULTIPLIER *= 2;
            vars.RARE_ORE_CHANCE_MULTIPLIER_CUTOFF = 1e-8;
        },
        onUnequip() {
            vars.RARE_ORE_CHANCE_MULTIPLIER /= 2;
            vars.RARE_ORE_CHANCE_MULTIPLIER_CUTOFF = 1e-4;
        }
    },
    iyonkontrabufraluliumPickaxe: {
        name: "Iyonkontrabufralulium Pickaxe",
        desc: "A pickaxe made of iyonkontrabufralulium. It's very strong, but it's also very radioactive. Can explode a large area.",
        color: ores.iyonkontrabufralulium.color,
        tags: ["pickaxe"],
        power: 90,
        range: 9,
        delay: 0.1,
        radiation: 1.5,
        explosion: {
            chance: 0.01,
            radius: 4
        }
    },
    kyawthuitePickaxe: {
        name: "Kyawthuite Pickaxe",
        desc: "Makes all rare+ ores 1.5x more common.",
        color: "#f40",
        tags: ["pickaxe"],
        power: 48,
        range: 10,
        delay: 0.06,
        onEquip() {
            vars.RARE_ORE_CHANCE_MULTIPLIER *= 1.5;
        },
        onUnequip() {
            vars.RARE_ORE_CHANCE_MULTIPLIER /= 1.5;
        }
    },
    ununenniumPickaxe: {
        name: "Ununennium Pickaxe",
        desc: "A pickaxe made of ununennium. Extremely powerful, but also extremely radioactive. Can explode, and makes epic+ ores 2x more common.",
        color: "#f0f",
        tags: ["pickaxe"],
        power: 110,
        range: 11,
        delay: 0.04,
        radiation: 1.25,
        explosion: {
            chance: 0.0045,
            radius: 4
        },
        onEquip() {
            vars.RARE_ORE_CHANCE_MULTIPLIER *= 2;
            vars.RARE_ORE_CHANCE_MULTIPLIER_CUTOFF = 1e-5;
        },
        onUnequip() {
            vars.RARE_ORE_CHANCE_MULTIPLIER /= 2;
            vars.RARE_ORE_CHANCE_MULTIPLIER_CUTOFF = 1e-4;
        }
    },
    alaphsPickaxe: {
        name: "Alaph's Pickaxe",
        desc: "The epitome of impatience in mining at its finest concentration.",
        color: ores.alaphite.color,
        tags: ["pickaxe"],
        power: 300,
        range: 30,
        delay: 0
    },
    explosivePickaxe: {
        name: "Explosive Pickaxe",
        desc: "A pickaxe that explodes every time you mine a block.",
        color: "#f00",
        tags: ["pickaxe"],
        power: 1,
        range: 5,
        delay: 0.2,
        explosion: {
            chance: 1,
            radius: 4,
            power: 6
        }
    },
    barrierPickaxe: {
        name: "Barrier Pickaxe",
        desc: "The most powerful pickaxe.",
        color: "#f00",
        tags: ["pickaxe"],
        power: 1e12,
        range: Infinity,
        delay: 0.01
    },
    superSpeedPickaxe: {
        name: "Super Speed Pickaxe",
        desc: "A pickaxe with no delay.",
        color: "#9e2",
        tags: ["pickaxe"],
        power: 20,
        range: 15,
        delay: 0 // every frame
    },
    ancientBeerPickaxe: {
        name: "Ancient Beer on a Stick",
        desc: "looks like you got a little drunk",
        color: "#c2f3fa",
        tags: ["pickaxe"],
        power: 373,
        range: 30,
        delay: 0.01
    },
    devPickaxe: {
        name: "Developer's Pickaxe",
        desc: "this is for me and me only!!!",
        color: "#90f",
        tags: ["pickaxe"],
        power: Infinity,
        range: Infinity,
        delay: 0
    },

    jetpackStrap: {
        name: "Jetpack Strap",
        desc: "A component of the jetpack. Keeps you secured.",
        color: "#684618"
    },
    bronzeThruster: {
        name: "Bronze Thruster",
        desc: "A component of the jetpack.",
        color: "#df9c43"
    },
    emeraldThruster: {
        name: "Emerald Thruster",
        desc: "The second iteration of the thruster. More powerful than the first.",
        color: "#6bd066"
    },
    dragonWing: {
        name: "Dragon Wing",
        desc: "A wing forged from dragonite. Two of them allow you to fly.",
        color: "#90f"
    },
    bronzeJetpack: {
        name: "Bronze Jetpack",
        desc: "Allows you to fly.",
        color: "#df9c43",
        tags: ["jetpack"],
        speed: 1,
        onUse() {
            vars.fly = !vars.fly;
            if (vars.fly) vars.player.moveSpeed = vars.player.baseMoveSpeed * this.speed;
            else vars.player.moveSpeed = vars.player.baseMoveSpeed;
        }
    },
    emeraldJetpack: {
        name: "Emerald Jetpack",
        desc: "A better version of the bronze jetpack; it flies 2.5x faster.",
        color: "#6bd066",
        tags: ["jetpack"],
        speed: 2,
        onUse() {
            vars.fly = !vars.fly;
            if (vars.fly) vars.player.moveSpeed = vars.player.baseMoveSpeed * this.speed;
            else vars.player.moveSpeed = vars.player.baseMoveSpeed;
        }
    },
    dragonWings: {
        name: "Dragon Wings",
        desc: "A pair of wings. Flies faster the farther you are from the ground.",
        color: "#90f",
        tags: ["jetpack"],
        speed: 3,
        onUse() {
            vars.fly = !vars.fly;
            if (vars.fly) vars.player.moveSpeed = vars.player.baseMoveSpeed * this.speed;
            else vars.player.moveSpeed = vars.player.baseMoveSpeed;
        }
    },

    dragonScales: {
        name: "Dragon Scales",
        desc: "A material from dragons.",
        color: "#90f"
    },
    dragonFur: {
        name: "Dragon Fur",
        desc: "A material from dragons.",
        color: "#d3b9d3"
    },

    lightBulb: {
        name: "Light Bulb",
        desc: "A bulb that emits light. Can be crafted into a box of light.",
        color: "#fff7e0"
    },
    nightVisionGoggles: {
        name: "Night Vision Goggles",
        desc: "Allows you to see in the dark.",
        color: "#91eb36",
        onUse() {
            vars.player.nightVision = !vars.player.nightVision;
        }
    },
    weatherRadar: {
        name: "Weather Radar",
        desc: "Gives insight on the weather. No, there is no such thing as sunny.",
        color: "#0088ff",
        onUse() {
            if (vars.weatherRadar) {
                vars.weatherRadar = false;
                document.getElementById("weather").style.display = "none";
            } else {
                vars.weatherRadar = true;
                document.getElementById("weather").style.display = "";
            }
        }
    },
    paintbrush: {
        name: "Paintbrush",
        desc: "Paints ores a random color. Because why not?",
        color: ores.rainbonite.color,
        onUse() {
            const {intersect} = vars;
            if (intersect && intersect.distance <= vars.inventory.currentPickaxe.range) {
                const mesh = intersect.object;

                if (mesh instanceof THREE.InstancedMesh && mesh.userData.type === "ore") {
                    const index = intersect.instanceId;
                    mesh.setColorAt(index, new THREE.Color(Math.floor(Math.random() * 2 ** 24)));
                    mesh.instanceColor.needsUpdate = true;
                }
            }
        }
    },
    convertinator: {
        name: "Convertinator",
        desc: "Rerolls the ore you are looking at into another random ore.",
        color: "#ff69b4",
        tags: ["pickaxe"],
        power: 26,
        range: 7,
        delay: 0.5,
        onMine(x, y, z) {
            vars.spawnQueue.push([x, y, z, {noUpdate: true, forced: true}]);
            vars.miningStartTime = performance.now() + vars.inventory.currentPickaxe.delay * 1000;
        }
    },

    // teleporters
    surfaceTeleporter: {
        name: "Surface Teleporter",
        desc: "Teleports you to the surface.",
        color: "#4c99cb"
    },
    volcanicTeleporter: {
        name: "Volcanic Teleporter",
        desc: "Allows you to teleport to the volcanic or surface layers.",
        color: "#a0885d",
        teleports: ["volcanic", "surface"],
        tags: ["teleporter"]
    },
    nuclearTeleporter: {
        name: "Irradiated Teleporter",
        desc: "Allows you to teleport to the irradiated layer or above (until the surface).",
        color: "#009141",
        teleports: ["irradiated", "volcanic", "surface"],
        tags: ["teleporter"]
    },
    hellTeleporter: {
        name: "Underworld Teleporter",
        desc: "Allows you to teleport to the underworld layer or above (until the surface).",
        color: "#800",
        teleports: ["hell", "irradiated", "volcanic", "surface"],
        tags: ["teleporter"]
    },
    frozenTeleporter: {
        name: "Frozen Teleporter",
        desc: "Allows you to teleport to the frozen layer or above (until the surface).",
        color: "#4fbded",
        teleports: ["frozen", "hell", "irradiated", "volcanic", "surface"],
        tags: ["teleporter"]
    },
    marineTeleporter: {
        name: "Marine Teleporter",
        desc: "Allows you to teleport to the marine layer or above (until the surface).",
        color: "#2b4cf8",
        teleports: ["marine", "frozen", "hell", "irradiated", "volcanic", "surface"],
        tags: ["teleporter"]
    },
    jungleTeleporter: {
        name: "Jungle Teleporter",
        desc: "Allows you to teleport to the jungle layer or above (until the surface).",
        color: "#4e2b14",
        teleports: ["jungle", "marine", "frozen", "hell", "irradiated", "volcanic", "surface"],
        tags: ["teleporter"]
    },
    asthenosphereTeleporter: {
        name: "Asthenosphere Teleporter",
        desc: "Allows you to teleport to the asthenosphere layer or above (until the surface).",
        color: "#cb5710",
        teleports: ["asthenosphere", "jungle", "marine", "frozen", "hell", "irradiated", "volcanic", "surface"],
        tags: ["teleporter"]
    },
    mantleTeleporter: {
        name: "Mantle Teleporter",
        desc: "Allows you to teleport to the mantle layer or above (until the surface).",
        color: "#ff6000",
        teleports: ["mantle", "asthenosphere", "jungle", "marine", "frozen", "hell", "irradiated", "volcanic", "surface"],
        tags: ["teleporter"]
    },
    coreTeleporter: {
        name: "Core Teleporter",
        desc: "Allows you to teleport to anywhere below the surface.",
        color: "#ffaa00",
        teleports: ["core", "mantle", "asthenosphere", "jungle", "marine", "frozen", "hell", "irradiated", "volcanic", "surface"],
        tags: ["teleporter"]
    },
    voidTeleporter1: {
        name: "Void Teleporter",
        desc: "Allows you to teleport to the void or surface.",
        color: "#000",
        teleports: ["void", "surface"],
        tags: ["teleporter"]
    },
    spaceTeleporter: {
        name: "Space Teleporter",
        desc: "Allows you to teleport to the space layer or surface.",
        color: "#103",
        teleports: ["space", "surface"],
        tags: ["teleporter"]
    },
    devTeleporter: {
        name: "Teleporter",
        desc: "A device that allows you to teleport between all layers.",
        color: "#bd5ed0"
    },

    // extra special / secret
    dragonHourglass: {
        name: "Tranquanto's Hourglass",
        desc: "An exclusive item that only the most patient players can obtain.",
        color: "#c0f",
        tags: ["special"]
    },
    dog: {
        name: "dog",
        desc: "dog",
        color: "#686868",
        tags: ["special"]
    },

    // mounts
    saddle: {
        name: "Saddle",
        desc: "A saddle necessary to ride any mount.",
        color: "#8b4513",
    },
    dragonMount: {
        name: "Dragon Mount",
        desc: "A flying dragon that you can ride.",
        color: "#90f",
        tags: ["mount"],
        speed: 0.5,
        onEquip() {
            MOUNTED = true;
            vars.fly = true;
        },
        onUnequip() {
            MOUNTED = false;
            vars.fly = false;
        }
    },

    // other
    newspaper: {
        name: "Newspaper",
        desc: "A newspaper that informs you about updates in your local town.", // like when a legendary+ ore is discovered
        color: "#ddd",
        onUse() {
            alert("lol you wasted paper on this item that does nothing lol!!!!")
            return;
            document.exitPointerLock();

            let date = Date();
            date = date.split(" ");
            date = date.slice(1, 4);
            if (!isNaN(Number(date[1]))) date[1] += ",";
            date = date.join(" ");

            const gui = document.createElement("div");
            const textElem = document.createElement("span");
            textElem.innerText = date;
            textElem.classList.add("wikiName");
            gui.append(textElem);

            document.getElementById("big-gui").innerHTML = "";
            Array.from(gui.children).forEach(elem => {
                document.getElementById("big-gui").appendChild(elem);
            });
            document.getElementById("big-gui").style.display = "block";
        }
    },
    periodicTable: {
        name: "Periodic Table",
        desc: "A trophy for collecting all the elements.",
        color: "#aaa"
    }
};

let recipes = [
    // materials
    {
        input: [{id: "petrifiedWood", count: 1}],
        output: {id: "wood", count: 2}
    },
    {
        input: [{id: "copper", count: 3}, {id: "tin", count: 1}],
        output: {id: "bronze", count: 3}
    },
    {
        input: [{id: "wood", count: 1}, {id: "leaves", count: 1}],
        output: {id: "paper", count: 3}
    },
    {
        input: [{id: "oil", count: 1}],
        output: {id: "plastic", count: 1} // worst deal ever considering oil is 1 in 6m
    },
    {
        input: [{id: "sand", count: 1}],
        output: {id: "glass", count: 1}
    },
    {
        input: [{id: "chalcedony", count: 1}],
        output: {id: "glass", count: 3} // since chalcedony is a type of quartz and quartz is silica and silica is used to make glass ☝🤓
    },
    /* {
        input: [{id: "tin", count: 1}, {id: "cobalt", count: 4}, {id: "glass", count: 2}],
        output: {id: "fluidCell", count: 36}
    }, */
    {
        input: [
            {id: "unobtainium", count: 1},
            {id: "trimium", count: 900},
            {id: "nickel", count: 700},
            {id: "diamond", count: 2000},
            {id: "garnet", count: 1250},
            {id: "floacite", count: 3000},
            {id: "iridium", count: 600},
            {id: "ulexite", count: 40},
            {id: "jade", count: 180},
            {id: "uranium", count: 400},
            {id: "plutonium", count: 200},
            {id: "neptunium", count: 100},
            {id: "astatine", count: 6},
            {id: "corruptum", count: 1},
            {id: "cloud", count: 15000},
            {id: "gold", count: 750},
            {id: "cinnabar", count: 240},
            {id: "melanterite", count: 25},
            {id: "obsidian", count: 1000},
            {id: "kyawthuite", count: 2},
            {id: "boracite", count: 300},
            {id: "emerald", count: 625}
        ],
        output: {id: "unobtainiumBar", count: 1},
        required: [{id: "unobtainium", count: 1}]
    },

    // tools
    {
        input: [{id: "plastic", count: 5}],
        output: {id: "plasticPickaxe", count: 1},
        required: [{id: "plastic", count: 1}]
    },
    {
        input: [{id: "wood", count: 5}, {id: "leaves", count: 1}],
        output: {id: "woodPickaxe", count: 1},
        required: [{id: "wood", count: 1}]
    },
    {
        input: [{id: "shale", count: 5}, {id: "wood", count: 2}],
        output: {id: "shalePickaxe", count: 1},
        required: [{id: "shale", count: 1}]
    },
    {
        input: [{id: "coal", count: 5}, {id: "shale", count: 1}, {id: "wood", count: 2}],
        output: {id: "coalPickaxe", count: 1},
        required: [{id: "coal", count: 1}]
    },
    {
        input: [{id: "copper", count: 4}, {id: "wood", count: 1}],
        output: {id: "copperPickaxe", count: 1},
        required: [{id: "copper", count: 1}]
    },
    {
        input: [{id: "bronze", count: 5}, {id: "wood", count: 2}],
        output: {id: "bronzePickaxe", count: 1},
        required: [{id: "bronze", count: 1}]
    },
    {
        input: [{id: "iron", count: 5}, {id: "wood", count: 1}],
        output: {id: "ironPickaxe", count: 1},
        required: [{id: "iron", count: 1}]
    },
    {
        input: [{id: "silver", count: 12}, {id: "copper", count: 1}, {id: "coal", count: 2}],
        output: {id: "silverPickaxe", count: 1},
        required: [{id: "silver", count: 1}]
    },
    {
        input: [{id: "gold", count: 14}, {id: "silver", count: 2}, {id: "copper", count: 2}, {id: "coal", count: 2}],
        output: {id: "goldPickaxe", count: 1},
        required: [{id: "gold", count: 1}]
    },
    {
        input: [{id: "emerald", count: 8}, {id: "gold", count: 6}, {id: "marble", count: 50}],
        output: {id: "emeraldPickaxe", count: 1},
        required: [{id: "emerald", count: 1}]
    },
    {
        input: [{id: "platinum", count: 7}, {id: "silver", count: 3}, {id: "gneiss", count: 40}],
        output: {id: "platinumPickaxe", count: 1},
        required: [{id: "platinum", count: 1}]
    },
    {
        input: [{id: "ruby", count: 11}, {id: "sapphire", count: 11}, {id: "wood", count: 17}],
        output: {id: "corundumPickaxe", count: 1},
        required: [{id: "ruby", count: 1}, {id: "sapphire", count: 1}]
    },
    {
        input: [{id: "diamond", count: 5}, {id: "emerald", count: 3}, {id: "shale", count: 80}, {id: "granite", count: 60}, {id: "bedrock", count: 1}, {id: "wood", count: 5}],
        output: {id: "diamondPickaxe", count: 1},
        required: [{id: "diamond", count: 1}]
    },
    {
        input: [{id: "sulfur", count: 22}, {id: "phosphorus", count: 3}, {id: "copper", count: 3}, {id: "coal", count: 4}, {id: "petrifiedWood", count: 6}],
        output: {id: "sulfurPickaxe", count: 1},
        required: [{id: "sulfur", count: 1}]
    },
    {
        input: [{id: "phosphorus", count: 28}, {id: "sulfur", count: 16}, {id: "silver", count: 40}, {id: "petrifiedWood", count: 10}, {id: "wood", count: 10}],
        output: {id: "phosphorusPickaxe", count: 1},
        required: [{id: "phosphorus", count: 1}]
    },
    {
        input: [{id: "biotite", count: 10}, {id: "sulfur", count: 4}, {id: "phosphorus", count: 4}, {id: "copper", count: 6}, {id: "silver", count: 4}, {id: "petrifiedWood", count: 10}],
        output: {id: "biotitePickaxe", count: 1},
        required: [{id: "biotite", count: 1}]
    },
    {
        input: [{id: "uranium", count: 16}, {id: "chalcedony", count: 4}, {id: "plutonium", count: 1}, {id: "coal", count: 11}, {id: "carnotite", count: 100}],
        output: {id: "uraniumPickaxe", count: 1},
        required: [{id: "uranium", count: 1}]
    },
    {
        input: [{id: "plutonium", count: 14}, {id: "uranium", count: 4}, {id: "copper", count: 7}, {id: "chalcedony", count: 12}, {id: "coal", count: 17}, {id: "carnotite", count: 250}],
        output: {id: "plutoniumPickaxe", count: 1},
        required: [{id: "plutonium", count: 1}]
    },
    {
        input: [{id: "neptunium", count: 15}, {id: "plutonium", count: 4}, {id: "copper", count: 10}, {id: "chalcedony", count: 20}, {id: "coal", count: 23}, {id: "carnotite", count: 150}, {id: "pitchblende", count: 150}, {id: "petrifiedWood", count: 50}],
        output: {id: "neptuniumPickaxe", count: 1},
        required: [{id: "neptunium", count: 1}]
    },
    {
        input: [{id: "ardite", count: 18}, {id: "bloodstone", count: 60}, {id: "sulfur", count: 2}, {id: "obsidian", count: 8}, {id: "petrifiedWood", count: 10}],
        output: {id: "arditePickaxe", count: 1},
        required: [{id: "ardite", count: 1}]
    },
    {
        input: [{id: "garnet", count: 17}, {id: "ardite", count: 9}, {id: "amethyst", count: 1}, {id: "ruby", count: 14}, {id: "petrifiedWood", count: 10}],
        output: {id: "garnetPickaxe", count: 1},
        required: [{id: "garnet", count: 1}]
    },
    {
        input: [{id: "cobalt", count: 35}, {id: "chalcanthite", count: 4}, {id: "ice", count: 200}, {id: "fossil", count: 10}, {id: "boracite", count: 5}],
        output: {id: "cobaltPickaxe", count: 1},
        required: [{id: "cobalt", count: 1}]
    },
    {
        input: [{id: "glass", count: 400}, {id: "chalcedony", count: 50}, {id: "ice", count: 750}, {id: "permafrost", count: 500}, {id: "granite", count: 96}, {id: "boracite", count: 24}, {id: "petrifiedWood", count: 25}],
        output: {id: "glassPickaxe", count: 1},
        required: [{id: "glass", count: 1}]
    },
    /* {
        input: [{id: "cadmium", count: 40}, {id: "gold", count: 20}, {id: "sulfur", count: 15}, {id: "petrifiedWood", count: 20}],
        output: {id: "cadmiumPickaxe", count: 1},
        required: [{id: "cadmium", count: 1}]
    },
    {
        input: [{id: "lead", count: 36}, {id: "platinum", count: 20}, {id: "iron", count: 15}, {id: "wood", count: 30}, {id: "paper", count: 6}],
        output: {id: "leadPickaxe", count: 1},
        required: [{id: "lead", count: 1}]
    }, */
    {
        input: [{id: "serpentine", count: 23}, {id: "petrifiedWood", count: 10}],
        output: {id: "serpentinePickaxe", count: 1},
        required: [{id: "serpentine", count: 1}]
    },
    {
        input: [{id: "diopside", count: 18}, {id: "boracite", count: 9}, {id: "cobalt", count: 2}, {id: "petrifiedWood", count: 11}],
        output: {id: "diopsidePickaxe", count: 1},
        required: [{id: "diopside", count: 1}]
    },
    {
        input: [{id: "chlorophyte", count: 11}, {id: "moldavite", count: 14}, {id: "wood", count: 22}, {id: "moss", count: 110}, {id: "vine", count: 36}],
        output: {id: "chlorophytePickaxe", count: 1},
        required: [{id: "chlorophyte", count: 1}]
    },
    {
        input: [{id: "dragonite", count: 4}, {id: "humanite", count: 1}, {id: "melanterite", count: 1}, {id: "sunstone", count: 1}, {id: "seventythree", count: 73}, {id: "chalcedony", count: 50}, {id: "shale", count: 400}],
        output: {id: "dragonitePickaxe", count: 1},
        rqeuired: [{id: "dragonite", count: 2}]
    },
    {
        input: [{id: "iyonkontrabufralulium", count: 4}, {id: "sunstone", count: 10}, {id: "uranium", count: 55}, {id: "plutonium", count: 35}, {id: "copper", count: 250}, {id: "shale", count: 2500}],
        output: {id: "iyonkontrabufraluliumPickaxe", count: 1},
        required: [{id: "iyonkontrabufralulium", count: 1}]
    },
    {
        input: [{id: "kyawthuite", count: 1}, {id: "dragonite", count: 4}, {id: "uranium", count: 64}, {id: "gold", count: 270}, {id: "silver", count: 1234}, {id: "shale", count: 10000}],
        output: {id: "kyawthuitePickaxe", count: 1},
        required: [{id: "kyawthuite", count: 1}]
    },
    {
        input: [{id: "ununennium", count: 1}, {id: "kyawthuitePickaxe", count: 1}, {id: "iyonkontrabufraluliumPickaxe", count: 1}, {id: "iyonkontrabufralulium", count: 32}, {id: "chalcanthite", count: 94}],
        output: {id: "ununenniumPickaxe", count: 1},
        required: [{id: "ununennium", count: 1}]
    },
    {
        input: [{id: "phosphorus", count: 10}, {id: "sulfur", count: 10}, {id: "coal", count: 10}, {id: "uranium", count: 2}, {id: "plutonium", count: 1}, {id: "petrifiedWood", count: 1}],
        output: {id: "explosivePickaxe", count: 1}
    },
    /* {
        input: [{id: "barrier", count: 1}, {id: "obsidian", count: 500}, {id: "diamond", count: 25}, {id: "emerald", count: 50}, {id: "sapphire", count: 75}, {id: "ruby", count: 75}, {id: "platinum", count: 88}, {id: "gold", count: 100}, {id: "silver", count: 200}, {id: "copper", count: 500}, {id: "iron", count: 1000}, {id: "shale", count: 10000}, {id: "granite", count: 9000}, {id: "gneiss", count: 8000}, {id: "marble", count: 7000}, {id: "pumice", count: 6000}, {id: "pitchblende", count: 5000}, {id: "bloodstone", count: 4000}, {id: "ice", count: 3000}, {id: "voidstone", count: 2000}, {id: "meteorite", count: 1500}, {id: "sunstone", count: 500}, {id: "melanterite", count: 500}, {id: "dragonite", count: 150}, {id: "humanite", count: 20}],
        output: {id: "barrierPickaxe", count: 1}
    }, */
    {
        input: [{id: "missing", count: 2}, {id: "dragonite", count: 5}, {id: "grass", count: 555}],
        output: {id: "superSpeedPickaxe", count: 1},
        required: [{id: "missing", count: 1}]
    },
    {
        input: [{id: "ancientBeer", count: 2}, {id: "boracite", count: 250}, {id: "ice", count: 200000}, {id: "permafrost", count: 15000}, {id: "petrifiedWood", count: 73}, {id: "wood", count: 100}],
        output: {id: "ancientBeerPickaxe", count: 1},
        required: [{id: "ancientBeer", count: 1}]
    },
    {
        input: [{id: "alaphite", count: 1}, {id: "dragonite", count: 500}, {id: "dwagonite", count: 1}, {id: "sapphire", count: 2500}, {id: "dragonScales", count: 50000}, {id: "glass", count: 867}, {id: "cloud", count: 15000}, {id: "meteorite", count: 12000000}, {id: "floacite", count: 150}],
        output: {id: "alaphsPickaxe", count: 1},
        required: [{id: "alaphite", count: 1}]
    },
    /* {
        input: [{id: "darkGem", count: 1}, {id: "newspaper", count: 5}, {id: "wood", count: 3}, {id: "ruby", count: 5}, {id: "gold", count: 3}],
        output: {id: "unfaithfulPickaxe", count: 1},
        required: [{id: "darkGem", count: 1}]
    }, */

    // components
    {
        input: [{id: "plastic", count: 5}, {id: "shale", count: 2}],
        output: {id: "jetpackStrap", count: 1}
    },
    {
        input: [{id: "bronze", count: 30}, {id: "coal", count: 20}, {id: "sulfur", count: 4}],
        output: {id: "bronzeThruster", count: 1}
    },
    {
        input: [{id: "bronzeThruster", count: 1}, {id: "cloud", count: 500}, {id: "silver", count: 45}, {id: "floacite", count: 15}],
        output: {id: "emeraldThruster", count: 1}
    },

    // jetpacks and wings
    {
        input: [{id: "bronzeThruster", count: 2}, {id: "bronze", count: 50}, {id: "coal", count: 100}, {id: "jetpackStrap", count: 1}],
        output: {id: "bronzeJetpack", count: 1}
    },
    {
        input: [{id: "bronzeJetpack", count: 1}, {id: "emeraldThruster", count: 2}, {id: "emerald", count: 120}, {id: "moonstone", count: 30}],
        output: {id: "emeraldJetpack", count: 1}
    },
    {
        input: [{id: "dragonite", count: 2}, {id: "cloud", count: 500}, {id: "floacite", count: 10}, {id: "dragonScales", count: 75}],
        output: {id: "dragonWing", count: 1},
        required: [{id: "dragonite", count: 1}]
    },
    {
        input: [{id: "dragonWing", count: 2}, {id: "chalcedony", count: 100}, {id: "seventythree", count: 73}],
        output: {id: "dragonWings", count: 1},
        required: [{id: "dragonWing", count: 1}]
    },

    // dragon cosmetics
    {
        input: [{id: "dragonite", count: 1}],
        output: {id: "dragonScales", count: 104}
    },
    /* {
        input: [{id: "dragonite", count: 1}, {id: "fursonite", count: 1}],
        output: {id: "dragonFur", count: 384}
    }, */
    {
        input: [{id: "dragonScales", count: 104}],
        output: {id: "dragonite", count: 1},
        requirement: [{id: "dragonScales", count: 104}]
    },
    /* {
        input: [{id: "dragonScales", count: 50}, {id: "dragonFur", count: 50}],
        output: {id: "dragonTail", count: 1}
    },
    {
        input: [{id: "dragonScales", count: 64}, {id: "dragonFur", count: 36}],
        output: {id: "dragonHead", count: 1}
    },
    {
        input: [{id: "dragonScales", count: 73}, {id: "dragonFur", count: 115}, {id: "dragonTail", count: 1}, {id: "dragonHead", count: 1}, {id: "fursonite", count: 1}],
        output: {id: "dragonFursuit", count: 1}
    }, */

    // craftable blocks
    {
        input: [{id: "glass", count: 1}, {id: "silver", count: 1}], // yeah i know they're made of aluminum but i don't have that (yet)
        output: {id: "lightBulb", count: 12}
    },
    {
        input: [{id: "lightBulb", count: 1}, {id: "wood", count: 4}],
        output: {id: "lightBox", count: 1}
    },
    {
        input: [{id: "lightBox", count: 75}, {id: "sunstone", count: 5}, {id: "diamond", count: 15}],
        output: {id: "sun", count: 1},
        requirement: [{id: "lightBox", count: 1}]
    },
    {
        input: [{id: "sun", count: 50}, {id: "paper", count: 100}, {id: "voidstone", count: 1}],
        output: {id: "wikipediaPageForWhite", count: 1},
        required: [{id: "sun", count: 10}]
    },
    {
        input: [{id: "wood", count: 1}, {id: "coal", count: 1}],
        output: {id: "torch", count: 2}
    },
    {
        input: [{id: "cadmium", count: 40}, {id: "glass", count: 240}, {id: "uranium", count: 18}, {id: "plastic", count: 1}],
        output: {id: "nightVisionGoggles", count: 1},
        requirement: [{id: "cadmium", count: 1}]
    },
    {
        input: [{id: "astatine", count: 1}, {id: "lead", count: 25}, {id: "glass", count: 50}, {id: "pointer", count: 12}, {id: "iron", count: 40}, {id: "moonstone", count: 5}, {id: "sapphire", count: 1}, {id: "bedrock", count: 20}],
        output: {id: "weatherRadar", count: 1}
    },
    {
        input: [{id: "rainbonite", count: 1}, {id: "nickel", count: 25}, {id: "silver", count: 12}, {id: "cinnabar", count: 1}, {id: "sunstone", count: 1}, {id: "sulfur", count: 1}, {id: "malachite", count: 1}, {id: "cobalt", count: 1}, {id: "amethyst", count: 1}],
        output: {id: "paintbrush", count: 1},
        requirement: [{id: "rainbonite", count: 1}]
    },
    // teleporters
    {
        input: [{id: "iron", count: 25}, {id: "amethyst", count: 1}, {id: "wood", count: 6}, {id: "leaves", count: 10}, {id: "grass", count: 1}, {id: "dirt", count: 5}],
        output: {id: "surfaceTeleporter", count: 1}
    },
    {
        input: [{id: "surfaceTeleporter", count: 1}, {id: "bedrock", count: 14}, {id: "petrifiedWood", count: 20}, {id: "pumice", count: 125}, {id: "sulfur", count: 16}, {id: "copper", count: 25}, {id: "gold", count: 6}],
        output: {id: "volcanicTeleporter", count: 1},
        required: [{id: "surfaceTeleporter", count: 1}]
    },
    {
        input: [{id: "volcanicTeleporter", count: 1}, {id: "uranium", count: 9}, {id: "plutonium", count: 3}, {id: "ulexite", count: 1}, {id: "carnotite", count: 60}, {id: "bedrock", count: 6}],
        output: {id: "nuclearTeleporter", count: 1},
        required: [{id: "volcanicTeleporter", count: 1}]
    },
    {
        input: [{id: "nuclearTeleporter", count: 1}, {id: "obsidian", count: 8}, {id: "bloodstone", count: 100}, {id: "ardite", count: 20}, {id: "garnet", count: 10}, {id: "gold", count: 96}],
        output: {id: "hellTeleporter", count: 1},
        required: [{id: "nuclearTeleporter", count: 1}]
    },
    {
        input: [{id: "hellTeleporter", count: 1}, {id: "ice", count: 240}, {id: "permafrost", count: 16}, {id: "boracite", count: 5}, {id: "cobalt", count: 2}, {id: "chalcanthite", count: 7}],
        output: {id: "frozenTeleporter", count: 1},
        required: [{id: "hellTeleporter", count: 1}]
    },
    {
        input: [{id: "frozenTeleporter", count: 1}, {id: "basalt", count: 125}, {id: "serpentine", count: 36}, {id: "olivine", count: 12}, {id: "coral", count: 16}],
        output: {id: "marineTeleporter", count: 1},
        required: [{id: "frozenTeleporter", count: 1}]
    },
    {
        input: [{id: "marineTeleporter", count: 1}, {id: "moss", count: 175}, {id: "crate", count: 5}, {id: "zircon", count: 39}, {id: "citrine", count: 7}, {id: "calcite", count: 22}, {id: "moldavite", count: 2}],
        output: {id: "jungleTeleporter", count: 1},
        required: [{id: "marineTeleporter", count: 1}]
    },
    {
        input: [{id: "jungleTeleporter", count: 1}, {id: "bedrock", count: 52}, {id: "jade", count: 16}, {id: "nickel", count: 7}, {id: "iron", count: 160}, {id: "arfvedsonite", count: 12}, {id: "mudstone", count: 180}, {id: "bauxite", count: 1}],
        output: {id: "asthenosphereTeleporter", count: 1},
        required: [{id: "jungleTeleporter", count: 1}]
    },
    {
        input: [{id: "coreTeleporter", count: 1}, {id: "voidstone", count: 1200}, {id: "cadmium", count: 22}, {id: "lead", count: 14}, {id: "blueScreenOfDeath", count: 4}, {id: "null", count: 888}],
        output: {id: "voidTeleporter1", count: 1},
        required: [{id: "coreTeleporter", count: 1}]
    },
    // upper teleporters
    {
        input: [{id: "surfaceTeleporter", count: 1}, {id: "cloud", count: 750}, {id: "meteorite", count: 500}, {id: "floacite", count: 30}, {id: "thundrite", count: 8}, {id: "osmium", count: 16}, {id: "iridium", count: 12}],
        output: {id: "spaceTeleporter", count: 1},
        required: [{id: "surfaceTeleporter", count: 1}]
    },

    // mounts
    /* {
        input: [{id: "iron", count: 75}, {id: "wood", count: 60}, {id: "diamond", count: 4}, {id: "humanite", count: 1}], // humanite because reasons
        output: {id: "saddle", count: 1}
    },
    {
        input: [{id: "dragonScales", count: 727}, {id: "dragonHead", count: 1}, {id: "dragonTail", count: 1}, {id: "dragonWings", count: 1}, {id: "saddle", count: 1}, {id: "dragonite", count: 50}],
        output: {id: "dragonMount", count: 1}
    }, */

    // other
    {
        input: [{id: "paper", count: 4}, {id: "coal", count: 1}],
        output: {id: "newspaper", count: 1}
    }
];

const weathers = {
    sandstorm: {
        name: "Sandstorm",
        effect() {
            vars.canvasFilter.sepia = 85;
            vars.canvasFilter.saturate = 150;
            vars.canvasFilter.hueRotate = -10;
        }
    }
};

let traits = { // traits appended to ores (excluding fillers/bgs)
    enriched: {
        name: "Enriched",
        chance: 1 / 15, // per ore
        effect(ore) {
            ore.yield++;
            ore.yield += Math.random() * 2 + 1;
            ore.str *= 1.5;
        }
    },
    purified: {
        name: "Purified",
        chance: 1 / 250,
        effect(ore) {
            ore.yield += 2;
            ore.yield *= Math.random() * 3 + 1;
            ore.str *= 2;
        }
    },
    refined: {
        name: "Refined",
        chance: 1 / 1000,
        effect(ore) {
            ore.yield += 3;
            ore.yield *= Math.random() * 4 + 1;
            ore.str *= 3.2;
        }
    },
    dense: {
        name: "Dense",
        chance: 1 / 35000,
        effect(ore) {
            ore.yield += 4;
            ore.yield *= Math.random() * 5 + 1;
            ore.str *= 4;
        }
    },
    singularity: {
        name: "Singularity",
        appendName: true, // tack on name to the end instead of the front
        chance: 1 / 1e6,
        effect(ore) {
            ore.yield += 15;
            ore.yield *= Math.random() * 16 + 1;
            ore.str *= 12;
        }
    },
    softened: {
        name: "Softened",
        chance: 1 / 20,
        effect(ore) {
            ore.str /= Math.random() * 3 + 2;
        }
    },
    hardened: {
        name: "Hardened",
        chance: 1 / 40,
        effect(ore) {
            ore.str *= Math.random() * 3 + 2;
        },
        incompatible: ["softened"]
    },
    shattered: {
        name: "Shattered",
        chance: 1 / 450,
        effect(ore) {
            ore.str /= Math.random() * 10 + 20;
            ore.yield /= 1e12;
        }
    },
    golden: {
        name: "Golden",
        chance: 1 / 7777,
        effect(ore) {
            ore.yield *= 7;
            ore.str = 7.77;
            ore.forcedColor = ore.color = "#fc0";
            ore.light = {col: "#fc0", str: 40};
        },
        separateMesh: true
    },
    protected: {
        name: "Protected",
        chance: 0,
        effect(ore) {
            ore.str = Infinity;
        }
    }
};

let structures = {
    temple: {
        key: { // merges with the rest of the JSON
            "g": (_x, y) => {return (getOre(1e9, y, 1e13) || {ore: "shale"}).ore + "Brick"},
            "G": (_x, y) => {return (getOre(1e8, y, 1e13, {caveExclusive: true, all: true, maxChance: 1, forceSpawn: true}) || {ore: "shale"}).ore}
        },
        // blockChance: 1 / 9000, // has a chance to spawn everytime an ore is generated
        chance: 1 / 800, // per grid space (width x height x depth)
        maxY: -5,
        minY: -10000
    },
    darkGemDungeon: {
        blockChance: 1 / 750000,
        maxY: -11,
        minY: -Infinity,
        caveExclusive: true
    },
    spawn: {
        chance: 0,
        maxY: 0,
        minY: 0
    },
    bush: {
        chance: 0, // only spawned by "bush" placeholder ore
        maxY: -6000,
        minY: -7000
    },
    frostburnFacility: {
        chance: 1 / 160,
        maxY: -4000,
        minY: -5000,
        condition(x, y, z) {
            return getLayer(y, x, z) === "subzero";
        }
    }
};

let achievements = {
    welcome: {
        name: "Welcome to The Draconic Depths!",
        desc: "Play the game for the first time.",
        icon: "trophy",
        progress: () => true
    },
    theBeginning: {
        name: "The Beginning",
        desc: "Mine your first ore.",
        icon: "woodPickaxe",
        progress() {
            return stats.totalOresMined;
        }
    },
    scavenger: {
        name: "Scavenger",
        desc: "Mine 100 ores.",
        icon: "shalePickaxe",
        preReq: ["theBeginning"],
        progress() {
            return stats.totalOresMined / 100;
        }
    },
    miner: {
        name: "Miner",
        desc: "Mine 1,000 ores.",
        icon: "copperPickaxe",
        preReq: ["scavenger"],
        progress() {
            return stats.totalOresMined / 1e3;
        }
    },
    seasonedMiner: {
        name: "Seasoned Miner",
        desc: "Mine 10,000 ores.",
        icon: "silverPickaxe",
        preReq: ["miner"],
        progress() {
            return stats.totalOresMined / 1e4;
        }
    },
    experiencedMiner: {
        name: "Experienced Miner",
        desc: "Mine 100,000 ores.",
        icon: "goldPickaxe",
        preReq: ["seasonedMiner"],
        progress() {
            return stats.totalOresMined / 1e5;
        }
    },
    expertMiner: {
        name: "Expert Miner",
        desc: "Mine 1,000,000 ores.",
        icon: "emeraldPickaxe",
        preReq: ["experiencedMiner"],
        progress() {
            return stats.totalOresMined / 1e6;
        }
    },
    masterMiner: {
        name: "Master Miner",
        desc: "Mine 10,000,000 ores.",
        icon: "diamondPickaxe",
        preReq: ["expertMiner"],
        progress() {
            return stats.totalOresMined / 1e7;
        }
    },
    eliteMiner: {
        name: "Elite Miner",
        desc: "Mine 100,000,000 ores.",
        icon: "cobaltPickaxe",
        preReq: ["masterMiner"],
        progress() {
            return stats.totalOresMined / 1e8;
        }
    },
    ultimateMiner: {
        name: "Ultimate Miner",
        desc: "Mine 1,000,000,000 ores.",
        icon: "dragonitePickaxe",
        preReq: ["eliteMiner"],
        progress() {
            return stats.totalOresMined / 1e9;
        }
    },
    gold: {
        name: "Ooh, Shiny!",
        desc: "Find gold.",
        icon: "gold",
        progress() {
            return stats.oresMined.gold;
        }
    },
    rareFind: {
        name: "A Rare Find",
        desc: "Discover your first rare ore (1/10k or rarer).",
        icon: "dragonite",
        progress() {
            return stats.lowestOreRNG / 1e4;
        }
    },
    epicFind: {
        name: "It's Epic!",
        desc: "Discover your first epic ore (1/100k or rarer).",
        icon: "iyonkontrabufralulium",
        preReq: ["rareFind"],
        progress() {
            return stats.lowestOreRNG / 1e5;
        }
    },
    legendaryFind: {
        name: "The Birth of a Legend",
        desc: "Discover your first legendary ore (1/1M or rarer).",
        icon: "kyawthuite",
        preReq: ["epicFind"],
        progress() {
            return stats.lowestOreRNG / 1e6;
        }
    },
    divineFind: {
        name: "Divine Intervention",
        desc: "Discover your first divine ore (1/3M or rarer).",
        icon: "noise",
        preReq: ["legendaryFind"],
        progress() {
            return stats.lowestOreRNG / 3e6;
        }
    },
    mythicFind: {
        name: "A Living Myth",
        desc: "Discover your first mythic ore (1/10M or rarer).",
        icon: "ununennium",
        preReq: ["divineFind"],
        progress() {
            return stats.lowestOreRNG / 1e7;
        }
    },
    angelicFind: {
        name: "A Blessing from Above",
        desc: "Discover your first angelic ore (1/30M or rarer).",
        icon: "unobtainium",
        preReq: ["mythicFind"],
        progress() {
            return stats.lowestOreRNG / 3e7;
        }
    },
    unfathomableFind: {
        name: "Breaking Reality",
        desc: "Discover your first unfathomable ore (1/100M or rarer).",
        icon: "creation",
        preReq: ["angelicFind"],
        progress() {
            return stats.lowestOreRNG / 1e8;
        }
    },
    extravagantFind: {
        name: "Renowned Treasure",
        desc: "Discover your first extravagant ore (1/300M or rarer).",
        icon: "destruction",
        preReq: ["unfathomableFind"],
        progress() {
            return stats.lowestOreRNG / 3e8;
        }
    },
    inconceivableFind: {
        name: "Beyond Comprehension",
        desc: "Discover your first inconceivable ore (1/1B or rarer).",
        icon: "antimatter",
        preReq: ["extravagantFind"],
        progress() {
            return stats.lowestOreRNG / 1e9;
        }
    },
    apotheoticFind: {
        name: "Perfected Form",
        desc: "Discover your first apotheotic ore (1/3B or rarer).",
        disabled: true,
        preReq: ["inconceivableFind"],
        progress() {
            return stats.lowestOreRNG / 3e9;
        }
    },
    transcendentFind: {
        name: "Between Dimensions",
        desc: "Discover your first transcendent ore (1/10B or rarer).",
        disabled: true,
        preReq: ["apotheoticFind"],
        progress() {
            return stats.lowestOreRNG / 1e10;
        }
    },
    metaexistentialFind: {
        name: "Traveling Between Timelines",
        desc: "Discover your first metaexistential ore (1/30B or rarer).",
        disabled: true,
        preReq: ["transcendentFind"],
        progress() {
            return stats.lowestOreRNG / 3e10;
        }
    },
    omniversalFind: {
        name: "Godly.",
        desc: "Discover your first omniversal ore (1/100B or rarer). You stand among gods.",
        disabled: true,
        preReq: ["metaexistentialFind"],
        progress() {
            return stats.lowestOreRNG / 1e11;
        }
    },
    explorer: {
        name: "Explorer",
        desc: "Break into a cave for the first time.",
        icon: "shale",
        progress() {
            return stats.cavesGenerated;
        }
    },
    bedrockBreaker: {
        name: "Bedrock Breaker",
        desc: "Break bedrock, leading you into the volcanic layer.",
        icon: "bedrock",
        preReq: ["explorer"],
        progress() {
            return stats.oresMined.bedrock || stats.layersVisited.volcanic;
        }
    },
    desertTraveler: {
        name: "How Shocking",
        desc: "Travel to the electric layer.",
        icon: "sandstone",
        preReq: ["bedrockBreaker"],
        progress() {
            return stats.layersVisited.electric;
        }
    },
    enterIrradiated: {
        name: "Gonna need a hazmat suit",
        desc: "Introducing a new hazard!", // enter the irradiated layer
        icon: "uranium",
        preReq: ["bedrockBreaker"],
        progress() {
            return stats.layersVisited.irradiated;
        }
    },
    enterNuclear: {
        name: "Maybe multiple",
        desc: "It's extremely radioactive here.",
        icon: "plutonium",
        preReq: ["enterIrradiated"],
        progress() {
            return stats.layersVisited.nuclear;
        }
    },
    underworld: {
        name: "Entering Hell",
        desc: "It's hot. It's really hot here.",
        icon: "garnet",
        preReq: ["enterNuclear"],
        progress() {
            return stats.layersVisited.hell;
        }
    },
    theMedian: {
        name: "The Median",
        desc: "The confusing rocky layer between the underworld and the frozen layer.",
        icon: "pegmatite",
        preReq: ["underworld"],
        progress() {
            return stats.layersVisited.intertemperate;
        }
    },
    icyTraveler: {
        name: "Icy Traveler",
        desc: "Travel to the frozen layer.",
        icon: "ice",
        preReq: ["theMedian"],
        progress() {
            return stats.layersVisited.frozen;
        }
    },
    deepDiver: {
        name: "Deep Diver",
        desc: "Reach the ocean.",
        icon: "olivine",
        preReq: ["icyTraveler"],
        progress() {
            return stats.layersVisited.marine;
        }
    },
    jungleExplorer: {
        name: "Jungle Explorer",
        desc: "Enter the jungle layer.",
        icon: "jade",
        preReq: ["deepDiver"],
        progress() {
            return stats.layersVisited.jungle;
        }
    },
    descent: {
        name: "The Descent",
        desc: "You're approaching the core... be careful.",
        icon: "mantle",
        preReq: ["jungleExplorer"],
        progress() {
            return stats.layersVisited.asthenosphere;
        }
    },
    beyondTheCore: {
        name: "I don't believe in physics",
        desc: "Somehow travel past the center of earth and enter the void. Things get weird from here on...",
        icon: "voidstone",
        disabled: true,
        progress() {
            return stats.layersVisited.void;
        }
    },
    enterPurgatory: {
        name: "Lost Soul",
        desc: "You're not supposed to be here...",
        icon: "question",
        disabled: true,
        progress() {
            return stats.layersVisited.purgatory;
        }
    },
    astronaut: {
        name: "Astronaut",
        desc: "Travel to space!",
        icon: "osmium",
        disabled: true,
        progress() {
            return stats.layersVisited.space;
        }
    },
    supervein: {
        name: "Supervein",
        desc: "Find a vein with at least 50 ores.",
        icon: "diamond",
        progress() {
            return stats.largestVein / 50;
        }
    },
    superdupervein: {
        name: "Super-duper-vein!!!",
        desc: "Find a vein with at least 200 ores.",
        icon: "amethyst",
        preReq: ["supervein"],
        progress() {
            return stats.largestVein / 200;
        }
    },
    supergeode: {
        name: "Supergeode...?",
        desc: "Find a geode with a radius of 12 or more.",
        icon: "limestone",
        progress() {
            return stats.largestGeode / 12;
        }
    },
    literallyMinecraft: {
        name: "Literally Minecraft",
        desc: "Break a log with your fists.",
        icon: "wood",
        progress() {
            return stats.oresMined.wood;
        }
    },
    doofenshmirtzsFavorite: {
        name: "Doofenshmirtz's Favorite",
        desc: "Craft and use a Convertinator.",
        icon: "convertinator",
        progress() {
            return stats.toolsUsed.convertinator;
        }
    },
    brokenWeather: {
        name: "This game makes no sense",
        desc: "Find rain or snow in a desert.",
        icon: "weatherRadar",
        disabled: true // i think this is impossible for now but i genuinely have no idea
    },
    gullible: {
        name: "Gullible",
        secretDesc: "Craft a newspaper and try to use it.",
        desc: "Don't believe everything you read.",
        icon: "paper",
        progress() {
            return stats.itemsUsed.newspaper;
        }
    },
    cheater: { // condition not specified here
        name: "Cheater!!!!!!!!!!!!",
        secretDesc: "Open the console.",
        desc: "S. M. H.",
        icon: "retrock"
    },
    changedMyMind: {
        name: "Actually, never mind",
        secretDesc: "Close the game before pressing play (after it loads).",
        desc: "Misclick, I think.",
        icon: "../block/x",
        progress() {
            return Boolean(localStorage.getItem("tdd-changedMyMind"));
        }
    },
    phases: {
        name: "Phases",
        secretDesc: "Play the game for at least 30 days in a row, break the streak, and then play again for another 30 days in a row.",
        desc: "I just can't make up my mind.",
        icon: "moonstone",
        progress() {
            return stats.maxDailyStreak / 30 / 2 + stats.dailyStreak / 30 / 2;
        }
    },
    marathon: {
        name: "Marathon",
        secretDesc: "Play the game for 6 hours in one session without going idle for more than 5 minutes.",
        desc: "You must really love mining. Probably a little too much.",
        icon: "sunstone",
        progress() {
            return (performance.now() - vars.startActiveTime) / (6 * 3600000);
        }
    },
    dirtness: {
        name: "Dirtiest Dirt",
        secretDesc: "Find dirtness.",
        desc: "Some dirt is just dirtier than the rest.",
        icon: "dirt",
        progress() {
            return stats.oresMined.dirtness;
        }
    },
    completionist: {
        name: "Completionist",
        secretDesc: "Unlock every achievement in the game. Good lord...",
        desc: "Unlock every achievement in the game.",
        icon: "trophy",
        progress() {
            return achievementArray.filter(a => !a.disabled && a.unlocked).length / achievementArray.filter(a => !a.disabled).length;
        }
    }
};

let animations = { // animated texture data
    darkmatter: {
        fps: 8,
        frames: 4,
        // axis: "y" // defaults to "y"
    },
    neutronium: {
        fps: 16,
        frames: 5
    }
};

let colors = { // for colored blocks
    red: "#f00",
    orange: "#f80",
    yellow: "#ff0",
    lime: "#0f0",
    green: "#080",
    cyan: "#0ff",
    lightBlue: "#0af",
    blue: "#00f",
    purple: "#a0f",
    magenta: "#f0f",
    pink: "#f0a",
    white: "#fff",
    lightGray: "#aaa",
    gray: "#888",
    darkGray: "#555",
    black: "#000",
    brown: "#654321"
}

for (const color in colors) {
    ores[color + "Block"] = {
        name: color[0].toUpperCase() + color.slice(1).split(/(?=[A-Z])/).join(" ") + " Block",
        color: colors[color],
        firstColor: colors[color],
        chance: 0,
        str: 1,
        noTexture: true,
        sfx: "stone",
        singleLayer: true,
        customTexture: {
            item: {
                src: "block"
            }
        }
    }
}

for (const ore in ores) {
    if (ores[ore].str === undefined) ores[ore].str = 0;
    if (ores[ore].chance === Infinity) ores[ore].discovered = true;
    if (ores[ore].color === undefined) ores[ore].color = "#888";
    if (ores[ore].creator === undefined) ores[ore].creator = "Tranquanto";
    if (ores[ore].removalReason) ores[ore].condition = () => false;
    if (ores[ore].placeholder) {
        ores[ore].excludeFromWiki = 2;
        ores[ore].noTexture = true;
        continue;
    }
    if (ores[ore].isLiquid) {
        ores[ore].str = Infinity;
    }
    if (ores[ore].cave) {
        ores[ore].noVein = true;
        ores[ore].noGeode = true;
        ores[ore].noCrystal = true;
    }
    if (ores[ore].viscosity !== undefined && ores[ore].speedModifier === undefined) {
        ores[ore].speedModifier = 200 / (ores[ore].viscosity + 200);
    }
    if (ores[ore].firstColor === undefined) {
        if (ores[ore].color.includes("gradient")) {
            ores[ore].firstColor = ores[ore].color.slice(ores[ore].color.indexOf("#")).split(",")[0].trim().split(" ")[0].trim();
        } else {
            ores[ore].firstColor = ores[ore].color;
        }
    }
    if (ores[ore].indexOptions === undefined) {
        ores[ore].indexOptions = {
            xAxis: "depth",
            yAxis: "rarity"
        }
    }
    if (!ores[ore + "Brick"]) {
        ores[ore + "Brick"] = {
            name: ores[ore].name + " Bricks",
            color: ores[ore].color,
            firstColor: ores[ore].firstColor,
            chance: 0,
            str: ores[ore].str,
            oreColor: true,
            singleLayer: true,
            excludeFromWiki: 2, // 0 = never; 1 = only when undiscovered; 2 = always
            customTexture: {
                ore: "brick",
                item: {
                    src: "brick",
                    colorize: ores[ore].firstColor
                }
            },
            desc: "Bricks made of " + ores[ore].name + ".",
            sfx: "stone",
            noRandomRotation: true
        };

        recipes.push({
            input: [{id: ore + "Brick", count: 4}],
            output: {id: ore, count: 1}
        });

        items[ore + "Brick"] = {
            name: ores[ore].name + " Bricks",
            color: ores[ore].color,
            excludeFromWiki: 2,
            singleLayer: true
        };
    }

    if (!ores[ore + "Block"]) {
        ores[ore + "Block"] = {
            name: ores[ore].name + " Block",
            color: ores[ore].color,
            firstColor: ores[ore].firstColor,
            chance: 0,
            str: ores[ore].str * 2,
            oreColor: true,
            singleLayer: true,
            excludeFromWiki: 2, // 0 = never; 1 = only when undiscovered; 2 = always
            customTexture: {
                ore: "block",
                item: {
                    src: "block",
                    colorize: ores[ore].color
                }
            },
            desc: "A compressed block of " + ores[ore].name + ".",
            sfx: "stone",
            noRandomRotation: true
        };

        recipes.push({
            input: [{id: ore + "Block", count: 1}],
            output: {id: ore, count: 10}
        });

        items[ore + "Block"] = {
            name: ores[ore].name + " Block",
            color: ores[ore].color,
            excludeFromWiki: 2,
            singleLayer: true
        };
    }

    if (ores[ore].globalTick) {
        vars.globalTickFuncs.push(ores[ore].globalTick);
    }
    if (!Array.isArray(ores[ore].chance) && ores[ore].condition === undefined && ores[ore].maxY === -2) {
        ores[ore].maxY = maxHeight;
        ores[ore].excludeLayers?.push ? ores[ore].excludeLayers.push("surface") : ores[ore].excludeLayers = ["surface"];
        ores[ore].condition = (x, y, z) => {
            return y < topLayer(x, z);
        };
    }

    if ((ores[ore].minY === undefined || ores[ore].maxY === undefined) && typeof ores[ore].chance === "object" && Array.isArray(ores[ore].chance)) {
        let min = Infinity;
        let max = -Infinity;
        for (const interval of ores[ore].chance) {
            if (interval.minY < min) min = interval.minY;
            if (interval.maxY > max) max = interval.maxY;
        }
        if (ores[ore].minY === undefined) ores[ore].minY = min;
        if (ores[ore].maxY === undefined) ores[ore].maxY = max;
    }

    if (ores[ore].minY <= 250 && ores[ore].minY >= minHeight - 1 || ores[ore].maxY <= 250 && ores[ore].maxY >= minHeight - 1) {
        surfaceOres.push(ores[ore]);
    }

    if (ores[ore].opacity < 1 && ores[ore].singleLayer) {
        ores[ore].textureHasTransparency = true;
    }
}

let unusedOres = [];

main: for (const ore in ores) { // add all ores as items
    if ((ores[ore].noVein && ores[ore].noGeode || ores[ore].forcedBG) && ores[ore].noCrystal === undefined) {
        ores[ore].noCrystal = true;
    }
    
    // fix some parameters
    if (ores[ore].str === undefined) ores[ore].str = 0;
    if (ores[ore].chance === undefined) ores[ore].chance = 0;
    if (ores[ore].minY === undefined) ores[ore].minY = -Infinity;
    if (ores[ore].maxY === undefined) ores[ore].maxY = Infinity;
    if (ores[ore].chance === Infinity) ores[ore].discovered = true;
    ores[ore].id = ore;
    if (ores[ore].placeholder) continue;

    if (!items[ore]) items[ore] = {};
    if (!items[ore].name) items[ore].name = ores[ore].name;
    if (!items[ore].color) items[ore].color = ores[ore].color;
    if (!items[ore].tags) items[ore].tags = {};
    if (items[ore].tags.block === undefined) items[ore].tags.block = true;
    if (!ores[ore].desc) ores[ore].desc = ores[ore].spawnMsg || "";
    if (ores[ore].otherDetails && typeof ores[ore].otherDetails !== "object" && !Array.isArray(ores[ore].otherDetails)) ores[ore].otherDetails = [ores[ore].otherDetails];
    if (!items[ore].desc) items[ore].desc = ores[ore].desc;

    for (const recipe of recipes) {
        if (recipe.input.some(i => i.id === ore)) continue main;
    }
    unusedOres.push(ore);
}

async function createItemTexture(id) {
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;

    const image = new Image(16, 16);
    image.src = `img/item/${ores[id]?.customTexture ? ores[id].customTexture.item.src : id}.png`;

    image.onload = () => {
        canvas.getContext("2d").drawImage(image, 0, 0);
    }

    return items[id].canvasElem = canvas;
}

for (const item in items) {
    items[item].id = item;
    if (!items[item].tags) items[item].tags = {};
    if (typeof items[item].tags === "object" && Array.isArray(items[item].tags)) {
        let obj = {};
        for (const k of items[item].tags) {
            obj[k] = true;
        }
        items[item].tags = obj;
    }
    if (items[item].tags.usable === undefined && items[item].onUse) items[item].tags.usable = true;

    items[item].tagArray = Object.keys(items[item].tags).filter(t => items[item].tags[t]);

    createItemTexture(item);
}

function findBiomePositions(targetBiome, threshold, comparison = "above", searchRadius = 1000, stepSize = 10, totalResults = 1, limits) {
    const results = [];
    const op = comparison === "above" ? (a, b) => a > b : (a, b) => a < b;
    if (!limits) {
        limits = {};
    }
    if (!limits.minX) limits.minX = -Infinity;
    if (!limits.maxX) limits.maxX = Infinity;
    if (!limits.minY) limits.minY = -Infinity;
    if (!limits.maxY) limits.maxY = Infinity;
    if (!limits.minZ) limits.minZ = -Infinity;
    if (!limits.maxZ) limits.maxZ = Infinity;

    for (let x = Math.max(limits.minX, -searchRadius); x <= Math.min(limits.maxX, searchRadius); x += stepSize) {
        for (let z = Math.max(limits.minZ, -searchRadius); z <= Math.min(limits.maxZ, searchRadius); z += stepSize) {
            for (let y = Math.max(limits.minY, -searchRadius); y <= Math.min(limits.maxY, searchRadius); y += stepSize) {
                const value = getBiomeNumber(x, y, z, targetBiome);
                if (op(value, threshold)) {
                    results.push({x, y, z, value});
                    if (results.length >= totalResults) return results; // Limit results
                }
            }
        }
    }
    return results;
}

const ores2 = [];
for (const ore in ores) {
    // change colors to 6-digit hex
    if (typeof ores[ore].color === "string" && ores[ore].color.length === 7) {
        ores[ore].color = "#" + ores[ore].color.slice(1);
    } else if (typeof ores[ore].color === "string" && ores[ore].color.length === 4) {
        ores[ore].color = "#" + ores[ore].color.slice(1).split("").map(c => c + c).join("");
    }
    // get the highest chance the ore has to spawn
    let maxChance = 0;
    if (typeof ores[ore].chance === "object") {
        if (Array.isArray(ores[ore].chance)) {
            for (const interval of ores[ore].chance) {
                if (typeof interval.chance === "object") {
                    if (interval.chance.max > maxChance) maxChance = interval.chance.max;
                    if (interval.chance.min > maxChance) maxChance = interval.chance.min;
                } else {
                    if (interval.chance > maxChance) maxChance = interval.chance;
                }
            }
        } else {
            if (ores[ore].chance.max > maxChance) maxChance = ores[ore].chance.max;
            if (ores[ore].chance.min > maxChance) maxChance = ores[ore].chance.min;
        }
    } else {
        maxChance = ores[ore].chance;
    }

    if (maxChance === 0 && ores[ore].excludeFromWiki === undefined) {
        ores[ore].excludeFromWiki = 2; // always exclude from wiki
    }
    if (maxChance === 0 && !ores[ore].tier) ores[ore].tier = "common";

    // set tier based on maxChance
    ores[ore].maxChance = maxChance;
    if (!ores[ore].tier) {
        for (const tier in tiers) {
            if (maxChance > tiers[tier].minChance && maxChance <= tiers[tier].maxChance) {
                ores[ore].tier = tier;
                break;
            }
        }
    }
    if (tiers[ores[ore].tier].maxChance <= 1e-4) {
        ores2.push({ore: ores[ore].name, rarity: 1 / maxChance});
    }
    if (typeof ores[ore].chance === "object" && Array.isArray(ores[ore].chance)) {
        if (ores[ore].condition) {
            for (const interval of ores[ore].chance) {
                if (!interval.condition) interval.condition = ores[ore].condition;
                if (!interval.conditionLabel) interval.conditionLabel = ores[ore].conditionLabel;
            }
        }
        if (ores[ore].caveExclusive !== undefined) {
            for (const interval of ores[ore].chance) {
                if (interval.caveExclusive === undefined) interval.caveExclusive = ores[ore].caveExclusive;
            }
        }
    }
    
    if (items[ore] && !items[ore].tier) items[ore].tier = ores[ore].tier;
    if ((ores[ore].noTexture || ores[ore].singleLayer) && !ores[ore].sfx && ores[ore].chance !== 0) console.warn(`Ore ${ore} is marked as singleLayer but has no sfx defined.`);
}
ores2.forEach(ore => {
    ore.rarity = "1 in " + formatNum(ore.rarity, 2);
});
// console.log(ores2.sort((a, b) => a.rarity - b.rarity));

let index = 0;
for (const b of Object.keys(biomes).filter(b => !biomes[b].seed)) {
    biomes[b].seedModifier = index++ / (7.8 + Math.E);
}
for (const b of Object.keys(biomes).filter(b => biomes[b].seed)) {
    biomes[b].seedModifier = biomes[biomes[b].seed].seedModifier;
}

let locations = [
    [0, 0, 0, "surface"]
];
let layerX = 500, layerZ = 0;
for (const l in layers) {
    if (layers[l].music && !layers[l].shortMusic) {
        const sp = layers[l].music.split(" - ")[1];
        layers[l].shortMusic = sp ? sp.replace(" (OST)", "") : layers[l].music;
    } else if (!layers[l].music) {
        layers[l].shortMusic = "None";
        layers[l].music = "No Music Yet... Sorry :(";
    }
    if (!layers[l].color) layers[l].color = layers[l].fogColor;
    if (l === "surface") continue;
    locations.push([layerX, layers[l].max > 0 ? layers[l].min + 5 : layers[l].max - 5, layerZ, l]);
    if (layerX >= 0) {
        layerX += 500;
    } else {
        layerX = -layerX;
    }
    if (Math.abs(layerX) >= 2000) {
        layerX = (layerX > 0 ? -1 : 1) * 500;
        if (layerZ >= 0) {
            layerZ += 500;
        } else {
            layerZ = -layerZ;
        }
        if (Math.abs(layerZ) >= 2000) {
            layerZ = (layerZ > 0 ? -1 : 1) * 500;
        }
    }
}

for (const b in biomes) {
    const biome = biomes[b];
    biome.noise = new PerlinNoise(vars.seed + biome.seedModifier);
    if (biome.surfaceBiome) {
        if (!biome.lighting) biome.lighting = layers.surface.lighting;
        if (!biome.fog) biome.fog = layers.surface.fog;
        if (!biome.fogColor) biome.fogColor = layers.surface.fogColor;
        if (!biome.nightFogColor) biome.nightFogColor = layers.surface.nightFogColor;
        if (!biome.bloom) biome.bloom = layers.surface.bloom;
        if (!biome.directionalLight) biome.directionalLight = layers.surface.directionalLight;
        if (!biome.geode) biome.geode = layers.surface.geode;
        if (!biome.caveRules) biome.caveRules = layers.surface.caveRules;
        if (!biome.tick) biome.tick = layers.surface.tick;
    }
    if (biomes[b].music && !biomes[b].shortMusic) {
        const sp = biomes[b].music.split(" - ")[1];
        biomes[b].shortMusic = sp ? sp.replace(" (OST)", "") : biomes[b].music;
    }
}

for (let i = 0; i < recipes.length; i++) {
    const recipe = recipes[i];
    recipe.input.sort((a, b) => {
        const aChance = ores[a.id] ? ores[a.id].maxChance : 0;
        const bChance = ores[b.id] ? ores[b.id].maxChance : 0;
        return bChance - aChance;
    });
    if (!items[recipe.output.id]) {
        console.warn(`Recipe output ${recipe.output.id} does not exist as an item.`);
        items[recipe.output.id] = {
            name: recipe.output.id,
            color: "#ffffff"
        };
    }
}
recipes.sort((a, b) => items[b.output.id].name < items[a.output.id].name ? 1 : -1);

// arrays for faster iteration
const oreArray = Array.from(Object.keys(ores), k => ores[k]);
const perLayerOreArray = {};
for (const l in layers) {
    if (layers[l].ores) {
        perLayerOreArray[l] = layers[l].ores.map(id => {
            return ores[id];
        });
        continue;
    }
    perLayerOreArray[l] = oreArray.filter(o => {
        const ore = o.id;
        let maxY = -Infinity;
        let minY = Infinity;
        if (ores[ore].minY === undefined || ores[ore].maxY === undefined || ores[ore].chance === 0 && !ores[ore].includeInOreArray || ores[ore].excludeLayers?.includes(l) || ores[ore].removalReason) return false;
        if (Array.isArray(ores[ore].chance)) {
            for (const interval of ores[ore].chance) {
                if (interval.maxY > maxY) maxY = interval.maxY;
                if (interval.minY < minY) minY = interval.minY;
            }
        } else {
            ({minY, maxY} = ores[ore]);
        }

        return (minY < 0 ? minY < layers[l].max : minY <= layers[l].max) && (maxY >= 0 ? maxY > layers[l].min : maxY >= layers[l].min);
    });
}

let structureIndex = 0;
for (const s in structures) {
    structureIndex++;
    structures[s].id = s;

    // compute structure bounds
    if (structures[s].layout) {
        const height = structures[s].layout.length;
        const width = structures[s].layout[0].length;
        const depth = structures[s].layout[0][0].length;

        structures[s].gridOffset = {
            x: Math.floor(rand01(structureIndex, 0, 0, vars.seed + Math.E * Math.PI) * width),
            y: Math.floor(rand01(structureIndex, 0, 1, vars.seed + Math.E * Math.PI) * height),
            z: Math.floor(rand01(structureIndex, 0, 2, vars.seed + Math.E * Math.PI) * depth)
        }
        
        structures[s].width = width;
        structures[s].height = height;
        structures[s].depth = depth;

        if (structures[s].chance === undefined && structures[s].blockChance !== undefined)
            structures[s].chance = 1 - Math.pow(1 - structures[s].blockChance, width * height * depth);
        else if (structures[s].blockChance === undefined && structures[s].chance !== undefined)
            structures[s].blockChance = 1 - Math.pow(1 - structures[s].chance, 1 / (width * height * depth));
        else {
            structures[s].chance = structures[s].chance || 0;
            structures[s].blockChance = structures[s].blockChance || 0;
        }
    } else {
        // fetch JSON
        let height = 0, width = 0, depth = 0;
            fetch(`structures/${s}.${structures[s].format || "json"}`).then(res => res.text()).then(data => {
                const {format} = structures[s];
                if (format === "snbt") {
                    data = parseSNBT(data);
                } else {
                    data = JSON.parse(data);
                }
                if (data.layout) {
                    structures[s].layout = data.layout;
                    height = data.layout.length;
                    width = data.layout[0].length;
                    depth = data.layout[0][0].length;
                    structures[s].width = width;
                    structures[s].height = height;
                    structures[s].depth = depth;

                    structures[s].gridOffset = {
                        x: Math.floor(rand01(structureIndex, 0, 0, vars.seed + Math.E * Math.PI) * width),
                        y: Math.floor(rand01(structureIndex, 0, 1, vars.seed + Math.E * Math.PI) * height),
                        z: Math.floor(rand01(structureIndex, 0, 2, vars.seed + Math.E * Math.PI) * depth)
                    }

                    for (const k in data.key) {
                        if (!structures[s].key) structures[s].key = {};
                        structures[s].key[k] = data.key[k];
                    }
                } else if (data.DataVersion || format === "snbt") { // SNBT (Minecraft) format
                    [width, height, depth] = data.size;
                    structures[s].width = width;
                    structures[s].height = height;
                    structures[s].depth = depth;

                    structures[s].gridOffset = {
                        x: Math.floor(rand01(structureIndex, 0, 0, vars.seed + Math.E * Math.PI) * width),
                        y: Math.floor(rand01(structureIndex, 0, 1, vars.seed + Math.E * Math.PI) * height),
                        z: Math.floor(rand01(structureIndex, 0, 2, vars.seed + Math.E * Math.PI) * depth)
                    }

                    structures[s].palette = data.palette;
                    structures[s].blocks = data.blocks;
                    structures[s].format = "snbt";

                    if (structures[s].palette) {
                        for (let i = 0; i < structures[s].palette.length; i++) {
                            structures[s].palette[i].id = i;
                            // convert snake_case to camelCase and remove "minecraft:" namespace
                            structures[s].palette[i].name = structures[s].palette[i].Name.replace("minecraft:", "").replace(/_([a-z])/g, g => g[1].toUpperCase());
                            delete structures[s].palette[i].Name;

                            if (!ores[structures[s].palette[i].name]) {
                                ores[structures[s].palette[i].name] = {
                                    name: structures[s].palette[i].name,
                                    color: "#888888",
                                    firstColor: "#888888",
                                    chance: 0,
                                    str: 0,
                                    id: structures[s].palette[i].name,
                                    tier: "placeholder",
                                    excludeFromWiki: 2,
                                    noTexture: true,
                                    singleLayer: true,
                                    sfx: "stone"
                                };
                                items[structures[s].palette[i].name] = {
                                    name: structures[s].palette[i].name,
                                    color: "#888888",
                                    tags: {block: true}
                                };
                            }
                        }
                    }
                }

                if (structures[s].chance === undefined && structures[s].blockChance !== undefined)
                    structures[s].chance = 1 - Math.pow(1 - structures[s].blockChance, width * height * depth);
                else if (structures[s].blockChance === undefined && structures[s].chance !== undefined)
                    structures[s].blockChance = 1 - Math.pow(1 - structures[s].chance, 1 / (width * height * depth));
                else {
                    structures[s].chance = structures[s].chance || 0;
                    structures[s].blockChance = structures[s].blockChance || 0;
                }
            });
    }
}

for (const a in achievements) {
    achievements[a].id = a;
    if (!achievements[a].progress) {
        achievements[a].progress = () => 0;
    }
}

function parseSNBT(snbt) {
    snbt = snbt.trim();
    let lines = snbt.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("//"));
    let nbtDepth = 0, nbtLength = 0, nbtStart = 0, isEntities = false;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(":")) {
            if (!nbtDepth) {
                let [key, ...rest] = lines[i].split(":");
                let value = rest.join(":").trim();

                if (key === "entities") { // remove entities tag and everything inside it
                    nbtDepth++;
                    nbtStart = i;
                    nbtLength = 1;
                    lines[i - 1] = lines[i - 1].replace(/,\s*$/, ""); // remove trailing comma from previous line
                    isEntities = true;
                    continue;
                }
                
                if (key === "nbt") { // remove all nbt tags
                    nbtDepth++;
                    nbtStart = i;
                    nbtLength = 1;
                    lines[i - 1] = lines[i - 1].replace(/,\s*$/, ""); // remove trailing comma from previous line
                    continue;
                }

                // quote keys if they aren't already
                if (!key.startsWith('"') && !key.startsWith("'")) {
                    key = `"${key.trim()}"`;
                }

                // remove number type suffixes
                value = value.replace(/([-+]?\d*\.?\d+)([bslfd])/gi, "$1");
                
                lines[i] = `${key}: ${value}`;
            }
        }
        if (nbtDepth) {
            nbtLength++;
            nbtDepth += (lines[i].match(/{/g) || []).length;
            nbtDepth -= (lines[i].match(/}/g) || []).length;
            nbtDepth += (lines[i].match(/\[/g) || []).length;
            nbtDepth -= (lines[i].match(/]/g) || []).length;
            if (!nbtDepth) {
                lines.splice(nbtStart, nbtLength);
                i = nbtStart - 1;
                if (isEntities && !lines[i].trim().endsWith(",") && !(lines[i + 1] && (lines[i + 1].trim().startsWith("}") || lines[i + 1].trim().startsWith("]")))) {
                    lines[i] = lines[i].trim() + ",";
                }
                isEntities = false;
            }
        }
    }

    let join = lines.join("");
    if (join.endsWith(",")) join = join.slice(0, -1);
    if (join.endsWith("]")) join += "}";
    const output = JSON.parse(join);
    return output;
}

const structureArray = Array.from(Object.keys(structures), k => structures[k]);
const achievementArray = Array.from(Object.keys(achievements), k => achievements[k]);

function checkAllBiomes(x, y, z, biome) {
    for (let i = 0; i < biomeArray.length; i++) {
        const b = biomeArray[i].id;
        if (!biomeArray[i].surfaceBiome || !biomeArray[i].hasOwnProperty("threshold") || b === biome) continue;
        if (getBiomeNumber(x, y, z, b) >= biomeArray[i].threshold) return false;
    }
    if (biomes[biome]) {
        if (getBiomeNumber(x, y, z, biome) >= biomes[biome].threshold) return true;
    } else return true;
    return false;
}



export {
    ores,
    items,
    recipes,
    layers,
    structures,
    tiers,
    replacedIds,
    biomes,
    traits,
    getLayer,
    getBiomeNumber,
    findBiomePositions,
    getTemperature,
    getHumidity,
    topLayer,
    locations,
    surfaceOres,
    sfxOptions,
    minHeight,
    maxHeight,
    oreArray,
    perLayerOreArray,
    layerArray, biomeArray, structureArray, achievementArray,
    achievements,
    animations
}

// console.log(unusedOres.filter(g => ores[g].chance)
// .sort((b, a) => ores[a].maxChance - ores[b].maxChance)
// .map(g => `${ores[g].name} | ${formatChance(ores[g].maxChance)}`).join("\n"));