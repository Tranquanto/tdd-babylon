"use strict";

import vars from "./vars.js";
import { getOre, map, oreAt, airAt, checkAdjacent, calculatePower, calculateRarity, chunks, getBGOre, breakMap, saveMap, interacted, setInteracted } from "./noise-utilities.js";
import { getLayer, items, layers, locations, oreArray, ores, structureArray, structures, tiers, traits, sfxOptions, achievementArray } from "./content/items.js";
import { biomes, getBiomeNumber, getHumidity, getTemperature, topLayer } from "./content/layers.js";
import { isCave, CHUNK3_RATE, CHUNK_SIZE_3, CHUNK_SIZE, noise, isCaveFloor, isCaveCeiling, caveFloorAdjacent, caveWallAdjacent, caveCeilingAdjacent } from "./noise.js";
import { inventory, toggleInventory, unlockAchievement } from "./inventory.js";
import { rand01 } from "./perlin.js";
import { getColor } from "./getColor.js";
import { oreParticles } from "./content/oreParticles.js";
import { VoxelMap, k } from "./VoxelMap.js";

const { player, stats, camera } = vars;

const canvas = getElementById("canvas");

const textures = {}, animatedCanvases = [];
const meshes = {}, meshesNeedingUpdate = new Set();
const audios = [];
const meshCounts = {};
const MAX_MESH_COUNT = 1024, MESH_CHUNK_SIZE = 128;
let STARTED = true;
let LAST_FRAME = performance.now(); // for FPS calculation
let FRAME_TIME = 0;
let LAST_FRAME_TIME = 0;
let MINING = false;
let LAST_ORE = [], CURRENT_ORE = [];
let CURRENT_LAYER, INITIALIZED_LAYER = false;
let generatingChunks = [], generatingChunks3 = [], generatedChunks = new Set(), GENERATION_DISTANCE = 64;
let generatedStructures = {};
let lightArr = [], repairArr = [], repairObj = {}, lightKeys = {};
let USE_THIN_INSTANCES = true;
let totalOres = 0;
let GUI_HIDDEN = false;
let savesDisabled = false;
let lastShadowUpdate = performance.now();

let radiationMap = new VoxelMap(null, {regionSize: 16});

let particleSystemID = 0, veinID = 0, geodeID = 0;

const VEIN_CHANCE = 1 / 150, GEODE_CHANCE = 1 / 2000;

// set up scene and camera
const engine = 
// navigator.gpu ? new BABYLON.WebGPUEngine(canvas, {antialias: true}, {useLargeWorldRendering: true}) :
new BABYLON.Engine(canvas, true, {useLargeWorldRendering: true});
if (engine.initAsync !== undefined) await engine.initAsync();
const scene = new BABYLON.Scene(engine);
let perspectiveCamera = new BABYLON.UniversalCamera("camera1", new BABYLON.Vector3(0, 2, 0), scene);
perspectiveCamera.maxZ = 1000;
perspectiveCamera.minZ = 0.1;
perspectiveCamera.fov = 1.2;
scene.fogEnabled = true;
scene.fogDensity = 0.01;
scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
scene.useRightHandedSystem = true;
scene.setRenderingAutoClearDepthStencil(1, false);

// vr :eyes:
let vrEnabled = true;
try {
    const xr = await scene.createDefaultXRExperienceAsync({disableTeleportation: true, disableDefaultUI: true});
    xr.baseExperience.onStateChangedObservable.add(e => {
        console.log(e);
    });
    vars.xr = xr;
    vars.xrHelper = xr.baseExperience;
} catch (e) {
    vrEnabled = false;
    console.log("WebXR not detected.");
}

if (vrEnabled) {
    console.log("WebXR has been detected and enabled!");
}

vars.scene = scene;
vars.perspectiveCamera = perspectiveCamera;

/** @type {BABYLON.WebXRDefaultExperience} */
const xr = vars.xr;
const xrHelper = xr.baseExperience;

const raycaster = new BABYLON.Ray(new BABYLON.Vector3(), new BABYLON.Vector3());
raycaster.length = 1000;

// rendering pipeline
const pipeline = new BABYLON.DefaultRenderingPipeline("pipeline", false, scene, [perspectiveCamera]);
pipeline.bloomEnabled = true;
pipeline.bloomWeight = 0.2;
pipeline.fxaaEnabled = true;
pipeline.fxaa.samples = 4;

// ambient occlusion
const ssao = new BABYLON.SSAO2RenderingPipeline("ssao", scene, 0.75, [perspectiveCamera]);
ssao.radius = 1;
ssao.samples = 16;
ssao.maxZ = 8;
window.ssao = ssao;

// glow
const glow = new BABYLON.GlowLayer("glow", scene);
glow.intensity = 0.3;
glow.customEmissiveColorSelector = (mesh, _subMesh, material, result) => {
    if (mesh.name === "sun") {
        result.set(0, 0, 0, 0); // separate glow
    } else {
        // use emissive color for glow
        result.set(material.emissiveColor.r, material.emissiveColor.g, material.emissiveColor.b, 1);
        result.a *= (mesh.visibility ?? 1) * (material.alpha ?? 1);
    }
}

const sunGlow = new BABYLON.GlowLayer("sunGlow", scene);
sunGlow.intensity = 1;
sunGlow.customEmissiveColorSelector = (mesh, _subMesh, _material, result) => {
    if (mesh.name !== "sun") {
        result.set(0, 0, 0, 0);
    } else {
        result.set(1, 2 * Math.sin(getTime()) + 0.25, 0.8 * Math.sin(getTime()), 1);
    }
}

let geigerAudio = new Audio("audio/geiger.mp3");
geigerAudio.volume = 0.15;

export function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    engine.resize(true);
    engine.setSize(window.innerWidth * vars.settings.resolutionScale, window.innerHeight * vars.settings.resolutionScale);
}

window.addEventListener("resize", resize);
resize();

// movement
const keys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false
};

// mouse controls
canvas.addEventListener("click", () => {
    canvas.requestPointerLock({unadjustedMovement: true});
});
canvas.addEventListener("mousemove", e => {
    vars.startIdleTime = performance.now();
    if (document.pointerLockElement === canvas) {
        perspectiveCamera.rotation.y += e.movementX * -0.0015 * vars.settings.sensitivity;
        perspectiveCamera.rotation.x += e.movementY * 0.0015 * vars.settings.sensitivity;
    }
    perspectiveCamera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, perspectiveCamera.rotation.x));
    fixRotation();
});
canvas.addEventListener("wheel", e => {
    if (document.pointerLockElement === canvas) {
        if (e.deltaY > 0) {
            inventory.selectHotbarSlot((inventory.SELECTED_HOTBAR + 1) % 10);
        } else if (e.deltaY < 0) {
            inventory.selectHotbarSlot((inventory.SELECTED_HOTBAR + 9) % 10);
        }
    }
});

// touch controls
function prevent(e) {
    vars.startIdleTime = performance.now();
}

document.addEventListener("touchstart", prevent);
document.addEventListener("touchmove", prevent);
document.addEventListener("touchend", prevent);
document.addEventListener("touchcancel", prevent);

getElementById("dpad-up").addEventListener("touchstart", e => {
    e.preventDefault();
    keys.forward = true;
});
getElementById("dpad-up").addEventListener("touchend", e => {
    e.preventDefault();
    keys.forward = false;
});
getElementById("dpad-down").addEventListener("touchstart", e => {
    e.preventDefault();
    keys.backward = true;
});
getElementById("dpad-down").addEventListener("touchend", e => {
    e.preventDefault();
    keys.backward = false;
});
getElementById("dpad-left").addEventListener("touchstart", e => {
    e.preventDefault();
    keys.left = true;
});
getElementById("dpad-left").addEventListener("touchend", e => {
    e.preventDefault();
    keys.left = false;
});
getElementById("dpad-right").addEventListener("touchstart", e => {
    e.preventDefault();
    keys.right = true;
});
getElementById("dpad-right").addEventListener("touchend", e => {
    e.preventDefault();
    keys.right = false;
});
getElementById("dpad-jump").addEventListener("touchstart", e => {
    e.preventDefault();
    keys.jump = true;
});
getElementById("dpad-jump").addEventListener("touchend", e => {
    e.preventDefault();
    keys.jump = false;
});
getElementById("pause-button").addEventListener("click", () => {
    pause();
});
getElementById("dpad-inventory").addEventListener("click", () => {
    toggleInventory();
});

function setupTouchControls() {
    let MINING_FINGER = -1;
    let MINING_TIMEOUT;
    let MINING_TIMEOUT_ACTIVE = false;

    let totalTouchMove = 0;
    let lastTouchX = 0;
    let lastTouchY = 0;
    let cameraRotation = new BABYLON.Vector3();
    canvas.addEventListener("touchstart", e => {
        for (let i = 0; i < e.touches.length; i++) {
            const touch = e.touches[i];
            if (touch.target.id !== "canvas") continue;
            lastTouchX = touch.clientX;
            lastTouchY = touch.clientY;
            
            totalTouchMove = 0;
            MINING_TIMEOUT = setTimeout(() => {
                if (!MINING) {
                    MINING = true;
                    vars.miningStartTime = performance.now();
                    MINING_FINGER = touch.identifier;
                }
            }, Math.max(inventory.currentPickaxe.delay * 1000, 200));
            MINING_TIMEOUT_ACTIVE = true;
            break;
        }

        getElementById("dpad").style.display = "";
        closeGUIs();
    });

    canvas.addEventListener("touchmove", e => {
        if (e.touches.length > 0) {
            for (let i = 0; i < e.touches.length; i++) {
                const touch = e.touches[i];
                if (touch.target.id !== "canvas") continue;
                const touchX = touch.clientX;
                const touchY = touch.clientY;
                const deltaX = touchX - lastTouchX;
                const deltaY = touchY - lastTouchY;

                totalTouchMove += Math.sqrt(deltaX ** 2 + deltaY ** 2);
                if (totalTouchMove > 10) {
                    clearTimeout(MINING_TIMEOUT);
                    MINING_TIMEOUT_ACTIVE = false;
                }

                cameraRotation.y -= deltaX * 0.01 * (vars.sensitivity || 1);
                cameraRotation.x += deltaY * 0.01 * (vars.sensitivity || 1);
                cameraRotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cameraRotation.x));

                perspectiveCamera.rotation.copyFrom(cameraRotation);

                fixRotation();

                lastTouchX = touchX;
                lastTouchY = touchY;
                break;
            }
        }
    });

    canvas.addEventListener("touchend", e => {
        clearTimeout(MINING_TIMEOUT);
        if (MINING) {
            if (e.touches.length === 0 || !Array.from(e.touches).some(touch => touch.identifier === MINING_FINGER)) {
                MINING = false;
                const x = CURRENT_ORE[0], y = CURRENT_ORE[1], z = CURRENT_ORE[2];
                if (map.at(x, y, z) && oreAt(x, y, z)) {
                    if (vars.miningStartTime < performance.now()) map.at(x, y, z).progress = setProgress(x, y, z);
                }
                vars.miningStartTime = undefined;
                getElementById("mining-progress").style.display = "none";
                getElementById("miningTime").style.display = "none";
            }
        }
        if (MINING_TIMEOUT_ACTIVE) {
            e.preventDefault();
            rightClick();
        }
        MINING_TIMEOUT_ACTIVE = false;
    });
}

setupTouchControls();

function closeGUIs() {
    getElementById("big-gui").style.display = "none";
    getElementById("ore-wiki").style.display = "none";
    getElementById("large-inventory").style.display = "none";
    getElementById("ore-wiki-list").style.display = "none";
    getElementById("item-wiki-list").style.display = "none";
    getElementById("layer-wiki-list").style.display = "none";
    getElementById("biome-wiki-list").style.display = "none";
    getElementById("achievements-list").style.display = "none";
}

function fixRotation() {
    if (perspectiveCamera.rotation.x > Math.PI / 2 - 0.00001) {
        perspectiveCamera.rotation.x = Math.PI / 2 - 0.00001;
    } else if (perspectiveCamera.rotation.x < -Math.PI / 2 + 0.00001) {
        perspectiveCamera.rotation.x = -Math.PI / 2 + 0.00001;
    }
}

document.addEventListener("keydown", event => {
    vars.startIdleTime = performance.now();
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
        keys.forward = true;
        break;
        case 'ArrowDown':
        case 'KeyS':
        keys.backward = true;
        break;
        case 'ArrowLeft':
        case 'KeyA':
        keys.left = true;
        break;
        case 'ArrowRight':
        case 'KeyD':
        keys.right = true;
        break;
        case 'Space':
        keys.jump = true;
        break;
        case 'KeyE':
        toggleInventory();
        break;
        case 'Escape':
        if (getElementById("ore-wiki").style.display === "block") {
            getElementById("ore-wiki").style.display = "none";
        } else if (getElementById("big-gui").style.display === "block") {
            getElementById("big-gui").style.display = "none";
            getElementById("big-gui").style.width = "";
        } else if (getElementById("large-inventory").style.display === "block") {
            getElementById("large-inventory").style.display = "none";
        } else if (getElementById("indexes").style.display === "block") {
            getElementById("indexes").style.display = "none";
        } else if (getElementById("ore-wiki-list").style.display === "block") {
            getElementById("ore-wiki-list").style.display = "none";
        } else if (getElementById("item-wiki-list").style.display === "block") {
            getElementById("item-wiki-list").style.display = "none";
        } else if (getElementById("layer-wiki-list").style.display === "block") {
            getElementById("layer-wiki-list").style.display = "none";
        } else if (getElementById("biome-wiki-list").style.display === "block") {
            getElementById("biome-wiki-list").style.display = "none";
        } else if (getElementById("achievements-list").style.display === "block") {
            getElementById("achievements-list").style.display = "none";
        } else if (getElementById("equip-text").style.display === "") {
            getElementById("equip-text").style.display = "none";
            getElementById("large-inventory").style.display = "block";
            getElementById("hotbar").classList.remove("big");
            inventory.SELECTED_ITEM = null;
        } else if (getElementById("main-menu").style.display === "none" && getElementById("settings-menu").style.display === "none" && getElementById("play-menu").style.display === "none") {
            pause();
        } else if (STARTED && getElementById("menu-mask").style.display === "none") {
            getElementById("main-menu").style.display = "none";
            getElementById("logo-container").style.visibility = "hidden";
            getElementById("settings-menu").style.display = "none";
            getElementById("play-menu").style.display = "none";
            getElementById("bgm").play();
            vars.PAUSED = false;
            vars.hasPlayed = true;
        }
        getElementById("logo").style.animationDuration = "0s";
        getElementById("menu-mask").style.animationDuration = "0s";
        getElementById("logo").style.animationDelay = "0s";
        getElementById("menu-mask").style.display = "none";
        break;
        case 'F1':
        event.preventDefault();
        if (GUI_HIDDEN) {
            GUI_HIDDEN = false;
            getElementById("ui").style.visibility = "visible";
        } else {
            GUI_HIDDEN = true;
            getElementById("ui").style.visibility = "hidden";
        }
        break;
        case 'F2':
        if (location.origin.includes("localhost") || location.origin.includes("192.168.")) {
            eval(prompt("Enter code to execute:"));
        }
        break;
        case 'F3':
        event.preventDefault();
        if (getElementById("totalOres").style.display === "none") {
            getElementById("totalOres").style.display = "block";
        } else {
            getElementById("totalOres").style.display = "none";
        }
        break;
        case 'F4':
        event.preventDefault();
        console.log(`get time: ${totalGetTime}\ngen time: ${totalGenTime}\nratio: ${totalGetTime / totalGenTime}\ntotal gets: ${totalGets}\naverage get time: ${totalGets ? totalGetTime / totalGets : 0}\naverage gen time: ${totalGenTime / totalGens}\ntotal gens: ${totalGens}`);
        break;
        case 'F5':
        event.preventDefault();
        console.log(map.at(LAST_ORE[0], LAST_ORE[1], LAST_ORE[2]));
        break;
        case 'F12':
        // cheater achievement
        unlockAchievement("cheater");
        break;
        case 'KeyI':
        case 'KeyJ':
        if (event.ctrlKey && event.shiftKey) {
            unlockAchievement("cheater");
        }
        break;
    }
});
document.addEventListener('keyup', event => {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
        keys.forward = false;
        break;
        case 'ArrowDown':
        case 'KeyS':
        keys.backward = false;
        break;
        case 'ArrowLeft':
        case 'KeyA':
        keys.left = false;
        break;
        case 'ArrowRight':
        case 'KeyD':
        keys.right = false;
        break;
        case 'Space':
        keys.jump = false;
        break;
    }
});
canvas.addEventListener("mousedown", e => {
    getElementById("dpad").style.display = "none";
    vars.startIdleTime = performance.now();
    if (e.button === 0) {
        // mine the nearest block using the raycaster
        if (!MINING) {
            MINING = true;
            vars.miningStartTime = performance.now() + inventory.currentPickaxe.delay * 1000;
        }
    } else if (e.button === 2) {
        rightClick();
    }
});
canvas.addEventListener("mouseup", e => {
    if (e.button !== 0) return;
    // stop mining
    if (MINING) {
        const x = CURRENT_ORE[0], y = CURRENT_ORE[1], z = CURRENT_ORE[2];
        if (map.at(x, y, z) && oreAt(x, y, z)) {
            if (vars.miningStartTime < performance.now()) map.at(x, y, z).progress = (performance.now() - vars.miningStartTime) / (map.at(x, y, z).str * 1000) * calculatePower(x, y, z) + (map.at(x, y, z).progress || 0);
            setProgress(x, y, z, undefined, map.at(x, y, z).progress);
        }
    }
    
    vars.miningStartTime = undefined;
    getElementById("mining-progress").style.display = "none";
    getElementById("miningTime").style.display = "none";
    MINING = false;
    CURRENT_ORE = [];
});

