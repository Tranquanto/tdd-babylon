import { getOre, m } from "./outside_stuff.js";
import { getLayer, layers, ores } from "./content/items.js";

const textures = {};
const meshes = {};

const canvas = document.getElementById("canvas");

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

window.addEventListener("resize", resize);
resize();

const engine = new BABYLON.Engine(canvas, true);
const scene = new BABYLON.Scene(engine);
const perspectiveCamera = new BABYLON.UniversalCamera("camera1", new BABYLON.Vector3(0, 2, 0), scene);
perspectiveCamera.minZ = 0.001;
perspectiveCamera.fov = 1.2;

perspectiveCamera.position.y = -8.1;

const raycaster = new BABYLON.Ray(new BABYLON.Vector3(), new BABYLON.Vector3());
raycaster.length = 1000;

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

const lightContainers = [];
for (let i = 0; i < 2; i++) {
    lightContainers.push(new BABYLON.ClusteredLightContainer(`lightContainer${i}`, [], scene));
}

for (let j = 0; j < lightContainers.length; j++) {
    const lightContainer = lightContainers[j];
    for (let i = 0; i < 20; i++) {
        const light = new BABYLON.PointLight(`light${i}`, new BABYLON.Vector3(Math.random() * 200 - 100, -8, Math.random() * 100 - 50), scene);
        light.diffuse = new BABYLON.Color3(Math.random(), Math.random(), Math.random());
        light.intensity = 2;
        light.range = 4;
        lightContainer.addLight(light);
    }
}

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

function generateOre(x, y, z, ore, background, settings) {
    if (!meshes[`${ore}_${background}`]) {
        const oreMesh = BABYLON.MeshBuilder.CreateBox(`ore-${x}_${y}_${z}`, {size: 1, wrap: true}, scene);
        oreMesh.metadata = {ore, background, coords: {}};
        oreMesh.thinInstanceEnablePicking = true; // allow picking by raycast
        const oreMaterial = new BABYLON.StandardMaterial(`oreMaterial-${x}_${y}_${z}`, scene);
        oreMaterial.diffuseColor = new BABYLON.Color3(1, 1, 1);
        oreMaterial.ambientColor = new BABYLON.Color3(1, 1, 1);
        oreMaterial.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        if (!textures[`${ore}_${background}`]) {
            textures[`${ore}_${background}`] = new BABYLON.Texture(`img/block/${ore}.png`, scene, false, true, BABYLON.Texture.NEAREST_SAMPLINGMODE);
        }
        oreMaterial.diffuseTexture = textures[`${ore}_${background}`];
        oreMesh.material = oreMaterial;
        meshes[`${ore}_${background}`] = oreMesh;
    }
    
    // create an instance of the mesh for better performance
    const matrix = BABYLON.Matrix.Translation(x, y, z);
    const index = meshes[`${ore}_${background}`].thinInstanceAdd(matrix);
    meshes[`${ore}_${background}`].metadata.coords[index] = {x, y, z};
    m(x, y, z, {ore, background});
}

function spawnOre(x, y, z, settings) {
    if (settings === undefined) settings = {caveExclusive: false, noUpdate: false, noCave: false};
    if (m(x, y, z) && !settings.forced && !settings.forceReplace && !m(x, y, z).temp) return false;
    if (typeof settings === "string") settings = {caveExclusive: true, noUpdate: true, noCave: true, caveType: settings};
    const layer = getLayer(y, x, z, false);
    if (layers[layer]?.universalCondition && !layers[layer].universalCondition(x, y, z) && !m(x, y, z)) {
        m(x, y, z, true);
        return m(x, y, z);
    }
    
    settings = {...settings};
    
    const oreData = getOre(x, y, z);
    generateOre(x, y, z, oreData.ore, oreData.background, settings);
    return m(x, y, z);
}

for (let x = -25; x < 25; x++) {
    for (let z = -25; z < 25; z++) {
        spawnOre(x, -10, z);
    }
}
console.log(meshes, textures);

let direction = new BABYLON.Vector3();
engine.runRenderLoop(() => {
    for (let i = 0; i < lightContainers.length; i++) {
        for (let j = 0; j < lightContainers[i].lights.length; j++) {
            const light = lightContainers[i].lights[j];
            light.position.x += Math.sin(Date.now() / 1000 + j) * 0.1;
            light.position.z += Math.cos(Date.now() / 1000 + j) * 0.1;
        }
    }
    scene.render();
    
    // movement
    direction.z = Number(keys.forward) - Number(keys.backward);
    direction.x = Number(keys.right) - Number(keys.left);
    direction.y = 0;

    direction.normalize();
    direction = BABYLON.Vector3.TransformNormal(direction, BABYLON.Matrix.RotationY(perspectiveCamera.rotation.y));
    perspectiveCamera.position.addInPlace(direction.scale(0.1));
    
    // raycasting
    const raycaster = perspectiveCamera.getForwardRay();
    const hit = scene.pickWithRay(raycaster);
    if (hit.hit) {
        const oreData = ores[hit.pickedMesh.metadata?.ore], color = oreData?.color || "#fff";
        document.getElementById("oreName").textContent = `${oreData?.name || "Unknown"}`;
        if (color[0] === "#") {
            document.getElementById("oreName").style.color = color;
            document.getElementById("oreName").style.textShadow = "";
            document.getElementById("oreName").style.backgroundImage = "none";
        } else {
            document.getElementById("oreName").style.color = "transparent";
            document.getElementById("oreName").style.textShadow = "none";
            document.getElementById("oreName").style.backgroundImage = color;
        }
        
        const {x, y, z} = hit.pickedMesh.metadata?.coords?.[hit.thinInstanceIndex] || {};
        
        document.getElementById("debugInfo").textContent = `${x}, ${y}, ${z}`;
    } else {
        document.getElementById("oreName").textContent = "None";
    }
});