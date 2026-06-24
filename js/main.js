import Color from "https://colorjs.io/dist/color.js";

import vars from "./vars.js";
import { getOre, m, oreAt, checkAdjacent, calculatePower, airAt, calculateRarity, chunks, getBGOre } from "./outside_stuff.js";
import { getLayer, items, layers, locations, oreArray, ores, structureArray, structures, tiers, traits } from "./content/items.js";
import { biomes, topLayer } from "./content/layers.js";
import { isCave, CHUNK3_RATE, CHUNK_SIZE_3, CHUNK_SIZE, noise, isCaveFloor, isCaveCeiling } from "./noise.js";
import { inventory, toggleInventory, unlockAchievement } from "./inventory.js";
import { rand01 } from "./perlin.js";

const { player, stats, camera } = vars;

const canvas = document.getElementById("canvas");

const textures = {}, animatedCanvases = [];
const meshes = {};
let meshCounts = {};
let MAX_MESH_COUNT = 1024, MESH_CHUNK_SIZE = 128;
let STARTED = true;
let LAST_FRAME = performance.now(); // for FPS calculation
let FRAME_TIME = 0;
let MINING = false;
let LAST_ORE = [], CURRENT_ORE = [];
let CURRENT_LAYER, INITIALIZED_LAYER = false;
let generatingChunks = [], generatingChunks3 = [], priorityChunks3 = new Set(), generatedChunks = new Set(), GENERATION_DISTANCE = 64;
let generatedStructures = {};
let lightArr = [], radArr = [], repairArr = [], repairObj = {}, lightKeys = {};
let USE_THIN_INSTANCES = true;
let totalOres = 0;
let GUI_HIDDEN = false;

// set up scene and camera
const engine = navigator.gpu ? new BABYLON.WebGPUEngine(canvas, {antialias: true}) : new BABYLON.Engine(canvas, true);
await engine.initAsync();
const scene = new BABYLON.Scene(engine);
const perspectiveCamera = new BABYLON.UniversalCamera("camera1", new BABYLON.Vector3(0, 2, 0), scene);
perspectiveCamera.maxZ = 1000;
perspectiveCamera.minZ = 0.1;
perspectiveCamera.fov = 1.2;
scene.fogEnabled = true;
scene.fogDensity = 0.01;
scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;

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
glow.intensity = 0.5;
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
        result.set(1, 1, 0.8, 1);
    }
}

let geigerAudio = new Audio("audio/geiger.mp3");

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    engine.resize(true);
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
canvas.addEventListener("click", () => {
    canvas.requestPointerLock({unadjustedMovement: true});
});
canvas.addEventListener("mousemove", e => {
    if (document.pointerLockElement === canvas) {
        perspectiveCamera.rotation.y += e.movementX * 0.0015;
        perspectiveCamera.rotation.x += e.movementY * 0.0015;
    }
    perspectiveCamera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, perspectiveCamera.rotation.x));
    if (perspectiveCamera.rotation.x > Math.PI / 2 - 0.00001) {
        perspectiveCamera.rotation.x = Math.PI / 2 - 0.00001;
    } else if (perspectiveCamera.rotation.x < -Math.PI / 2 + 0.00001) {
        perspectiveCamera.rotation.x = -Math.PI / 2 + 0.00001;
    }
});
document.addEventListener("keydown", event => {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
        keys['forward'] = true;
        break;
        case 'ArrowDown':
        case 'KeyS':
        keys['backward'] = true;
        break;
        case 'ArrowLeft':
        case 'KeyA':
        keys['left'] = true;
        break;
        case 'ArrowRight':
        case 'KeyD':
        keys['right'] = true;
        break;
        case 'Space':
        keys['jump'] = true;
        break;
        case 'KeyE':
        toggleInventory();
        break;
        case 'Escape':
        if (document.getElementById("ore-wiki").style.display === "block") {
            document.getElementById("ore-wiki").style.display = "none";
        } else if (document.getElementById("big-gui").style.display === "block") {
            document.getElementById("big-gui").style.display = "none";
            document.getElementById("big-gui").style.width = "";
        } else if (document.getElementById("large-inventory").style.display === "block") {
            document.getElementById("large-inventory").style.display = "none";
        } else if (document.getElementById("indexes").style.display === "block") {
            document.getElementById("indexes").style.display = "none";
        } else if (document.getElementById("ore-wiki-list").style.display === "block") {
            document.getElementById("ore-wiki-list").style.display = "none";
        } else if (document.getElementById("item-wiki-list").style.display === "block") {
            document.getElementById("item-wiki-list").style.display = "none";
        } else if (document.getElementById("layer-wiki-list").style.display === "block") {
            document.getElementById("layer-wiki-list").style.display = "none";
        } else if (document.getElementById("biome-wiki-list").style.display === "block") {
            document.getElementById("biome-wiki-list").style.display = "none";
        } else if (document.getElementById("achievements-list").style.display === "block") {
            document.getElementById("achievements-list").style.display = "none";
        } else if (document.getElementById("equip-text").style.display === "") {
            document.getElementById("equip-text").style.display = "none";
            document.getElementById("large-inventory").style.display = "block";
            document.getElementById("hotbar").classList.remove("big");
            inventory.SELECTED_ITEM = null;
        } else if (document.getElementById("main-menu").style.display === "none" && document.getElementById("settings-menu").style.display === "none" && document.getElementById("play-menu").style.display === "none") {
            pause();
        } else if (STARTED && document.getElementById("menu-mask").style.display === "none") {
            document.getElementById("main-menu").style.display = "none";
            document.getElementById("logo-container").style.visibility = "hidden";
            document.getElementById("settings-menu").style.display = "none";
            document.getElementById("play-menu").style.display = "none";
            document.getElementById("bgm").play();
            vars.PAUSED = false;
            vars.hasPlayed = true;
        }
        document.getElementById("logo").style.animationDuration = "0s";
        document.getElementById("menu-mask").style.animationDuration = "0s";
        document.getElementById("logo").style.animationDelay = "0s";
        document.getElementById("menu-mask").style.display = "none";
        break;
        case 'F1':
        event.preventDefault();
        if (GUI_HIDDEN) {
            GUI_HIDDEN = false;
            document.getElementById("ui").style.visibility = "visible";
        } else {
            GUI_HIDDEN = true;
            document.getElementById("ui").style.visibility = "hidden";
        }
        break;
        case 'F2':
        if (location.origin.includes("localhost") || location.origin.includes("192.168.")) {
            eval(prompt("Enter code to execute:"));
        }
        break;
        case 'F3':
        event.preventDefault();
        if (document.getElementById("totalOres").style.display === "none") {
            document.getElementById("totalOres").style.display = "block";
        } else {
            document.getElementById("totalOres").style.display = "none";
        }
        break;
        case 'F4':
        event.preventDefault();
        console.log(`get time: ${totalGetTime}\ngen time: ${totalGenTime}\nratio: ${totalGetTime / totalGenTime}\ntotal gets: ${totalGets}\naverage get time: ${totalGets ? totalGetTime / totalGets : 0}\naverage gen time: ${totalGenTime / totalGens}\ntotal gens: ${totalGens}`);
        break;
        case 'F5':
        event.preventDefault();
        console.log(m(LAST_ORE[0], LAST_ORE[1], LAST_ORE[2]));
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
        keys['forward'] = false;
        break;
        case 'ArrowDown':
        case 'KeyS':
        keys['backward'] = false;
        break;
        case 'ArrowLeft':
        case 'KeyA':
        keys['left'] = false;
        break;
        case 'ArrowRight':
        case 'KeyD':
        keys['right'] = false;
        break;
        case 'Space':
        keys['jump'] = false;
        break;
    }
});
document.addEventListener("mousedown", e => {
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
document.addEventListener("mouseup", e => {
    if (e.button !== 0) return;
    // stop mining
    if (MINING) {
        const x = CURRENT_ORE[0], y = CURRENT_ORE[1], z = CURRENT_ORE[2];
        if (m(x, y, z) && oreAt(x, y, z)) {
            if (vars.miningStartTime < performance.now()) m(x, y, z).progress = (performance.now() - vars.miningStartTime) / (m(x, y, z).str * 1000) * calculatePower(x, y, z) + (m(x, y, z).progress || 0);
            setProgress(x, y, z, undefined, m(x, y, z).progress);
        }
    }
    
    vars.miningStartTime = undefined;
    document.getElementById("mining-progress").style.display = "none";
    document.getElementById("miningTime").style.display = "none";
    MINING = false;
    CURRENT_ORE = [];
});

const workers = {};
workers.findEmpty = new Worker("js/workers/find-empty.js", {type: "module"});
workers.findEmpty.addEventListener("message", e => {
    console.log("Message received from find-empty worker:", e.data);
});
workers.findEmpty.postMessage({seed: vars.seed});

document.getElementById("bgm").volume = 0.25;

scene.ambientColor = new BABYLON.Color3(0.01, 0.01, 0.01);

const hemisphereLight = new BABYLON.HemisphericLight("hemisphereLight", new BABYLON.Vector3(0, 1, 0), scene);
const directionalLight = new BABYLON.DirectionalLight("directionalLight", new BABYLON.Vector3(-0.5, -2, -1), scene);
const cameraLight = new BABYLON.PointLight("cameraLight", perspectiveCamera.position, scene);

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
const checkCollision = (pos, returnOre, includeNotCollidable) => {
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
                    y < 0 && !m(x, y, z) && !isCave(x, y, z) && checkAdjacent(x, y, z, isCave) ||
                    oreAt(x, y, z) && ores[m(x, y, z).ore] &&
                    (includeNotCollidable || !(
                        m(x, y, z).notCollidable ||
                        ores[m(x, y, z).ore] &&
                        ores[m(x, y, z).ore].notCollidable
                    ))
                ) {
                    // Support variable block sizes
                    const block = m(x, y, z) || {bounds: {x: 1, y: 1, z: 1}, offset: {x: 0, y: 0, z: 0}};
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
                            if (returnOre) return {ore: m(x, y, z), x, y, z, block, out, notCollidable: includeNotCollidable || (m(x, y, z).notCollidable || ores[m(x, y, z).ore] && ores[m(x, y, z).ore].notCollidable)};
                            return out;
                        } else {
                            all.push({x, y, z, block, out: y === maxY ? 2 : true, notCollidable: includeNotCollidable || (m(x, y, z).notCollidable || ores[m(x, y, z).ore] && ores[m(x, y, z).ore].notCollidable)});
                        }
                    }
                }
            }
        }
    }
    if (returnOre === 2) return all.filter((v, i, s) => s.findIndex(t => t.x === v.x && t.y === v.y && t.z === v.z) === i); // remove duplicates
    return false;
};