addEventListener("beforeunload", () => {
    localStorage.setItem("tdd-lastPlayed", Date.now());
    if (!vars.hasPlayed && STARTED) {
        localStorage.setItem("tdd-changedMyMind", "true"); // secret achievement for opening the game and then leaving without doing anything
    }

    stats.totalPlaytime += (performance.now() - vars.sessionStart) / 1000;

    stats.update();

    let unlockedAchievements = [];
    for (let i = 0; i < achievementArray.length; i++) {
        if (achievementArray[i].unlocked) unlockedAchievements.push(achievementArray[i].id);
    }
    localStorage.setItem("tdd-unlockedAchievements", JSON.stringify(unlockedAchievements));

    if (!savesDisabled) localStorage.setItem(`tdd-saveMap`, JSON.stringify({save: interacted._obj, seed: vars.seed, position: {x: player.position.x, y: player.position.y, z: player.position.z}, rotation: perspectiveCamera.rotation}));
});

getElementById("bgm").volume = 0.25;

scene.ambientColor = new BABYLON.Color3(0.01, 0.01, 0.01);

const hemisphereLight = new BABYLON.HemisphericLight("hemisphereLight", new BABYLON.Vector3(0, 1, 0), scene);
const directionalLight = new BABYLON.DirectionalLight("directionalLight", new BABYLON.Vector3(-0.5, -2, -1).normalize(), scene);
directionalLight.shadowFrustumSize = 256;
directionalLight.shadowMinZ = 0.1;
directionalLight.shadowMaxZ = 512;
directionalLight.falloffType = BABYLON.Light.FALLOFF_PHYSICAL;
const cameraLight = new BABYLON.PointLight("cameraLight", perspectiveCamera.position, scene);

const directionalLightShadow = new BABYLON.ShadowGenerator(4096, directionalLight);
directionalLightShadow.bias = 0.0008;
directionalLightShadow.usePercentageCloserFiltering = true;

vars.directionalLight = directionalLight;

const sun = new BABYLON.CreateSphere("sun", {diameter: 10}, scene);
const sunMaterial = new BABYLON.StandardMaterial("sunMaterial", scene);
sunMaterial.emissiveColor = new BABYLON.Color3(1, 1, 0.8);
sunMaterial.emissiveIntensity = 50;
sunMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
sunMaterial.disableLighting = true;
sun.applyFog = false;
sun.ignoreCameraMaxZ = true;
sun.material = sunMaterial;

function getTime() {
    // return -1.7; // midnight
    if (vars.timeOverride !== undefined) return vars.timeOverride;
    const dayLength = 1800000; // milliseconds for a full day cycle
    return (Date.now() / dayLength * Math.PI * 2) % (Math.PI * 2);
}

function getTimeString() {
    const time = getTime() / (Math.PI * 2) * 24 + 6.5;
    return new Date(`Jan 1 1970 ${Math.floor(time % 24)}:${Math.floor((time % 1) * 60).toString().padStart(2, "0")}`).toLocaleTimeString([], {hour: "numeric", minute: "2-digit"});
}

const skybox = BABYLON.MeshBuilder.CreateBox("skyBox", {size: 500}, scene); // not working, figure out later
skybox.visibility = 1;
const skyboxMaterial = new BABYLON.StandardMaterial("skyBoxMaterial", scene);
skyboxMaterial.backFaceCulling = false;
skyboxMaterial.disableLighting = true;
skyboxMaterial.disableDepthWrite = true;
skybox.material = skyboxMaterial;
skybox.applyFog = false;
skybox.infiniteDistance = true;
skybox.ignoreCameraMaxZ = true;

const lightContainers = {};

/**
 * Creates a new clustered light container.
 * @param {string} key Key of the container
 * @returns {BABYLON.ClusteredLightContainer}
 */
function createLightContainer(key) {
    key = "0";
    if (lightContainers[key]) return lightContainers[key];
    
    const container = new BABYLON.ClusteredLightContainer(`lightContainer${key}`, [], scene);
    container.falloffType = BABYLON.Light.FALLOFF_PHYSICAL;
    
    lightContainers[key] = container;
    return container;
}


window.cameraLight = cameraLight;
window.hemisphereLight = hemisphereLight;

cameraLight.falloffType = BABYLON.Light.FALLOFF_PHYSICAL;

const halfBoundingBox = {x: 0.25, y: 0.9, z: 0.25};
const checkCollision = (pos, returnOre, includeNoCollision) => {
    spawnOre(pos.x, pos.y, pos.z);
    const minX = Math.floor(pos.x - halfBoundingBox.x + 0.5);
    const maxX = Math.floor(pos.x + halfBoundingBox.x + 0.5);
    const minY = Math.floor(pos.y - halfBoundingBox.y + 0.9);
    const maxY = Math.floor(pos.y + halfBoundingBox.y + 0.9);
    const minZ = Math.floor(pos.z - halfBoundingBox.z + 0.5);
    const maxZ = Math.floor(pos.z + halfBoundingBox.z + 0.5);
    
    let all = [];
    
    for (let x of [minX, maxX]) {
        for (let y of [minY, Math.floor((minY + maxY) / 2), maxY]) {
            for (let z of [minZ, maxZ]) {
                if (
                    y < 0 && !map.at(x, y, z) && !isCave(x, y, z) && checkAdjacent(x, y, z, isCave) ||
                    saveMap.at(x, y, z) && saveMap.at(x, y, z).ore !== "air" && !map.at(x, y, z) ||
                    oreAt(x, y, z) && ores[map.at(x, y, z).ore] &&
                    (includeNoCollision || !(
                        map.at(x, y, z).noCollision ||
                        ores[map.at(x, y, z).ore] &&
                        ores[map.at(x, y, z).ore].noCollision
                    ))
                ) {
                    // Support variable block sizes
                    const block = map.at(x, y, z) || {bounds: {x: 1, y: 1, z: 1}, offset: {x: 0, y: 0, z: 0}};
                    const width = block.bounds.x || 1;
                    const height = block.bounds.y || 1;
                    const depth = block.bounds.z || 1;
                    const offset = block.offset || {x: 0, y: 0, z: 0};
                    
                    // Calculate block bounds
                    const blockMinX = x - width / 2 + offset.x;
                    const blockMaxX = x + width / 2 + offset.x;
                    const blockMinY = y - height / 2 - 0.4 + offset.y;
                    const blockMaxY = y + height / 2 - 0.4 + offset.y;
                    const blockMinZ = z - depth / 2 + offset.z;
                    const blockMaxZ = z + depth / 2 + offset.z;
                    
                    // Check if the player's bounding box overlaps with the block's bounding box
                    if (
                        (pos.x + halfBoundingBox.x > blockMinX) &&
                        (pos.x - halfBoundingBox.x < blockMaxX) &&
                        (pos.y + halfBoundingBox.y > blockMinY) &&
                        (pos.y - halfBoundingBox.y < blockMaxY) &&
                        (pos.z + halfBoundingBox.z > blockMinZ) &&
                        (pos.z - halfBoundingBox.z < blockMaxZ)
                    ) {
                        if (returnOre !== 2) {
                            let out;
                            if (y === maxY) out = 2;
                            else out = true;
                            if (returnOre) return {ore: map.at(x, y, z), x, y, z, block, out, noCollision: includeNoCollision || (map.at(x, y, z).noCollision || ores[map.at(x, y, z).ore] && ores[map.at(x, y, z).ore].noCollision)};
                            return out;
                        } else {
                            all.push({x, y, z, block, out: y === maxY ? 2 : true, noCollision: includeNoCollision || (map.at(x, y, z).noCollision || ores[map.at(x, y, z).ore] && ores[map.at(x, y, z).ore].noCollision)});
                        }
                    }
                }
            }
        }
    }
    if (returnOre === 2) return all.filter((v, i, s) => s.findIndex(t => t.x === v.x && t.y === v.y && t.z === v.z) === i); // remove duplicates
    return false;
};

export function teleport(x, y, z, rotX, rotY) {
    if (!player.velocity.set) player.velocity = new BABYLON.Vector3(0, 0, 0);
    else player.velocity.set(0, 0, 0);

    x = Number(x);
    y = Number(y);
    z = Number(z);

    if (nd(x)) x = 0;
    if (nd(x)) y = 0;
    if (nd(x)) z = 0;

    if (!player.position.set) player.position = new BABYLON.Vector3(0, 0, 0);
    player.position.set(x, y, z);
    if (!map.at(x, y, z)) map.at(x, y, z, true);
    if (!map.at(x, y + 1, z)) map.at(x, y + 1, z, true);
    updateTopLeft();
    generateAdjacent(x, y, z);
    generateAdjacent(x, y + 1, z);

    perspectiveCamera.rotation.x = rotX ?? 0;
    perspectiveCamera.rotation.y = rotY ?? 0;
}

player.teleport = teleport;
window.teleport = teleport;

function getTexture(ore, type = "ore", face, setTransparent) {
    if (typeof type !== "string" && type !== undefined) console.warn("INCORRECT PARAMETERS!!!!!!!!", ...arguments);

    if (ores[ore]?.noTexture) return null;
    
    if (type === "ore" || type === "emissive") {
        const id = ore;
        if (ores[id]?.multipleTextures && face !== undefined) {
            if (type === "emissive" && ores[id]?.emissive.map)
                ore = ores[id].emissive.map[face] ?? id;
            else
                ore = ores[id].multipleTextures[face] ?? id;
        } else if (type === "emissive" && ores[id]?.emissive?.map) {
            ore = ores[id].emissive.map ?? id;
        } else if (ores[id]?.customTexture) {
            ore = ores[id].customTexture?.ore ?? id;
            if (ores[id].customTexture?.src) type = "src";
        }
    }
    
    if (!textures[`${ore}_${type}`]) {
        const texture = new BABYLON.Texture(`img/block/${ore}.png`, scene, false, false, BABYLON.Texture.NEAREST_SAMPLINGMODE);
        if (setTransparent || type === "particle") texture.hasAlpha = true;
        texture.wAng = Math.PI;
        textures[`${ore}_${type}`] = texture;
    }
    
    return textures[`${ore}_${type}`];
}

vars.getTexture = getTexture;

