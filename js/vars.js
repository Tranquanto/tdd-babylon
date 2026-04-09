import { seed, caveNoise, caveNoiseSmall, CAVE_SIZE, MIN_CAVE_REQ } from "./perlin.js";
import { deathMessages } from "./content/deathMessages.js";

const vars = {
    version: "0.7.0.5a",
    lastUpdate: 1772404520, // unix timestamp of last major update. the user cannot play for 20 minutes after this time
    RARE_ORE_CHANCE_MULTIPLIER: 1,
    RARE_ORE_CHANCE_MULTIPLIER_CUTOFF: 1 / 1e4,
    itemMultiplier: 1,
    fly: false,
    player: {
        /** @type {BABYLON.Vector3} */
        position: {x: 0, y: 6, z: 0},
        moveSpeed: 0.1,
        baseMoveSpeed: 0.1,
        velocity: {x: 0, y: 0, z: 0},
        lastVelocity: {x: 0, y: 0, z: 0},
        stepHeight: 0.5,
        nightVision: false,
        health: 100,
        radiation: 0,
        godMode: new URLSearchParams(location.search).has("godmode"),
        /**
         * Applies damage to the player, with a cooldown to prevent multiple hits in a short time. If health drops to 0 or below, the player dies and an alert is displayed.
         * @param {number} amount Amount of damage
         * @param {number} cooldown Delay in milliseconds before the next hit is allowed
         * @param {string} source Source of damage
         * @param {boolean} force If true, bypasses the cooldown and applies damage immediately
         * @param {boolean} vignette If true, shows a red vignette effect on damage (defaults to true)
         * @param {Object} shake Shake parameters (intensity, duration), or false to disable shake (defaults to {intensity: 0.04, duration: 200})
         */
        damage(amount, cooldown, source, force, vignette = true, shake = {intensity: 0.04, duration: 200}) {
            if (amount === 0 || this.godMode) return;
            if (shake) vars.camera.shake(shake.intensity, shake.duration);
            if (this.lastHit + cooldown > performance.now() && !force) return;
            if (cooldown) this.lastHit = performance.now();
            else this.lastHit = -Infinity;
            this.health -= amount;

            if (vignette) {
                const newElem = document.getElementById("damageVignette").cloneNode();
                document.getElementById("damageVignette").parentElement.replaceChild(newElem, document.getElementById("damageVignette"));
                newElem.style.animation = "damageVignetteAnim 0.2s";
            }

            if (this.health <= 0) {
                this.dead = true;
                this.health = 0;
                
                if (deathMessages[source]) {
                    const msg = typeof deathMessages[source] === "function" ? deathMessages[source](vars.username) : Array.isArray(deathMessages[source]) ? deathMessages[source][Math.floor(Math.random() * deathMessages[source].length)] : deathMessages[source];
                    displayAlert(msg.replaceAll("%s", vars.username), "#f44", 5000);
                } else {
                    displayAlert(`${vars.username} died (source: ${source})`, "#f44", 5000);
                }
            }
        }
    },
    camera: {
        playerOffset: {x: 0, y: 0.9, z: 0},
        offset: {x: 0, y: 0, z: 0}, // intended for camera shake and similar effects
        shakeIntensity: 0, // max vector length from original position (updates per frame)
        /**
         * Shakes the camera with a given intensity and duration.
         * @param {number} intensity Intensity of shake (in block units)
         * @param {number} duration Decay time in milliseconds
         */
        shake(intensity, duration) {
            this.shakeIntensity = intensity;
            this.shakeStartTime = performance.now();
            this.shakeDuration = duration;

            clearInterval(this.shakeInterval);
            this.shakeInterval = setInterval(() => {
                this.shakeIntensity = intensity * (1 - (performance.now() - this.shakeStartTime) / this.shakeDuration);
                if (performance.now() - this.shakeStartTime >= this.shakeDuration) {
                    this.shakeIntensity = 0;
                    clearInterval(this.shakeInterval);
                }
            }, 16);
        }
    },
    settings: {
        sensitivity: Number(localStorage.getItem("sensitivity") || 1),
        music: Number(localStorage.getItem("music") || 0.25),
        oreSound: Number(localStorage.getItem("oreSound") || 1),
        maxLights: Number(localStorage.getItem("maxLights") || 10),
        resolutionScale: Number(localStorage.getItem("resolutionScale") || 1),
        shadowMapSize: Number(localStorage.getItem("shadowMapSize") || 2048)
    },
    stats: {
        update() {
            localStorage.setItem("tdd-stats", JSON.stringify(vars.stats));
        },
        totalOresMined: 0,
        lowestRNG: 0, // rarest find (1 in X chance)
        lowestOreRNG: 0, // rarest ore find (1 in X chance; excludes veins, geodes, and the like)
        oresMined: {}, // oreID: count
        itemsUsed: {}, // itemID: count
        toolsUsed: {}, // toolID: count (this is for blocks broken with that item, but still functionally the same as itemsUsed (i.e., any item can be used as a tool))
        cavesGenerated: 0,
        totalCaveVolume: 0,
        layersVisited: {},
        largestVein: 0,
        largestGeode: 0,
        dailyStreak: 0,
        maxDailyStreak: 0,
        totalPlaytime: 0
    },
    currentDate: Math.floor(Date.now() / 86400000) - Math.floor(new Date(2025, 0, 0) / 86400000),
    startActiveTime: performance.now(),
    startIdleTime: performance.now(),
    overlays: [],
    globalTickFuncs: [],
    oreTicks: [],
    particleQueue: [],
    particles: [],
    removalQueue: [],
    spawnQueue: [],
    structureQueue: [],
    matricesToUpdate: new Set(),
    cameras: [],
    seed,
    PAUSED: true,
    hasPlayed: false,
    ambientLightIntensity: 0.4,
    caveNoise,
    caveNoiseSmall,
    CAVE_SIZE,
    MIN_CAVE_REQ,
    lightRayRotation: 0.1,
    setFogColor() {} // will be set after scripts load
};
export default vars;