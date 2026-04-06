import {
    PerlinNoise,
    rand01,
    seed,
    heightMapNoise,
    heightMapNoiseLarge,
    heightMapMountain,
    heightMapMountainLarge,
    temperatureNoise,
    humidityNoise,
    BIOME_INTERVAL,
    MIN_CAVE_REQ,
    CAVE_SIZE,
    caveNoise,
    deepSpaceNoise
} from "../perlin.js";

export const maxHeight = 150, minHeight = 0;
const worldHeight = (maxHeight - minHeight) / 2;

export function topLayer(x, z, noFloor = false) {
    const small = heightMapNoise.noise(x / 100, 0, z / 100) * worldHeight / 3;
    const large = heightMapNoiseLarge.noise(x / 400, 0, z / 400) * worldHeight * 2 / 3;
    const mountain = Math.max(heightMapMountain.noise(x / 25, 0, z / 25), 0) * worldHeight * Math.max(heightMapMountainLarge.noise(x / 125, 0, z / 125), 0);
    const a = (small + large + mountain);
    return (noFloor ? a : Math.floor(a)) + worldHeight + minHeight;
}

let vars = {
    particleQueue: []
}

const layers = {
    upperVoid: {
        name: "Upper Void",
        desc: "An area in which no blocks exist.",
        item: "air",
        max: Infinity,
        min: 10000,
        lighting: {color: "#fff", intensity: 0.5},
        fog: 0,
        fogColor: "#0af"
    },
    deepSpace: {
        name: "Deep Space",
        desc: "It's dark and scary out here.",
        item: "meteorite",
        max: 10000,
        min: 2000,
        lighting: {color: "#fff", intensity: 1, cameraLightIntensity: 2, cameraLightDecay: 0},
        fog: 400,
        fogColor: "#000000",
        skybox: {
            id: "space",
            opacity: 1
        },
        gravity: 0,
        airFriction: 0,
        airFrictionSpeed: 0.01, // speed modifier override for air friction (0 would make you immobile)
        music: "Tranquanto - Entering the Cosmos (OST)",
        bloom: {
            strength: 0.3,
            radius: -0.2
        },
        chunks: "3d",
        chunkGenSpeed: 16,
        chunkRadius: 6,
        universalCondition(x, y, z) {
            return deepSpaceNoise(x, y, z, 128) < 0.06;
        }
    },
    space: {
        name: "Space",
        desc: "The final frontier (not really).",
        item: "meteorite",
        max: 2000,
        min: 1000,
        geode: "meteorite",
        lighting: {color: "#44f", intensity: 2, cameraLightIntensity: 4, cameraLightDecay: 0},
        fog: 80,
        fogColor: "#000000",
        gravity: 0.1,
        color: "#050022",
        music: "startijer - Space Sifter (OST)",
        bloom: {
            strength: 0.3,
            radius: -0.2
        },
        skybox: {
            opacity: 1
        },
        directionalLight: {
            str: 5,
            alwaysVisible: true
        },
        chunks: "3d",
        universalCondition(x, y, z) {
            return caveNoise.noise(x / CAVE_SIZE, y / CAVE_SIZE, z / CAVE_SIZE) > MIN_CAVE_REQ - 0.1;
        }
    },
    sky: {
        name: "Sky",
        desc: "A layer above the surface.",
        item: "cloud",
        max: 1000,
        min: 249,
        geode: "rainCloud",
        lighting: {color: "#ddd", intensity: 0.6},
        fog: 40,
        fogColor: "#82b2da",
        nightFogColor: "#050022",
        gravity: 0.55,
        bloom: {
            strength: 0.5,
            threshold: 2
        },
        caveRules: {
            noDripstone: true,
            noCrystals: true
        },
        caveNoise: () => -1,
        music: "Tranquanto + Thunderlord888 - Ethereal Oasis (OST)",
        chunks: "3d",
        universalCondition(x, y, z) {
            return caveNoise.noise(x / CAVE_SIZE, y / CAVE_SIZE, z / CAVE_SIZE) > MIN_CAVE_REQ - 0.1;
        }
    },
    surface: {
        name: "Surface",
        desc: "The top of the world, filled with luscious life.",
        item: "grass",
        max: 250,
        min: -10,
        geode: "limestone",
        lighting: {color: "#fff", intensity: 0.4},
        fog: 1000,
        fogColor: "#0088ff",
        nightFogColor: "#050022",
        music: "startijer - Generic Grassland (OST)",
        bloom: {
            strength: 0.4,
            threshold: 0.8
        },
        directionalLight: {
            str: 5,
            pos: {x: 1, y: 4, z: 2}
        },
        caveRules: {
            noDripstone: true,
            noCrystals: true
        },
        requirement(x, y, z) {
            return y >= topLayer(x, z) - 4;
        }
    },
    subsurface: {
        name: "Subsurface",
        desc: "Slightly below the surface.",
        item: "shale",
        max: maxHeight - 4,
        min: -100,
        geode: "limestone",
        lighting: {color: "#fff", intensity: 0.15},
        fog: 100,
        color: "#777",
        music: "Tranquanto - Illuminated Fungal Grotto",
        requirement(x, y, z) {
            return y < topLayer(x, z) - 4;
        }
    },
    fungal: {
        name: "Fungal",
        desc: "A peaceful layer full of mushrooms.",
        item: "granite",
        max: -100,
        min: -300,
        geode: "limestone",
        lighting: {color: "#fff", intensity: 0.1},
        fog: 80,
        color: "#f77",
        music: "Tranquanto - Illuminated Fungal Grotto: Side B",
        bloom: {
            strength: 0.2
        }
    },
    caverns: {
        name: "Caverns",
        desc: "A gneiss layer far below the surface.",
        item: "gneiss",
        max: -300,
        min: -600,
        geode: "limestone",
        lighting: {color: "#fff", intensity: 0.08},
        fog: 60,
        color: "#b5b5b5",
        music: "Tranquanto - Illuminated Fungal Grotto"
    },
    crystallized: {
        name: "Crystallized",
        desc: "A marble layer dense with shining minerals.",
        item: "marble",
        max: -600,
        min: -1000,
        geode: "limestone",
        lighting: {color: "#fff", intensity: 0.05},
        fog: 40,
        color: "#d6d6d6",
        music: "Tranquanto - Crystal Caverns (OST)"
    },
    volcanic: {
        name: "Volcanic",
        desc: "After crossing the bedrock, you find yourself in a hot layer made of volcanic rock.",
        item: "pumice",
        max: -1000,
        min: -1500,
        lighting: {color: "#f86", intensity: 0.2},
        fog: 60,
        fogColor: "#ff8800",
        color: "#bcb87e",
        music: "startijer - Magmatic Flumes (OST)"
    },
    electric: {
        name: "Electric",
        desc: "A layer buzzing with electricity.",
        item: "ignimbrite",
        max: -1500,
        min: -2000,
        lighting: {color: "#ff9", intensity: 0.3},
        fog: 40,
        fogColor: "#aaaa00"
    },
    irradiated: {
        name: "Irradiated",
        desc: "A dangerous radioactive layer.",
        item: "carnotite",
        max: -2000,
        min: -2500,
        lighting: {color: "#cf8", intensity: 0.22},
        fog: 70,
        fogColor: "#784",
        music: "Tranquanto - Irradiated (OST)"
    },
    nuclear: {
        name: "Nuclear",
        desc: "An extremely radioactive layer.",
        item: "pitchblende",
        max: -2500,
        min: -3000,
        lighting: {color: "#8f8", intensity: 0.25},
        fog: 80,
        fogColor: "#6a6",
        music: "Tranquanto - Nuclear Abyss (OST)"
    },
    hell: {
        name: "Underworld",
        desc: "oopsie poopsie you dug a little too deep",
        item: "bloodstone",
        max: -3000,
        min: -3500,
        lighting: {color: "#f66", intensity: 0.3},
        fog: 50,
        fogColor: "#ff0000",
        music: "Tranquanto - The Underworld (OST)"
    },
    intertemperate: {
        name: "Intertemperate",
        desc: "A suspiciously peaceful layer after the hottest.",
        item: "pegmatite",
        max: -3500,
        min: -4000,
        lighting: {color: "#ffa", intensity: 0.3},
        fog: 120,
        fogColor: "#8b8b7e",
        music: "Tranquanto - Intertemperate (OST)",
        caveNoise(x, y, z, CAVE_SIZE) {
            return this.perlinNoise.noise(
                x / CAVE_SIZE + Math.sin(x / CAVE_SIZE / 3 + this.xOffset) * 4,
                y / CAVE_SIZE + Math.sin(y / CAVE_SIZE / 3 + this.yOffset) * 4,
                z / CAVE_SIZE + Math.sin(z / CAVE_SIZE / 3 + this.zOffset) * 4
            );
        }
    },
    frozen: {
        name: "Frozen",
        desc: "You find yourself in a frigid layer of ice and permafrost.",
        item: "ice",
        max: -4000,
        min: -5000,
        lighting: {color: "#8af", intensity: 0.2},
        fog: 40,
        fogColor: "#88aaff",
        music: "Tranquanto - Icy Peaks"
    },
    marine: {
        name: "Marine",
        desc: "After escaping the void, you plunge into a layer of water.",
        item: "basalt",
        max: -5000,
        min: -6000,
        lighting: {color: "#88f", intensity: 0.25},
        fog: 40,
        fogColor: "#0000ff",
        music: "Tranquanto - The Seafloor (OST)",
        tick(x, y, z) {
            vars.particleQueue.push({
                x: x + Math.random() * 20 - 10,
                y: y - 15,
                z: z + Math.random() * 20 - 10,
                size: Math.random() * 0.2 + 0.1,
                texture: "bubble",
                velocity: {
                    x: Math.random() - 0.5,
                    y: Math.random() + 6,
                    z: Math.random() - 0.5
                },
                tick(particle) {
                    if (particle.points.position.y > y + 10) {
                        return true;
                    }
                }
            });
        }
    },
    jungle: {
        name: "Jungle",
        desc: "A lush paradise is growing underneath the ocean.",
        item: "mud",
        max: -6000,
        min: -7000,
        lighting: {color: "#e7b790", intensity: 0.8},
        fog: 80,
        fogColor: "#7a451a",
        caveRules: {
            noDripstone: true // no dripstone in jungle caves
        },
        music: "Tranquanto - Jungle Exploration (OST)",
        tick(x, y, z) {
            vars.particleQueue.push({
                x: x + Math.random() * 30 - 15,
                y: Math.random() * 10 + y,
                z: z + Math.random() * 30 - 15,
                size: Math.random() * 0.07 + 0.02,
                texture: "pixel",
                color: 0,
                velocity: {
                    x: Math.random() * 6 - 3,
                    y: Math.random() * 3 - 3,
                    z: Math.random() * 6 - 3
                },
                tick(particle) {
                    if (particle.time > 4000) {
                        return true;
                    }
                }
            });
        }
    },
    asthenosphere: {
        name: "Asthenosphere",
        desc: "The upper mantle... it's getting very warm.",
        item: "mudstone",
        lighting: {color: "#e7b790", intensity: 0.28},
        fog: 15,
        fogColor: "#cb5710",
        max: -7000,
        min: -8000,
        bloom: {
            threshold: 0.24
        },
        music: "Tranquanto - Asthenosphere (OST)"
    },
    mantle: {
        name: "Mantle",
        desc: "A layer full of molten rock.",
        item: "mantle",
        lighting: {color: "#ffbc92", intensity: 0.6},
        fog: 25,
        fogColor: "#ff6000",
        max: -8000,
        min: -9000,
        bloom: {
            threshold: 0.3
        }
    },
    core: {
        name: "Core",
        desc: "Hot, molten rock and metal.",
        item: "magma",
        lighting: {color: "#ffbc92", intensity: 0.8},
        fog: 15,
        fogColor: "#ffaa00",
        max: -9000,
        min: -10000,
        bloom: {
            threshold: 1.8
        }
    },
    grid: {
        name: "Grid",
        desc: "A strange layer of perfectly straight lines. It feels... digital.",
        item: "steel",
        max: -11000,
        min: -12000,
        lighting: {color: "#fff", intensity: 0.1},
        fog: 50,
        fogColor: "#000",
        color: "#aaa",
        caveNoise: () => -1,
        chunks: "3d",
        chunkGenSpeed: 4,
        chunkRadius: 6,
        universalCondition(x, y, z) {
            const gridSize = 6;
            const gridThickness = 2;
            const inGridX = Math.floor(Math.abs(x) / gridSize) % 2 === 0 && Math.abs(x) % gridSize < gridThickness;
            const inGridY = Math.floor(Math.abs(y) / gridSize) % 2 === 0 && Math.abs(y) % gridSize < gridThickness;
            const inGridZ = Math.floor(Math.abs(z) / gridSize) % 2 === 0 && Math.abs(z) % gridSize < gridThickness;
            return inGridX && inGridY || inGridX && inGridZ || inGridY && inGridZ; // makes a 3D grid pattern
        }
    },
    cyberspace: {
        name: "Cyberspace",
        desc: "A weird computerized layer.",
        item: "retrock",
        max: -12000,
        min: -13000,
        lighting: {color: "#fff", intensity: 0.3},
        fog: Infinity,
        fogColor: "#000",
        color: "#0f0",
        hue: 0,
        bloom: {
            radius: -0.5,
            strength: 0.3,
            threshold: 0
        },
        caveRules: {
            noDripstone: true,
            noCrystals: true
        },
        music: "Tranquanto - Cyberspace (OST)",
        /* tick() {
            vars.canvasFilter.hueRotate++;
        },
        onExit() {
            vars.canvasFilter.hueRotate = 0;
        }, */
        /* caveNoise(x, y, z, size) {
            // return x % 20 > 0 && y % 20 > 0 && z % 20 > 0;
            return x % 6 > 2 && y % 6 > 2 && z % 1000 > 0;
        } */
    },
    interstellar: {
        name: "Interstellar",
        desc: "experimental",
        item: "darkmatter",
        max: -13000,
        min: -15000,
        lighting: {color: "#88f", intensity: 0.3},
        fog: 90,
        fogColor: "#000022"
    },
    mystical: {
        name: "Mystical",
        desc: "A magical layer of strange phenomena.",
        item: "fairyDust",
        lighting: {color: "#ddabff", intensity: 0.4},
        fog: 45,
        fogColor: "#4b007c",
        max: -15000,
        min: -16000,
        bloom: {
            strength: 0.5,
            threshold: 1.5,
            radius: -0.4
        }
    },
    basement: {
        name: "Basement",
        desc: "wha?",
        item: "carpet",
        max: -49000,
        min: -50000,
        lighting: {color: "#ffa", intensity: 0.5},
        fog: 35,
        fogColor: "#ad9850",
        bloom: {
            threshold: 1.5,
            strength: 0.3
        },
        caveNoise(x, y, z, size, seed1 = seed) {
            return -y % 6 > 2 ? 0 : (Math.seedrandom(Math.floor(x / 3) * Math.SQRT2 + Math.floor(-y / 3) * Math.sqrt(3) + Math.floor(z / 3) * Math.sqrt(5) + seed1 / 150000)() / 2 + layers.basement.perlin.noise(Math.floor(x / 3) / size * 3, Math.floor(-y / 3) / size * 3, Math.floor(z / 3) / size * 3) / 2 + 0.2);
        },
        caveReq: 0.5,
        caveRules: {
            noDripstone: true,
            noCrystals: true
        }
    },
    void: {
        name: "Void",
        desc: "A layer of emptiness. Even colder than the frozen layer.",
        item: "voidstone",
        max: -10000,
        min: -50000,
        lighting: {color: "#777", intensity: 0.1},
        fog: 90,
        fogColor: "#000000",
        music: "Tranquanto - Emptiness (OST)"
    },
    purgatory: {
        name: "Purgatory",
        desc: "A limbo between life and death.",
        item: "question",
        max: -50000,
        min: -Infinity,
        lighting: {color: "#000", intensity: 0, cameraLightIntensity: 0},
        fog: 1000,
        fogColor: "#000000",
        music: "---",
        directionalLight: {
            str: 1,
            pos: {x: 0, y: 1, z: 0}
        },
        caveRules: {
            noDripstone: true
        },
        onEnter() {
            const directionalLight2 = new THREE.DirectionalLight(0xffffff, 1);
            directionalLight2.position.set(0, -1, 0);
            this.directionalLight2 = directionalLight2;
            vars.scene.add(directionalLight2);

            const directionalLight3 = new THREE.DirectionalLight(0xff0000, 0.5);
            directionalLight3.position.set(1, 0, 0);
            this.directionalLight3 = directionalLight3;
            vars.scene.add(directionalLight3);
        },
        onExit() {
            vars.scene.remove(this.directionalLight2);
            vars.scene.remove(this.directionalLight3);
        },
        tick() {
            this.directionalLight3.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.1);
            vars.directionalLight.intensity = this.directionalLight2.intensity = Math.random() ** 0.1;
        }
    },
};