export async function generateOre(x, y, z, ore, bg, settings) {
    if (!ores[ore]) return;
    x = Math.round(x), y = Math.round(y), z = Math.round(z);
    settings = {...settings};

    if (ores[ore].customModel) settings.customModel = ore;
    if (ores[ore].singleLayer || ores[ore].customModel) bg = ore;
    
    if (ores[ore] && ores[ore].placeholder) {
        if (ores[ore].onGenerate) ores[ore].onGenerate(x, y, z, settings, map.at(x, y, z));
        return;
    }

    if (oreAt(x, y, z) && !settings.forcedReplace) {
        return map.at(x, y, z);
    } else if (airAt(x, y, z) && !settings.forced && !map.at(x, y, z)?.temp || map.at(x, y, z)?.loadingModel) {
        return map.at(x, y, z);
    } else if (!map.at(x, y, z)?.temp && ores[ore]) {
        removeOre(x, y, z, {fullyRemove: true});
    }

    let progress;
    if (saveMap.at(x, y, z)) {
        const block = saveMap.at(x, y, z);

        if (!(settings.forced && block.ore === "air")) {
            ore = block.ore;
            bg = block.background ?? block.ore;
            settings.chance = block.chance;
            settings.offset = block.offset;
            settings.rotation = block.rotation;
            settings.scale = block.scale;
            settings.placed = block.placed;
            settings.properties = {...block};
            progress = block.progress;
        }

        if (saveMap.at(x, y, z).ore === "air" && !settings.forced) {
            map.at(x, y, z, true);
            return map.at(x, y, z);
        }

        if (!ores[ore]) {
            saveMap.at(x, y, z, "delete");
            return;
        }
        if (!ores[bg]) bg = ore;
    }
    if (ore === undefined || ore === null) {
        if (!map.at(x, y, z)?.temp) map.at(x, y, z, true);
        return;
    }
    if (!settings) settings = {};
    settings = JSON.parse(JSON.stringify(settings));

    if (!settings.properties) settings.properties = {};
    
    if (!settings.offset) settings.offset = {x: 0, y: 0, z: 0};
    if (nd(settings.offset.x)) settings.offset.x = 0;
    if (nd(settings.offset.y)) settings.offset.y = 0;
    if (nd(settings.offset.z)) settings.offset.z = 0;
    
    settings.offset.x += ores[ore].offset?.x ?? 0;
    settings.offset.y += ores[ore].offset?.y ?? 0;
    settings.offset.z += ores[ore].offset?.z ?? 0;
    
    if (!settings.scale) settings.scale = {x: 1, y: 1, z: 1}; // test
    if (nd(settings.scale.x)) settings.scale.x = 1;
    if (nd(settings.scale.y)) settings.scale.y = 1;
    if (nd(settings.scale.z)) settings.scale.z = 1;
    
    if (ores[ore].scale) {
        settings.scale.x *= ores[ore].scale.x ?? 1;
        settings.scale.y *= ores[ore].scale.y ?? 1;
        settings.scale.z *= ores[ore].scale.z ?? 1;
    }
    
    if (!settings.rotation) {
        if (ores[ore].cave?.rotate) {
            let sides = [
                [`${x + 1},${y},${z}`, {x: 0, y: 0, z: Math.PI / 2}],
                [`${x - 1},${y},${z}`, {x: 0, y: 0, z: -Math.PI / 2}],
                [`${x},${y + 1},${z}`, {x: Math.PI, y: 0, z: 0}],
                [`${x},${y - 1},${z}`, {x: 0, y: 0, z: 0}],
                [`${x},${y},${z + 1}`, {x: -Math.PI / 2, y: 0, z: 0}],
                [`${x},${y},${z - 1}`, {x: Math.PI / 2, y: 0, z: 0}]
            ];
            
            sides = sides.filter(s => {
                const [x1, y1, z1] = s[0].split(",").map(Number);
                return !isCave(x1, y1, z1);
            });
            settings.rotation = sides.length > 0 ? sides[Math.floor(Math.random() * sides.length)][1] : {x: 0, y: 0, z: 0};
        } else {
            settings.rotation = { x: 0, y: 0, z: 0 };
            if (ores[ore]) {
                if (ores[ore].rotation) settings.rotation = JSON.parse(JSON.stringify(ores[ore].rotation));
                // else if (ores[ore].noRandomRotation || ores[bg].noRandomRotation) settings.rotation.y = 0;
            }
        }
    }
    if (nd(settings.rotation.x)) settings.rotation.x = 0;
    if (nd(settings.rotation.y)) settings.rotation.y = 0;
    if (nd(settings.rotation.z)) settings.rotation.z = 0;

    if (ores[ore].onBeforeGenerate) {
        const output = ores[ore].onBeforeGenerate(x, y, z, settings, bg);

        if (output !== undefined) {
            if (output.ore !== undefined) ore = output.ore;
            if (output.bg !== undefined) bg = output.bg;
        }
    }

    if (settings.isGeode) {
        settings.customTexture = {ore: "crystals", bg: null};
        settings.meshIDPrefix = "geode";
    }
    
    let meshID = `${settings.meshIDPrefix ? settings.meshIDPrefix + "_" : ""}${ore}_${settings.customModel ?? bg}`;
    const chunk = getChunkKey(x, y, z, MESH_CHUNK_SIZE);
    const chunkSplit = getChunkKey(x, y, z, MESH_CHUNK_SIZE, true).map(a => a * MESH_CHUNK_SIZE);
    meshID += `_${chunk}`;
    
    let count = meshCounts[meshID] || 0;
    
    let str = (typeof ores[ore].str === "function" ? ores[ore].str(x, y, z) : ores[ore].str);
    const colorData = (settings.oreColor || ores[ore].noTexture || settings.isGeode || ores[ore].oreColor)
    ? ores[ore].firstColor
    : ores[ore].forcedColor ?? "#ffffff";
    let color = getColor(settings.color ?? (ores[ore].colorize !== undefined ? ores[ore].colorize(settings) : colorData));
    
    if (ores[bg] !== undefined && !ores[ore].singleLayer) str = Math.max(str, typeof ores[bg].str === "function" ? ores[bg].str(x, y, z) : ores[bg].str);
    if (str === undefined || str === 0) str = 1;
    
    if (meshes[`${meshID}_${count}`]?.thinInstanceCount >= MAX_MESH_COUNT) {
        meshCounts[meshID] = ++count;
    }
    
    if (meshes[`${meshID}_${count}`] === undefined) {
        meshes[`${meshID}_${count}`] = true;
        let oreMesh;
        if (settings.customModel) {
            map.at(x, y, z, {ore: "air", loadingModel: true});
            const result = await BABYLON.ImportMeshAsync(`models/${settings.customModel}.glb`, scene);
            oreMesh = result.meshes[1];
            oreMesh.id = oreMesh.name = `${meshID}_${count}`;
            const oreMaterial = new BABYLON.PBRMaterial(`customModelMaterial-${k(x, y, z)}`, scene);

            if (ores[ore].colorize === undefined) oreMaterial.albedoColor = color;
            oreMaterial.roughness = 1;
            oreMaterial.metallic = 0;
            oreMaterial.specularColor = new BABYLON.Color3(0.01, 0.01, 0.01);
            oreMaterial.specularPower = 0;

            if (ores[ore].singleLayer) {
                oreMaterial.albedoTexture = getTexture(ore);
            } else {
                oreMaterial.albedoTexture = oreMesh.material.albedoTexture;
            }

            if (ores[ore]?.emissive) {
                oreMaterial.emissiveColor = color;
            }
            if (ores[ore]?.light) {
                oreMesh.receiveShadows = false;
                if (!ores[ore].emissive) {
                    oreMaterial.emissiveColor = getColor(ores[ore].light.col);
                }
            }

            oreMaterial.emissiveColor.r **= 2;
            oreMaterial.emissiveColor.g **= 2;
            oreMaterial.emissiveColor.b **= 2;

            oreMesh.material = oreMaterial;
        } else {
            oreMesh = BABYLON.MeshBuilder.CreateBox(`${meshID}_${count}`, {size: 1, wrap: true}, scene);
            oreMesh.alphaIndex = 99;
            
            const oreMaterial = new BABYLON.PBRMaterial(`oreMaterial-${k(x, y, z)}`, scene);
            oreMaterial.albedoColor = oreMaterial.diffuseColor = new BABYLON.Color3(1, 1, 1);
            oreMaterial.ambientColor = new BABYLON.Color3(1, 1, 1);
            oreMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
            oreMaterial.alphaMode = 2;
            
            oreMaterial.roughness = 1;
            oreMaterial.metallic = 0;
            
            let materials = [];
            if (ores[ore]?.multipleTextures) {
                for (let i = 0; i < 6; i++) {
                    const mat = new BABYLON.PBRMaterial(`oreMaterial-${k(x, y, z)}-${i}`, scene);
                    mat.albedoColor = mat.diffuseColor = new BABYLON.Color3(1, 1, 1);
                    mat.ambientColor = new BABYLON.Color3(1, 1, 1);
                    mat.specularColor = new BABYLON.Color3(0, 0, 0);
                    mat.alphaMode = 2;
                    mat.baseTexture = mat.albedoTexture = mat.opacityTexture = getTexture(ore, "ore", i);
                    mat.usePhysicalLightFalloff = false;
                    
                    mat.roughness = 1;
                    mat.metallic = 0;
                    materials.push(mat);
                }
            } else {
                materials.push(oreMaterial);
            }
            
            const backgroundMaterial = new BABYLON.PBRMaterial(`backgroundMaterial-${k(x, y, z)}`, scene);
            backgroundMaterial.albedoColor = backgroundMaterial.diffuseColor = settings.bgColor ? color : new BABYLON.Color3(1, 1, 1);
            backgroundMaterial.ambientColor = new BABYLON.Color3(1, 1, 1);
            backgroundMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
            
            const bgMaterials = [];
            if (ores[bg]?.multipleTextures) {
                for (let i = 0; i < 6; i++) {
                    const mat = new BABYLON.PBRMaterial(`backgroundMaterial-${k(x, y, z)}-${i}`, scene);
                    mat.albedoColor = mat.diffuseColor = new BABYLON.Color3(1, 1, 1);
                    mat.ambientColor = new BABYLON.Color3(1, 1, 1);
                    mat.specularColor = new BABYLON.Color3(0, 0, 0);
                    mat.baseTexture = mat.albedoTexture = getTexture(bg, "ore", i);
                    mat.usePhysicalLightFalloff = false;
                    
                    mat.roughness = 1;
                    mat.metallic = 0;
                    bgMaterials.push(mat);
                }
            } else {
                bgMaterials.push(backgroundMaterial);
            }
            
            if (ores[ore]?.emissive) {
                for (const oreMaterial of materials) {
                    oreMaterial.emissiveColor = getColor(ores[ore].emissive.col ?? "#ffffff");
                    oreMaterial.emissiveIntensity = ores[ore].emissive.str ?? 1;
                }
            }
            if (ores[ore]?.light) {
                oreMesh.receiveShadows = false;
                if (!ores[ore].emissive) {
                    for (const oreMaterial of materials) {
                        oreMaterial.emissiveColor = new BABYLON.Color3(1, 1, 1);
                        oreMaterial.emissiveIntensity = ores[ore].light.str;
                    }
                }
            }
            oreMaterial.albedoTexture = oreMaterial.baseTexture = getTexture(settings.customTexture?.ore ?? ore);
            oreMaterial.opacityTexture = getTexture(settings.customTexture?.ore ?? ore);
            if (ores[ore]?.light || ores[ore]?.emissive) {
                if (!ores[ore]?.multipleTextures)
                    oreMaterial.emissiveTexture = getTexture(settings.customTexture?.ore ?? ore, "emissive");
                else {
                    for (let i = 0; i < materials.length; i++) {
                        materials[i].emissiveTexture = getTexture(ore, "emissive", i);
                    }
                }
            }
            backgroundMaterial.albedoTexture = backgroundMaterial.baseTexture = ores[ore]?.singleLayer ? getTexture(settings.customTexture?.ore ?? ore) : getTexture(settings.customTexture?.bg ?? bg);
            backgroundMaterial.diffuseTexture = getTexture(settings.customTexture?.bg ?? bg);

            if (ores[ore].disableLighting) {
                for (const oreMaterial of materials) {
                    oreMaterial.disableLighting = true;
                    oreMaterial.emissiveTexture = oreMaterial.albedoTexture;
                    oreMaterial.emissiveColor = BABYLON.Color3.White();
                }
            }
            if (ores[bg].disableLighting) {
                for (const oreMaterial of bgMaterials) {
                    oreMaterial.disableLighting = true;
                    oreMaterial.emissiveTexture = oreMaterial.albedoTexture;
                    oreMaterial.emissiveColor = BABYLON.Color3.White();
                }
            }
            
            if (ores[ore].textureHasTransparency) {
                backgroundMaterial.alpha = 0;
                backgroundMaterial.alphaMode = BABYLON.Constants.ALPHA_DISABLE;
                backgroundMaterial.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;
                bgMaterials.length = 0;
                
                for (const oreMaterial of materials) {
                    oreMaterial.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_ALPHATESTANDBLEND;
                    oreMaterial.alphaCutOff = 0.01;
                    oreMaterial.forceDepthWrite = true;
                }

                oreMesh.alphaIndex = 100;
            } else if (!ores[ore].singleLayer) {
                for (const oreMaterial of materials) {
                    oreMaterial.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_ALPHATESTANDBLEND;
                    oreMaterial.alphaCutOff = 0.01;
                }
            } else {
                oreMaterial.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;
            }

            if (ores[ore].singleLayer || ores[ore].forcedBG) {
                oreMaterial.roughness = 1;
                oreMaterial.metallic = 0;

                // bgMaterials.length = 0;
                // bgMaterials.push(backgroundMaterial);
            }
            
            backgroundMaterial.roughness = 1;
            backgroundMaterial.metallic = 0;
            
            oreMaterial.usePhysicalLightFalloff = false;
            backgroundMaterial.usePhysicalLightFalloff = false;
            
            const multiMaterial = new BABYLON.MultiMaterial(`multi-${k(x, y, z)}`, scene);
            multiMaterial.subMaterials.push(...bgMaterials, ...materials);
            oreMesh.material = multiMaterial;
            
            oreMesh.releaseSubMeshes();
            const vertices = oreMesh.getTotalVertices();
            const indices = oreMesh.getTotalIndices();
            if (bgMaterials.length === 1) new BABYLON.SubMesh(0, 0, vertices, 0, indices, oreMesh);
            else if (bgMaterials.length === 6) {
                const faceVertexCount = vertices / 6;
                for (let i = 0; i < 6; i++) {
                    new BABYLON.SubMesh(i, i * faceVertexCount, faceVertexCount, i * 6, 6, oreMesh);
                }
            }
            if (materials.length === 1) new BABYLON.SubMesh(bgMaterials.length, 0, vertices, 0, indices, oreMesh);
            else if (materials.length === 6) {
                const faceVertexCount = vertices / 6;
                for (let i = 0; i < 6; i++) {
                    new BABYLON.SubMesh(i + bgMaterials.length, i * faceVertexCount, faceVertexCount, i * 6, 6, oreMesh);
                }
            }
        }

        directionalLightShadow.addShadowCaster(oreMesh);
        oreMesh.receiveShadows = true;
        
        oreMesh.position.set(...chunkSplit);
        
        oreMesh.metadata = {ore, background: bg, coords: [], type: "ore"};
        if (USE_THIN_INSTANCES) oreMesh.thinInstanceEnablePicking = true; // allow picking by raycast
        
        meshes[`${meshID}_${count}`] = oreMesh;
    } else if (meshes[`${meshID}_${count}`] === true) return false;
    
    // create an instance of the mesh for better performance
    const matrix = BABYLON.Matrix.Scaling(settings.scale.x, settings.scale.y, settings.scale.z)
    .multiply(BABYLON.Matrix.Translation(settings.offset.x, settings.offset.y, settings.offset.z))
    .multiply(BABYLON.Matrix.RotationYawPitchRoll(settings.rotation.y, settings.rotation.x, settings.rotation.z))
    .multiply(BABYLON.Matrix.Translation(x - chunkSplit[0], y - chunkSplit[1], z - chunkSplit[2]));
    meshes[`${meshID}_${count}`].thinInstanceAdd(matrix, settings.forceUpdate);
    const index = meshes[`${meshID}_${count}`].thinInstanceCount - 1;
    meshes[`${meshID}_${count}`].metadata.coords[index] = {x, y, z};
    
    meshesNeedingUpdate.add(`${meshID}_${count}`);
    
    /** @type {BABYLON.Mesh} */
    const mesh = meshes[`${meshID}_${count}`];
    mesh.metadata.thinInstanceColors ??= [];
    mesh.metadata.thinInstanceColors[index * 4 + 0] = color.r;
    mesh.metadata.thinInstanceColors[index * 4 + 1] = color.g;
    mesh.metadata.thinInstanceColors[index * 4 + 2] = color.b;
    mesh.metadata.thinInstanceColors[index * 4 + 3] = 1;
    mesh.thinInstanceSetBuffer("color", new Float32Array(mesh.metadata.thinInstanceColors), 4);
    
    let bounds = new BABYLON.Vector3(
        settings.scale.x * (ores[ore].boundingBox?.x || 1),
        settings.scale.y * (ores[ore].boundingBox?.y || 1),
        settings.scale.z * (ores[ore].boundingBox?.z || 1)
    );
    // apply rotation to bounds
    if (settings.rotation) {
        bounds.rotateByQuaternionToRef(BABYLON.Quaternion.FromEulerVector(new BABYLON.Vector3(settings.rotation.x, settings.rotation.y, settings.rotation.z)), bounds);
        bounds = new BABYLON.Vector3(Math.abs(bounds.x), Math.abs(bounds.y), Math.abs(bounds.z));
    }
    
    map.at(x, y, z, {
        ore, background: bg,
        offset: settings.offset,
        bounds: bounds ?? {x: 1, y: 1, z: 1},
        rotation: settings.rotation,
        scale: {...settings.scale},
        chance: settings.chance,
        str,
        meshID: `${meshID}_${count}`,
        index: USE_THIN_INSTANCES ? meshes[`${meshID}_${count}`].thinInstanceCount - 1 : undefined
    });

    if (settings.cssColor !== undefined) map.at(x, y, z).color = settings.cssColor;
    if (settings.customModel !== undefined) map.at(x, y, z).customModel = settings.customModel;

    map.at(x, y, z, Object.assign({}, settings.properties, map.at(x, y, z)));
    totalOres++;

    if (ores[ore].textureHasTransparency && !settings.allowTransparent && !ores[ore].allowTransparent || ores[ore].forceAdjacent) {
        generateAdjacent(x, y, z, {noCave: settings.noCave, caveExclusive: settings.caveExclusive});
    }

    const posWithOffset = matrix.getTranslation().addInPlace(new BABYLON.Vector3(...chunkSplit));
    
    // if ore light
    if (ores[ore]?.light) {
        let x1 = x, y1 = y, z1 = z;
        if (settings.offset) {
            const vector = new BABYLON.Vector3(settings.offset.x, settings.offset.y, settings.offset.z);
            vector.applyRotationQuaternionInPlace(BABYLON.Quaternion.FromEulerAngles(settings.rotation.x, settings.rotation.y, settings.rotation.z));
            x1 += vector.x || 0;
            y1 += vector.y || 0;
            z1 += vector.z || 0;
        }
        if (settings.light?.offset) {
            x1 += settings.light.offset.x || 0;
            y1 += settings.light.offset.y || 0;
            z1 += settings.light.offset.z || 0;
        }
        const light = {
            position: new BABYLON.Vector3(x1, y1, z1),
            color: getColor(typeof ores[ore].light.col === "function" ? ores[ore].light.col() : ores[ore].light.col !== "random" ? ores[ore].light.col : Math.floor(Math.random() * 2 ** 24)),
            intensity: ores[ore].light.str,
            distance: ores[ore].light.radius || ores[ore].light.str * 2,
            decay: typeof ores[ore].light.decay === "number" ? ores[ore].light.decay : 2,
            name: `light0-${k(x, y, z)}`
        };
        lightArr.push(light);
        const pointLight = new BABYLON.PointLight(light.name, light.position, scene, true);
        pointLight.diffuse = light.color;
        pointLight.intensity = light.intensity;
        pointLight.range = light.distance + 1;
        pointLight.id = light.name;
        lightKeys[`${k(x, y, z)}`] = pointLight;
        
        const container = createLightContainer(getChunkKey(x, y, z, 64), 64);
        
        // pointLight.position.subtractInPlace(container.position);
        
        container.addLight(pointLight);
    }

    if (ores[ore].audio) {
        const audioNode = new BABYLON.TransformNode(`audioNode0-${k(x, y, z)}`, scene);
        audioNode.position.copyFrom(posWithOffset);
        audioNode.rotate(BABYLON.Vector3.Up(), Math.PI);
        
        new BABYLON.CreateAudioEngineAsync({disableDefaultUI: true}).then(audioEngine => {
            BABYLON.CreateSoundAsync(`audio0-${k(x, y, z)}`, `audio/ore/${ores[ore].audio}`, {spatialEnabled: true}).then(sound => {
                audioEngine.unlockAsync().then(() => {
                    sound.loop = true;
                    sound.spatial.minDistance = 1;
                    sound.spatial.maxDistance = 20;
                    sound.spatial.distanceModel = "linear";
                    sound.spatial.attach(audioNode);
                    sound.spatial.panningModel = "HRTF";
                    sound.play();
                    
                    audios.push({audioEngine, sound, x, y, z, ore});
                });
            });
        });
    }

    if (oreParticles[ore]) {
        /** @type {BABYLON.ParticleSystem} */
        const ps = oreParticles[ore].getParticleSystem(`particles-${k(x, y, z)}_${particleSystemID++}`, scene).clone();
        ps.renderingGroupId = 1;
        ps.blendMode ||= BABYLON.ParticleSystem.BLENDMODE_STANDARD;
        ps.emitter = posWithOffset.clone();
        ps.disposeOnStop = true;
        ps.start();
        map.at(x, y, z).particles = ps;
    }

    if (ores[ore].radiation) {
        radiationMap.at(x, y, z, {
            position: new BABYLON.Vector3(x + settings.offset.x || 0, y + settings.offset.y || 0, z + settings.offset.z || 0),
            strength: ores[ore].radiation,
            name: `rad-${k(x, y, z)}`,
            falloff: ores[ore].radiationFalloff || 0.2
        });
    }
    
    if (ores[ore].tick) {
        vars.oreTicks.push({x, y, z, ore, tick: ores[ore].tick});
    }

    if (ores[ore].onGenerate) ores[ore].onGenerate(x, y, z, settings, map.at(x, y, z));

    if (settings.placed) {
        map.at(x, y, z).placed = true;
        setInteracted(x, y, z);
    }

    if (progress !== undefined) {
        setProgress(x, y, z, undefined, progress);
    }
    
    return map.at(x, y, z);
}

/**
 * Removes a thin instance of a mesh at a specified index.
 * @param {BABYLON.Mesh} mesh Parent mesh
 * @param {Number} index Index to remove
 * @returns {Boolean} Whether the operation was successful
 */
function removeThinInstance(mesh, index) {
    if (index !== undefined && index >= 0 && index < mesh.thinInstanceCount) {
        const matrices = mesh.thinInstanceGetWorldMatrices();
        const lastIndex = mesh.thinInstanceCount - 1;
        if (index !== lastIndex) {
            // splice
            const last = matrices[lastIndex];
            mesh.thinInstanceSetMatrixAt(index, last);
        }
        mesh.thinInstanceCount--;
        if (mesh.thinInstanceCount <= 0) {
            if (meshes[mesh.name]) delete meshes[mesh.name];
            mesh.dispose();
            return true;
        }

        if (mesh._thinInstanceDataStorage) {
            mesh._thinInstanceDataStorage.worldMatrices = null;
        }

        return true;
    }
    return false;
}

