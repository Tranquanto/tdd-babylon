import vars, { airAt } from "./outside_stuff.js";
import { items, layers, ores, structures, biomes, locations, topLayer } from "./content/items.js";
import { isCave } from "./noise.js";

const generateOre = () => undefined;
const teleport = generateOre;
const spawnAlert = generateOre;

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

            const threeCol = new BABYLON.Color3.FromHexString(color);
            const { r, g, b } = threeCol;
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

biomes.stormy.tick = (x, y, z) => {
    biomes.rainy.tick(x, y, z);
    biomes.stormy.stormTick();
}
biomes.blizzard.tick = (x, y, z) => {
    biomes.snowy.tick(x, y, z, 8);
    biomes.stormy.stormTick();
}

layers.sky.directionalLight = layers.surface.directionalLight;