const biomes = {
    rainy: {
        name: "Rainy",
        desc: "It's raining.",
        maxY: 1000,
        minY: -10,
        requirement(x, y, z) {
            return getBiomeNumber(x, Math.max(y, 250), z, "rainy") >= 0.4 && getBiomeNumber(x, Math.max(y, 250), z, "rainy") < 0.7 && getTemperature(x, y, z) > 0 && getLayer(y, x, z, false) !== "subsurface";
        },
        modifier(n, x, y, z) {
            const hum = getHumidity(x, y, z);
            return n / 2 + hum / 2;
        },
        lighting: {color: "#bdf", intensity: 0.5},
        fog: 36,
        fogColor: "#556177",
        nightFogColor: "#262c35",
        bloom: {
            strength: 0.5,
            threshold: 0.8
        },
        geode: layers.sky.geode,
        caveRules: layers.surface.caveRules,
        music: "Tranquanto - Blighted Pond",
        tick(x, y, z) {
            for (let i = 0; i < 10; i++) {
                vars.particleQueue.push({
                    x: x + Math.random() * 20 - 10,
                    y: y + 25,
                    z: z + Math.random() * 20 - 10,
                    size: Math.random() * 0.2 + 0.1,
                    texture: "raindrop",
                    velocity: {
                        x: Math.random() - 0.5,
                        y: Math.random() * 2 - 20,
                        z: Math.random() - 0.5
                    },
                    tick(particle) {
                        if (particle.points.position.y < y - 10) {
                            return true;
                        }
                    }
                });
            }
        }
    },
    stormy: {
        name: "Stormy",
        desc: "A lightning storm.",
        maxY: 1000,
        minY: -10,
        requirement(x, y, z) {
            return getBiomeNumber(x, Math.max(y, 250), z, "rainy") >= 0.7 && getTemperature(x, y, z) > 0 && getLayer(y, x, z, false) !== "subsurface";
        },
        lighting: {color: "#bdf", intensity: 0.3},
        seed: "rainy", // uses the same seed as rainy biome
        fog: 32,
        fogColor: "#2d2d2d",
        geode: layers.sky.geode,
        caveRules: layers.surface.caveRules,
        bloom: {
            strength: 0.5,
            threshold: 0.8
        },
        music: "Tranquanto - Thunderstorm (OST)",
        lastLightning: 0,
        stormTick() {
            const zap = (brightness, iteration) => {
                this.lastLightning = Date.now();
                vars.setFogColor(new THREE.Color(this.fogColor).lerp(new THREE.Color(0xbadaff), brightness));
                vars.directionalLight.intensity = (brightness * 4) ** 2;
                vars.directionalLight.position.set(Math.random(), Math.random(), Math.random()).normalize().multiplyScalar(1000);
                setTimeout(() => {
                    vars.setFogColor(this.fogColor);
                    vars.directionalLight.intensity = 0;
                }, 50);
                if (iteration === 0) {
                    const audio = new Audio(Math.random() > 0.5 ? "audio/thunder.mp3" : "audio/thunder-2.mp3");
                    audio.volume = brightness * 0.5;
                    audio.playbackRate = Math.random() * 0.4 + 0.8;
                    audio.play().catch(() => {
                        console.warn("Failed to play thunder sound");
                    });
                }
                if (iteration < 1 && brightness > 0.3) {
                    setTimeout(() => {
                        zap(brightness * Math.random() * 0.7, iteration + 1);
                    }, Math.random() * 400 + 200);
                }
            }
            if (Math.random() < 0.003 && Date.now() - this.lastLightning > 3000) {
                zap(Math.random() * 0.6 + 0.4, 0);
            }
        }
    },
    snowy: {
        name: "Snowy",
        desc: "A frozen rain.",
        maxY: 1000,
        minY: -10,
        requirement(x, y, z) {
            return getBiomeNumber(x, Math.max(y, 250), z, "rainy") >= 0.4 && getBiomeNumber(x, Math.max(y, 250), z, "rainy") < 0.7 && getTemperature(x, y, z) < 0 && getLayer(y, x, z, false) !== "subsurface";
        },
        lighting: {color: "#fff", intensity: 0.5},
        fog: 50,
        fogColor: "#ffffff",
        nightFogColor: "#575757", // fog color at night
        music: "Tranquanto - December's Greetings",
        tick(x, y, z, c = 1) {
            // Snow particles
            for (let i = 0; i < c; i++)
                vars.particleQueue.push({
                    x: x + Math.random() * 20 - 10,
                    y: y + 15,
                    z: z + Math.random() * 20 - 10,
                    size: Math.random() * 0.2 + 0.1,
                    texture: "snowflake",
                    velocity: {
                        x: (Math.random() - 0.5),
                        y: (Math.random() * 0.2 - 3),
                        z: (Math.random() - 0.5)
                    },
                    tick(particle) {
                        if (particle.points.position.y < y - 10) {
                            return true;
                        }
                    }
                });
        },
        bloom: {
            threshold: 1
        }
    },
    blizzard: {
        name: "Blizzard",
        desc: "A frozen storm.",
        maxY: 1000,
        minY: -10,
        requirement(x, y, z) {
            return getBiomeNumber(x, Math.max(y, 250), z, "rainy") >= 0.7 && getTemperature(x, y, z) < 0 && getLayer(y, x, z, false) !== "subsurface";
        },
        lighting: {color: "#fff", intensity: 0.3},
        fog: 60,
        fogColor: "#a1a1a1",
        nightFogColor: "#575757",
        music: "Tranquanto - Blizzard (OST)",
        bloom: {
            strength: 0.5,
            threshold: 0.8
        }
    },
    desert: {
        name: "Desert",
        desc: "A hot, dry biome.",
        maxY: 250,
        minY: -10,
        staticY: true,
        surfaceBiome: true,
        requirement(x, y, z) {
            return getBiomeNumber(x, 1, z, "desert") >= 0.4 && (y >= 0 || layers.surface.requirement(x, y, z));
        },
        threshold: 0.4,
        modifier(n, x, y, z) {
            const hum = getHumidity(x, y, z);
            return (n + 0.2 - 3 * hum) / 4 - 0.05;
        },
        bloom: {
            threshold: 1.2
        },
        fogColor: "#ffe4b5",
        music: "startijer - Waltz of the Onyx (OST)",
        size: 200
    },
    autumnal: {
        name: "Autumnal",
        desc: "A biome of autumn colors.",
        maxY: 250,
        minY: -10,
        staticY: true, // doesn't change with height
        surfaceBiome: true,
        requirement(x, y, z) {
            return getBiomeNumber(x, 1, z, "autumnal") >= 0.2 && layers.surface.requirement(x, y, z);
        },
        threshold: 0.2,
        fogColor: "#f2b27d",
        music: "Tranquanto - Pumpkin Patch",
        size: 250 // default is 80
    },
    clay: {
        name: "Fossilized",
        desc: "A biome of clay.",
        maxY: -1,
        minY: -10,
        requirement() {
            return false;
        },
        threshold: 0.6,
        lighting: {color: "#fff", intensity: 0.4},
        fog: 1000,
        fogColor: layers.surface.fogColor,
        size: 25
    },
    dirt: {
        name: "Dirt",
        size: 15,
        maxY: minHeight,
        minY: -1000,
        requirement() {
            return false;
        },
        modifier(n, _x, y, _z) {
            return y < -900 ? n * (y / 100 + 10) : n;
        },
        threshold: 2, // never spawns; intended to be avoided in checkAllBiomes
        lighting: {color: "#fff", intensity: 0.4},
        fog: 1000,
        fogColor: layers.surface.fogColor
    },
    subzero: {
        name: "Subzero",
        desc: "An extremely cold biome.",
        maxY: -4000,
        minY: -5000,
        requirement(x, y, z) {
            return getBiomeNumber(x, y, z, "subzero") >= 0.4;
        },
        lighting: {color: "#acf", intensity: 0.2},
        fog: 40,
        fogColor: "#aaccff",
        music: "Tranquanto - Frostburn Facility (Remix)",
        bloom: {
            threshold: 0.7
        }
    },
    hive: {
        name: "Hive",
        desc: "A beehive.",
        maxY: -6000,
        minY: -7000,
        requirement(x, y, z) {
            return getBiomeNumber(x, y, z, "hive") >= 0.5;
        },
        lighting: {color: "#ffb", intensity: 0.6, cameraLightIntensity: 1.1},
        bloom: {
            threshold: 1.8
        },
        fog: 30,
        fogColor: "#665500",
        music: "Tranquanto - The Hive (OST)"
    },
    error: {
        name: "null",
        desc: "ERROR",
        maxY: -10000,
        minY: -11000,
        requirement(x, y, z) {
            return getBiomeNumber(x, y, z, "error") >= 0.4;
        },
        lighting: {color: "#88f", intensity: 0.3},
        fog: 50,
        fogColor: "#0000ff",
        music: "Tranquanto - Error"
    }
};