function removeOre(x, y, z, settings = {}) {
    // the fun part... yay...
    x = Math.round(x), y = Math.round(y), z = Math.round(z);
    const oreData = map.at(x, y, z);
    if (oreData) {
        updateBreakMesh(x, y, z, oreData, 2);
        if (oreAt(x, y, z)) {
            const meshID = oreData.meshID;
            /** @type {BABYLON.Mesh} */
            const mesh = meshes[meshID];
            if (mesh) {
                const index = oreData.index;
                const successfulRemoval = removeThinInstance(mesh, index);
                if (successfulRemoval) {
                    // Remove the instance by swapping with the last and decreasing count
                    totalOres--;
                    const lastIndex = mesh.thinInstanceCount;
                    
                    const movedCoord = mesh.metadata?.coords?.[lastIndex];
                    if (index !== lastIndex && movedCoord) {
                        const movedOre = map.at(movedCoord.x, movedCoord.y, movedCoord.z);
                        if (movedOre?.ore) movedOre.index = index;
                    }

                    if (Array.isArray(mesh.metadata?.coords)) {
                        mesh.metadata.coords[index] = mesh.metadata.coords.pop();
                        mesh.metadata.coords.length = mesh.thinInstanceCount;
                    }
                    
                    // remove any audio and light associated with this ore
                    const light = lightArr.find(l => l.name === `light0-${k(x, y, z)}`);
                    if (light !== undefined) {
                        const idx = lightArr.indexOf(light);
                        if (idx !== -1) lightArr.splice(idx, 1);
                        /** @type {BABYLON.ClusteredLightContainer} */
                        const container = lightContainers["0"];
                        const pointLight = lightKeys[`${k(x, y, z)}`];
                        if (pointLight !== undefined) {
                            pointLight.intensity = 0;
                            scene.removeLight(pointLight);
                            delete lightKeys[`${k(x, y, z)}`];
                        } else {
                            console.warn(`Light for ${k(x, y, z)} not found in lightKeys.`);
                        }
                    }

                    const audioIdx = audios.findIndex(l => l.sound.name === `audio0-${k(x, y, z)}`);
                    if (audioIdx !== -1) {
                        const audio = audios[audioIdx];
                        audio.audioEngine.dispose();
                        audios.splice(audioIdx, 1);
                    }
                    // remove particle system if it exists
                    if (map.at(x, y, z).particles) {
                        map.at(x, y, z).particles.stop();
                    }
                    
                    // remove radiation
                    radiationMap.at(x, y, z, "delete");
                    
                    // remove from repair list
                    if (repairObj[`${k(x, y, z)}`]) {
                        delete repairObj[`${k(x, y, z)}`];
                        repairArr.splice(repairArr.indexOf(`${k(x, y, z)}`), 1);
                    }
                    
                    // remove tick
                    const tickIndex = vars.oreTicks.findIndex(t => t.x === x && t.y === y && t.z === z);
                    if (tickIndex !== -1) {
                        vars.oreTicks.splice(tickIndex, 1);
                    }
                    
                    if (ores[map.at(x, y, z).ore]?.onRemove) {
                        ores[map.at(x, y, z).ore].onRemove(x, y, z);
                    }
                    
                    // check for overlay as well
                    const overlayIndex = vars.overlays.findIndex(g => Math.round(g.x) === Math.round(x) && Math.round(g.y) === Math.round(y) && Math.round(g.z) === Math.round(z));
                    if (overlayIndex !== -1) {
                        getElementById(vars.overlays[overlayIndex].ore + "Overlay").style.opacity = 0;
                        vars.overlays.splice(overlayIndex, 1);
                    }
                } else {
                    console.warn("Could not remove instance of mesh", meshID, "with index", index);
                }
            }

            if (!settings.fullyRemove) {
                map.at(x, y, z, true);
            } else {
                map.at(x, y, z, "delete");
            }
        } else {
            if (!settings.fullyRemove) {
                map.at(x, y, z, true);
            } else {
                map.at(x, y, z, "delete");
            }
        }

        const chunk = getChunk(x, y, z);
        const index = chunk.indexOf(`${k(x, y, z)}`);
        if (index !== -1) {
            chunk.splice(index, 1);
        }
    } else {
        map.at(x, y, z, true);
    }

    if (!settings.fullyRemove) setInteracted(x, y, z);
}

function getPickedOreCoords(hit) {
    if (!hit?.hit || !hit.pickedMesh) return null;
    const metadata = hit.pickedMesh.metadata;
    if (!metadata) return null;
    
    const index = hit.thinInstanceIndex;
    let coords;
    if (Number.isInteger(index) && index >= 0) {
        coords = metadata.coords?.[index];
    } else {
        coords = metadata.coords;
    }
    
    if (!coords) return null;
    const x = Math.round(coords.x), y = Math.round(coords.y), z = Math.round(coords.z);
    if (![x, y, z].every(Number.isFinite)) return null;
    
    const oreData = map.at(x, y, z);
    if (!oreData?.ore) return null;
    return {x, y, z, oreData};
}

function getChunk(x, y, z) {
    x = Math.floor(x / CHUNK_SIZE);
    y = Math.floor(y / CHUNK_SIZE);
    z = Math.floor(z / CHUNK_SIZE);
    if (!chunks[`${k(x, y, z)}`]) chunks[`${k(x, y, z)}`] = [];
    return chunks[`${k(x, y, z)}`];
}

function getChunkKey(x, y, z, size, split) {
    const chunkX = Math.floor(x / size);
    const chunkY = Math.floor(y / size);
    const chunkZ = Math.floor(z / size);
    if (!split) return `${chunkX}_${chunkY}_${chunkZ}`;
    else return [chunkX, chunkY, chunkZ];
}

window.removeOre = removeOre;

function spawnOre(x, y, z, settings) {
    x = Math.round(x);
    y = Math.round(y);
    z = Math.round(z);
    if (settings === undefined) settings = {caveExclusive: false, noCave: false};
    if (map.at(x, y, z) && !settings.forced && !settings.forceReplace && !map.at(x, y, z).temp) return false;
    if (typeof settings === "string") settings = {caveExclusive: true, noCave: true, caveType: settings};
    const layer = getLayer(y, x, z, false);
    if (layers[layer]?.universalCondition && !layers[layer].universalCondition(x, y, z) && !map.at(x, y, z)) {
        map.at(x, y, z, true);
        return map.at(x, y, z);
    }
    
    settings = {...settings};
    settings.all = true;
    settings.cave = {};
    settings.scale = {};
    let progress;
    
    for (let i = 0; i < structureArray.length; i++) {
        const structure = structureArray[i];
        if (structure.chance === 0) continue;
        if (!Number.isFinite(structure.width) || !Number.isFinite(structure.height) || !Number.isFinite(structure.depth)) continue;
        
        let gridX = Math.floor((x - structure.gridOffset.x) / structure.width);
        let gridY = Math.floor((y - structure.gridOffset.y) / structure.height);
        let gridZ = Math.floor((z - structure.gridOffset.z) / structure.depth);
        function test(gridX, gridY, gridZ) {
            const structurePos = getStructurePlacementData(structure, gridX, gridY, gridZ);
            const centerX = structurePos.centerX;
            const centerY = structurePos.centerY;
            const centerZ = structurePos.centerZ;
            
            if ((x < structurePos.x || x >= structurePos.x + structure.width ||
                y < structurePos.y || y >= structurePos.y + structure.height ||
                z < structurePos.z || z >= structurePos.z + structure.depth)) return false;
                
            return {centerX, centerY, centerZ};
        }
            
        let testResult = test(gridX, gridY, gridZ);
        if (!testResult) {
            for (let xOff = -1; xOff <= 1; xOff++) {
                for (let yOff = -1; yOff <= 1; yOff++) {
                    for (let zOff = -1; zOff <= 1; zOff++) {
                        if (xOff === 0 && yOff === 0 && zOff === 0) continue;
                        const newTestResult = test(gridX + xOff, gridY + yOff, gridZ + zOff);
                        if (newTestResult) {
                            testResult = newTestResult;
                            gridX += xOff;
                            gridY += yOff;
                            gridZ += zOff;
                            break;
                        }
                    }
                }
            }
        }
        
        const {centerX, centerY, centerZ} = testResult || {};
        if (!centerX) continue;
        
        const structureNoiseVal = noise(centerX, centerY, centerZ);
        if (structure.caveExclusive !== undefined && (structureNoiseVal.value > structureNoiseVal.caveReq !== structure.caveExclusive)) continue;
        
        const exists = rand01(gridX, gridY, gridZ, vars.seed) < calculateRarity(structure, centerY, centerX, centerZ);
        if (exists && !(generatedStructures[structure.id] && generatedStructures[structure.id][`${gridX}_${gridY}_${gridZ}`])) {
            generateStructure(gridX, gridY, gridZ, structure.id, {centerX, centerY, centerZ});
            // return map.at(x, y, z);
        }
    }
    
    if (isCaveFloor(x, y, z)) settings.isCaveFloor = true;
    if (isCaveCeiling(x, y, z)) settings.isCaveCeiling = true;
    if (!Object.keys(settings.cave).length) delete settings.cave;
    
    let oreData = {ore: null};

    if (isCave(x, y, z) && !saveMap.at(x, y, z)) {
        settings.cave = {};
        settings.caveAir = true;

        // check for dripstone
        let dripstone = false;

        function check(x, y, z) {
            return !layers[getLayer(y, x, z, false)]?.caveRules?.noDripstone;
        }

        let pos = [x, y, z];

        for (let i = 0; i < 4; i++) {
            if (caveFloorAdjacent(...pos, vars.seed)) {
                if (rand01(...pos, vars.seed + Math.E * 3) < 0.05 && check(pos[0], pos[1] - 1, pos[2]) && rand01(...pos, vars.seed + Math.E * 4) < 0.8 ** (i + 1)) {
                    dripstone = true;
                    const size = (4 - i) / 5;
                    const bgOre = getBGOre(pos[0], pos[1] - 1, pos[2]);

                    if (!ores[bgOre]?.noDripstone) {
                        oreData.ore = oreData.bg = bgOre;
                        settings.noVein = true;
                        settings.noGeode = true;
                        settings.scale.x = settings.scale.z = size;
                    }
                }
                break;
            } else {
                pos[1]--;
            }
        }

        if (!dripstone) {
            settings.cave = {};
            settings.caveAir = true;

            settings.cave.floor = caveFloorAdjacent(x, y, z, vars.seed);
            settings.cave.ceiling = caveCeilingAdjacent(x, y, z, vars.seed);
            settings.cave.walls = caveWallAdjacent(x, y, z, vars.seed);
            settings.cave.air = true;
            if (!Object.keys(settings.cave).length) return map.at(x, y, z, {ore: "air"});
        }
    }

    if (!oreData?.ore) {
        oreData = getOre(x, y, z, settings);
    }
    if (!oreData || oreData.ore === null) {
        map.at(x, y, z, true);
        return map.at(x, y, z);
    }
    settings.chance = oreData.chance;

    const veinRnd = rand01(x, y, z, vars.seed + Math.SQRTPI);
    const geodeRnd = rand01(x, y, z, vars.seed + Math.SQRTPI * 2);
    if (!settings.noVein && !ores[oreData.ore]?.noVein && !ores[oreData.ore]?.forcedBG && veinRnd < VEIN_CHANCE && oreData.chance !== Infinity || ores[oreData.ore]?.guaranteedVein) {
        const num = veinRnd / VEIN_CHANCE;
        settings.num = num;
        const oreCount = Math.max(Math.round(1 / 1.5 / num * Math.tan(Math.PI / 2 * (1 - (1 - num) ** (Math.log10(100 * (1.004 - num)) / 2 + 1) + 1.9997878)) + 120.721 ** (245000 * (num - 0.99999))), 3); // 3~128000
        generateVein(x, y, z, oreData.ore, oreCount, ores[oreData.ore]?.guaranteedVein, settings.chance, oreData.conditionLabel, settings);
        settings.isVein = true;
    } else if (!settings.noGeode && geodeRnd < GEODE_CHANCE && oreData.chance !== Infinity && !ores[oreData.ore]?.noGeode && !ores[oreData.ore]?.forcedBG || ores[oreData.ore]?.guaranteedGeode) {
        const num = geodeRnd / GEODE_CHANCE;
        settings.num = num;
        let radius = Math.floor(Math.tan((Math.PI * (num - 0.05) ** Math.max((num + 0.6) ** 3.6 - 1, 4)) / 2) + 3 - Math.log(1 - num) / Math.log(4)); // 3~12
        if (isNaN(radius) || radius < 3) radius = 3;
        generateGeode(x, y, z, radius, oreData.ore, settings.chance, ores[oreData.ore]?.guaranteedGeode, oreData.conditionLabel, settings);
    }
    
    generateOre(x, y, z, oreData.ore, oreData.bg, settings);

    if (progress !== undefined) {
        setProgress(x, y, z, undefined, progress);
    }
    
    if (ores[oreData.ore]?.tree) {
        let h = ores[oreData.ore].tree.height || {min: 4, max: 4};
        if (typeof h === "number") h = {min: h, max: h};
        const height = Math.floor(Math.random() * (h.max - h.min + 1)) + h.min;
        const settings2 = {...settings};
        if (ores[oreData.ore].tree.allowTransparent) settings2.allowTransparent = true;
        generateTree(
            x, y, z,
            oreData.ore,
            typeof ores[oreData.ore].tree.leaves.block === "function" ? ores[oreData.ore].tree.leaves.block(x, y, z) : ores[oreData.ore].tree.leaves.block,
            height,
            typeof ores[oreData.ore].tree.leaves.size === "function" ? ores[oreData.ore].tree.leaves.size(x, y, z) : ores[oreData.ore].tree.leaves.size,
            settings2
        );
    }
    return map.at(x, y, z);
}

function generateAdjacent(x, y, z, settings) {
    if (settings === true) settings = {caveExclusive: true};
    spawnOre(x + 1, y, z, settings);
    spawnOre(x - 1, y, z, settings);
    spawnOre(x, y + 1, z, settings);
    spawnOre(x, y - 1, z, settings);
    spawnOre(x, y, z + 1, settings);
    spawnOre(x, y, z - 1, settings);
}

function generateCave(x, y, z) {
    x = Math.round(x);
    y = Math.round(y);
    z = Math.round(z);
}

function generateVein(x, y, z, ore, count, isGuaranteed, chance, conditionLabel, settings = {}) {
    let num = settings.num;
    let positions = [];
    if (typeof ore !== "string" || !ores[ore]) return;
    x = Math.round(x);
    y = Math.round(y);
    z = Math.round(z);
    let count2 = 0;
    let r = Math.floor(Math.cbrt(count) + 1);
    veinID++;

    const candidates = [];
    for (let x1 = x - r; x1 <= x + r; x1++) {
        for (let y1 = y - r; y1 <= y + r; y1++) {
            for (let z1 = z - r; z1 <= z + r; z1++) {
                if (x1 === x && y1 === y && z1 === z) continue;
                if (Math.sqrt((x1 - x) ** 2 + (y1 - y) ** 2 + (z1 - z) ** 2) < r && Math.random() < 0.75) {
                    candidates.push({x: x1, y: y1, z: z1});
                }
            }
        }
    }

    // Shuffle candidates
    for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    for (let i = 0; i < candidates.length; i++) {
        const pos = candidates[i];
        if (count2 >= count) break;
        const oreData = generateOre(pos.x, pos.y, pos.z, ore, getBGOre(pos.x, pos.y, pos.z) ?? "shale", {isVein: true, veinCount: count + 1, noUpdate: true, chance, conditionLabel, properties: {veinID}});
        if (oreData && oreData.ore === ore) {
            positions.push(pos);
            count2++;
        }
    }
    let end = "";
    if (num) {
        const chance1 = (1 - num) * settings.originalChance * (isGuaranteed ? 1 : VEIN_CHANCE);
        const chance2 = (1 - num) * chance * (isGuaranteed ? 1 : VEIN_CHANCE);

        if (1 / chance2 > stats.lowestRNG) {
            stats.lowestRNG = 1 / chance2;
        }
    }
    if (ores[ore].textureHasTransparency && !ores[ore].allowTransparent || ores[ore].forceAdjacent) {
        for (let i = 0; i < positions.length; i++) {
            const pos = positions[i];
            generateAdjacent(pos.x, pos.y, pos.z, {noUpdate: true});
        }
    }

    if (count2 + 1 > stats.largestVein) {
        stats.largestVein = count2 + 1;
    }
}