export function teleport(x, y, z) {
    player.velocity.set(0, 0, 0);
    if (x === undefined) x = 0;
    if (y === undefined) y = 0;
    if (z === undefined) z = 0;
    player.position.set(x, y, z);
    if (!m(x, y, z)) m(x, y, z, true);
    if (!m(x, y + 1, z)) m(x, y + 1, z, true);
    updateTopLeft();
    generateAdjacent(x, y, z);
    generateAdjacent(x, y + 1, z);
}

player.teleport = teleport;
window.teleport = teleport;

function getColor(input) {
    try {
        const color = new Color(input).toString({format: "hex", collapse: false});
        return new BABYLON.Color3.FromHexString(color);
    } catch (e) {
        console.error(`Invalid color: ${input}`);
        return new BABYLON.Color3(1, 1, 1);
    }
}

function getTexture(ore, face, type) {
    if (ores[ore]?.noTexture) return null;
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
    }
    if (!textures[`${ore}`]) textures[`${ore}`] = new BABYLON.Texture(`img/block/${ore}.png`, scene, false, true, BABYLON.Texture.NEAREST_SAMPLINGMODE);
    
    return textures[`${ore}`];
}

export function generateOre(x, y, z, ore, bg, settings) {
    if (!ores[ore]) return;
    x = Math.round(x), y = Math.round(y), z = Math.round(z);
    
    if (ores[ore] && ores[ore].placeholder) {
        if (ores[ore].onGenerate) ores[ore].onGenerate(x, y, z, settings, m(x, y, z));
        return;
    }

    if (oreAt(x, y, z) && !settings.forcedReplace) {
        return m(x, y, z);
    } else if (airAt(x, y, z) && !settings.forced && !m(x, y, z)?.temp) {
        return m(x, y, z);
    } else if (!m(x, y, z)?.temp && ores[ore]) {
        removeOre(x, y, z, {fullyRemove: true});
    }
    if (ore === undefined || ore === null) {
        if (!m(x, y, z)?.temp) m(x, y, z, true);
        return;
    }
    if (!settings) settings = {};
    settings = JSON.parse(JSON.stringify(settings));
    
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
        settings.rotation = { x: 0, y: Math.floor(Math.random() * 4) * Math.PI / 2, z: 0 };
        if (ores[ore]) {
            if (ores[ore].rotation) settings.rotation = JSON.parse(JSON.stringify(ores[ore].rotation));
            else if (ores[ore].noRandomRotation) settings.rotation.y = 0;
        }
    }
    if (nd(settings.rotation.x)) settings.rotation.x = 0;
    if (nd(settings.rotation.y)) settings.rotation.y = 0;
    if (nd(settings.rotation.z)) settings.rotation.z = 0;

    let meshID = `${ore}_${bg}`;
    const chunk = getChunkKey(x, y, z, MESH_CHUNK_SIZE);
    meshID += `_${chunk}`;
    
    let count = meshCounts[meshID] || 0;
    
    let str = (typeof ores[ore].str === "function" ? ores[ore].str(x, y, z) : ores[ore].str);
    const colorData = (ores[ore].customModel || ores[ore].noTexture || settings.isGeode || ores[ore].oreColor)
        ? ores[ore].firstColor
        : ores[ore].forcedColor ?? "#ffffff";
    let color = getColor(settings.color ?? colorData);
    
    if (ores[bg]) str = Math.max(str, typeof ores[bg].str === "function" ? ores[bg].str(x, y, z) : ores[bg].str);
    if (str === undefined || str === 0) str = 1;
    
    if (meshes[`${meshID}_${count}`]?.thinInstanceCount >= MAX_MESH_COUNT) {
        meshCounts[meshID] = ++count;
    }
    
    if (!meshes[`${meshID}_${count}`]) {
        const oreMesh = BABYLON.MeshBuilder.CreateBox(`${meshID}_${count}`, {size: 1, wrap: true}, scene);
        oreMesh.metadata = {ore, background: bg, coords: [], type: "ore"};
        if (USE_THIN_INSTANCES) oreMesh.thinInstanceEnablePicking = true; // allow picking by raycast
        const oreMaterial = new BABYLON.PBRMaterial(`oreMaterial-${x}_${y}_${z}`, scene);
        oreMaterial.useVertexColors = true;
        oreMaterial.baseColor = oreMaterial.diffuseColor = new BABYLON.Color3(1, 1, 1);
        oreMaterial.ambientColor = new BABYLON.Color3(1, 1, 1);
        oreMaterial.specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);
        oreMaterial.alphaMode = 2;
        
        oreMaterial.roughness = 1;
        oreMaterial.metallic = 0;

        let materials = [];
        if (ores[ore]?.multipleTextures) {
            for (let i = 0; i < 6; i++) {
                const mat = new BABYLON.PBRMaterial(`oreMaterial-${x}_${y}_${z}-${i}`, scene);
                mat.useVertexColors = true;
                mat.baseColor = mat.diffuseColor = new BABYLON.Color3(1, 1, 1);
                mat.ambientColor = new BABYLON.Color3(1, 1, 1);
                mat.specularColor = ore === bg || ores[ore]?.singleLayer ? new BABYLON.Color3(0.5, 0.5, 0.5) : new BABYLON.Color3(0, 0, 0);
                mat.alphaMode = 2;
                mat.baseTexture = mat.albedoTexture = mat.opacityTexture = getTexture(ore, i);
        
                mat.roughness = 1;
                mat.metallic = 0;
                materials.push(mat);
            }
        } else {
            materials.push(oreMaterial);
        }
        
        const backgroundMaterial = new BABYLON.PBRMaterial(`backgroundMaterial-${x}_${y}_${z}`, scene);
        backgroundMaterial.useVertexColors = true;
        backgroundMaterial.baseColor = backgroundMaterial.diffuseColor = new BABYLON.Color3(1, 1, 1);
        backgroundMaterial.ambientColor = new BABYLON.Color3(1, 1, 1);
        backgroundMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
        
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
        oreMaterial.albedoTexture = oreMaterial.baseTexture = getTexture(ore);
        oreMaterial.opacityTexture = getTexture(ore);
        if (ores[ore]?.light || ores[ore]?.emissive) {
            if (!ores[ore]?.multipleTextures)
                oreMaterial.emissiveTexture = getTexture(ore, null, "emissive");
            else {
                for (let i = 0; i < materials.length; i++) {
                    materials[i].emissiveTexture = getTexture(ore, i, "emissive");
                }
            }
        }
        backgroundMaterial.albedoTexture = backgroundMaterial.baseTexture = ores[ore]?.singleLayer ? getTexture(ore) : getTexture(bg);
        backgroundMaterial.diffuseTexture = getTexture(bg);
        
        if (ores[ore]?.textureHasTransparency) {
            backgroundMaterial.alpha = 0;
            
            for (const oreMaterial of materials) {
                oreMaterial.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_ALPHATEST;
            }
        }

        backgroundMaterial.roughness = 1;
        backgroundMaterial.metallic = 0;
        
        oreMaterial.usePhysicalLightFalloff = false;
        backgroundMaterial.usePhysicalLightFalloff = false;
        
        const multiMaterial = new BABYLON.MultiMaterial(`multi-${x}_${y}_${z}`, scene);
        multiMaterial.subMaterials.push(backgroundMaterial, ...materials);
        oreMesh.material = multiMaterial;
        
        oreMesh.releaseSubMeshes();
        const vertices = oreMesh.getTotalVertices();
        const indices = oreMesh.getTotalIndices();
        new BABYLON.SubMesh(0, 0, vertices, 0, indices, oreMesh);
        if (materials.length === 1) new BABYLON.SubMesh(1, 0, vertices, 0, indices, oreMesh);
        else {
            const faceVertexCount = vertices / 6;
            for (let i = 0; i < 6; i++) {
                new BABYLON.SubMesh(i + 1, i * faceVertexCount, faceVertexCount, i * 6, 6, oreMesh);
            }
        }
        
        meshes[`${meshID}_${count}`] = oreMesh;
    }
    
    // create an instance of the mesh for better performance
    if (USE_THIN_INSTANCES) {
        const matrix = BABYLON.Matrix.Scaling(settings.scale.x, settings.scale.y, settings.scale.z).multiply(BABYLON.Matrix.RotationYawPitchRoll(settings.rotation.y, settings.rotation.x, settings.rotation.z)).multiply(BABYLON.Matrix.Translation(x + settings.offset.x, y + settings.offset.y, z + settings.offset.z));
        meshes[`${meshID}_${count}`].thinInstanceAdd(matrix);
        const index = meshes[`${meshID}_${count}`].thinInstanceCount - 1;
        meshes[`${meshID}_${count}`].metadata.coords[index] = {x, y, z};

        /** @type {BABYLON.Mesh} */
        const mesh = meshes[`${meshID}_${count}`];
        mesh.metadata.thinInstanceColors ??= [];
        mesh.metadata.thinInstanceColors[index * 4 + 0] = color.r;
        mesh.metadata.thinInstanceColors[index * 4 + 1] = color.g;
        mesh.metadata.thinInstanceColors[index * 4 + 2] = color.b;
        mesh.metadata.thinInstanceColors[index * 4 + 3] = 1;
        mesh.thinInstanceSetBuffer("color", new Float32Array(mesh.metadata.thinInstanceColors), 4);
    } else {
        const instance = meshes[`${meshID}_${count}`].createInstance(`${meshID}_${count}`);
        instance.position = new BABYLON.Vector3(x, y, z);
        instance.metadata = {ore, background: bg, coords: {x, y, z}};
    }

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

    m(x, y, z, {
        ore, background: bg,
        offset: settings.offset,
        bounds: bounds ?? {x: 1, y: 1, z: 1},
        rotation: settings.rotation,
        chance: settings.chance,
        str,
        meshID: `${meshID}_${count}`,
        index: USE_THIN_INSTANCES ? meshes[`${meshID}_${count}`].thinInstanceCount - 1 : undefined
    });
    totalOres++;
    
    // if ore light
    if (ores[ore]?.light) {
        let x1 = x, y1 = y, z1 = z;
        if (settings.offset) {
            x1 += settings.offset.x || 0;
            y1 += settings.offset.y || 0;
            z1 += settings.offset.z || 0;
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
            name: `light0-${x}-${y}-${z}`
        };
        lightArr.push(light);
        const pointLight = new BABYLON.PointLight(light.name, light.position, scene);
        pointLight.diffuse = light.color;
        pointLight.intensity = light.intensity;
        pointLight.range = light.distance + 1;
        pointLight.id = light.name;
        lightKeys[`${x}_${y}_${z}`] = pointLight;
        
        const container = createLightContainer(getChunkKey(x, y, z, 64), 64);
        
        // pointLight.position.subtractInPlace(container.position);
        
        container.addLight(pointLight);
    }

    if (ores[ore]?.onGenerate) ores[ore].onGenerate(x, y, z, settings, m(x, y, z));
    
    return m(x, y, z);
}