export function resetSeed(seed) {
    layers.intertemperate.perlinNoise = new PerlinNoise(seed + Math.sqrt(11));
    layers.intertemperate.xOffset = rand01(0, 0, 0, seed + Math.sqrt(13));
    layers.intertemperate.yOffset = rand01(0, 0, 1, seed + Math.sqrt(13));
    layers.intertemperate.zOffset = rand01(0, 0, 2, seed + Math.sqrt(13));

    layers.basement.perlin = new PerlinNoise(seed + Math.sqrt(7));
}
resetSeed(seed);

for (const l in layers) layers[l].id = l;
for (const b in biomes) biomes[b].id = b;

export const layerArray = Array.from(Object.keys(layers), k => layers[k]);
export const biomeArray = Array.from(Object.keys(biomes), k => biomes[k]);

const layerCache = {};
export function getLayer(y, x, z, includeBiomes = true) {
    if (includeBiomes)
        for (let i = 0; i < biomeArray.length; i++) {
            const biome = biomeArray[i];
            if (y < biome.maxY && y >= biome.minY && biome.requirement(x, y, z)) {
                return biome.id;
            }
        }
    if (layerCache[y] !== undefined) return layerCache[y];
    for (let i = 0; i < layerArray.length; i++) {
        const layer = layerArray[i];
        if ((y < 0 ? y < layer.max : y <= layer.max) && (y >= 0 ? y > layer.min : y >= layer.min)) {
            if (layer.requirement) {
                if (layer.requirement(x, y, z)) {
                    return layer.id;
                }
            } else {
                layerCache[y] = layer.id;
                return layer.id;
            }
        }
    }
    return "surface";
}