function generateGeode(x, y, z, radius = 4, ore, chance1, isGuaranteed, conditionLabel, settings = {}) {
    let num = settings.num;
    if (typeof ore !== "string" || !ores[ore]) return;
    const outerGeode = layers[getLayer(y, x, z, false)]?.geode ?? "chalcedony";
    x = Math.round(x);
    y = Math.round(y);
    z = Math.round(z);
    geodeID++;
    // only generate on the outermost layer
    for (let x1 = x - radius; x1 < x + radius; x1++) {
        for (let y1 = y - radius; y1 < y + radius; y1++) {
            if (y1 === ores.barrier.maxY) continue;
            for (let z1 = z - radius; z1 < z + radius; z1++) {
                if (Math.sqrt((x1 - x) ** 2 + (y1 - y) ** 2 + (z1 - z) ** 2) < radius) {
                    if (Math.sqrt((x1 - x) ** 2 + (y1 - y) ** 2 + (z1 - z) ** 2) < radius - 1) {
                        if (Math.sqrt((x1 - x) ** 2 + (y1 - y) ** 2 + (z1 - z) ** 2) >= radius - 2) {
                            generateOre(x1, y1, z1, ore, null, {isGeode: true, chance: chance1, conditionLabel, properties: {geodeID}});
                        } else {
                            if (!map.at(x1, y1, z1)) map.at(x1, y1, z1, true);
                        }
                    } else {
                        generateOre(x1, y1, z1, outerGeode, outerGeode);
                    }
                }
            }
        }
    }

    const chance = settings.originalChance * (1 - num) * (isGuaranteed ? 1 : GEODE_CHANCE);
    const chance2 = chance1 * (1 - num) * (isGuaranteed ? 1 : GEODE_CHANCE);

    if (1 / chance2 > stats.lowestRNG) {
        stats.lowestRNG = 1 / chance2;
    }
    if (radius > stats.largestGeode) {
        stats.largestGeode = radius;
    }
}

function generateTree(x, y, z, trunk, leaves, height = 4, leafSize = 2, settings = {}) {
    settings.isTree = true;
    settings.isVein = true;
    for (let y1 = y; y1 < y + height; y1++) {
        generateOre(x, y1, z, trunk, trunk, settings);
    }
    for (let x1 = x - leafSize; x1 <= x + leafSize; x1++) {
        for (let y1 = y + height - leafSize; y1 <= y + height + leafSize; y1++) {
            for (let z1 = z - leafSize; z1 <= z + leafSize; z1++) {
                if (Math.sqrt((x1 - x) ** 2 + (y1 - y - height) ** 2 + (z1 - z) ** 2) < leafSize + 0.5) {
                    generateOre(x1, y1, z1, leaves, leaves, settings);
                }
            }
        }
    }
}

function getStructurePlacementData(structure, gridX, gridY, gridZ) {
    const structureID = structure.id || "unknown";
    const structureSeed = structureID.split("").reduce((seed, char) => (seed * 31 + char.charCodeAt(0)) | 0, 0);
    const getStructureOffset = (axis, maxOffset) => {
        if (maxOffset <= 0) return 0;
        const salt = axis === "x" ? 137 : axis === "y" ? 911 : 2713;
        const value = rand01(gridX + salt, gridY - salt, gridZ + salt, vars.seed ^ structureSeed);
        return Math.floor(value * (maxOffset * 2 + 1)) - maxOffset;
    };
    
    const gridJitter = typeof structure.gridJitter === "number" ? Math.max(0, Math.min(0.5, structure.gridJitter)) : 0.5;
    const maxOffsetX = Math.floor((structure.width - 1) * gridJitter);
    const maxOffsetY = Math.floor((structure.height - 1) * gridJitter);
    const maxOffsetZ = Math.floor((structure.depth - 1) * gridJitter);
    const jitterX = getStructureOffset("x", maxOffsetX);
    const jitterY = getStructureOffset("y", maxOffsetY);
    const jitterZ = getStructureOffset("z", maxOffsetZ);
    
    const x = gridX * structure.width + structure.gridOffset.x + jitterX;
    const y = gridY * structure.height + structure.gridOffset.y + jitterY;
    const z = gridZ * structure.depth + structure.gridOffset.z + jitterZ;
    
    return {
        x,
        y,
        z,
        centerX: Math.floor(x + structure.width / 2),
        centerY: Math.floor(y + structure.height / 2),
        centerZ: Math.floor(z + structure.depth / 2)
    };
}

export function generateStructure(gridX, gridY, gridZ, structure, settings) {
    if (settings === undefined) settings = {};
    if (settings === true) settings = {forceLocation: true};
    const str = structures[structure];
    if (!generatedStructures[structure]) generatedStructures[structure] = {};
    if (!str) return;
    
    const structurePos = getStructurePlacementData(str, gridX, gridY, gridZ);
    let x = structurePos.x;
    let y = structurePos.y;
    let z = structurePos.z;
    if (settings.centerX === undefined) settings.centerX = structurePos.centerX;
    if (settings.centerY === undefined) settings.centerY = structurePos.centerY;
    if (settings.centerZ === undefined) settings.centerZ = structurePos.centerZ;
    
    if (settings.absPos) {
        if (!settings.noCenter) {
            x = gridX - Math.floor(str.width / 2);
            y = gridY - Math.floor(str.height / 2);
            z = gridZ - Math.floor(str.depth / 2);
            
            settings.centerX = gridX;
            settings.centerY = gridY;
            settings.centerZ = gridZ;
        } else {
            x = gridX;
            y = gridY;
            z = gridZ;
            
            settings.centerX = gridX + Math.floor(str.width / 2);
            settings.centerY = gridY + Math.floor(str.height / 2);
            settings.centerZ = gridZ + Math.floor(str.depth / 2);
        }
    } else {
        generatedStructures[structure][`${gridX}_${gridY}_${gridZ}`] = true;
    }
    
    let empty = [];
    
    if (str.key && str.layout) {
        const key = JSON.parse(JSON.stringify(str.key));
        for (const k in str.key) {
            if (typeof str.key[k] === "function") {
                key[k] = str.key[k](x, y, z);
            }
        }
        for (const y1 in str.layout) {
            for (const x1 in str.layout[y1]) {
                for (const z1 in str.layout[y1][x1]) {
                    const block = key[str.layout[y1][x1][z1]];
                    
                    const x2 = x + Number(x1);
                    const y2 = y + Number(y1);
                    const z2 = z + Number(z1);
                    
                    if (block === null) continue;
                    if (block) {
                        if (settings.allowOverride) {
                            spawnOre(x2, y2, z2, settings);
                        }
                        const isAir = airAt(x2, y2, z2);
                        if (isAir && !settings.forced && !map.at(x2, y2, z2).temp) continue;
                        if (map.at(x2, y2, z2) && !isAir && settings.forced !== 2 && !map.at(x2, y2, z2).temp) continue;
                        if (block === "air") {
                            if (settings.forced) removeOre(x2, y2, z2, {type: "structure"});
                            map.at(x2, y2, z2, true);
                            empty.push(x2, y2, z2);
                        } else if (ores[block]) {
                            if (settings.forced) removeOre(x2, y2, z2, {fullyRemove: true, type: "structure"});
                            generateOre(x2, y2, z2, block, getBGOre(x2, y2, z2), settings || {noUpdate: true});
                            if (ores[block].textureHasTransparency && !ores[block].allowTransparent || ores[block].forceAdjacent) {
                                empty.push(x2, y2, z2);
                            }
                        }
                    }
                }
            }
        }
    } else if (str.format === "snbt" || str.palette && str.blocks) {
        const palette = str.palette;
        for (let i = 0; i < str.blocks.length; i++) {
            const {pos, state} = str.blocks[i];
            if (palette[state].name === "air") {
                if (settings.forced) removeOre(x + pos[0], y + pos[1], z + pos[2], {type: "structure"});
                map.at(x + pos[0], y + pos[1], z + pos[2], true);
                empty.push(x + pos[0], y + pos[1], z + pos[2]);
                continue;
            } else if (palette[state].name === "structureVoid") {
                if (settings.forced) removeOre(x + pos[0], y + pos[1], z + pos[2], {fullyRemove: true, type: "structure"});
                continue;
            }
            if (ores[palette[state].name].textureHasTransparency && !ores[palette[state].name].allowTransparent || ores[palette[state].name].forceAdjacent) {
                empty.push(x + pos[0], y + pos[1], z + pos[2]);
            }
            if (settings.forced) removeOre(x + pos[0], y + pos[1], z + pos[2], {fullyRemove: true, type: "structure"});
            generateOre(
                x + pos[0],
                y + pos[1],
                z + pos[2],
                palette[state].name,
                getBGOre(x + pos[0], y + pos[1], z + pos[2]),
                settings || {}
            );
        }
    }
    
    for (let i = 0; i < empty.length; i += 3) {
        const x1 = empty[i];
        const y1 = empty[i + 1];
        const z1 = empty[i + 2];
        generateAdjacent(x1, y1, z1, {noUpdate: true});
    }
    
    if (str.onGenerate !== undefined) str.onGenerate(x, y, z);
    
    if (str.log !== false) console.log(`Generated structure ${structure} at ${settings.centerX}, ${settings.centerY}, ${settings.centerZ} (grid: ${gridX}, ${gridY}, ${gridZ}; world: ${x}, ${y}, ${z})`);
}

function generateChunk(x, z) {
    const sets = {noVein: true, noGeode: true, forceReplace: ["leaves", "autumnalLeaves"], surface: true};
    const sets2 = {noVein: true, noGeode: true, forceReplace: ["leaves", "autumnalLeaves"]};
    for (let x1 = x * CHUNK_SIZE; x1 < (x + 1) * CHUNK_SIZE; x1++) {
        for (let z1 = z * CHUNK_SIZE; z1 < (z + 1) * CHUNK_SIZE; z1++) {
            const y1 = topLayer(x1, z1);
            spawnOre(x1, y1, z1, sets);
            spawnOre(x1, y1 + 1, z1, sets);
            let y = y1;
            function check(y) {
                for (const pos of [[x1 - 1, z1], [x1 + 1, z1], [x1, z1 - 1], [x1, z1 + 1]]) {
                    if (y > topLayer(pos[0], pos[1])) return false;
                }
                return true;
            }
            while (!check(--y)) {
                spawnOre(x1, y, z1, sets2);
            }
            spawnOre(x1, layers.sky.min, z1, sets);
        }
    }
}

function generateChunk3(x, y, z) { // used for places like space
    let generatedAny = false;
    let startTime = performance.now();
    const sets = {};
    for (let x1 = x * CHUNK_SIZE_3; x1 < (x + 1) * CHUNK_SIZE_3; x1++) {
        for (let y1 = y * CHUNK_SIZE_3; y1 < (y + 1) * CHUNK_SIZE_3; y1++) {
            for (let z1 = z * CHUNK_SIZE_3; z1 < (z + 1) * CHUNK_SIZE_3; z1++) {
                const sets1 = {...sets};
                const fromSave = checkAdjacent(x1, y1, z1, (x, y, z) => saveMap.at(x, y, z), true);
                const isCaveAir = checkAdjacent(x1, y1, z1, isCave);
                let caveData;

                if (!fromSave) {
                    if (
                        map.at(x1, y1, z1) && !map.at(x1, y1, z1).temp
                        || layers[getLayer(y1, x1, z1, false)].chunks !== "3d"
                        && layers[getLayer(y1 - 1, x1, z1, false)].chunks !== "3d"
                        && layers[getLayer(y1 + 1, x1, z1, false)].chunks !== "3d"
                        && !isCaveAir
                    ) continue;
                    if (isCaveAir) {
                        caveData = map.at(...isCaveAir);
                        sets1.caveType = caveData.caveType;
                        sets1.hasCrates = caveData.hasCrates;
                        sets1.hasTorches = caveData.hasTorches;
                        sets1.hasCrystals = caveData.hasCrystals;
                    }
                }
                
                spawnOre(x1, y1, z1, sets1);
                generatedAny = true;
            }
        }
    }

    return generatedAny;
}

function loadNearbyChunks() {
    const playerX = perspectiveCamera.position.x,
    playerY = perspectiveCamera.position.y,
    playerZ = perspectiveCamera.position.z;
    
    function chunkToPlayer(a) {
        return Math.hypot(a.split("_")[0] - playerX / CHUNK_SIZE, a.split("_")[1] - playerZ / CHUNK_SIZE) * CHUNK_SIZE;
    }
    
    function chunkToPlayer3(a) {
        const [ax, ay, az] = a.split("_").map(Number);
        return Math.abs(ax * CHUNK_SIZE_3 - playerX) + Math.abs(ay * CHUNK_SIZE_3 - (playerY)) + Math.abs(az * CHUNK_SIZE_3 - playerZ);
    }
    
    if (!vars.PAUSED) {
        const GEN_SIZE = Math.ceil(GENERATION_DISTANCE / CHUNK_SIZE);
        if (playerY > topLayer(playerX, playerZ) - 4 && playerY < layers.sky.min + 0.5) {
            for (let x = -GEN_SIZE; x < GEN_SIZE; x++) {
                for (let z = -GEN_SIZE; z < GEN_SIZE; z++) {
                    generatingChunks.push(`${Math.floor(playerX / CHUNK_SIZE) + x}_${Math.floor(playerZ / CHUNK_SIZE) + z}`);
                }
            }
        } else {
            generatingChunks.length = 0;
        }
        
        generatingChunks = Array.from(new Set(generatingChunks.filter(g => !generatedChunks.has(g) && chunkToPlayer(g) < GENERATION_DISTANCE)));
        generatingChunks.sort((a, b) => { // Sort chunks by distance to the player
            const distA = chunkToPlayer(a);
            const distB = chunkToPlayer(b);
            return distA - distB;
        });
        for (let i = 0; i < Math.min(generatingChunks.length, 1); i++) {
            const [x, z] = generatingChunks[i].split("_").map(Number);
            generateChunk(x, z);
            generatedChunks.add(`${x}_${z}`);
        }
        generatingChunks.shift();
        
        generatingChunks3 = Array.from(new Set(generatingChunks3.filter(g => !generatedChunks.has(g) && chunkToPlayer3(g) < GENERATION_DISTANCE)));
        const dist = (a, b) => { // Sort chunks by distance to the player
            const distA = chunkToPlayer3(a);
            const distB = chunkToPlayer3(b);
            return distA - distB;
        };
        generatingChunks3.sort(dist);
        let i = 0;
        let check = Math.min(generatingChunks3.length, layers[CURRENT_LAYER]?.chunkGenSpeed || CHUNK3_RATE);
        while (check > 0) {
            if (generatingChunks3.length === 0 || !generatingChunks3[i]) break;
            const [x, y, z] = generatingChunks3[i++].split("_").map(Number);
            if (generateChunk3(x, y, z)) check--;
            else check -= 0.25;
            generatedChunks.add(`${k(x, y, z)}`);
        }
        generatingChunks3.shift();
        
        // if (player.position.y > layers.sky.min - 15 && player.position.y < layers.space.max || layers[CURRENT_LAYER]?.chunks === "3d") {
        const playerPosChunk = {
            x: Math.floor(playerX / CHUNK_SIZE_3),
            y: Math.floor(playerY / CHUNK_SIZE_3),
            z: Math.floor(playerZ / CHUNK_SIZE_3)
        };
        
        const GEN_RADIUS = layers[CURRENT_LAYER]?.chunkRadius || Math.ceil(GENERATION_DISTANCE / CHUNK_SIZE_3 / 4);
        
        for (let dx = -GEN_RADIUS; dx <= GEN_RADIUS; dx++) {
            for (let dy = -GEN_RADIUS; dy <= GEN_RADIUS; dy++) {
                for (let dz = -GEN_RADIUS; dz <= GEN_RADIUS; dz++) {
                    const chunkKey = `${Math.round(playerPosChunk.x + dx)}_${Math.round(playerPosChunk.y + dy)}_${Math.round(playerPosChunk.z + dz)}`;
                    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) * CHUNK_SIZE_3;
                    
                    if (!generatedChunks.has(chunkKey) && distance < GENERATION_DISTANCE) {
                        generatingChunks3.push(chunkKey);
                    }
                }
            }
        }
        // }
    }
}