window.meshes = meshes;

function removeOre(x, y, z, settings = {}) {
    // the fun part... yay...
    x = Math.round(x), y = Math.round(y), z = Math.round(z);
    const oreData = m(x, y, z);
    if (oreData) {
        if (oreAt(x, y, z)) {
            const meshID = oreData.meshID;
            /** @type {BABYLON.Mesh} */
            const mesh = meshes[meshID];
            if (mesh) {
                const index = oreData.index;
                const matrices = mesh.thinInstanceGetWorldMatrices();
                if (index !== undefined && index >= 0 && index < mesh.thinInstanceCount) {
                    // Remove the instance by swapping with the last and decreasing count
                    totalOres--;
                    const lastIndex = mesh.thinInstanceCount - 1;
                    if (index !== lastIndex) {
                        // splice
                        const last = matrices[lastIndex];
                        mesh.thinInstanceSetMatrixAt(index, last);
                    }

                    const movedCoord = mesh.metadata?.coords?.[lastIndex];
                    if (index !== lastIndex && movedCoord) {
                        const movedOre = m(movedCoord.x, movedCoord.y, movedCoord.z);
                        if (movedOre?.ore) movedOre.index = index;
                    }
                    
                    mesh.thinInstanceCount--;
                    if (Array.isArray(mesh.metadata?.coords)) {
                        mesh.metadata.coords[index] = mesh.metadata.coords.pop();
                        mesh.metadata.coords.length = mesh.thinInstanceCount;
                    }
                    if (mesh._thinInstanceDataStorage) {
                        mesh._thinInstanceDataStorage.worldMatrices = null;
                    }
                    mesh.thinInstanceRefreshBoundingInfo();
                    
                    // remove any audio and light associated with this ore
                    /* const audio = scene.getObjectByName(`audio-${x}-${y}-${z}`);
                    if (audio) {
                    audio.stop();
                    scene.remove(audio);
                    } */
                    const light = lightArr.find(l => l.name === `light0-${x}-${y}-${z}`);
                    if (light) {
                        const idx = lightArr.indexOf(light);
                        if (idx !== -1) lightArr.splice(idx, 1);
                        /** @type {BABYLON.ClusteredLightContainer} */
                        const container = lightContainers["0"];
                        const pointLight = lightKeys[`${x}_${y}_${z}`];
                        if (pointLight) {
                            pointLight.intensity = 0;
                            scene.removeLight(pointLight);
                            lightContainers["0"].removeLight(pointLight);
                            delete lightKeys[`${x}_${y}_${z}`];
                        } else {
                            console.warn(`Light for ${x}_${y}_${z} not found in lightKeys.`);
                        }
                    }
                    // remove particle system if it exists
                    if (m(x, y, z).particleSystem) {
                        scene.remove(m(x, y, z).particleSystem.points);
                        const idx = activeParticleSystems.indexOf(m(x, y, z).particleSystem);
                        if (idx !== -1) activeParticleSystems.splice(idx, 1);
                        m(x, y, z).particleSystem = undefined;
                    }
                    
                    // remove radiation
                    const radIndex = radArr.findIndex(r => r.name === `rad-${x}-${y}-${z}`);
                    if (radIndex !== -1) {
                        radArr.splice(radIndex, 1);
                    }
                    
                    // remove from repair list
                    if (repairObj[`${x}_${y}_${z}`]) {
                        delete repairObj[`${x}_${y}_${z}`];
                        repairArr.splice(repairArr.indexOf(`${x}_${y}_${z}`), 1);
                    }
                    
                    // remove tick
                    const tickIndex = vars.oreTicks.findIndex(t => t.x === x && t.y === y && t.z === z);
                    if (tickIndex !== -1) {
                        vars.oreTicks.splice(tickIndex, 1);
                    }
                    
                    if (ores[m(x, y, z).ore]?.onRemove) {
                        ores[m(x, y, z).ore].onRemove(x, y, z);
                    }
                    
                    // check for overlay as well
                    const overlayIndex = vars.overlays.findIndex(g => Math.round(g.x) === Math.round(x) && Math.round(g.y) === Math.round(y) && Math.round(g.z) === Math.round(z));
                    if (overlayIndex !== -1) {
                        document.getElementById(vars.overlays[overlayIndex].ore + "Overlay").style.opacity = 0;
                        vars.overlays.splice(overlayIndex, 1);
                    }
                }
            }
            if (!settings.keep) {
                if (!settings.fullyRemove) m(x, y, z, true);
                else m(x, y, z, "delete");
            }
        } else {
            if (!settings.keep) {
                if (!settings.fullyRemove) m(x, y, z, true);
                else m(x, y, z, "delete");
            }
        }
        if (!settings.keep) {
            const chunk = getChunk(x, y, z);
            const index = chunk.indexOf(`${x}_${y}_${z}`);
            if (index !== -1) {
                chunk.splice(index, 1);
            }
        }
    } else {
        m(x, y, z, true);
    }
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

    const oreData = m(x, y, z);
    if (!oreData?.ore) return null;
    return {x, y, z, oreData};
}