let cachedTemperatures = {};
export function getTemperature(x, _y, z) {
    x = Math.round(x);
    z = Math.round(z);
    if (cachedTemperatures[`${x},${_y},${z}`] !== undefined) {
        return cachedTemperatures[`${x},${_y},${z}`];
    }
    // returns a temperature value between -1 and 1
    // -1 = coldest, 0 = neutral, 1 = hottest
    const TEMPERATURE_INTERVAL = BIOME_INTERVAL * 12;
    const month = new Date().getMonth() + new Date().getDate() / 30.3;
    let y2 = 0;
    let baseTemp = (temperatureNoise.noise(x / TEMPERATURE_INTERVAL, y2 / TEMPERATURE_INTERVAL, z / TEMPERATURE_INTERVAL) / 2 - Math.cos(Math.PI * month / 5.5) / 2) * 40 + 10;

    return cachedTemperatures[`${x},${_y},${z}`] = baseTemp;
}

export function getHumidity(x, _y, z) {
    x = Math.round(x);
    z = Math.round(z);
    // returns a humidity value between -1 and 1
    // -1 = dry, 0 = neutral, 1 = wet
    const TEMPERATURE_INTERVAL = BIOME_INTERVAL * 11;
    let y2 = 0;
    let base = humidityNoise.noise(x / TEMPERATURE_INTERVAL, y2 / TEMPERATURE_INTERVAL, z / TEMPERATURE_INTERVAL) * 1.35;

    base = Math.min(1, Math.max(-1, base));

    return base;
}

let cachedBiomeNumbers = {};
export function getBiomeNumber(x, y, z, biome, useMod = true) {
    x = Math.round(x);
    y = Math.round(y);
    z = Math.round(z);
    if (!biome) biome = Object.keys(biomes).filter(b => !biomes[b].seed)[0];
    if (!biomes[biome]) {
        return 0;
    }
    
    if (!cachedBiomeNumbers[biome]) cachedBiomeNumbers[biome] = {};
    if (cachedBiomeNumbers[biome][`${x},${y},${z}`] !== undefined) {
        return cachedBiomeNumbers[biome][`${x},${y},${z}`];
    }
    
    if (biomes[biome].staticY) y = 1;

    const biomeInterval = biomes[biome].size || BIOME_INTERVAL;

    const noise = biomes[biome].noise;
    const val = noise.noise(x / biomeInterval, y / biomeInterval, z / biomeInterval);
    return cachedBiomeNumbers[biome][`${x},${y},${z}`] = useMod && biomes[biome].modifier ? biomes[biome].modifier(val, x, y, z) : val;
}

export { layers, biomes };