function miningTick() {
    let updatedBreak = false;
    getElementById("miningTime").style.display = "block";
    getElementById("mining-progress").style.display = "block";
    
    const intersect = LAST_ORE[4];
    const oldIntersect = CURRENT_ORE[4];
    
    const x = LAST_ORE[0], y = LAST_ORE[1], z = LAST_ORE[2];
    if (CURRENT_ORE[0] !== x || CURRENT_ORE[1] !== y || CURRENT_ORE[2] !== z) {
        if (vars.miningStartTime < performance.now() && CURRENT_ORE && map.at(CURRENT_ORE[0], CURRENT_ORE[1], CURRENT_ORE[2]) && oreAt(CURRENT_ORE[0], CURRENT_ORE[1], CURRENT_ORE[2])) {
            setProgress(CURRENT_ORE[0], CURRENT_ORE[1], CURRENT_ORE[2]);
        }
        if (intersect <= inventory.currentPickaxe.range) vars.miningStartTime = performance.now() + inventory.currentPickaxe.delay * 1000;
        else {
            CURRENT_ORE = [];
            vars.miningStartTime = undefined;
            return;
        }
    }

    if (!(vars.miningStartTime < performance.now())) {
        getElementById("miningTime").innerText = formatTime((map.at(x, y, z).str) / calculatePower(x, y, z) * (1 - (map.at(x, y, z).progress || 0))).replace("Infinity", "Unbreakable") + " + " + ((vars.miningStartTime - performance.now()) / 1000).toFixed(2) + " sec";
        getElementById("miningTime").style.color = "#ff0";
        getElementById("mining-progress").style.setProperty("--color", "#ff0");
        if (inventory.currentPickaxe.delay >= 0.2) getElementById("mining-progress").value = (((vars.miningStartTime - performance.now()) / 1000 / inventory.currentPickaxe.delay)) * 100;
        else getElementById("mining-progress").value = 0;
    }
    
    CURRENT_ORE = LAST_ORE;
    
    let progress = setProgress(x, y, z, true) * 100;
    if (Math.abs(progress) === Infinity) progress = 100;
    if (isNaN(progress)) {
        progress = 0;
    }
    if (progress > 100) progress = 100;
    if (progress < 0) progress = 0;
    
    if (!updatedBreak && performance.now() >= vars.miningStartTime) updateBreakMesh(x, y, z, map.at(x, y, z), progress / 100);
    
    if (progress >= 100) {
        mine(x, y, z);
    } else if (vars.miningStartTime < performance.now()) {
        getElementById("miningTime").innerText = formatTime((map.at(x, y, z).str) / calculatePower(x, y, z) * (1 - progress / 100)).replace("Infinity", "Unbreakable");
        getElementById("miningTime").style.color = "#fff";
        getElementById("mining-progress").value = progress;
        getElementById("mining-progress").style.setProperty("--color", (map.at(x, y, z).color || map.at(x, y, z).ore ? ores[map.at(x, y, z).ore].color : "#888") || "#888");
        getElementById("mining-progress").style.setProperty("--size", getElementById("mining-progress").offsetWidth + "px");
    }
}

function setProgress(x, y, z, dontSet = false, forcedProgress, noAdd = false) {
    const pos = map.at(x, y, z);
    let updated = false;
    let progress = forcedProgress !== undefined ? forcedProgress : (performance.now() - vars.miningStartTime) / (pos.str * 1000) * calculatePower(x, y, z) + (pos.progress || 0);
    if (calculatePower(x, y, z) === Infinity) progress = 100;
    if (!dontSet) {
        pos.progress = progress;
        if (pos.progress > 1) {
            updateBreakMesh(x, y, z, pos, 2);
            if (!noAdd) mine(x, y, z);
            updated = true;
        } else if (pos.progress < 0) pos.progress = 0;
        
        if (!updated) updateBreakMesh(x, y, z, pos);

        setInteracted(x, y, z);
    }
    return progress;
}

function updateBreakMesh(x, y, z, pos = map.at(x, y, z), progress = pos.progress) {
    if (ores[pos?.background]?.customModel || pos === undefined || ores[pos?.ore] === undefined) return;

    const breakState = Math.min(Math.max(Math.floor(progress * 16), 0), 15);
    let obj = breakMap.at(x, y, z);
    const chunkKey = getChunkKey(x, y, z, MESH_CHUNK_SIZE);
    const chunkSplit = getChunkKey(x, y, z, MESH_CHUNK_SIZE, true).map(a => a * MESH_CHUNK_SIZE);

    const meshID = `break${breakState}_${chunkKey}`;
    let count = meshCounts[meshID] ?? 0;
    let longID = `${meshID}_${count}`;
    let needsRefresh = obj.state !== breakState;

    if (!obj) {
        if (progress >= 1) return;
        if (meshes[longID]?.thinInstanceCount >= MAX_MESH_COUNT) {
            count++;
            longID = `${meshID}_${count}`;
        }

        breakMap.at(x, y, z, {
            state: breakState,
            meshID: longID
        });
        obj = breakMap.at(x, y, z);
    } else if (needsRefresh || progress >= 1) {
        const oldMesh = meshes[obj.meshID];

        const lastIdxCoords = oldMesh.metadata.coords[oldMesh.thinInstanceCount - 1];
        oldMesh.metadata.coords[obj.index] = lastIdxCoords;
        delete oldMesh.metadata.coords[oldMesh.thinInstanceCount - 1];
        breakMap.at(...lastIdxCoords).index = obj.index;

        removeThinInstance(oldMesh, obj.index);
        
        if (progress >= 1) {
            breakMap.at(x, y, z, "delete");
            return false;
        }

        obj.state = breakState;
        obj.meshID = longID;
    }

    if (meshes[longID] === undefined) {
        const mesh = BABYLON.MeshBuilder.CreateBox(longID, {size: 1, wrap: true}, scene);
        mesh.position.set(...chunkSplit);
        
        const material = new BABYLON.StandardMaterial(`breakMaterial-${longID}`, scene);
        material.diffuseTexture = getTexture(`break${breakState}`, "src", undefined, true);
        material.roughness = 1;
        material.specularColor = new BABYLON.Color3(0, 0, 0);
        material.useAlphaFromDiffuseTexture = true;
        
        mesh.material = material;
        meshes[longID] = mesh;
    }

    if (needsRefresh) {
        if (pos.scale === undefined) return console.warn(x, y, z, map.at(x, y, z), breakMap.at(x, y, z));
        const mesh = meshes[longID];
        mesh.thinInstanceAdd(
            BABYLON.Matrix.Scaling(pos.scale.x * 1.001, pos.scale.y * 1.001, pos.scale.z * 1.001)
            .multiply(BABYLON.Matrix.Translation(pos.offset.x, pos.offset.y, pos.offset.z))
            .multiply(BABYLON.Matrix.RotationYawPitchRoll(pos.rotation.y, pos.rotation.x, pos.rotation.z))
            .multiply(BABYLON.Matrix.Translation(x - chunkSplit[0], y - chunkSplit[1], z - chunkSplit[2]))
        );
        obj.index = mesh.thinInstanceCount - 1;
        if (mesh.metadata === null) mesh.metadata = {};
        if (mesh.metadata.coords === undefined) mesh.metadata.coords = {};
        mesh.metadata.coords[obj.index] = [x, y, z];
    }
}

function updateTopLeft() {
    getElementById("health").value = player.health;
    getElementById("radiation").value = Math.max(Math.log2(player.radiation + 1), 0);
    getElementById("healthText").innerText = `${formatNum(player.health, 2)} HP`;
    getElementById("radiationText").innerText = `${formatNum(player.radiation, 3)} Rads`;
    const debugMode = getElementById("totalOres").style.display !== "none";
    if (player.radiation > 12.5) {
        getElementById("radiation").classList.add("danger");
    } else {
        getElementById("radiation").classList.remove("danger");
    }
    getElementById("depth").innerText = `${player.position.y < 0 ? "Depth" : "Altitude"}: ${Math.abs(player.position.y).toLocaleString(undefined, {maximumFractionDigits: 1})}m (${layers[CURRENT_LAYER] ? layers[CURRENT_LAYER].name : biomes[CURRENT_LAYER] ? biomes[CURRENT_LAYER].name : "Unknown"})`;
    getElementById("position").innerText = `Position: ${player.position.x.toLocaleString(undefined, {maximumFractionDigits: debugMode ? 3 : 1})}, ${(player.position.y).toLocaleString(undefined, {maximumFractionDigits: debugMode ? 3 : 1})}, ${player.position.z.toLocaleString(undefined, {maximumFractionDigits: debugMode ? 3 : 1})}`.replaceAll("-0,", "0,");
    getElementById("power").innerText = `Pickaxe Power: ${formatNum(1 / (Math.abs(player.position.y) + 1000) * 1000 * calculatePower(player.position.x, player.position.y, player.position.z))}`;
    getElementById("time").innerText = `Time: ${getTimeString()}`;
    
    getElementById("totalOres").innerText = `Ores: ${totalOres.toLocaleString()}
    Meshes: ${Object.keys(meshes).length.toLocaleString()}
    Lights: ${lightArr.length.toLocaleString()} | ${scene.lights.length}
    Generating Chunks: ${generatingChunks.length.toLocaleString()}, ${generatingChunks3.length.toLocaleString()}
    Velocity: ${formatNum(player.velocity.x * 60, 2)}, ${formatNum(player.velocity.y * 60, 2)}, ${formatNum(player.velocity.z * 60, 2)}
    `;
}

function mine(x, y, z, settings = {}) {
    if (airAt(x, y, z)) return;
    
    getElementById("mining-progress").value = 0;
    const ore = map.at(x, y, z).ore;
    if (!ores[ore]) console.log(ore, x, y, z, map.at(x, y, z));
    const dropCount = vars.itemMultiplier * Math.round(map.at(x, y, z).yield || 1);
    const drops = map.at(x, y, z)?.drops ?? ores[ore]?.drops;
    if (drops !== undefined) {
        if (Array.isArray(drops)) {
            for (let i = 0; i < drops.length; i++) {
                inventory.addItem(drops[i].id, (typeof drops[i].count === "function" ? drops[i].count(arguments) : drops[i].count) * dropCount);
            }
        } else if (typeof drops === "object") {
            inventory.addItem(drops.id, (typeof drops.count === "function" ? drops.count(arguments) : drops.count) * dropCount);
        }
        
        inventory.addItem(ore, 0);
    } else {
        inventory.addItem(ore, dropCount);
    }
    const chance = map.at(x, y, z).chance || calculateRarity(ores[ore], y, x, z);
    
    if (!map.at(x, y, z).placed) {
        stats.totalOresMined++;
        stats.oresMined[ore] = (stats.oresMined[ore] || 0) + 1;
        
        if (chance !== 0 && 1 / chance > stats.lowestRNG) {
            stats.lowestRNG = 1 / chance;
        }
        if (chance !== 0 && 1 / chance > stats.lowestOreRNG) {
            stats.lowestOreRNG = 1 / chance;
        }
    }
    
    if (ores[ore].onBreak) ores[ore].onBreak(x, y, z, inventory);
    removeOre(x, y, z, settings);
    generateAdjacent(x, y, z, {forceUpdate: true});
    
    if (!settings.noExplosion && inventory.currentPickaxe.explosion) {
        const radius = inventory.currentPickaxe.explosion.radius || 1;
        if (Math.random() < (inventory.currentPickaxe.explosion.chance || 1)) {
            for (let x1 = x - radius; x1 <= x + radius; x1++) {
                for (let y1 = y - radius; y1 <= y + radius; y1++) {
                    for (let z1 = z - radius; z1 <= z + radius; z1++) {
                        const r = Math.sqrt((x1 - x) ** 2 + (y1 - y) ** 2 + (z1 - z) ** 2);
                        if (r < radius) {
                            let exists;
                            if (map.at(x1, y1, z1)) {
                                const oreData = map.at(x1, y1, z1);
                                if (oreAt(x1, y1, z1) && ores[oreData.ore]) exists = true;
                            } else {
                                spawnOre(x1, y1, z1);
                                if (oreAt(x1, y1, z1)) exists = true;
                            }
                            
                            if (exists) {
                                let progress = map.at(x1, y1, z1).progress || 0;
                                progress += (inventory.currentPickaxe.explosion.power || calculatePower(x, y, z) || 1) / r / map.at(x1, y1, z1).str;
                                if (progress >= 1) {
                                    updateBreakMesh(x1, y1, z1, undefined, 2);
                                    mine(x1, y1, z1, {noExplosion: true});
                                } else setProgress(x1, y1, z1, false, progress);
                            }
                        }
                    }
                }
            }
        }
    }
    if (inventory.currentPickaxe.onMine) {
        inventory.currentPickaxe.onMine(x, y, z);
    }
    stats.toolsUsed[inventory.currentPickaxe.id] = (stats.toolsUsed[inventory.currentPickaxe.id] || 0) + 1;
}

function rightClick() {
    const raycaster = perspectiveCamera.getForwardRay();
    const hit = scene.pickWithRay(raycaster, pickPredicate);
    const used = useSelectedItem();
    
    const picked = getPickedOreCoords(hit);
    if (!picked) return;
    /** @type {BABYLON.Mesh} */
    const mesh = hit.pickedMesh;
    const matrix = mesh.thinInstanceGetWorldMatrices()[hit.thinInstanceIndex];
    const relativeFace = hit.getNormal(false).rotateByQuaternionToRef(BABYLON.Quaternion.FromRotationMatrix(matrix), new BABYLON.Vector3());
    if (!relativeFace) return;
    let rightClickFunc = false;
    
    if (!used && hit.hit && hit.distance < inventory.currentPickaxe.range) {
        const {x, y, z} = picked;
        
        if (ores[map.at(x, y, z).ore].onUse) {
            ores[map.at(x, y, z).ore].onUse(x, y, z);
            rightClickFunc = true;
            return;
        }
        
        const {x: dx, y: dy, z: dz} = relativeFace;
        const newX = x + dx, newY = y + dy, newZ = z + dz;
        const bg = !(ores[inventory.hotbar[inventory.SELECTED_HOTBAR]] && ores[inventory.hotbar[inventory.SELECTED_HOTBAR]].singleLayer) ? getOre(newX, newY, newZ).bg : inventory.hotbar[inventory.SELECTED_HOTBAR];
        
        if (inventory.getCount(inventory.hotbar[inventory.SELECTED_HOTBAR]) > 0 && ores[inventory.hotbar[inventory.SELECTED_HOTBAR]] && (!oreAt(newX, newY, newZ))) {
            const placeSets = {isGeode: false, isVein: false, placed: true, forced: true};
            if (ores[inventory.hotbar[inventory.SELECTED_HOTBAR]].placeSettings?.rotate?.allAxes) {
                // convert rotationVector to an angle pointing away from the face it was placed on (assuming default is y+)
                const up = new BABYLON.Vector3(0, 1, 0);
                const axis = up.cross(relativeFace).normalize();
                const angle = Math.acos(up.dot(relativeFace));
                placeSets.rotation = { x: axis.x * angle, y: axis.y * angle, z: axis.z * angle };
                if (relativeFace.y === -1) {
                    placeSets.rotation = { x: Math.PI, y: 0, z: 0 };
                }
            }
            
            generateOre(newX, newY, newZ, inventory.hotbar[inventory.SELECTED_HOTBAR], bg ?? "shale", placeSets);
            
            if (checkCollision(player.position)) removeOre(newX, newY, newZ, placeSets);
            else inventory.addItem(inventory.hotbar[inventory.SELECTED_HOTBAR], -1);
        }
    }
    
}

function useSelectedItem() {
    const oldNV = player.nightVision;
    const id = inventory.hotbar[inventory.SELECTED_HOTBAR];
    if (items[id] && items[id].onUse && inventory.getCount(id) > 0) {
        items[id].onUse();
        stats.itemsUsed[id] = (stats.itemsUsed[id] || 0) + 1;
        
        if (oldNV !== player.nightVision) {
            if (!player.nightVision) {
                cameraLight.diffuse = ambientLight.color;
                cameraLight.intensity = ambientLight.intensity * 6;
                getElementById("nightVisionOverlay").style.display = "none";
            } else {
                cameraLight.diffuse = BABYLON.Color3.FromHexString("#91eb36");
                cameraLight.intensity = 5;
                getElementById("nightVisionOverlay").style.display = "block";
            }
        }
        return true;
    }
    return false;
}

function itemTick() {
    if (vars.weatherRadar) {
        if (player.position.y > -10 && player.position.y < 1000) {
            const weather = getBiomeNumber(player.position.x, Math.max(Math.min(player.position.y, 999), layers.sky.min), player.position.z, "rainy");
            if (weather < -0.5) {
                getElementById("weather").innerHTML = "Weather: Clear";
            } else if (weather < 0) {
                getElementById("weather").innerHTML = "Weather: Partly Cloudy";
            } else if (weather < 0.4) {
                getElementById("weather").innerHTML = "Weather: Cloudy";
            } else if (weather < 0.475) {
                getElementById("weather").innerHTML = "Weather: Drizzle";
            } else if (weather < 0.55) {
                getElementById("weather").innerHTML = "Weather: Light Rain";
            } else if (weather < 0.625) {
                getElementById("weather").innerHTML = "Weather: Rain";
            } else if (weather < 0.7) {
                getElementById("weather").innerHTML = "Weather: Heavy Rain";
            } else if (weather < 0.85) {
                getElementById("weather").innerHTML = "Weather: Thunderstorm";
            } else if (weather < 1) {
                getElementById("weather").innerHTML = "Weather: Severe Thunderstorm";
            } else {
                getElementById("weather").innerHTML = "Weather: Is the world ending?";
            }
            if (getTemperature(player.position.x, player.position.y, player.position.z) < 0) {
                getElementById("weather").innerHTML = getElementById("weather").innerHTML
                .replace("Rain", "Snow")
                .replace("Drizzle", "Flurries")
                .replace("Severe Thunderstorm", "Blizzard")
                .replace("Thunderstorm", "Snowstorm");
            }
            getElementById("weather").innerHTML += ` (${(weather * 50 + 50).toLocaleString(undefined, {maximumFractionDigits: 1})}%)`
            + `<br>Temperature: ${getTemperature(player.position.x, player.position.y, player.position.z).toLocaleString(undefined, {maximumFractionDigits: 2})}°C`
            + `<br>Humidity: ${(getHumidity(player.position.x, player.position.y, player.position.z) * 50 + 50).toLocaleString(undefined, {maximumFractionDigits: 2})}%`;
        } else {
            getElementById("weather").innerHTML = `Weather: ---<br>Temperature: ---`;
        }
    } else {
        getElementById("weather").innerHTML = "";
    }
}