function getChunk(x, y, z) {
    x = Math.floor(x / CHUNK_SIZE);
    y = Math.floor(y / CHUNK_SIZE);
    z = Math.floor(z / CHUNK_SIZE);
    if (!chunks[`${x}_${y}_${z}`]) chunks[`${x}_${y}_${z}`] = [];
    return chunks[`${x}_${y}_${z}`];
}

function getChunkKey(x, y, z, size) {
    const chunkX = Math.floor(x / size);
    const chunkY = Math.floor(y / size);
    const chunkZ = Math.floor(z / size);
    return `${chunkX}_${chunkY}_${chunkZ}`;
}

window.removeOre = removeOre;

function spawnOre(x, y, z, settings) {
    if (settings === undefined) settings = {caveExclusive: false, noCave: false};
    if (m(x, y, z) && !settings.forced && !settings.forceReplace && !m(x, y, z).temp) return false;
    if (typeof settings === "string") settings = {caveExclusive: true, noCave: true, caveType: settings};
    const layer = getLayer(y, x, z, false);
    if (layers[layer]?.universalCondition && !layers[layer].universalCondition(x, y, z) && !m(x, y, z)) {
        m(x, y, z, true);
        return m(x, y, z);
    }
    
    settings = {...settings};
    settings.all = true;
    settings.cave = {};
    settings.scale = {};

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
            return m(x, y, z);
        }
    }

    const noiseVal = noise(x, y, z);
    if (noiseVal.value > noiseVal.caveReq && !m(x, y, z)?.temp) {
        if (!settings.noCave) generateCave(x, y, z);
        return m(x, y, z);
    }
    
    if (isCaveFloor(x, y, z)) settings.isCaveFloor = true;
    if (isCaveCeiling(x, y, z)) settings.isCaveCeiling = true;
    if (!Object.keys(settings.cave).length) delete settings.cave;
    
    let oreData;

    if (m(x, y, z)?.temp) {
        const data = m(x, y, z);
        oreData = {};

        if (data.dripstone) {
            settings.noVein = true;
            settings.noGeode = true;
            oreData.ore = oreData.bg = getBGOre(x, Math.round(y - 5 + data.dripstone * 5), z);
            settings.scale.x = settings.scale.z = data.dripstone;
        } else {
            settings.cave = {};
            settings.caveAir = true;
            if (data.caveFloor) {
                settings.cave = { floor: true };
            }
            if (data.caveCeiling) {
                settings.cave.ceiling = true;
            }
            if (data.caveWall) {
                settings.cave.walls = data.caveWall;
            }
            settings.cave.air = true;
            if (!Object.keys(settings.cave).length) return m(x, y, z, { ore: "air", caveType: data.caveType });
        }
    }

    if (!oreData?.ore) {
        oreData = getOre(x, y, z, settings);
    }
    if (!oreData || oreData.ore === null) {
        m(x, y, z, true);
        return m(x, y, z);
    }
    settings.chance = oreData.chance;
    
    generateOre(x, y, z, oreData.ore, oreData.bg, settings);
    
    if (ores[oreData.ore]?.tree) {
        let h = ores[oreData.ore].tree.height || { min: 4, max: 4 };
        if (typeof h === "number") h = { min: h, max: h };
        const height = Math.floor(Math.random() * (h.max - h.min + 1)) + h.min;
        generateTree(
            x, y, z,
            oreData.ore,
            typeof ores[oreData.ore].tree.leaves.block === "function" ? ores[oreData.ore].tree.leaves.block(x, y, z) : ores[oreData.ore].tree.leaves.block,
            height,
            typeof ores[oreData.ore].tree.leaves.size === "function" ? ores[oreData.ore].tree.leaves.size(x, y, z) : ores[oreData.ore].tree.leaves.size,
            settings
        );
    }
    return m(x, y, z);
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
    
    workers.findEmpty.postMessage({x, y, z, seed: vars.seed});
}

