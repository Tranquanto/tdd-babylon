import Color from "https://colorjs.io/dist/color.js";

import vars, { airAt } from "./outside_stuff.js";
import { items, layers, ores, structures, biomes, locations, topLayer } from "./content/items.js";
import { isCave } from "./noise.js";
import { teleport, generateOre } from "./main.js";

const spawnAlert = () => undefined;

function tpMenu(locations = locations) {
    return function() {
        if (document.getElementById("big-gui").style.display === "block") {
            document.getElementById("big-gui").style.display = "none";
            document.getElementById("big-gui").style.width = "";
            return;
        }
        // create teleportation menu
        try {
            document.exitPointerLock();
        } catch (e) {
            // ignore
        }
        const menu = document.getElementById("big-gui");
        menu.innerHTML = "";
        menu.style.width = "30vw";
        
        const title = document.createElement("h1");
        title.className = "wikiName relPos";
        title.innerText = "Teleportation";
        menu.appendChild(title);
        
        locations.forEach((loc) => {
            const button = document.createElement("button");
            button.className = "menuButton";
            button.innerText = `${layers[loc[3]].name}`;
            const color = layers[loc[3]].color || layers[loc[3]].fogColor || "#000";
            button.style.backgroundColor = color;
            
            const threeCol = new Color(color);
            const [r, g, b] = threeCol.coords;
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            button.style.color = brightness < 0.5 ? "#fff" : "#000";
            
            button.onclick = () => {
                teleport(loc[0], loc[1], loc[2]);
                menu.style.display = "none";
            };
            menu.appendChild(button);
        });
        
        menu.style.display = "block";
    }
}
items.devTeleporter.onUse = tpMenu(locations);
items.surfaceTeleporter.onUse = () => {
    teleport(locations[0][0], locations[0][1], locations[0][2]);
}
for (const item of Object.keys(items).filter(i => items[i].tags?.teleporter)) {
    items[item].onUse = tpMenu(locations.filter(l => items[item].teleports.includes(l[3])));
}

structures.darkGemDungeon.onGenerate = (x, y, z) => { // x, y, z = bottom northwest corner (minimum x & z and maximum y)
    generateOre(x + 5, y + 3, z + 5, "darkGem", "obsidian", {width: 0.6, height: 0.6, depth: 0.6, forced: true, chance: 1 / 750000});
    generateOre(x + 4, y + 2, z + 5, "shaleBlock", "shaleBlock", {height: 0.5, forced: true, offset: {y: -0.25}});
    generateOre(x + 6, y + 2, z + 5, "shaleBlock", "shaleBlock", {height: 0.5, forced: true, offset: {y: -0.25}});
    generateOre(x + 5, y + 2, z + 4, "shaleBlock", "shaleBlock", {height: 0.5, forced: true, offset: {y: -0.25}});
    generateOre(x + 5, y + 2, z + 6, "shaleBlock", "shaleBlock", {height: 0.5, forced: true, offset: {y: -0.25}});
    generateOre(x + 4, y + 4, z + 5, "shaleBlock", "shaleBlock", {height: 0.5, forced: true, offset: {y: 0.25}});
    generateOre(x + 6, y + 4, z + 5, "shaleBlock", "shaleBlock", {height: 0.5, forced: true, offset: {y: 0.25}});
    generateOre(x + 5, y + 4, z + 4, "shaleBlock", "shaleBlock", {height: 0.5, forced: true, offset: {y: 0.25}});
    generateOre(x + 5, y + 4, z + 6, "shaleBlock", "shaleBlock", {height: 0.5, forced: true, offset: {y: 0.25}});
    
    spawnAlert("darkGem", x + 5, y + 3, z + 5);
}

ores.cactus.onGenerate = (x, y, z, settings) => {
    const sides = [
        [1, 0], [-1, 0], [0, 1], [0, -1]
    ];
    if (!settings.placed && !settings.postGen) {
        let height = Math.floor(Math.random() * 6) + 2;
        for (let i = 1; i < height; i++) {
            generateOre(x, y + i, z, "cactus", "cactus", {forced: true, chance: settings.chance, postGen: true});
        }
        
        if (height >= 5 && Math.random() < Math.min(0.75, 0.25 + (height - 4) * 0.2)) {
            const side = sides[Math.floor(Math.random() * sides.length)];
            const y1 = y + Math.floor(Math.random() * (height - 3)) + 1;
            generateOre(x + side[0], y1, z + side[1], "cactus", "cactus", {forced: true, chance: settings.chance, postGen: true});
            generateOre(x + side[0] * 2, y1, z + side[1] * 2, "cactus", "cactus", {forced: true, chance: settings.chance, postGen: true});
            generateOre(x + side[0] * 2, y1 + 1, z + side[1] * 2, "cactus", "cactus", {forced: true, chance: settings.chance, postGen: true});
            
            if (Math.random() < 0.75) {
                let y2 = y1;
                while (y2 === y1) y2 = y + Math.floor(Math.random() * (height - 3)) + 1;
                generateOre(x - side[0], y2, z - side[1], "cactus", "cactus", {forced: true, chance: settings.chance, postGen: true});
                generateOre(x - side[0] * 2, y2, z - side[1] * 2, "cactus", "cactus", {forced: true, chance: settings.chance, postGen: true});
                generateOre(x - side[0] * 2, y2 + 1, z - side[1] * 2, "cactus", "cactus", {forced: true, chance: settings.chance, postGen: true});
            }
        }
    }
}