for (let i = 0; i < oreArray.length; i++) {
    const ore = oreArray[i];

    if (ore.customModel && ore.noCollision === undefined) ore.noCollision = true;

    if (ore.getCanvas) {
        ore.canvasElem = document.createElement("canvas");
        ore.canvasElem.width = 32;
        ore.canvasElem.height = 32;
        if (ore.updateCanvas) animatedCanvases.push(ore.id);
        textures[ore.id + "_ore"] = new BABYLON.DynamicTexture(`${ore.name}CanvasTexture`, ore.getCanvas(), scene, true, BABYLON.Texture.NEAREST_SAMPLINGMODE, undefined, true);
        textures[ore.id + "_ore"]?.update();
    }
}

function start() {
    vars.sessionStart = performance.now();
    locations[0][1] = topLayer(locations[0][0], locations[0][2]) + 1;

    if (new URLSearchParams(location.search).has("spawn")) {
        const spawn = new URLSearchParams(location.search).get("spawn").split(",").map(Number);
        teleport(...spawn);
    } else if (vars.save.position) {
        teleport(vars.save.position.x, vars.save.position.y, vars.save.position.z, vars.save.rotation._x, vars.save.rotation._y);
    } else {
        player.position.y = locations[0][1] + 1;
    }
    player.rotation = perspectiveCamera.rotation;
    
    for (let i = 0; i < locations.length; i++) {
        const location = locations[i];
        const [x, y, z] = location;
        if (!saveMap.at(x, y, z)) generateOre(x, y - 1, z, "blackWall", "grass", {traits: ["protected"]});
    }
    
    // start logo css animation
    function startAnimations() {
        setTimeout(() => {
            getElementById("logo").style.display = "";
            getElementById("logo").style.animation = "initLogo 4s ease-in-out";
            getElementById("logo").style.animationFillMode = "forwards";
            setTimeout(() => {
                getElementById("menu-mask").style.animation = "initMask 2.4s ease-in-out";
                getElementById("menu-mask").style.animationFillMode = "forwards";
            }, 1600);
        }, 0);
    }
    requestAnimationFrame(startAnimations);
}
start();

function pause() {
    vars.PAUSED = true;
    getElementById("logo-container").style.visibility = "visible";
    getElementById("main-menu").style.display = "block";
    getElementById("bgm").pause();
}

let direction = new BABYLON.Vector3();
const jumpSpeed = 0.16;
let canJump = false;
let gravity = 0.01;
let lastStepDist = 0;

function pickPredicate(mesh) {
    return mesh.metadata?.type === "ore";
}

