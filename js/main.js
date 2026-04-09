import vars from "./vars.js";
import { getOre, m, oreAt, checkAdjacent } from "./outside_stuff.js";
import { getLayer, layers, locations, ores } from "./content/items.js";
import { biomes, topLayer } from "./content/layers.js";
import { isCave, CHUNK3_RATE, CHUNK_SIZE_3, CHUNK_SIZE } from "./noise.js";

const { player, stats, camera } = vars;

const canvas = document.getElementById("canvas");

const textures = {};
const meshes = {};
let meshCounts = {};
let MAX_MESH_COUNT = 1000;
let STARTED = true;
let LAST_FRAME = performance.now(); // for FPS calculation
let FRAME_TIME = 0;
let CURRENT_LAYER, INITIALIZED_LAYER = false;
let generatingChunks = [], generatingChunks3 = [], priorityChunks3 = new Set(), generatedChunks = new Set(), GENERATION_DISTANCE = 64;
let lightArr = [];
let USE_THIN_INSTANCES = true;

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

window.addEventListener("resize", resize);
resize();

// set up scene and camera
const engine = new BABYLON.Engine(canvas, true);
const scene = new BABYLON.Scene(engine);
const perspectiveCamera = new BABYLON.UniversalCamera("camera1", new BABYLON.Vector3(0, 2, 0), scene);
perspectiveCamera.maxZ = 1000;
perspectiveCamera.minZ = 0.1;
perspectiveCamera.fov = 1.2;
scene.fogEnabled = true;

const raycaster = new BABYLON.Ray(new BABYLON.Vector3(), new BABYLON.Vector3());
raycaster.length = 1000;

// rendering pipeline
const pipeline = new BABYLON.DefaultRenderingPipeline("pipeline", true, scene, [perspectiveCamera]);
pipeline.bloomEnabled = true;
pipeline.fxaaEnabled = true;
pipeline.fxaa.samples = 4;

// ambient occlusion
const ssao = new BABYLON.SSAO2RenderingPipeline("ssao", scene, 0.75, [perspectiveCamera]);
ssao.radius = 1;
window.ssao = ssao;

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

scene.ambientColor = new BABYLON.Color3(0.2, 0.2, 0.2);

const hemisphereLight = new BABYLON.HemisphericLight("hemisphereLight", new BABYLON.Vector3(0, 1, 0), scene);
const directionalLight = new BABYLON.DirectionalLight("directionalLight", new BABYLON.Vector3(-0.5, -2, -1), scene);
const cameraLight = new BABYLON.PointLight("cameraLight", perspectiveCamera.position, scene);

const sun = new BABYLON.CreateSphere("sun", {diameter: 10}, scene);
const sunMaterial = new BABYLON.StandardMaterial("sunMaterial", scene);
sunMaterial.emissiveColor = new BABYLON.Color3(1, 1, 0.8);
sunMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
sunMaterial.disableLighting = true;
sun.material = sunMaterial;

function getTime() {
    if (vars.timeOverride !== undefined) return vars.timeOverride;
    const dayLength = 1800000; // milliseconds for a full day cycle
    return (Date.now() / dayLength * Math.PI * 2) % (Math.PI * 2);
}

const skybox = BABYLON.MeshBuilder.CreateBox("skyBox", {size: 500}, scene); // not working, figure out later
const skyboxMaterial = new BABYLON.StandardMaterial("skyBoxMaterial", scene);
skyboxMaterial.backFaceCulling = false;
skyboxMaterial.disableLighting = true;
skybox.material = skyboxMaterial;
skybox.applyFog = false;
skybox.infiniteDistance = true;

const lightContainers = [];
for (let i = 0; i < 2; i++) {
    lightContainers.push(new BABYLON.ClusteredLightContainer(`lightContainer${i}`, [], scene));
}
window.cameraLight = cameraLight;

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