ores.mushroom.onGenerate = (x, y, z, settings) => {
    if (!settings.placed && !settings.postGen) {
        let height = Math.floor(Math.random() * 4) + 2;
        
        for (let i = 0; i < height; i++) {
            generateOre(x, y + i, z, "mushroomStem", "mushroomStem", {forced: true, chance: settings.chance, postGen: true});
        }
        
        // cap
        for (let dx = -2; dx <= 2; dx++) {
            for (let dz = -2; dz <= 2; dz++) {
                if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
                generateOre(x + dx, y + height - 1, z + dz, "mushroomCap", "mushroomCap", {forced: true, chance: settings.chance, postGen: true});
                
                if (Math.sqrt(dx * dx + dz * dz) <= 1.8) {
                    generateOre(x + dx, y + height, z + dz, "mushroomCap", "mushroomCap", {forced: true, chance: settings.chance, postGen: true});
                } else {
                    generateOre(x + dx, y + height - 2, z + dz, "mushroomCap", "mushroomCap", {forced: true, chance: settings.chance * 0.5, postGen: true});
                }
            }
        }
    }
}


function generateTower(x, y, z, settings, ore, chance = 1, bg = ore) {
    if (settings.noTower) return;
    if (!settings.placed && Math.random() < chance) {
        if (!isCave(x, y - 1, z)) return;
        generateOre(x, y - 1, z, ore, bg, {chance: settings.chance, forced: true});
    }
}

const needsSupport = (x, y, z) => { // break when the block below is broken
    if (airAt(x, y - 1, z)) {
        vars.removalQueue.push({ x, y, z });
    }
}

ores.snow.onUpdate = needsSupport;
ores.fumarole.onUpdate = needsSupport;
ores.ash.onUpdate = needsSupport;

ores.vine.onGenerate = (x, y, z, settings) => {
    generateTower(x, y, z, settings, "vine", 0.9);
}

ores.lava.onGenerate = (x, y, z, settings) => {
    settings.forceReplace = ["ash"];
    generateTower(x, y, z, settings, "lava");
}

ores.chain.onGenerate = (x, y, z, settings) => {
    generateTower(x, y, z, settings, "chain");
}

ores.purplePillar.onGenerate = (x, y, z, settings) => {
    generateTower(x, y, z, settings, "purplePillar");
}

/* ores.blackHole.onGenerate = (x, y, z) => {
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
}

ores.blackHole.onRemove = (x, y, z) => {
    const mesh = vars.scene.getObjectByName(`blackHole-${x}-${y}-${z}`);
    const mesh2 = vars.scene.getObjectByName(`blackHole-disc-${x}-${y}-${z}`);
    if (mesh) {
        vars.scene.remove(mesh);
    }
    if (mesh2) {
        vars.scene.remove(mesh2);
    }
} */

ores.googite.chance[0].condition = ores.rainCloud.condition;
ores.outlite.condition = ores.thunderCloud.condition;
ores.dirtness.condition = ores.dirt.condition;
ores.pluyoniomBlock.radiation = -10;

ores.shaleBrick.name = items.shaleBrick.name = "Stone Bricks";

ores.plastic.condition = (x, y, z) => {
    return ores.plastic.clayCondition(x, y, z) && !biomes.snowy.requirement(x, y, z);
}
ores.wood.condition = (x, y, z) => {
    return ores.wood.clayCondition(x, y, z) * (biomes.snowy.requirement(x, y, z) ? 0.25 : 1);
}
ores.onyx.condition = (x, y, z) => {
    return ores.sandstone.chance[0].condition(x, y, z) && y > topLayer(x, z);
}

ores.unnamed5.tick = (x, y, z) => {
    // move towards the player
    const playerPos = vars.player.position;
    const orePos = new BABYLON.Vector3(x, y, z).add(m(x, y, z).offset);
    const dir = playerPos.clone().sub(orePos).normalize();
    m(x, y, z).offset.add(dir.multiplyScalar(0.1));
    vars.matricesToUpdate.add(`${x},${y},${z}`);
}

ores.blackHole.tick = (x, y, z) => {
    // apply gravitational pull to the player
    const playerPos = vars.player.position;
    const orePos = new BABYLON.Vector3(x, y, z);
    const dir = orePos.clone().subtract(playerPos);
    const distance = dir.length();
    let strength = 0.01 * (1 - distance / 10);
    if (strength < 0) strength = 0;
    dir.normalize();
    vars.player.velocity.add(dir.multiplyByFloats(strength, strength, strength));
}

ores.error.tick = (x, y, z) => {
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

biomes.stormy.tick = (x, y, z) => {
    biomes.rainy.tick(x, y, z);
    biomes.stormy.stormTick();
}
biomes.blizzard.tick = (x, y, z) => {
    biomes.snowy.tick(x, y, z, 8);
    biomes.stormy.stormTick();
}

layers.sky.directionalLight = layers.surface.directionalLight;