// tick function
function tick() {
    requestAnimationFrame(tick);

    if (performance.now() - vars.startIdleTime > 300000) { // 5 minutes
        vars.startActiveTime = performance.now(); // reset active time
    }
    
    if (vars.PAUSED) return;
    FRAME_TIME = Math.min((performance.now() - LAST_FRAME) / 1000, 0.1); // cap frame time to prevent huge lag spikes
    LAST_FRAME = performance.now();
    LAST_FRAME_TIME = LAST_FRAME_TIME * 0.97 + FRAME_TIME * 0.03;
    vars.FRAME_TIME = FRAME_TIME;
    
    getElementById("fps").textContent = `FPS: ${Math.round(1 / LAST_FRAME_TIME)}`;
    
    for (let i = 0; i < animatedCanvases.length; i++) {
        ores[animatedCanvases[i]].getCanvas();
        textures[animatedCanvases[i] + "_ore"]?.update();
    }

    itemTick();
    loadNearbyChunks();

    if (layers[CURRENT_LAYER]?.tick) {
        layers[CURRENT_LAYER].tick(player.position.x, player.position.y, player.position.z);
    } else if (biomes[CURRENT_LAYER]?.tick) {
        biomes[CURRENT_LAYER].tick(player.position.x, player.position.y, player.position.z);
    }
    
    for (let i = 0; i < vars.removalQueue.length; i++) {
        const r = vars.removalQueue[i];
        if (oreAt(r.x, r.y, r.z)) {
            updateBreakMesh(r.x, r.y, r.z, undefined, 2);
            removeOre(r.x, r.y, r.z, { noUpdate: true });
        } else {
            map.at(r.x, r.y, r.z, true);
        }
    }
    for (let i = 0; i < vars.removalQueue.length; i++) {
        const r = vars.removalQueue[i];
        generateAdjacent(r.x, r.y, r.z, { noUpdate: true });
    }
    vars.removalQueue.length = 0;
    
    for (let i = 0; i < vars.spawnQueue.length; i++) {
        spawnOre(...vars.spawnQueue[i]); // why is this like my first time ever using spread syntax
    }
    vars.spawnQueue.length = 0;
    
    for (let i = 0; i < vars.structureQueue.length; i++) {
        generateStructure(...vars.structureQueue[i]);
    }
    vars.structureQueue.length = 0;
    
    const needingUpdate = Array.from(meshesNeedingUpdate);
    for (let i = 0; i < needingUpdate.length; i++) {
        /** @type {BABYLON.Mesh} */
        const mesh = meshes[needingUpdate[i]];
        if (mesh === undefined) continue;
        const matrices = mesh.thinInstanceGetWorldMatrices();
        if (matrices[0] !== undefined) mesh.thinInstanceSetMatrixAt(0, matrices[0]);
    }
    
    meshesNeedingUpdate.clear();
    
    // movement
    direction.z = Number(keys.backward) - Number(keys.forward);
    direction.x = Number(keys.right) - Number(keys.left);
    direction.y = 0;
    
    direction.normalize();
    direction = BABYLON.Vector3.TransformNormal(direction, perspectiveCamera.getWorldMatrix().getRotationMatrix());
    if (!vars.fly) direction.y = 0;
    direction.normalize();
    
    if (STARTED) {
        if (!player.position.normalize) player.position = new BABYLON.Vector3(player.position.x, player.position.y, player.position.z);
        if (!player.velocity.normalize) player.velocity = new BABYLON.Vector3(player.velocity.x, player.velocity.y, player.velocity.z);
        if (!camera.offset.normalize) camera.offset = new BABYLON.Vector3(camera.offset.x, camera.offset.y, camera.offset.z);
        if (!camera.playerOffset.normalize) camera.playerOffset = new BABYLON.Vector3(camera.playerOffset.x, camera.playerOffset.y, camera.playerOffset.z);
        const {velocity} = player;
        let friction;
        let speedModifier;
        
        const dt = FRAME_TIME || (1 / 60);
        
        (() => {
            const {x, y, z} = player.position;
            const x1 = Math.round(x), y1 = Math.round(y), z1 = Math.round(z);
            if (oreAt(x1, y1, z1)) {
                const ore = map.at(x1, y1, z1).background;
                if (ores[ore]) {
                    if (ores[ore].friction !== undefined) {
                        friction = ores[ore].friction;
                    } else {
                        friction = 0.2; // default friction
                    }
                    
                    if (ores[ore].speedModifier !== undefined) {
                        speedModifier = ores[ore].speedModifier;
                    }
                }
            }
        })();
        
        if (friction === undefined) {
            const collisionDataPos = clonePos();
            collisionDataPos.y -= 0.01;
            const collisionData = checkCollision(collisionDataPos, true);
            if (collisionData.ore) {
                const ore = collisionData.ore.background;
                if (ores[ore]) {
                    if (ores[ore].friction !== undefined) {
                        friction = ores[ore].friction;
                    } else {
                        friction = 0.2;
                    }
                } else if (ore !== "air") {
                    friction = 0.2;
                }
            }
        }
        if (speedModifier === undefined) {
            const collisionDataPos = clonePos();
            const collisionData = checkCollision(collisionDataPos, true, true);
            if (collisionData.ore) {
                const ore = collisionData.ore.background;
                if (ores[ore] && ores[ore].speedModifier !== undefined) {
                    speedModifier = ores[ore].speedModifier;
                }
            }
        }
        
        let isAir = false;
        if (friction === undefined) {
            friction = vars.airFriction !== undefined ? vars.airFriction : 0.04; // air friction
            isAir = true;
        }
        if (speedModifier === undefined) speedModifier = 1;
        
        let newYVelocity = velocity.y;
        if (!vars.fly) {
            newYVelocity -= gravity * dt * 60;
            newYVelocity *= speedModifier ** 0.15;
        }
        
        if (Math.abs(newYVelocity) > 3 + Math.PI) {
            newYVelocity = Math.sign(newYVelocity) * (3 + Math.PI); // limit fall speed (the pi is to prevent blocks appearing to repeat)
        }
        
        if (keys.jump && canJump) {
            newYVelocity = jumpSpeed;
            canJump = false;
        }
        
        velocity.y = newYVelocity;
        
        const oldYVelocity = velocity.y;
        
        let moveSpeed = player.moveSpeed;
        if (player.sprint) moveSpeed *= 1.5;
        
        let frictionSpeed = (isAir && vars.airFrictionSpeed !== undefined) ? vars.airFrictionSpeed : friction;
        
        velocity.x += direction.x * moveSpeed * 0.9 * frictionSpeed * (FRAME_TIME * 60) * speedModifier;
        velocity.y += direction.y * moveSpeed * 0.9 * frictionSpeed * (FRAME_TIME * 60) * speedModifier;
        velocity.z += direction.z * moveSpeed * 0.9 * frictionSpeed * (FRAME_TIME * 60) * speedModifier;
        
        let scalar = (1 - friction) ** (FRAME_TIME * 60);
        if (1 - friction < 0) scalar = -((friction - 1) ** (FRAME_TIME * 60));
        velocity.scaleInPlace(scalar);
        if (Math.abs(velocity.x) < 1e-12) velocity.x = 0;
        if (Math.abs(velocity.y) < 1e-12) velocity.y = 0;
        if (Math.abs(velocity.z) < 1e-12) velocity.z = 0;
        
        if (!vars.fly) velocity.y = oldYVelocity; // ignore friction
        
        // check for collisions
        const MAX_SPEED = 1.4;
        const collisionChecks = 50; // number of collision checks per frame; increases max speed but decreases performance
        let collisionResult;
        
        function clonePos() {
            return new BABYLON.Vector3(player.position.x, player.position.y, player.position.z);
        }
        
        function test(nextPos) {
            let canMoveX = true;
            let canMoveY = true;
            let canMoveZ = true;
            
            if (!player.noclip) {
                // Check X movement
                const testPosX = clonePos();
                testPosX.x = nextPos.x;
                if (checkCollision(testPosX)) {
                    canMoveX = false;
                }
                
                // Check Y movement
                const testPosY = clonePos();
                testPosY.y = nextPos.y;
                collisionResult = checkCollision(testPosY);
                if (collisionResult) {
                    canMoveY = false;
                }
                
                // Check Z movement
                const testPosZ = clonePos();
                testPosZ.z = nextPos.z;
                if (checkCollision(testPosZ)) {
                    canMoveZ = false;
                }
                
                // Check X and Z movement together
                const testPosXZ = clonePos();
                testPosXZ.x = nextPos.x;
                testPosXZ.z = nextPos.z;
                if (checkCollision(testPosXZ)) {
                    // If both X and Z movement collide, prioritize one direction
                    if (canMoveX) {
                        canMoveZ = false; // cancel Z movement
                    } else if (canMoveZ) {
                        canMoveX = false; // otherwise, cancel X movement
                    } else {
                        // If both directions are blocked, do not move
                        canMoveX = false;
                        canMoveZ = false;
                    }
                }
                
                // Check X and Y movement together (prioritizes X)
                const testPosXY = clonePos();
                testPosXY.x = nextPos.x;
                testPosXY.y = nextPos.y;
                if (checkCollision(testPosXY)) {
                    if (canMoveX) {
                        canMoveY = false;
                    } else if (canMoveY) {
                        canMoveX = false;
                    } else {
                        canMoveX = false;
                        canMoveY = false;
                    }
                }
                
                // Check Y and Z movement together (prioritizes Z)
                const testPosYZ = clonePos();
                testPosYZ.y = nextPos.y;
                testPosYZ.z = nextPos.z;
                if (checkCollision(testPosYZ)) {
                    if (canMoveZ) {
                        canMoveY = false;
                    } else if (canMoveY) {
                        canMoveZ = false;
                    } else {
                        canMoveY = false;
                        canMoveZ = false;
                    }
                }
                
                const xCollisionOres = checkCollision(testPosX, 2, true);
                const yCollisionOres = checkCollision(testPosY, 2, true);
                const zCollisionOres = checkCollision(testPosZ, 2, true);
                const xzCollisionOres = checkCollision(testPosXZ, 2, true);
                const xyCollisionOres = checkCollision(testPosXY, 2, true);
                const yzCollisionOres = checkCollision(testPosYZ, 2, true);
                
                // combine and deduplicate collision ores
                const collisionOres = [...new Set([
                    ...(xCollisionOres ? (Array.isArray(xCollisionOres) ? xCollisionOres : [xCollisionOres]) : []),
                    ...(yCollisionOres ? (Array.isArray(yCollisionOres) ? yCollisionOres : [yCollisionOres]) : []),
                    ...(zCollisionOres ? (Array.isArray(zCollisionOres) ? zCollisionOres : [zCollisionOres]) : []),
                    ...(xzCollisionOres ? (Array.isArray(xzCollisionOres) ? xzCollisionOres : [xzCollisionOres]) : []),
                    ...(xyCollisionOres ? (Array.isArray(xyCollisionOres) ? xyCollisionOres : [xyCollisionOres]) : []),
                    ...(yzCollisionOres ? (Array.isArray(yzCollisionOres) ? yzCollisionOres : [yzCollisionOres]) : [])
                ])];
                
                return {canMoveX, canMoveY, canMoveZ, collisionResult, collisionOres};
            }
        }
        
        let steppingUp = false, attemptedStepUp = false, stepMoved = false, stepIterations = 0, yBeforeStep = player.position.y, beforeStepCanMove = {x: false, z: false};
        
        for (let i = 0; i < collisionChecks; i++) {
            const nextPos = clonePos();
            
            nextPos.x += Math.max(Math.min(velocity.x * FRAME_TIME * 60 / collisionChecks, MAX_SPEED), -MAX_SPEED);
            nextPos.y += Math.max(Math.min(velocity.y * FRAME_TIME * 60 / collisionChecks, MAX_SPEED), -MAX_SPEED);
            nextPos.z += Math.max(Math.min(velocity.z * FRAME_TIME * 60 / collisionChecks, MAX_SPEED), -MAX_SPEED);
            
            if (steppingUp) {
                nextPos.y += player.stepHeight / collisionChecks;
                stepIterations++;
                i--;
                if (stepIterations > collisionChecks) {
                    steppingUp = false;
                    stepIterations = 0;
                }
            }
            if (attemptedStepUp && !steppingUp && !stepMoved) nextPos.y = yBeforeStep;
            
            const {canMoveX, canMoveY, canMoveZ, collisionResult, collisionOres} = test(nextPos);
            
            // onTouch events for new collisions
            for (let j = 0; j < collisionOres.length; j++) {
                if (ores[collisionOres[j].block.ore]?.onTouch) {
                    ores[collisionOres[j].block.ore].onTouch(collisionOres[j].x, collisionOres[j].y, collisionOres[j].z);
                }
            }
            
            player.lastVelocity.x = velocity.x;
            player.lastVelocity.y = velocity.y;
            player.lastVelocity.z = velocity.z;
            
            if (!canMoveX) {
                nextPos.x = player.position.x;
                velocity.x = 0;
                
                if (Math.abs(player.lastVelocity.x) > 0.3) player.damage((Math.abs(player.lastVelocity.x) - 0.3) * 60, 0, "collision", true);
            }
            if (!canMoveY) {
                nextPos.y = player.position.y;
                velocity.y = 0;
            }
            if (!canMoveZ) {
                nextPos.z = player.position.z;
                velocity.z = 0;
                
                if (Math.abs(player.lastVelocity.z) > 0.3) player.damage((Math.abs(player.lastVelocity.z) - 0.3) * 60, 0, "collision", true);
            }
            
            const dist = BABYLON.Vector3.Distance(player.position, nextPos);
            const ore = map.at(Math.floor(player.position.x + 0.5), Math.floor(player.position.y - 0.01), Math.floor(player.position.z + 0.5))?.background;
            lastStepDist += dist;
            
            if (lastStepDist > 2 && dist > 0 && !vars.fly) {
                if (ores[ore]?.sfx) {
                    const audio = new Audio(`audio/sfx/step/${ores[ore].sfx}${Math.ceil(Math.random() * sfxOptions[ores[ore].sfx].count)}.wav`);
                    audio.volume = 0.15 * (sfxOptions[ores[ore].sfx].volume || 1);
                    audio.play();
                    lastStepDist = lastStepDist % 2;
                }
            }
            
            // Apply movement if no collision
            if (canMoveY) {
                player.position.y = nextPos.y;
                if (velocity.y !== 0) canJump = false;
            } else {
                if (!vars.fly && collisionResult !== 2) {
                    canJump = true;
                }
                if (collisionResult !== 2) {
                    if (Math.abs(player.lastVelocity.y) > 0.3) player.damage((Math.abs(player.lastVelocity.y) - 0.3) * 60, 0, player.lastVelocity.y < 0 && !vars.fly ? "fall" : "collision", true);
                }
            }
            
            if (!(steppingUp && stepMoved)) {
                if (canMoveX) {
                    player.position.x = nextPos.x;
                } else {
                    nextPos.x = player.position.x;
                }
                if (canMoveZ) {
                    player.position.z = nextPos.z;
                } else {
                    nextPos.z = player.position.z;
                }
            }
            
            /* if (steppingUp && (canMoveX && !beforeStepCanMove.x || canMoveZ && !beforeStepCanMove.z)) {
            stepMoved = true;
            // steppingUp = false;
            attemptedStepUp = true;
            }
            
            if (!attemptedStepUp && !vars.fly && (!canMoveX || !canMoveZ) && !canMoveY) {
            // Check for stepping up
            yBeforeStep = player.position.y;
            beforeStepCanMove = {x: canMoveX, z: canMoveZ};
            steppingUp = true;
            } */
            
            if (!canMoveX && !canMoveY && !canMoveZ) break; // stop checking if all movement is blocked
        }
        
        // Check for block underneath
        const playerPos = new BABYLON.Vector3();
        playerPos.copyFrom(player.position);
        playerPos.y = player.position.y + 0.5; // move down to check for block
        playerPos.x = Math.floor(playerPos.x + 0.5);
        playerPos.z = Math.floor(playerPos.z + 0.5);
        
        const music = getElementById("bgm");
        const layer = getLayer(playerPos.y, playerPos.x, playerPos.z);
        const layerDetails = layers[layer] || biomes[layer];
        
        const musicElem = getElementById("music");
        musicElem.innerText = `♫ ${((layerDetails && layerDetails.music) ? (layerDetails.shortMusic && !musicElem.matches(":hover")) ? layerDetails.shortMusic : layerDetails.music : "None")}`;
        
        if (layer !== CURRENT_LAYER) {
            stats.layersVisited[layer] = true;
            if (INITIALIZED_LAYER) {
                const thud = document.createElement("audio");
                thud.setAttribute("src", `audio/thud.mp3`);
                thud.setAttribute("preload", "auto");
                thud.setAttribute("autoplay", "true");
            }
            
            music.setAttribute("src", `audio/layers/${layer}.mp3`);
            music.play();
            
            INITIALIZED_LAYER = true;
            gravity = (layerDetails.gravity !== undefined ? layerDetails.gravity : 1) * 0.01; // default gravity is 0.01
            vars.airFriction = layerDetails.airFriction !== undefined ? layerDetails.airFriction : undefined; // default air friction
            vars.airFrictionSpeed = layerDetails.airFrictionSpeed !== undefined ? layerDetails.airFrictionSpeed : undefined;
            if (layerDetails.directionalLight) {
                const dl = layerDetails.directionalLight;
                vars.directionalLightIntensity = dl.intensity !== undefined ? dl.intensity : 5;
                vars.sunAlwaysVisible = dl.alwaysVisible || false;
                directionalLight.castShadow = true;
                sun.visible = true;
                /* if (dl.pos) {
                const {x, y, z} = dl.pos;
                directionalLight.position.set(x !== undefined ? x : 1, y !== undefined ? y : 4, z !== undefined ? z : 2);
                } */
            } else {
                directionalLight.intensity = 0;
                directionalLight.castShadow = false;
                sun.visible = false;
            }
            if (layers[CURRENT_LAYER]?.onExit) layers[CURRENT_LAYER].onExit();
            if (biomes[CURRENT_LAYER]?.onExit) biomes[CURRENT_LAYER].onExit();
            
            if (layerDetails?.onEnter) layerDetails.onEnter();
            if (layerDetails?.skybox) {
                skyboxMaterial.alpha = layerDetails?.skybox.opacity ? layerDetails.skybox.opacity : 1;
                skyboxMaterial.reflectionTexture = skyboxMaterial.emissiveTexture = textures[`skybox/${layerDetails.skybox.id || layer}`];
                skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
                skyboxMaterial.albedoTexture = textures[`skybox/${layerDetails.skybox.id || layer}`];
            } else {
                skyboxMaterial.alpha = 0;
            }
            CURRENT_LAYER = layer;
            
            const musicElem = getElementById("music");
            musicElem.innerText = `♫ ${((layerDetails && layerDetails.music) ? (layerDetails.shortMusic && !musicElem.matches(":hover")) ? layerDetails.shortMusic : layerDetails.music : "None")}`;
            
            let BLOOM_SETTINGS = {};
            if (layerDetails && layerDetails.bloom) {
                BLOOM_SETTINGS.strength = layerDetails.bloom.strength !== undefined ? layerDetails.bloom.strength : 0.5;
                BLOOM_SETTINGS.radius = layerDetails.bloom.radius !== undefined ? layerDetails.bloom.radius : 0;
                BLOOM_SETTINGS.threshold = layerDetails.bloom.threshold !== undefined ? layerDetails.bloom.threshold : 0.5;
            } else {
                BLOOM_SETTINGS.strength = 0.5;
                BLOOM_SETTINGS.radius = 0;
                BLOOM_SETTINGS.threshold = 0.5;
            }
            
            pipeline.bloomThreshold = BLOOM_SETTINGS.threshold;
            pipeline.bloomRadius = BLOOM_SETTINGS.radius;
            pipeline.bloomStrength = BLOOM_SETTINGS.strength;
            
            function updateLighting(area) {
                scene.fogStart = 0;
                // scene.fogEnd = area.fog || 1000;
                scene.fogDensity = 0.2 / (Math.sqrt(area.fog || 100));
                perspectiveCamera.maxZ = area.fog * 1.7 || 1000;
                vars.fogColor = area.fogColor || "#000000";
                vars.nightFogColor = area.nightFogColor || vars.fogColor;
                
                hemisphereLight.diffuse = getColor(area.lighting.hemisphereColor || area.lighting.color || "#ffffff");
                hemisphereLight.groundColor = getColor(area.lighting.hemisphereGroundColor || "#000000");
                hemisphereLight.intensity = (area.lighting.hemisphereIntensity ?? area.lighting.intensity ?? 0) / 4;
                
                vars.ambientLightIntensity = hemisphereLight.intensity;
                
                if (!player.nightVision) {
                    cameraLight.diffuse = area.lighting.cameraLightColor !== undefined ? area.lighting.cameraLightColor : hemisphereLight.diffuse;
                    cameraLight.intensity = area.lighting.cameraLightIntensity !== undefined ? area.lighting.cameraLightIntensity : hemisphereLight.intensity * 3;
                    // cameraLight.decay = area.lighting.cameraLightDecay !== undefined ? area.lighting.cameraLightDecay : 1;
                    cameraLight.range = 15;
                }
                
                vars.lighting = {
                    color: hemisphereLight.diffuse,
                    intensity: hemisphereLight.intensity * 6
                };
            }
            
            updateLighting(layerDetails);
        }
        
        let shakeOffset;
        if (camera.shakeIntensity > 0) {
            shakeOffset = new BABYLON.Vector3(
                (Math.random() - 0.5),
                (Math.random() - 0.5),
                (Math.random() - 0.5)
            ).normalize().scaleInPlace(camera.shakeIntensity);
        }
        
        perspectiveCamera.position.copyFrom(player.position);
        perspectiveCamera.position.addInPlace(camera.playerOffset);
        perspectiveCamera.position.addInPlace(camera.offset);
        if (shakeOffset) perspectiveCamera.position.addInPlace(shakeOffset);
        cameraLight.position.copyFrom(perspectiveCamera.position);
        cameraLight.setDirectionToTarget(perspectiveCamera.getForwardRay().direction.scale(10).addInPlace(perspectiveCamera.position));
    }

    // audio listener updates
    for (let i = 0; i < audios.length; i++) {
        const audio = audios[i];
        if (map.at(audio.x, audio.y, audio.z).ore !== audio.ore) {
            audio.audioEngine.dispose();
            audios.splice(i--, 1);
            continue;
        }
        audio.audioEngine.listener.position.copyFrom(perspectiveCamera.position);
        audio.audioEngine.listener.rotation.copyFrom(perspectiveCamera.rotation);
        audio.audioEngine.listener.rotation.y += Math.PI;
        audio.audioEngine.listener.rotation.x /= 4;
    }
    
    // update sun position
    const angle = getTime();
    const offset = new BABYLON.Vector3(
        Math.cos(angle) * 2,
        Math.sin(angle) * 2.5,
        Math.sin(angle) * 2
    ).normalize().scaleInPlace(250);
    
    const sunHeight = Math.sin(angle);
    const nightFog = vars.nightFogColor !== undefined ? vars.nightFogColor : "#050022";
    
    if (sun.visible) {
        skyboxMaterial.reflectionTexture = skyboxMaterial.emissiveTexture = textures["skybox/space"];
        if (sunHeight < -0.2) {
            scene.fogColor = getColor(nightFog);
            hemisphereLight.intensity = 0;
            skyboxMaterial.alpha = 1;
        } else if (sunHeight < 0.2) {
            scene.fogColor = BABYLON.Color3.Lerp(getColor(vars.fogColor), getColor(nightFog), (0.2 - sunHeight) / 0.4);
            hemisphereLight.intensity = vars.ambientLightIntensity * (sunHeight + 0.2) / 0.4;
            if (CURRENT_LAYER !== "space") skyboxMaterial.alpha = Math.min(Math.max(0.8 - sunHeight / 0.2, 0), 1);
        } else {
            scene.fogColor = getColor(vars.fogColor);
            hemisphereLight.intensity = vars.ambientLightIntensity;
            if (CURRENT_LAYER !== "space") skyboxMaterial.alpha = 0;
        }
        
        if (!vars.sunAlwaysVisible) {
            sun.visibility = Math.max(0, (sunHeight + 0.3) / 0.7);
            directionalLight.intensity = vars.directionalLightIntensity * Math.min(1, sun.visibility);
        } else {
            directionalLight.intensity = vars.directionalLightIntensity;
            sun.visibility = 1;
        }
        
        sunGlow.intensity = sun.visibility;
    } else {
        scene.fogColor = BABYLON.Color3.Lerp(getColor(vars.fogColor), getColor(nightFog), Math.min(Math.max((0.2 - sunHeight) / 0.4, 0), 1));
    }

    function round(n) {
        return Math.round(n * 0.5) / 0.5;
    }
    
    if (performance.now() - lastShadowUpdate > 1) {
        directionalLight.position.copyFrom(player.position.add(offset.scale(0.25)));
        directionalLight.setDirectionToTarget(player.position);
        directionalLight.position.x = round(directionalLight.position.x);
        directionalLight.position.y = round(directionalLight.position.y);
        directionalLight.position.z = round(directionalLight.position.z);

        directionalLightShadow.bias = Math.max(0.0008, 0.05 - (offset.y / 3000));
        lastShadowUpdate = performance.now();
    }
    sun.position.copyFrom(perspectiveCamera.position).addInPlace(offset);
    
    function hide() {
        getElementById("tooltip").style.display = "none";
        vars.miningStartTime = undefined;
        LAST_ORE = [];
        CURRENT_ORE = [];
    }

    // tick functions
    vars.globalTickFuncs.forEach(func => {
        func();
    });
    vars.oreTicks.forEach(oreTick => {
        const {x, y, z} = oreTick;
        oreTick.tick(x, y, z);
    });
    
    // raycasting
    const raycaster = perspectiveCamera.getForwardRay(inventory.currentPickaxe.range);
    const hit = scene.pickWithRay(raycaster, pickPredicate);
    if (hit.hit) {
        vars.intersect = hit;
        const picked = getPickedOreCoords(hit);
        if (!picked) {
            console.log("Error: Hit an ore mesh but couldn't get coordinates", hit);
            hide();
        } else {
            const {x, y, z, oreData} = picked;
            if (JSON.stringify(LAST_ORE.slice(0, 4)) !== JSON.stringify([x, y, z, oreData.ore])) LAST_ORE = [x, y, z, oreData.ore, hit.distance];

            const block = map.at(x, y, z);
            
            if (hit.distance <= inventory.currentPickaxe.range) {
                const oreData = ores[hit.pickedMesh.metadata?.ore], color = block.color ?? oreData?.color ?? "#fff";
                getElementById("oreName").textContent = `${oreData?.name || "Unknown"}`;
                getElementById("tooltip").style.display = "";
                if (!color.includes("gradient")) {
                    getElementById("oreName").style.color = color;
                    getElementById("oreName").style.textShadow = "";
                    getElementById("oreName").style.backgroundImage = "none";
                } else {
                    getElementById("oreName").style.color = "transparent";
                    getElementById("oreName").style.textShadow = "none";
                    getElementById("oreName").style.backgroundImage = color;
                }
                
                let chance = block.chance ?? 0;
                
                if (MINING) {
                    miningTick();
                } else {
                    getElementById("miningTime").innerText = "";
                }
                
                getElementById("debugInfo").textContent = `${x}, ${y}, ${z}`;
                if (getElementById("totalOres").style.display !== "none") {
                    getElementById("debugInfo").innerText += `\n${block.meshID}`;
                    getElementById("debugInfo").innerText += `\n${block.index}`;
                }
                getElementById("oreRarity").textContent = block.placed ? `Placed by ${window.username || "you"}` : (isFinite(chance) && Math.abs(chance) !== 0 ? formatChance(chance) : "");
                getElementById("oreRarity").style.color = tiers[ores[block.ore]?.tier]?.color ?? "#fff";
                getElementById("oreRarity").style.display = "block";
                
                getElementById("oreDesc").textContent = oreData?.desc ?? "No description available.";
            } else {
                hide();
            }
        }
    } else {
        if ((vars.miningStartTime < performance.now() && CURRENT_ORE && map.at(CURRENT_ORE[0], CURRENT_ORE[1], CURRENT_ORE[2]) && oreAt(CURRENT_ORE[0], CURRENT_ORE[1], CURRENT_ORE[2]))) {
            setProgress(CURRENT_ORE[0], CURRENT_ORE[1], CURRENT_ORE[2]);
        }

        hide();
    }
    
    // hp + radiation
    let canRegen = false;
    if (performance.now() - player.lastRealHit > player.regenCooldown) {
        canRegen = true;
        player.health += FRAME_TIME * 3; // health regeneration
    }
    let netChange = player.radiation + 0;
    player.radiation *= 0.95 ** FRAME_TIME; // decay radiation over time
    player.radiation -= 0.3 * FRAME_TIME; // slight radiation loss over time
    netChange = player.radiation - netChange;

    const regions = radiationMap.getClosestRegions(player.position.x, player.position.y, player.position.z, 2);

    for (let i = 0; i < regions.length; i++) {
        const region = regions[i];
        const sources = radiationMap.getAllInRegion(region.x, region.y, region.z);
        for (let j = 0; j < sources.length; j++) {
            const source = radiationMap._obj[sources[j]];
            const dist = BABYLON.Vector3.Distance(player.position, source.position);
            if (dist < 15) {
                const r = source.strength * (1 - source.falloff) ** Math.max(dist - 2, 0) ** 2 * FRAME_TIME;
                player.radiation += r;
                netChange += r;
            }
        }
    }
    if (inventory.currentPickaxe.radiation) {
        const rad = inventory.currentPickaxe.radiation * FRAME_TIME / 2;
        player.radiation += rad;
        netChange += rad;
    }
    if (netChange > 0) {
        if (geigerAudio.paused) {
            geigerAudio.play();
        }
    } else if (!geigerAudio.paused) {
        geigerAudio.pause();
        geigerAudio.currentTime = 0;
    }
    if (player.radiation > 12.5) {
        player.damage(((player.radiation) * 0.08 - 1) * FRAME_TIME, 0, "radiation", true, false, false);
    } else if (player.radiation > 0) {
        if (canRegen) player.health -= (player.radiation) * 0.24 * FRAME_TIME;
    } else player.radiation = 0;
    
    if (player.health > 100) player.health = 100;
    if (player.health <= 0 || player.dead) {
        // die!!!
        if (!player.dead) displayAlert("You died!", "red");
        player.dead = false;
        player.health = 100;
        player.radiation = 0;
        perspectiveCamera.rotation.set(0, 0, 0);
        teleport(0, locations[0][1], 0);
    }
    
    updateTopLeft();
}

tick();

engine.runRenderLoop(() => {
    if (vrEnabled && xrHelper.state === BABYLON.WebXRState.IN_XR) {
        xrHelper.camera.position.x = player.position.x;
        xrHelper.camera.position.y = player.position.y;
        xrHelper.camera.position.z = player.position.z;

        // console.log(xrHelper.sessionManager?.viewerReferenceSpace?.getOffsetReferenceSpace(new XRRigidTransform({x: 0, y: 0, z: 0})));
        // xrHelper.camera.position.y += xrHelper.camera.realWorldHeight - 1;
    }
    
    scene.clearColor = scene.fogColor;
    scene.fogColor = scene.clearColor;
    scene.render();
});

vars.setFogColor = (color, night) => {
    vars.fogColor = getColor(color);
    vars.nightFogColor = getColor(night ?? color);
}

textures["skybox/space"] = new BABYLON.Texture("img/block/skybox/space.png", scene);
textures["skybox/space"].coordinatesMode = BABYLON.Texture.SKYBOX_MODE;