workers.findEmpty.addEventListener("message", e => {
    const data = e.data;
    const {mToSend, mToModify, priorityChunksToAdd} = data;

    for (let i = 0; i < mToSend.length; i++) {
        if (!m(...(mToSend[i].slice(0, 3)))) {
            m(...mToSend[i]);
        }
    }
    for (let i = 0; i < mToModify.length; i++) {
        const j = mToModify[i];
        m(j[0], j[1], j[2])[j[3]] = j[4];
    }
    priorityChunks3 = new Set([...priorityChunks3, ...priorityChunksToAdd]);
});

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

    const gridJitter = typeof structure.gridJitter === "number" ? Math.max(0, Math.min(1, structure.gridJitter)) : 1;
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
                        if (m(x2, y2, z2) && !settings.forced && !m(x2, y2, z2).temp) continue;
                        if (block === "air") {
                            if (settings.forced) removeOre(x2, y2, z2, {type: "structure"});
                            m(x2, y2, z2, true);
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
                m(x + pos[0], y + pos[1], z + pos[2], true);
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
                settings || { noUpdate: true }
            );
        }
    }

    for (let i = 0; i < empty.length; i += 3) {
        const x1 = empty[i];
        const y1 = empty[i + 1];
        const z1 = empty[i + 2];
        generateAdjacent(x1, y1, z1, {noUpdate: true});
    }

    if (str.onGenerate) str.onGenerate(x, y, z);

    console.log(`Generated structure ${structure} at ${settings.centerX}, ${settings.centerY}, ${settings.centerZ} (grid: ${gridX}, ${gridY}, ${gridZ}; world: ${x}, ${y}, ${z})`);
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