function generateOre(x, y, z, ore, bg, settings) {
    x = Math.round(x), y = Math.round(y), z = Math.round(z);
    if (m(x, y, z) && !settings.forceReplace && !settings.forced && !m(x, y, z).temp) return;
    if (m(x, y, z).ore === "air" && !settings.forced && !m(x, y, z).temp) return;
    if (!settings) settings = {};
    settings = JSON.parse(JSON.stringify(settings));
    
    if (!settings.offset) settings.offset = {x: 0, y: 0, z: 0};
    if (!settings.offset.x) settings.offset.x = 0;
    if (!settings.offset.y) settings.offset.y = 0;
    if (!settings.offset.z) settings.offset.z = 0;

    let count = meshCounts[`${ore}_${bg}`] || 0;

    if (meshes[`${ore}_${bg}_${count}`]?.thinInstanceCount >= MAX_MESH_COUNT) {
        meshCounts[`${ore}_${bg}`] = ++count;
    }
    
    if (!meshes[`${ore}_${bg}_${count}`]) {
        const oreMesh = BABYLON.MeshBuilder.CreateBox(`${ore}_${bg}_${count}`, {size: 1, wrap: true}, scene);
        oreMesh.metadata = {ore, background: bg, coords: {}};
        if (USE_THIN_INSTANCES) oreMesh.thinInstanceEnablePicking = true; // allow picking by raycast
        const oreMaterial = new BABYLON.StandardMaterial(`oreMaterial-${x}_${y}_${z}`, scene);
        oreMaterial.diffuseColor = new BABYLON.Color3(1, 1, 1);
        oreMaterial.ambientColor = new BABYLON.Color3(1, 1, 1);
        oreMaterial.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        oreMaterial.alphaMode = 2;

        const backgroundMaterial = new BABYLON.StandardMaterial(`backgroundMaterial-${x}_${y}_${z}`, scene);
        backgroundMaterial.diffuseColor = new BABYLON.Color3(1, 1, 1);
        backgroundMaterial.ambientColor = new BABYLON.Color3(1, 1, 1);
        backgroundMaterial.specularColor = new BABYLON.Color3(0, 0, 0);

        if (ore === bg || ores[ore]?.singleLayer) oreMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
        
        if (ores[ore]?.light) {
            oreMesh.receiveShadows = false;
            oreMaterial.emissiveColor = new BABYLON.Color3(1, 1, 1);
        }

        if (!textures[`${ore}`]) textures[`${ore}`] = new BABYLON.Texture(`img/block/${ore}.png`, scene, false, true, BABYLON.Texture.NEAREST_SAMPLINGMODE);
        if (!textures[`${bg}`]) textures[`${bg}`] = new BABYLON.Texture(`img/block/${bg}.png`, scene, false, true, BABYLON.Texture.NEAREST_SAMPLINGMODE);
        oreMaterial.diffuseTexture = textures[`${ore}`];
        oreMaterial.opacityTexture = textures[`${ore}`];
        backgroundMaterial.diffuseTexture = textures[`${bg}`];

        const multiMaterial = new BABYLON.MultiMaterial(`multi-${x}_${y}_${z}`, scene);
        multiMaterial.subMaterials.push(backgroundMaterial, oreMaterial);
        oreMesh.material = multiMaterial;

        oreMesh.releaseSubMeshes();
        const vertices = oreMesh.getTotalVertices();
        const indices = oreMesh.getTotalIndices();
        new BABYLON.SubMesh(0, 0, vertices, 0, indices, oreMesh);
        new BABYLON.SubMesh(1, 0, vertices, 0, indices, oreMesh);
        
        meshes[`${ore}_${bg}_${count}`] = oreMesh;
    }
    
    // create an instance of the mesh for better performance
    if (USE_THIN_INSTANCES) {
        const matrix = BABYLON.Matrix.Translation(x, y, z);
        const index = meshes[`${ore}_${bg}_${count}`].thinInstanceAdd(matrix);
        meshes[`${ore}_${bg}_${count}`].metadata.coords[index] = {x, y, z};
    } else {
        const instance = meshes[`${ore}_${bg}_${count}`].createInstance(`${ore}_${bg}_${count}`);
        instance.position = new BABYLON.Vector3(x, y, z);
        instance.metadata = {ore, background: bg, coords: {x, y, z}};
    }
    m(x, y, z, {ore, background: bg, offset: settings.offset, bounds: settings.bounds || {x: 1, y: 1, z: 1}});
    
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
            color: new BABYLON.Color3.FromHexString(typeof ores[ore].light.col === "function" ? ores[ore].light.col() : ores[ore].light.col !== "random" ? ores[ore].light.col : Math.floor(Math.random() * 2 ** 24)),
            intensity: ores[ore].light.str,
            distance: ores[ore].light.radius || ores[ore].light.str * 2,
            decay: typeof ores[ore].light.decay === "number" ? ores[ore].light.decay : 2,
            name: `light-${x}-${y}-${z}`
        };
        lightArr.push(light);
        const pointLight = new BABYLON.PointLight(light.name, light.position, scene);
        pointLight.diffuse = light.color;
        pointLight.intensity = light.intensity;
        pointLight.range = light.distance;
        lightContainers[0].addLight(pointLight);
    }
}

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
    
    const oreData = getOre(x, y, z);
    if (!oreData || oreData.ore === null) {
        m(x, y, z, true);
        return m(x, y, z);
    }
    generateOre(x, y, z, oreData.ore, oreData.bg, settings);
    return m(x, y, z);
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
    if (noCave) sets.noCave = true;
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
          playerZ = perspectiveCamera.position.z;

    function chunkToPlayer(a) {
        return Math.hypot(a.split("_")[0] - playerX / CHUNK_SIZE, a.split("_")[1] - playerZ / CHUNK_SIZE) * CHUNK_SIZE;
    }

    function chunkToPlayer3(a) {
        const [ax, ay, az] = a.split("_").map(Number);
        return Math.abs(ax * CHUNK_SIZE_3 - playerX) + Math.abs(ay * CHUNK_SIZE_3 - (player.position.y)) + Math.abs(az * CHUNK_SIZE_3 - playerZ);
    }

    if (!vars.PAUSED) {
        const GEN_SIZE = Math.ceil(GENERATION_DISTANCE / CHUNK_SIZE);
        for (let x = -GEN_SIZE; x < GEN_SIZE; x++) {
            for (let z = -GEN_SIZE; z < GEN_SIZE; z++) {
                generatingChunks.push(`${Math.floor(playerX / CHUNK_SIZE) + x}_${Math.floor(playerZ / CHUNK_SIZE) + z}`);
            }
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
                x: Math.floor(perspectiveCamera.position.x / CHUNK_SIZE_3),
                y: Math.floor(player.position.y / CHUNK_SIZE_3),
                z: Math.floor(perspectiveCamera.position.z / CHUNK_SIZE_3)
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

window.generatedChunks = generatedChunks;

function start() {
    locations[0][1] = topLayer(locations[0][0], locations[0][2]) + 1;
    player.position.y = locations[0][1] + 1;

    for (let i = 0; i < locations.length; i++) {
        const location = locations[i];
        const [x, y, z] = location;
        generateOre(x, y - 1, z, "blackWall", "grass", {traits: ["protected"]});
    }
}
start();

let direction = new BABYLON.Vector3();
const jumpSpeed = 0.16;
let canJump = false;
let gravity = 0.01;
let lastStepDist = 0;

engine.runRenderLoop(() => {
    FRAME_TIME = Math.min((performance.now() - LAST_FRAME) / 1000, 0.1); // cap frame time to prevent huge lag spikes
    LAST_FRAME = performance.now();
    vars.FRAME_TIME = FRAME_TIME;
    
    document.getElementById("fps").textContent = `FPS: ${(1 / FRAME_TIME).toFixed(1)}`;
    
    loadNearbyChunks();
    
    // movement
    direction.z = Number(keys.forward) - Number(keys.backward);
    direction.x = Number(keys.right) - Number(keys.left);
    direction.y = 0;
    
    direction.normalize();
    direction = BABYLON.Vector3.TransformNormal(direction, perspectiveCamera.getWorldMatrix().getRotationMatrix());
    direction.y = 0;
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
                skyboxMaterial.reflectionTexture = textures[`skybox/${layerDetails.skybox.id || layer}`];
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
                scene.fogEnd = area.fog || 1000;
                vars.fogColor = area.fogColor || "#000000";
                vars.nightFogColor = area.nightFogColor || vars.fogColor;
                
                hemisphereLight.diffuse = new BABYLON.Color3.FromHexString(area.lighting.hemisphereColor || area.lighting.color || "#fff");
                hemisphereLight.groundColor = new BABYLON.Color3.FromHexString(area.lighting.hemisphereGroundColor || "#000");
                hemisphereLight.intensity = area.lighting.hemisphereIntensity ?? area.lighting.intensity ?? 0;
                
                if (!player.nightVision) {
                    cameraLight.diffuse = area.lighting.cameraLightColor !== undefined ? area.lighting.cameraLightColor : hemisphereLight.diffuse;
                    cameraLight.intensity = area.lighting.cameraLightIntensity !== undefined ? area.lighting.cameraLightIntensity : hemisphereLight.intensity * 6;
                    cameraLight.decay = area.lighting.cameraLightDecay !== undefined ? area.lighting.cameraLightDecay : 1;
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
        skyboxMaterial.reflectionTexture = textures["skybox/space"];
        if (sunHeight < -0.2) {
            scene.fogColor = new BABYLON.Color3.FromHexString(nightFog);
            skyboxMaterial.alpha = 1;
        } else if (sunHeight < 0.2) {
            scene.fogColor = BABYLON.Color3.Lerp(new BABYLON.Color3.FromHexString(vars.fogColor), new BABYLON.Color3.FromHexString(nightFog), (0.2 - sunHeight) / 0.4);
            // ambientLight.intensity = vars.ambientLightIntensity * (sunHeight + 0.2) / 0.4;
            if (CURRENT_LAYER !== "space") skyboxMaterial.alpha = Math.min(Math.max(0.8 - sunHeight / 0.2, 0), 1);
        } else {
            scene.fogColor = new BABYLON.Color3.FromHexString(vars.fogColor);
            // ambientLight.intensity = vars.ambientLightIntensity;
            if (CURRENT_LAYER !== "space") skyboxMaterial.alpha = 0;
        }
        
        if (!vars.sunAlwaysVisible) {
            sun.material.alpha = Math.max(0, (sunHeight + 0.3) / 0.7);
            directionalLight.intensity = vars.directionalLightIntensity * Math.min(1, sun.material.alpha);
        } else {
            directionalLight.intensity = vars.directionalLightIntensity;
            sun.material.alpha = 1;
        }
    } else {
        scene.fogColor = BABYLON.Color3.Lerp(new BABYLON.Color3.FromHexString(vars.fogColor), new BABYLON.Color3.FromHexString(nightFog), Math.min(Math.max((0.2 - sunHeight) / 0.4, 0), 1));
    }
    
    directionalLight.position.copyFrom(offset.scale(1));
    directionalLight.setDirectionToTarget(BABYLON.Vector3.Zero());
    sun.position.copyFrom(perspectiveCamera.position).addInPlace(offset);
    
    // raycasting
    const raycaster = perspectiveCamera.getForwardRay();
    const hit = scene.pickWithRay(raycaster);
    if (hit.hit) {
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
        
        const {x, y, z} = hit.pickedMesh.metadata?.coords?.[hit.thinInstanceIndex] ?? hit.pickedMesh.metadata?.coords ?? {};
        
        document.getElementById("debugInfo").textContent = `${x}, ${y}, ${z}`;
    } else {
        document.getElementById("tooltip").style.display = "none";
    }

    scene.clearColor = scene.fogColor;
    scene.render();
});

textures["skybox/space"] = new BABYLON.Texture("img/block/skybox/space.png", scene);
textures["skybox/space"].coordinatesMode = BABYLON.Texture.SKYBOX_MODE;