function generateChunk3(x, y, z, noCave = false) { // used for places like space
    let generatedAny = false;
    let startTime = performance.now();
    const sets = {};
    // 2if (noCave) sets.noCave = true;
    for (let x1 = x * CHUNK_SIZE_3; x1 < (x + 1) * CHUNK_SIZE_3; x1++) {
        for (let y1 = y * CHUNK_SIZE_3; y1 < (y + 1) * CHUNK_SIZE_3; y1++) {
            for (let z1 = z * CHUNK_SIZE_3; z1 < (z + 1) * CHUNK_SIZE_3; z1++) {
                const sets1 = {...sets};
                if (m(x1, y1, z1) && !m(x1, y1, z1).temp) continue;
                const isCaveAir = checkAdjacent(x1, y1, z1, isCave);
                let caveData;
                if (layers[getLayer(y1, x1, z1, false)].chunks !== "3d"
                    && layers[getLayer(y1 - 1, x1, z1, false)].chunks !== "3d"
                    && layers[getLayer(y1 + 1, x1, z1, false)].chunks !== "3d"
                    && !isCaveAir
                ) continue;
                if (isCaveAir) {
                    caveData = m(...isCaveAir);
                    sets1.caveType = caveData.caveType;
                    sets1.hasCrates = caveData.hasCrates;
                    sets1.hasTorches = caveData.hasTorches;
                    sets1.hasCrystals = caveData.hasCrystals;
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
        const priority = [...priorityChunks3].filter(g => chunkToPlayer3(g) < GENERATION_DISTANCE * 4).sort(dist);
        const prioritySet = new Set(priority);
        generatingChunks3 = [...new Set(priority.concat(generatingChunks3))];
        let i = 0;
        let check = Math.min(generatingChunks3.length, layers[CURRENT_LAYER]?.chunkGenSpeed || CHUNK3_RATE);
        while (check > 0) {
            if (generatingChunks3.length === 0 || !generatingChunks3[i]) break;
            const [x, y, z] = generatingChunks3[i++].split("_").map(Number);
            if (generateChunk3(x, y, z, prioritySet.has(`${x}_${y}_${z}`))) check--;
            else check -= 0.25;
            generatedChunks.add(`${x}_${y}_${z}`);
            priorityChunks3.delete(`${x}_${y}_${z}`);
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
    if (vars.miningStartTime < performance.now()) {
        document.getElementById("miningTime").style.display = "block";
        document.getElementById("mining-progress").style.display = "block";
    }
    
    const intersect = LAST_ORE[4];
    const oldIntersect = CURRENT_ORE[4];
    
    const x = LAST_ORE[0], y = LAST_ORE[1], z = LAST_ORE[2];
    if (CURRENT_ORE[0] !== x || CURRENT_ORE[1] !== y || CURRENT_ORE[2] !== z || oldIntersect > inventory.currentPickaxe.range) {
        if (vars.miningStartTime < performance.now() && CURRENT_ORE && m(CURRENT_ORE[0], CURRENT_ORE[1], CURRENT_ORE[2]) && oreAt(CURRENT_ORE[0], CURRENT_ORE[1], CURRENT_ORE[2])) {
            setProgress(CURRENT_ORE[0], CURRENT_ORE[1], CURRENT_ORE[2]);
        }
        if (intersect <= inventory.currentPickaxe.range) vars.miningStartTime = performance.now() + inventory.currentPickaxe.delay * 1000;
        else {
            CURRENT_ORE = [];
            vars.miningStartTime = undefined;
            return;
        }
    }
    
    CURRENT_ORE = LAST_ORE;
    
    let progress = setProgress(x, y, z, true) * 100;
    if (Math.abs(progress) === Infinity) progress = 100;
    if (isNaN(progress)) {
        progress = 0;
    }
    if (progress > 100) progress = 100;
    if (progress < 0) progress = 0;
    
    if (!updatedBreak && performance.now() >= vars.miningStartTime) updateBreakMesh(x, y, z, m(x, y, z), progress / 100);
    
    if (progress >= 100) {
        mine(x, y, z);
    } else if (vars.miningStartTime < performance.now()) {
        document.getElementById("miningTime").innerText = formatTime((m(x, y, z).str) / calculatePower(x, y, z) * (1 - progress / 100)).replace("Infinity", "Unbreakable");
        document.getElementById("mining-progress").value = progress;
        document.getElementById("mining-progress").style.setProperty("--color", (m(x, y, z).color || m(x, y, z).ore ? ores[m(x, y, z).ore].color : "#888") || "#888");
        document.getElementById("mining-progress").style.setProperty("--size", document.getElementById("mining-progress").offsetWidth + "px");
    }
}

function setProgress(x, y, z, dontSet = false, forcedProgress, noAdd = false) {
    const pos = m(x, y, z);
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
    }
    return progress;
}

function updateBreakMesh() {
    return "temp";
}

function updateTopLeft() {
    document.getElementById("health").value = player.health;
    document.getElementById("radiation").value = Math.max(Math.log2(player.radiation + 1), 0);
    document.getElementById("healthText").innerText = `${formatNum(player.health, 2)} HP`;
    document.getElementById("radiationText").innerText = `${formatNum(player.radiation, 3)} Rads`;
    if (player.radiation > 12.5) {
        document.getElementById("radiation").classList.add("danger");
    } else {
        document.getElementById("radiation").classList.remove("danger");
    }
    document.getElementById("depth").innerText = `${player.position.y < 0 ? "Depth" : "Altitude"}: ${Math.abs(player.position.y).toLocaleString(undefined, {maximumFractionDigits: 1})}m (${layers[CURRENT_LAYER] ? layers[CURRENT_LAYER].name : biomes[CURRENT_LAYER] ? biomes[CURRENT_LAYER].name : "Unknown"})`;
    document.getElementById("position").innerText = `Position: ${player.position.x.toLocaleString(undefined, {maximumFractionDigits: 1})}, ${(player.position.y).toLocaleString(undefined, {maximumFractionDigits: 1})}, ${player.position.z.toLocaleString(undefined, {maximumFractionDigits: 1}) === "-0" ? "0" : player.position.z.toLocaleString(undefined, {maximumFractionDigits: 1})}`.replaceAll("-0,", "0,");
    document.getElementById("power").innerText = `Pickaxe Power: ${formatNum(1 / (Math.abs(player.position.y) + 1000) * 1000 * calculatePower(player.position.x, player.position.y, player.position.z))}`;
    document.getElementById("time").innerText = `Time: ${getTimeString()}`;
    
    document.getElementById("totalOres").innerText = `Ores: ${totalOres.toLocaleString()}
    Meshes: ${Object.keys(meshes).length.toLocaleString()}
    Lights: ${lightArr.length.toLocaleString()}
    Generating Chunks: ${generatingChunks.length.toLocaleString()}, ${generatingChunks3.length.toLocaleString()}
    Velocity: ${formatNum(player.velocity.x * 60, 2)}, ${formatNum(player.velocity.y * 60, 2)}, ${formatNum(player.velocity.z * 60, 2)}
    `;
}

function mine(x, y, z, settings = {}) {
    if (airAt(x, y, z)) return;
    
    document.getElementById("mining-progress").value = 0;
    const ore = m(x, y, z).ore;
    if (!ores[ore]) console.log(ore, x, y, z, m(x, y, z));
    const dropCount = vars.itemMultiplier * Math.round(m(x, y, z).yield || 1);
    const drops = m(x, y, z)?.drops ?? ores[ore]?.drops;
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
    const chance = m(x, y, z).chance || calculateRarity(ores[ore], y, x, z);
    const displayName = `${m(x, y, z).prefix ? m(x, y, z).prefix + " " : ""}${m(x, y, z).name || ores[ore].name}`;
    if (!m(x, y, z).placed && (chance <= 1e-6 || tiers[ores[ore].tier].maxChance <= 1e-6 || (tiers[ores[ore].tier].global && !ores[ore].noGlobal)) && chance !== 0 && !m(x, y, z).isVein && !m(x, y, z).isGeode) {
        let footerText = "";
        if (m(x, y, z).traits) {
            const originalChance = chance / m(x, y, z).traits.reduce((acc, trait) => acc * (traits[trait].chance || 1), 1);
            footerText += `${formatChance(originalChance)} chance for the ore to spawn`;
            for (let i = 0; i < m(x, y, z).traits.length; i++) {
                const trait = m(x, y, z).traits[i];
                footerText += `\n${formatChance(traits[trait].chance)} chance to be ${traits[trait].appendName ? "a " : ""}${traits[trait].name.toLowerCase()}`;
            }
        }
        
        if (ores[ore].caveExclusive) {
            if (ores[ore].caveExclusive === -1) footerText += `\nNever spawns in caves`;
            else footerText += `\nOnly spawns in caves`;
        }
        if (m(x, y, z).conditionLabel) footerText += `\n${m(x, y, z).conditionLabel}`;
        footerText = footerText.trim();
        let footer;
        if (footerText) footer = {text: footerText};
        
        // webhookMessage(`${username} has found ${displayName}!`, `**Tier:** ${tiers[ores[ore].tier].name}`, ore, chance, y, footer);
    }
    
    if (!m(x, y, z).placed) {
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
    removeOre(x, y, z);
    generateAdjacent(x, y, z);
    
    if (!settings.noExplosion && inventory.currentPickaxe.explosion) {
        const radius = inventory.currentPickaxe.explosion.radius || 1;
        if (Math.random() < (inventory.currentPickaxe.explosion.chance || 1)) {
            for (let x1 = x - radius; x1 <= x + radius; x1++) {
                for (let y1 = y - radius; y1 <= y + radius; y1++) {
                    for (let z1 = z - radius; z1 <= z + radius; z1++) {
                        const r = Math.sqrt((x1 - x) ** 2 + (y1 - y) ** 2 + (z1 - z) ** 2);
                        if (r < radius) {
                            let exists;
                            if (m(x1, y1, z1)) {
                                const oreData = m(x1, y1, z1);
                                if (oreAt(x1, y1, z1) && ores[oreData.ore]) exists = true;
                            } else {
                                spawnOre(x1, y1, z1);
                                if (oreAt(x1, y1, z1)) exists = true;
                            }
                            
                            if (exists) {
                                let progress = m(x1, y1, z1).progress || 0;
                                progress += (inventory.currentPickaxe.explosion.power || calculatePower(x, y, z) || 1) / r / m(x1, y1, z1).str;
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
    
    if (!used && hit.hit) {
        const {x, y, z} = picked;
        
        if (ores[m(x, y, z).ore].onUse) {
            ores[m(x, y, z).ore].onUse(x, y, z);
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
                document.getElementById("nightVisionOverlay").style.display = "none";
            } else {
                cameraLight.diffuse = new BABYLON.Color3.FromHexString("#91eb36");
                cameraLight.intensity = 5;
                document.getElementById("nightVisionOverlay").style.display = "block";
            }
        }
        return true;
    }
    return false;
}

for (let i = 0; i < oreArray.length; i++) {
    const ore = oreArray[i];
    if (ore.getCanvas) {
        ore.canvasElem = document.createElement("canvas");
        ore.canvasElem.width = 32;
        ore.canvasElem.height = 32;
        if (ore.updateCanvas) animatedCanvases.push(ore.id);
        textures[ore.id] = new BABYLON.DynamicTexture(`${ore.name}CanvasTexture`, ore.getCanvas(), scene, true, BABYLON.Texture.NEAREST_SAMPLINGMODE, undefined, true);
        textures[ore.id]?.update();
    }
}

function start() {
    locations[0][1] = topLayer(locations[0][0], locations[0][2]) + 1;
    player.position.y = locations[0][1] + 1;
    
    for (let i = 0; i < locations.length; i++) {
        const location = locations[i];
        const [x, y, z] = location;
        generateOre(x, y - 1, z, "blackWall", "grass", {traits: ["protected"]});
    }
    
    // start logo css animation
    function startAnimations() {
        setTimeout(() => {
            document.getElementById("logo").style.display = "";
            document.getElementById("logo").style.animation = "initLogo 4s ease-in-out";
            document.getElementById("logo").style.animationFillMode = "forwards";
            setTimeout(() => {
                document.getElementById("menu-mask").style.animation = "initMask 2.4s ease-in-out";
                document.getElementById("menu-mask").style.animationFillMode = "forwards";
            }, 1600);
        }, 0);
    }
    requestAnimationFrame(startAnimations);
}
start();

function pause() {
    vars.PAUSED = true;
    document.getElementById("logo-container").style.visibility = "visible";
    document.getElementById("main-menu").style.display = "block";
    document.getElementById("bgm").pause();
}

let direction = new BABYLON.Vector3();
const jumpSpeed = 0.16;
let canJump = false;
let gravity = 0.01;
let lastStepDist = 0;

function pickPredicate(mesh) {
    return mesh.metadata?.type === "ore";
}

engine.runRenderLoop(() => {
    if (vars.PAUSED) return;
    FRAME_TIME = Math.min((performance.now() - LAST_FRAME) / 1000, 0.1); // cap frame time to prevent huge lag spikes
    LAST_FRAME = performance.now();
    vars.FRAME_TIME = FRAME_TIME;
    
    document.getElementById("fps").textContent = `FPS: ${(1 / FRAME_TIME).toFixed(1)}`;

    for (let i = 0; i < animatedCanvases.length; i++) {
        ores[animatedCanvases[i]].getCanvas();
        textures[animatedCanvases[i]]?.update();
    }
    
    loadNearbyChunks();
    
    for (let i = 0; i < vars.removalQueue.length; i++) {
        const r = vars.removalQueue[i];
        if (oreAt(r.x, r.y, r.z)) {
            updateBreakMesh(r.x, r.y, r.z, undefined, 2);
            removeOre(r.x, r.y, r.z, { noUpdate: true });
        } else {
            m(r.x, r.y, r.z, true);
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
    
    // movement
    direction.z = Number(keys.forward) - Number(keys.backward);
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
                const ore = m(x1, y1, z1).background;
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
        
        if (keys['jump'] && canJump) {
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
            return {x: player.position.x, y: player.position.y, z: player.position.z};
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
                
                if (Math.abs(player.lastVelocity.x) > 0.3) player.damage(Math.max((Math.abs(player.lastVelocity.x) - 0.3) * 60, 0), 0, "collision", true);
            }
            if (!canMoveY) {
                nextPos.y = player.position.y;
                velocity.y = 0;
            }
            if (!canMoveZ) {
                nextPos.z = player.position.z;
                velocity.z = 0;
                
                if (Math.abs(player.lastVelocity.z) > 0.3) player.damage(Math.max((Math.abs(player.lastVelocity.z) - 0.3) * 60, 0), 0, "collision", true);
            }
            
            const dist = BABYLON.Vector3.Distance(player.position, nextPos);
            const ore = m(Math.floor(player.position.x + 0.5), Math.floor(player.position.y - 0.01), Math.floor(player.position.z + 0.5))?.background;
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
                    if (Math.abs(player.lastVelocity.y) > 0.3) player.damage(Math.max((Math.abs(player.lastVelocity.y) - 0.3) * 60, 0), 0, player.lastVelocity.y < 0 && !vars.fly ? "fall" : "collision", true);
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
        
        const music = document.getElementById("bgm");
        const layer = getLayer(playerPos.y, playerPos.x, playerPos.z);
        const layerDetails = layers[layer] || biomes[layer];
        
        const musicElem = document.getElementById("music");
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
            
            const musicElem = document.getElementById("music");
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
                scene.fogDensity = 0.5 / (Math.sqrt(area.fog || 100));
                perspectiveCamera.maxZ = area.fog || 1000;
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
    } else {
        scene.fogColor = BABYLON.Color3.Lerp(getColor(vars.fogColor), getColor(nightFog), Math.min(Math.max((0.2 - sunHeight) / 0.4, 0), 1));
    }
    
    directionalLight.position.copyFrom(offset.scale(1));
    directionalLight.setDirectionToTarget(BABYLON.Vector3.Zero());
    sun.position.copyFrom(perspectiveCamera.position).addInPlace(offset);

    function hide() {
        document.getElementById("tooltip").style.display = "none";
        vars.miningStartTime = undefined;
        LAST_ORE = [];
        CURRENT_ORE = [];
    }
    
    // raycasting
    const raycaster = perspectiveCamera.getForwardRay(inventory.currentPickaxe.range);
    const hit = scene.pickWithRay(raycaster, pickPredicate);
    if (hit.hit) {
        const picked = getPickedOreCoords(hit);
        if (!picked) {
            console.log("Error: Hit an ore mesh but couldn't get coordinates", hit);
            hide();
        } else {
            const {x, y, z, oreData} = picked;
            if (JSON.stringify(LAST_ORE.slice(0, 4)) !== JSON.stringify([x, y, z, oreData.ore])) LAST_ORE = [x, y, z, oreData.ore, hit.distance];
            
            if (hit.distance <= inventory.currentPickaxe.range) {
                const oreData = ores[hit.pickedMesh.metadata?.ore], color = oreData?.color || "#fff";
                document.getElementById("oreName").textContent = `${oreData?.name || "Unknown"}`;
                document.getElementById("tooltip").style.display = "";
                if (color[0] === "#") {
                    document.getElementById("oreName").style.color = color;
                    document.getElementById("oreName").style.textShadow = "";
                    document.getElementById("oreName").style.backgroundImage = "none";
                } else {
                    document.getElementById("oreName").style.color = "transparent";
                    document.getElementById("oreName").style.textShadow = "none";
                    document.getElementById("oreName").style.backgroundImage = color;
                }
                
                let chance = m(x, y, z).chance ?? 0;
                
                if (MINING) miningTick();
                
                document.getElementById("debugInfo").textContent = `${x}, ${y}, ${z}`;
                if (document.getElementById("totalOres").style.display !== "none") {
                    document.getElementById("debugInfo").innerText += `\n${m(x, y, z).meshID}`;
                }
                document.getElementById("oreRarity").textContent = m(x, y, z).placed ? `Placed by ${window.username || "you"}` : (isFinite(chance) && Math.abs(chance) !== 0 ? formatChance(chance) : "");
                document.getElementById("oreRarity").style.color = tiers[ores[m(x, y, z).ore]?.tier]?.color ?? "#fff";
                document.getElementById("oreRarity").style.display = "block";
                
                document.getElementById("oreDesc").textContent = oreData?.desc ?? "No description available.";
                document.getElementById("miningTime").innerText = formatTime((m(x, y, z).str) / calculatePower(x, y, z) * (1 - (m(x, y, z).progress || 0))).replace("Infinity", "Unbreakable") + " + " + formatTime(inventory.currentPickaxe.delay);
            } else {
                hide();
            }
        }
    } else {
        hide();
    }

    // hp + radiation
    player.health += FRAME_TIME; // health regeneration
    let netChange = player.radiation + 0;
    player.radiation *= 0.95 ** FRAME_TIME; // decay radiation over time
    player.radiation -= 0.3 * FRAME_TIME; // slight radiation loss over time
    netChange = player.radiation - netChange;
    for (let i = 0; i < radArr.length; i++) {
        const source = radArr[i];
        const dist = player.position.distanceTo(source.position);
        if (dist < 15) {
            const r = source.strength * (1 - source.falloff) ** Math.max(dist - 2, 0) ** 2 * FRAME_TIME;
            player.radiation += r;
            netChange += r;
        }
    }
    if (inventory.currentPickaxe.radiation) {
        const rad = inventory.currentPickaxe.radiation * FRAME_TIME / 2;
        player.radiation += rad;
        netChange += rad;
    }
    if (netChange > 0) {
        if (!geigerAudio.isPlaying) {
            geigerAudio.play();
        }
    } else if (geigerAudio.isPlaying) {
        geigerAudio.stop();
    }
    if (player.radiation > 0) {
        player.damage((player.radiation) * 0.08 * FRAME_TIME, 0, "radiation", true, false, false);
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
    
    scene.clearColor = scene.fogColor;
    scene.fogColor = scene.clearColor;
    scene.render();
});

textures["skybox/space"] = new BABYLON.Texture("img/block/skybox/space.png", scene);
textures["skybox/space"].coordinatesMode = BABYLON.Texture.SKYBOX_MODE;