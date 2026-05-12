import { ores, items, recipes, replacedIds, tiers, layers, achievements, achievementArray, animations, getLayer } from './content/items.js';
import vars, { getBGOre, calculateChance, displayAlert } from './outside_stuff.js';
const GAME_MODE = "normal";

class Inventory {
    constructor(max, isNew = false) {
        this.items = [];
        this.hotbar = localStorage.getItem(`hotbar-${GAME_MODE}`) ? JSON.parse(localStorage.getItem(`hotbar-${GAME_MODE}`)) : [];
        this.SELECTED_HOTBAR = -1;
        this.SELECTED_ITEM = null;
        this.max = max;
        this.currentPickaxe = {power: 0.25, range: 5, delay: 0.3, color: "#efb77d"};

        if (!isNew && localStorage.getItem(`inventory-${GAME_MODE}`)) {
            this.items = JSON.parse(localStorage.getItem(`inventory-${GAME_MODE}`));
        }

        for (let h = 0; h < 10; h++) {
            const div = document.createElement("div");
            const itemCount = document.createElement("span");
            itemCount.classList.add("hotbar-item-count");
            itemCount.innerText = "0";
            div.append(itemCount);
            document.getElementById(`hotbar-${h}`).append(div);
        
            document.getElementById(`hotbar-${h}`).addEventListener("click", () => {
                inventory.selectHotbarSlot(h);
                if (inventory.SELECTED_ITEM) {
                    inventory.selectHotbarSlot(h, true);
                    inventory.setHotbarItem(inventory.SELECTED_ITEM, h);
                    inventory.SELECTED_ITEM = null;
                    document.getElementById("equip-text").style.display = "none";
                    document.getElementById("large-inventory").style.display = "block";
                    document.getElementById("hotbar").classList.remove("big");
                }
            });
        
            addEventListener("keydown", e => {
                if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
                    if (e.code === 'Escape') {
                        document.activeElement.blur();
                    }
                    return;
                }
                if (e.code === `Digit${h}`) {
                    inventory.selectHotbarSlot(h - 1 === -1 ? 9 : h - 1);
                }
            });
        }

        this.print();
    }
    addItem(item, count) {
        if (!item) return;
        if (count === undefined) count = 1;
        if (this.items.find(i => i.item === item)) {
            this.items.find(i => i.item === item).count += count;
            if (Math.abs(this.max) !== Infinity && this.getTotal() > this.max) {
                this.items.find(i => i.item === item).count -= this.getTotal() - this.max;
                return false;
            }
        } else {
            this.items.push({item, count});
            this.items.sort((a, b) => {
                return items[b.item].name.toLowerCase() < items[a.item].name.toLowerCase() ? 1 : -1;
            });
        }
        localStorage.setItem(`inventory-${GAME_MODE}`, JSON.stringify(this.items));

        if (document.getElementsByName(item + "-hotbar")[0]) {
            for (const elem of document.getElementsByName(item + "-hotbar")) {
                elem.querySelector(".hotbar-item-count").innerText = formatNum(this.getCount(item), 2, 1e4);
            }
        }

        if (document.getElementById(`inventory-item-${item}`)) {
            document.getElementById(`inventory-item-${item}`).querySelector(".item-name").innerText = `${formatNum(this.getCount(item))}× ${items[item].name}`;
        } else {
            let html = `<div class="item" id="inventory-item-${item}" style="background: ${items[item].color}" onclick="inventory.setHotbarItem('${item}');"><div class="item-name">${formatNum(this.getCount(item))}× ${items[item].name}</div><img class="item-count" src="img/item/${ores[item] && ores[item].customTexture ? ores[item].customTexture.item.src : item}.png" alt="${item}" style="${ores[item] && ores[item].customTexture ? `opacity: 0.5; filter: drop-shadow(0 0 0 ${ores[item].customTexture.item.colorize});` : ""}"></div>`;
            // add to inventory (keeping alphabetical order)
            let inserted = false;
            const inventoryItems = document.getElementById("inventory").children;
            for (let i = 0; i < inventoryItems.length; i++) {
                if (!inventoryItems[i].id.includes("inventory-item-")) continue;
                if (items[inventoryItems[i].id.replace("inventory-item-", "")].name.toLowerCase() > items[item].name.toLowerCase()) {
                    inventoryItems[i].insertAdjacentHTML("beforebegin", html);
                    inserted = true;
                    break;
                }
            }
            loadOreWiki();
        }
        // this.print();

        if (Math.abs(count) < 1) return true;
        if (!document.getElementsByName(item)[0]) {
            const notif = document.createElement("div");
            notif.classList.add("item");
            notif.setAttribute("name", item);
            notif.setAttribute("data-count", count);
            notif.style.background = items[item].color;

            let span = document.createElement("span");
            span.classList.add("item-name");
            span.innerText = `+${count.toLocaleString()} ${items[item].name}`.replace("+-", "-");
            notif.appendChild(span);

            let img = document.createElement("img");
            img.classList.add("item-count");
            img.src = `img/item/${ores[item] && ores[item].customTexture ? ores[item].customTexture.item.src : item}.png`;
            img.alt = item;
            notif.appendChild(img);

            notif.addEventListener("animationend", () => {
                notif.remove();
            });

            document.getElementById("inventoryNotif").appendChild(notif);
        } else {
            document.getElementsByName(item)[0].setAttribute("data-count", Number(document.getElementsByName(item)[0].getAttribute("data-count")) + count);
            document.getElementsByName(item)[0].querySelector(".item-name").innerText = `+${Number(document.getElementsByName(item)[0].getAttribute("data-count")).toLocaleString()} ${items[item].name}`.replace("+-", "-");
            clearTimeout(document.getElementsByName(item)[0].getAttribute("data-delete-timeout"));
            // reset css animation time
            document.getElementsByName(item)[0].style.animation = "none";
            document.getElementsByName(item)[0].offsetHeight; // trigger reflow
            document.getElementsByName(item)[0].style.animation = null;
        }
    }
    removeItem(item, count) {
        this.addItem(item, -count);
        if (this.getCount(item) <= 0) {
            if (document.getElementById(`inventory-item-${item}`)) document.getElementById(`inventory-item-${item}`).remove();
            if (document.getElementById(`large-inventory-item-${item}`)) document.getElementById(`large-inventory-item-${item}`).remove();
        }
    }

    getCount(item) {
        if (this.items.find(i => i.item === item)) {
            return this.items.find(i => i.item === item).count;
        } else {
            return false;
        }
    }

    has(item, count = 1) {
        return this.getCount(item) >= count;
    }

    getTotal() {
        return this.items.reduce((a, b) => a + b.count, 0);
    }

    getAllRecipes() {
        let r = [];
        let canCraft = false;
        for (const recipe of recipes) {
            canCraft = true;
            for (const input of recipe.input) {
                if (!this.has(input.id, input.count)) {
                    canCraft = false;
                    break;
                }
            }
            if (canCraft) r.push(recipe);
        }
        return r;
    }

    canCraft(recipe, count = 1) {
        let maxPossibleCount = count;
        for (const input of recipe.input) {
            if (this.has(input.id, input.count)) {
                maxPossibleCount = Math.min(maxPossibleCount, Math.floor(this.getCount(input.id) / input.count));
            } else {
                return false;
            }
        }
        return maxPossibleCount;
    }

    hasAtLeastOneIngredient(recipe) { // determines whether to show the recipe
        if (recipe.required) {
            if (Array.isArray(recipe.required)) {
                for (const req of recipe.required) {
                    if (!this.has(req.id, req.count)) {
                        return false;
                    }
                }
            } else {
                if (!this.has(recipe.required.id, recipe.required.count)) {
                    return false;
                }
            }
        }
        for (const input of recipe.input) {
            if (this.has(input.id, 1)) {
                return true;
            }
        }
        return false;
    }

    craft(recipe, count = 1) {
        const c = this.canCraft(recipe, count);
        if (c) {
            for (const input of recipe.input) {
                this.removeItem(input.id, input.count * c);
                if (document.getElementById(`large-inventory-item-${input.id}`)) {
                    document.getElementById(`large-inventory-item-${input.id}`).querySelector(".large-item-count").innerText = formatNum(this.getCount(input.id));
                    if (this.getCount(input.id) <= 0) {
                        document.getElementById(`large-inventory-item-${input.id}`).remove();
                    }
                }
            }
            this.addItem(recipe.output.id, recipe.output.count * c);
            this.largePrint();
        }
        if (document.getElementById(`large-inventory-item-${recipe.output.id}`)) {
            document.getElementById(`large-inventory-item-${recipe.output.id}`).querySelector(".large-item-count").innerText = formatNum(this.getCount(recipe.output.id));
        } else {
            const color = items[recipe.output.id].color;
            const bg = `background-image: url(img/item/${ores[recipe.output.id] && ores[recipe.output.id].customTexture ? ores[recipe.output.id].customTexture.item.src : recipe.output.id}.png)`;
            if (color[0] === "#") bg += `; background-color: ${color};`;
            else bg += `, ${color};`;
            let html = `<div class="large-item" id="large-inventory-item-${recipe.output.id}" style="${bg}" onclick="inventory.setHotbarItem('${recipe.output.id}');"><div class="large-item-name">${formatNum(this.getCount(recipe.output.id))}× ${items[recipe.output.id].name}</div><div class="large-item-count">${this.getCount(recipe.output.id).toLocaleString()}</div></div>`;
            document.getElementById("large-inventory").insertAdjacentHTML("beforeend", html);
        }
    }

    setHotbarItem(item, slot = this.SELECTED_HOTBAR) {
        this.beforeItemCheck();
        if (this.getCount(item) > 0 && slot !== -1 && this.hotbar[slot] !== item) {
            this.hotbar[slot] = item;
            this.print();
        } else if (this.hotbar[slot] === item) {
            this.hotbar[slot] = undefined;
            this.print();
        }
        this.afterItemCheck();
        document.getElementById("cursor").setAttribute("raycaster", `objects: .ore; far: ${Math.min(this.currentPickaxe.range, 10000)};`);
        localStorage.setItem(`hotbar-${GAME_MODE}`, JSON.stringify(this.hotbar));
    }

    selectHotbarSlot(s, forced = false) {
        this.beforeItemCheck();
        this.currentPickaxe = {power: 0.25, range: 5, delay: 0.3, color: "#efb77d"};
        if (this.SELECTED_HOTBAR !== -1) document.getElementById(`hotbar-${this.SELECTED_HOTBAR}`).classList.remove("hotbar-item-selected");
        if (this.SELECTED_HOTBAR !== s || forced) {
            this.SELECTED_HOTBAR = s;
        } else {
            this.SELECTED_HOTBAR = -1;
        }
        if (this.SELECTED_HOTBAR !== -1) {
            document.getElementById(`hotbar-${this.SELECTED_HOTBAR}`).classList.add("hotbar-item-selected");
        }
        this.afterItemCheck();
        document.getElementById("cursor").setAttribute("raycaster", `objects: .ore; far: ${Math.min(this.currentPickaxe.range, 10000)};`);
    }

    print() {
        // merge duplicate items and remove invalid items
        const toRemove = [];
        for (const item of this.items) {
            if (replacedIds[item.item]) {
                item.item = replacedIds[item.item];
            }
            if (this.items.filter(i => i.item === item.item).length > 1) {
                const duplicates = this.items.filter(i => i.item === item.item);
                for (let i = 1; i < duplicates.length; i++) {
                    item.count += duplicates[i].count;
                    toRemove.push(duplicates[i]);
                }
            }
            if (!items[item.item]) {
                toRemove.push(item);
            }
        }
        for (const item of toRemove) {
            this.items.splice(this.items.indexOf(item), 1);
        }

        let html = '<div class="divider item" style="background-color: #000000;">Items</div>';
        this.items.sort((a, b) => items[b.item].name.toLowerCase() < items[a.item].name.toLowerCase() ? 1 : -1);
        this.items.forEach(i => {
            if (i.count > 0) {
                // noinspection CssUnknownTarget
                html += `<div class="item" id="inventory-item-${i.item}" style="background: ${items[i.item].color}" onclick="inventory.setHotbarItem('${i.item}');"><div class="item-name">${formatNum(i.count)}× ${items[i.item].name}</div><img class="item-count" src="img/item/${ores[i.item] && ores[i.item].customTexture ? ores[i.item].customTexture.item.src : i.item}.png" alt="${i.item}" style="${ores[i.item] && ores[i.item].customTexture ? `opacity: 0.5; filter: drop-shadow(0 0 0 ${ores[i.item].customTexture.item.colorize});` : ""}"></div>`;
            }
        });
        for (let h in this.hotbar) {
            if (typeof this.hotbar[h] === "string" && items[this.hotbar[h]]) {
                if (items[this.hotbar[h]].color[0] === "#") {
                    document.getElementById(`hotbar-${h}`).style.backgroundColor = items[this.hotbar[h]].color;
                    document.getElementById(`hotbar-${h}`).style.backgroundImage = `url(img/item/${ores[this.hotbar[h]] && ores[this.hotbar[h]].customTexture ? ores[this.hotbar[h]].customTexture.item.src : this.hotbar[h]}.png)`;
                } else {
                    document.getElementById(`hotbar-${h}`).style.backgroundImage = `url(img/item/${ores[this.hotbar[h]] && ores[this.hotbar[h]].customTexture ? ores[this.hotbar[h]].customTexture.item.src : this.hotbar[h]}.png), ${items[this.hotbar[h]].color}`;
                }
                document.getElementById(`hotbar-${h}`).setAttribute("name", this.hotbar[h] + "-hotbar");
            } else {
                document.getElementById(`hotbar-${h}`).style.backgroundColor = "#0008";
                document.getElementById(`hotbar-${h}`).style.backgroundImage = "none";
                document.getElementById(`hotbar-${h}`).removeAttribute("name");
            }

            if (document.getElementById(`hotbar-${h}`).querySelector(".hotbar-item-count")) document.getElementById(`hotbar-${h}`).querySelector(".hotbar-item-count").innerText = formatNum(this.getCount(this.hotbar[h]), 2, 1e4);
        }
        document.getElementById("inventory").innerHTML = html;
    }

    largePrint() { // for fullscreen inventory view
        let div = document.createElement("div");
        let itemContainer;
        let ITEMS_APPENDED = false;
        // first do items
        if (!document.getElementById("large-inventory-header-items")) {
            const header = document.createElement("span");
            header.classList.add("large-inventory-header");
            header.innerText = "Items";
            header.id = "large-inventory-header-items";
            div.appendChild(header);
            div.appendChild(document.createElement("br"));
            div.appendChild(document.createElement("br"));
            itemContainer = document.createElement("div");
            itemContainer.id = "large-inventory-items";

            const filter = document.createElement("input");
            filter.id = "large-inventory-items-filter";
            filter.type = "text";
            filter.placeholder = "Filter items...";
            filter.addEventListener("input", () => {
                const filterValue = filter.value.toLowerCase();
                for (const itemDiv of itemContainer.querySelectorAll(".large-item")) {
                    if (itemDiv.querySelector(".large-item-name").innerText.toLowerCase().includes(filterValue)) {
                        itemDiv.style.display = "";
                    } else {
                        itemDiv.style.display = "none";
                    }
                }
            });
            itemContainer.appendChild(filter);
        } else {
            itemContainer = document.getElementById("large-inventory-items");
            ITEMS_APPENDED = true;
        }
        for (const item of this.items) {
            const itemData = items[item.item];
            // first, fix any old item ids
            if (isNaN(Number(item.count))) {
                item.count = 1;
            }
            // if (replacedIds[item.item]) item.item = replacedIds[item.item];
            if (!itemData) this.items.splice(this.items.indexOf(item), 1);

            if (item.count > 0) {
                if (!document.getElementById(`large-inventory-item-${item.item}`)) {
                    const itemDiv = document.createElement("div");
                    itemDiv.classList.add("large-item");
                    itemDiv.id = `large-inventory-item-${item.item}`;
                    itemDiv.setAttribute("data-item-id", item.item);
                    if (itemData.color[0] === "#") {
                        itemDiv.style.backgroundColor = itemData.color;
                        itemDiv.style.backgroundImage = `url(img/item/${ores[item.item] && ores[item.item].customTexture ? ores[item.item].customTexture.item.src : item.item}.png)`;
                    } else {
                        itemDiv.style.backgroundImage = `url(img/item/${ores[item.item] && ores[item.item].customTexture ? ores[item.item].customTexture.item.src : item.item}.png), ${itemData.color}`;
                    }
                    itemDiv.addEventListener("click", () => {
                        document.getElementById("equip-text").style.display = "";
                        document.getElementById("large-inventory").style.display = "none";
                        document.getElementById("hotbar").classList.add("big");
                        this.SELECTED_ITEM = item.item;
                    });
                    itemDiv.addEventListener("contextmenu", () => {
                        if (confirm(`Are you sure you want to drop ${itemData.name}?`)) {
                            this.removeItem(item.item, item.count);
                        }
                    });

                    const details = document.createElement("div");
                    details.classList.add("large-recipe-inputs");
                    
                    if (itemData.tags.pickaxe) {
                        const power = document.createElement("div");
                        power.classList.add("large-recipe-input");
                        power.innerHTML = `<b>Power:</b> ${itemData.power}<br><b>Range:</b> ${itemData.range}<br><b>Delay:</b> ${itemData.delay}s`;

                        if (itemData.explosion) {
                            power.innerHTML += `<br><b>Explosion Radius:</b> ${itemData.explosion.radius}<br><b>Explosion Chance:</b> ${(itemData.explosion.chance * 100).toLocaleString()}%`;
                        }
                        details.appendChild(power);
                    }

                    if (itemData.desc) {
                        const desc = document.createElement("div");
                        desc.classList.add("large-recipe-input");
                        if (details.children.length > 0) desc.style.marginTop = "1vh";
                        desc.style.maxWidth = "10vw";
                        desc.innerHTML = `${itemData.desc}`;
                        details.appendChild(desc);
                    }

                    if (details.innerHTML !== "") itemDiv.appendChild(details);

                    const itemName = document.createElement("div");
                    itemName.classList.add("large-item-name");
                    itemName.innerText = `${itemData.name}`;
                    itemName.style.color = tiers[itemData.tier] ? tiers[itemData.tier].color : "#fff";
                    itemDiv.appendChild(itemName);

                    const itemCount = document.createElement("div");
                    itemCount.classList.add("large-item-count");
                    itemCount.innerText = `${item.count.toLocaleString()}`;
                    itemDiv.appendChild(itemCount);

                    if (itemContainer.children.length === 0) {
                        itemContainer.appendChild(itemDiv);
                    } else {
                        // insert itemDiv in alphabetical order
                        let inserted = false;
                        for (let i = 0; i < itemContainer.children.length; i++) {
                            if (!itemContainer.children[i].id.includes("large-inventory-item-")) continue;
                            if (items[itemContainer.children[i].id.replace("large-inventory-item-", "")].name.toLowerCase() > itemData.name.toLowerCase()) {
                                itemContainer.children[i].insertAdjacentElement("beforebegin", itemDiv);
                                inserted = true;
                                break;
                            }
                        }
                        if (!inserted) {
                            itemContainer.appendChild(itemDiv);
                        }
                    }
                } else {
                    document.getElementById(`large-inventory-item-${item.item}`).querySelector(".large-item-count").innerText = formatNum(item.count);
                }
            } else if (document.getElementById(`large-inventory-item-${item.item}`)) {
                document.getElementById(`large-inventory-item-${item.item}`).remove();
            }
        }
        if (!ITEMS_APPENDED) div.appendChild(itemContainer);
        if (!document.getElementById("large-inventory-separator")) {
            const br = document.createElement("br");
            br.id = "large-inventory-separator";

            div.appendChild(br);
            div.appendChild(document.createElement("br"));
        }

        // recipes
        let recipesDiv, RECIPES_APPENDED = false;
        if (!document.getElementById("large-inventory-header-recipes")) {
            const header2 = document.createElement("span");
            header2.classList.add("large-inventory-header");
            header2.innerText = "Recipes";
            header2.id = "large-inventory-header-recipes";
            div.appendChild(header2);
            div.appendChild(document.createElement("br"));
            div.appendChild(document.createElement("br"));

            recipesDiv = document.createElement("div");
            recipesDiv.id = "large-inventory-recipes";

            const filter = document.createElement("input");
            filter.id = "large-inventory-recipes-filter";
            filter.type = "text";
            filter.placeholder = "Filter recipes...";

            filter.addEventListener("input", () => {
                const filterValue = filter.value.toLowerCase();
                for (const recipeDiv of recipesDiv.querySelectorAll(".large-recipe")) {
                    if (recipeDiv.innerText.toLowerCase().includes(filterValue)) {
                        recipeDiv.style.display = "";
                    } else {
                        recipeDiv.style.display = "none";
                    }
                }
            });

            recipesDiv.appendChild(filter);
        } else {
            recipesDiv = document.getElementById("large-inventory-recipes");
            RECIPES_APPENDED = true;
        }
        for (const r in recipes) {
            const recipe = recipes[r];
            if (!document.getElementById(`large-inventory-recipe-${r}`)) {
                if (!this.hasAtLeastOneIngredient(recipe)) continue;
                const recipeDiv = document.createElement("div");
                recipeDiv.classList.add("large-item");
                recipeDiv.classList.add("large-recipe");
                recipeDiv.id = `large-inventory-recipe-${r}`;
                recipeDiv.setAttribute("data-recipe-id", r);
                if (items[recipe.output.id].color[0] === "#") {
                    recipeDiv.style.backgroundColor = items[recipe.output.id].color;
                    recipeDiv.style.backgroundImage = `url(img/item/${ores[recipe.output.id] && ores[recipe.output.id].customTexture ? ores[recipe.output.id].customTexture.item.src : recipe.output.id}.png)`;
                } else {
                    recipeDiv.style.backgroundImage = `url(img/item/${ores[recipe.output.id] && ores[recipe.output.id].customTexture ? ores[recipe.output.id].customTexture.item.src : recipe.output.id}.png), ${items[recipe.output.id].color}`;
                }
                recipeDiv.addEventListener("click", () => {
                    // this.craft(recipe);
                    // create a new menu with recipe details
                    const gui = document.getElementById("big-gui");
                    gui.innerHTML = "";
                    gui.style.width = "";
                    gui.style.display = "block";
                    const title = document.createElement("span");
                    title.className = "wikiName";
                    title.classList.add("recipeGUI");
                    title.innerText = `${recipe.output.count.toLocaleString()}× ${items[recipe.output.id].name}`;
                    if (items[recipe.output.id].color[0] === "#") {
                        title.style.color = items[recipe.output.id].color;
                    } else {
                        title.style.color = "transparent";
                        title.style.background = items[recipe.output.id].color;
                        title.style.backgroundClip = "text";
                    }
                    gui.appendChild(title);

                    const closeBtn = document.createElement("span");
                    closeBtn.className = "closeButton";
                    closeBtn.innerText = "×";
                    closeBtn.addEventListener("click", () => {
                        gui.style.display = "none";
                        gui.innerHTML = "";
                    });
                    gui.appendChild(closeBtn);

                    const ingredients = document.createElement("div");
                    ingredients.className = "wikiIngredients";

                    const craftBtn = document.createElement("button");
                    craftBtn.className = "menuButton halfWidth";

                    const craftAllBtn = document.createElement("button");
                    craftAllBtn.className = "menuButton halfWidth";

                    const recipeInputs = document.createElement("div");
                    recipeInputs.className = "line-below";
                    if (items[recipe.output.id].tags.pickaxe) {
                        const div = document.createElement("div");
                        div.classList.add("large-recipe-input");
                        div.style.marginTop = "1vh";
                        div.innerHTML = `<b>Power:</b> ${items[recipe.output.id].power.toLocaleString()}<br><b>Range:</b> ${items[recipe.output.id].range.toLocaleString()}<br><b>Delay:</b> ${items[recipe.output.id].delay.toLocaleString()}s`;
                        if (items[recipe.output.id].explosion) {
                            div.innerHTML += `<br><b>Explosion Radius:</b> ${items[recipe.output.id].explosion.radius}<br><b>Explosion Chance:</b> ${(items[recipe.output.id].explosion.chance * 100).toLocaleString()}%`;
                        }
                        recipeInputs.appendChild(div);
                    }
                    if (items[recipe.output.id].desc) {
                        const descDiv = document.createElement("div");
                        descDiv.classList.add("large-recipe-input");
                        descDiv.style.marginTop = "1vh";
                        descDiv.innerHTML = `${items[recipe.output.id].desc}`;
                        recipeInputs.appendChild(descDiv);
                    }
                    recipeInputs.style.marginTop = "calc(5vh + 1vw)";
                    gui.appendChild(recipeInputs);

                    function reloadIngredients() {
                        ingredients.innerHTML = "";
                        for (const input of recipe.input) {
                            const ingredient = document.createElement("div");
                            ingredient.className = "wikiIngredient";
                            ingredient.innerText = `${formatNum(this.getCount(input.id))} / ${formatNum(input.count)}× ${items[input.id].name}`;
                            if (inventory.getCount(input.id) >= input.count) {
                                ingredient.style.color = "#0f0";
                                ingredient.style.textShadow = "0 0 5px #0f0";
                            } else if (inventory.getCount(input.id) >= 1) {
                                ingredient.style.color = "#ff0";
                                ingredient.style.textShadow = "0 0 5px #ff0";
                            } else {
                                ingredient.style.color = "#888";
                                ingredient.style.textShadow = "0 0 5px #888";
                            }

                            if (ores[input.id] && ores[input.id].excludeFromWiki !== 2) {
                                ingredient.addEventListener("click", () => {
                                    openOre(input.id);
                                });
                                ingredient.classList.add("hoverable");
                                ingredient.title = "View in Ore Index";
                            }

                            ingredients.appendChild(ingredient);
                        }
                        gui.insertBefore(ingredients, craftBtn);
                        const count = (this.canCraft(recipe, 1e99) * recipe.output.count).toLocaleString();
                        craftBtn.innerText = `Craft ${recipe.output.count}`;
                        craftAllBtn.innerText = `Craft All (${count})`;
                        if (count == 0) {
                            craftBtn.disabled = true;
                            craftAllBtn.disabled = true;
                        }
                    }
                    craftBtn.addEventListener("click", () => {
                        this.craft(recipe, this.canCraft(recipe));
                        reloadIngredients.call(this);
                    });
                    craftAllBtn.addEventListener("click", () => {
                        this.craft(recipe, 1e12);
                        reloadIngredients.call(this);
                    })
                    gui.append(craftBtn, craftAllBtn);
                    reloadIngredients.call(this);
                });

                const recipeName = document.createElement("div");
                recipeName.classList.add("large-item-name");
                recipeName.innerText = `${recipe.output.count.toLocaleString()}× ${items[recipe.output.id].name}`;
                recipeDiv.appendChild(recipeName);

                if (recipesDiv.children.length === 0) {
                    recipesDiv.appendChild(recipeDiv);
                } else {
                    let added = false;
                    for (const elem of recipesDiv.children) {
                        if (Number(r) < Number(elem.getAttribute("data-recipe-id"))) {
                            recipesDiv.insertBefore(recipeDiv, elem);
                            added = true;
                            break;
                        }
                    }
                    if (!added) {
                        recipesDiv.appendChild(recipeDiv);
                    }
                }
            } else {
                const recipeDiv = document.getElementById(`large-inventory-recipe-${r}`);
                if (!this.hasAtLeastOneIngredient(recipe)) {
                    recipeDiv.remove();
                    continue;
                }
            }
        }

        if (!RECIPES_APPENDED) {
            div.appendChild(recipesDiv);
        }

        if (div.innerHTML !== "") document.getElementById("large-inventory").appendChild(div);
    }

    beforeItemCheck() {
        const a = items[this.hotbar[this.SELECTED_HOTBAR]];
        if (a && items[this.hotbar[this.SELECTED_HOTBAR]].onUnequip) {
            items[this.hotbar[this.SELECTED_HOTBAR]].onUnequip();
            items[this.hotbar[this.SELECTED_HOTBAR]].equipped = false;
        }
    }
    afterItemCheck() {
        const a = items[this.hotbar[this.SELECTED_HOTBAR]];
        const owns = inventory.getCount(this.hotbar[this.SELECTED_HOTBAR]) >= 1;
        if (a && items[this.hotbar[this.SELECTED_HOTBAR]].tags.pickaxe && owns) {
            this.currentPickaxe = items[this.hotbar[this.SELECTED_HOTBAR]];
        } else {
            this.currentPickaxe = {power: 0.25, range: 5, delay: 0.3, color: "#efb77d"};
        }
        if (a && items[this.hotbar[this.SELECTED_HOTBAR]].onEquip && owns) {
            items[this.hotbar[this.SELECTED_HOTBAR]].onEquip();
            items[this.hotbar[this.SELECTED_HOTBAR]].equipped = true;
        }
    }
}
let inventory = new Inventory(Infinity);

function sortWikiList() {
    let wikiList = document.getElementById("ore-wiki-list");
    let wikiListItems = Array.from(wikiList.children);
    wikiListItems.sort((a, b) => {
        if (a.classList.contains("undiscovered")) return 1;
        if (b.classList.contains("undiscovered")) return -1;
        if (a.classList.contains("hidden")) return 1;
        if (b.classList.contains("hidden")) return -1;
        if (a.id === "undiscovered-count") return 1;
        if (b.id === "undiscovered-count") return -1;
        return ores[a.getAttribute("data-id")].name.toLowerCase() < ores[b.getAttribute("data-id")].name.toLowerCase() ? -1 : 1;
    });
    wikiList.innerHTML = "";
    for (const item of wikiListItems) {
        wikiList.appendChild(item);
    }
}

export function toggleInventory() {
    if (document.exitPointerLock) document.exitPointerLock();
    if (document.getElementById("large-inventory").style.display === "none") {
        document.getElementById("large-inventory").style.display = "block";
        inventory.largePrint();
    }
    else document.getElementById("large-inventory").style.display = "none";
}

function openOre(ore) { // open wiki page
    const oreData = ores[ore];
    let oreInfo = document.createElement("div");
    oreInfo.classList.add("wikiOre");

    const closeButton = document.createElement("span");
    closeButton.className = "closeButton";
    closeButton.innerText = "×";
    closeButton.addEventListener("click", () => {
        document.getElementById("ore-wiki").style.display = "none";
        document.getElementById("ore-wiki").innerHTML = "";
    });
    oreInfo.appendChild(closeButton);

    let name = document.createElement("span");
    name.className = "wikiName";
    name.innerText = oreData.name;
    if (oreData.color[0] === "#") {
        name.style.color = oreData.color;
    } else {
        name.style.color = "transparent";
        name.style.background = oreData.color;
        name.style.backgroundClip = "text";
    }
    oreInfo.appendChild(name);

    let textStuff = document.createElement("div");
    textStuff.className = "wikiVariousText";

    let tier = document.createElement("p");
    tier.classList.add("wikiOreTier");
    tier.innerHTML = `<b>Tier:</b> <span style="color: ${tiers[oreData.tier].color}">${tiers[oreData.tier].name}</span>`;
    if (oreData.removalReason) {
        tier.style.textDecoration = "line-through";
        tier.innerHTML += `<div class="large-recipe-inputs" style="text-align: center;"><b>Removal Reason:</b><br>${oreData.removalReason}</div>`;
    }
    textStuff.appendChild(tier);

    let spawnMsg = document.createElement("span");
    spawnMsg.className = "wikiText";
    spawnMsg.innerHTML = `<i>${oreData.spawnMsg || ""}</i>`;
    textStuff.appendChild(spawnMsg);

    let otherDetails = document.createElement("p");
    otherDetails.className = "wikiText";
    otherDetails.classList.add("wikiOtherDetails");
    otherDetails.innerHTML += oreData.desc !== oreData.spawnMsg ? oreData.desc : "";
    if (ores[ore].otherDetails) {
        otherDetails.innerHTML += "<br>" + ores[ore].otherDetails.join("<br>");
    }
    if (oreData.caveExclusive) {
        if (oreData.caveExclusive === -1) otherDetails.innerHTML += "<p><b>Never</b> spawns in caves</p>";
        else otherDetails.innerHTML += "<p><b>Only</b> spawns in caves</p>";
    }
    if (oreData.guaranteedVein) otherDetails.innerHTML += "<p><b>Always</b> spawns in veins</p>";
    if (oreData.guaranteedGeode) otherDetails.innerHTML += "<p><b>Always</b> spawns in geodes</p>";
    if (oreData.noVein) otherDetails.innerHTML += "<p><b>Never</b> spawns in veins</p>";
    if (oreData.noGeode) otherDetails.innerHTML += "<p><b>Never</b> spawns in geodes</p>";
    textStuff.appendChild(otherDetails);

    let strength = document.createElement("p");
    strength.className = "wikiText";
    strength.innerHTML = `<b>Strength:</b> ${oreData.shownStr || formatNum(oreData.str)}`;
    textStuff.appendChild(strength);

    if (oreData.radiation) {
        let radiation = document.createElement("p");
        radiation.className = "wikiText";
        radiation.innerHTML = `<b>Radiation:</b> ${oreData.radiation} rads/s (-${formatNum((oreData.radiationFalloff || 0.2) * 100)}%/m)`;
        textStuff.appendChild(radiation);
    }

    if (oreData.creator) {
        if (typeof oreData.creator === "string") {
            let creator = document.createElement("p");
            creator.className = "wikiText";
            creator.innerHTML = `<b>Creator:</b> ${oreData.creator}`;
            textStuff.appendChild(creator);
        } else if (typeof oreData.creator === "object" && Array.isArray(oreData.creator)) {
            let creator = document.createElement("p");
            creator.className = "wikiText";
            creator.innerHTML = `<b>Creators:</b> ${oreData.creator.join(", ")}`;
            textStuff.appendChild(creator);
        }
    }

    if (oreData.music) {
        let music = document.createElement("p");
        music.className = "wikiText";
        music.innerHTML = `<b>♫</b> ${oreData.music}`;
        textStuff.appendChild(music);
    }
    let rarityGraph = document.createElement("canvas");
    rarityGraph.className = "wikiGraph";
    const size = Math.min(window.innerHeight * 0.65, window.innerWidth * 0.325);
    rarityGraph.width = size;
    rarityGraph.height = size;
    let ctx = rarityGraph.getContext("2d");
    ctx.strokeStyle = "#fff";
    ctx.fillStyle = "#fff";
    ctx.lineWidth = 2;

    // set up the graph
    let minChance = Infinity;
    let maxChance = 0;
    let minY = Infinity;
    let maxY = -Infinity;
    let sampledPoints = [];
    const minAllowedY = -11000, maxAllowedY = 3000;
    if (typeof oreData.chance === "object") {
        if (Array.isArray(oreData.chance)) {
            for (const interval of oreData.chance) {
                let intervalMin = Math.max(interval.minY, minAllowedY);
                let intervalMax = Math.min(interval.maxY, maxAllowedY);
                if (intervalMax < minAllowedY || intervalMin > maxAllowedY) continue; // skip intervals that are out of bounds

                if (intervalMin < minY) minY = intervalMin;
                if (intervalMax > maxY) maxY = intervalMax;

                // Sample points per interval for smoothness
                for (let i = 0; i <= intervalMax - intervalMin; i++) {
                    let y = intervalMin + i;
                    let chance = Math.min(calculateChance(y, interval, 0, 0, true), 1.001);
                    if (chance < minChance) minChance = chance;
                    if (chance > maxChance) maxChance = chance;
                    sampledPoints.push({ x: y, y: chance, conditionLabel: interval.conditionLabel });
                }
            }
        } else {
            let intervalMin = Math.max(oreData.minY, minAllowedY);
            let intervalMax = Math.min(oreData.maxY, maxAllowedY);
            if (intervalMin < minY) minY = intervalMin;
            if (intervalMax > maxY) maxY = intervalMax;
            for (let i = 0; i <= intervalMax - intervalMin; i++) {
                let y = intervalMin + i;
                let chance = Math.min(calculateChance(y, oreData, 0, 0, true), 1.001);
                if (chance < minChance) minChance = chance;
                if (chance > maxChance) maxChance = chance;
                sampledPoints.push({ x: y, y: chance, conditionLabel: oreData.conditionLabel });
            }
        }
    } else {
        for (let i = Math.max(oreData.minY, minAllowedY); i <= Math.min(oreData.maxY, maxAllowedY); i++) {
            sampledPoints.push({ x: i, y: Math.min(calculateChance(i, oreData, 0, 0, true), 1.001), adj: Math.min(calculateChance(i, oreData, 0, 0, true, true)), conditionLabel: oreData.conditionLabel });
        }
        minY = Math.max(oreData.minY, minAllowedY);
        maxY = Math.min(oreData.maxY, maxAllowedY);

        minChance = calculateChance(minY, oreData, 0, 0, true);
        maxChance = Math.min(calculateChance(maxY, oreData, 0, 0, true), 1.001);
    }

    if (maxY > maxAllowedY) maxY = maxAllowedY;
    if (minY < minAllowedY) minY = minAllowedY;

    const padding = 32; // graph padding

    // draw the graph line using sampledPoints
    ctx.beginPath();
    let started = false;
    let lastPoint = 0;
    for (const pt of sampledPoints) {
        let px = ((maxY - pt.x) / (maxY - minY)) * (size - padding) + padding / 2;
        let py = size - ((pt.y - minChance) / (maxChance - minChance)) * (size - padding) - padding / 2;
        if (isNaN(px)) px = size / 2;
        if (isNaN(py)) py = size / 2;
        pt.px = px;
        pt.py = py;
        for (const t in tiers) {
            if (pt.y === 0) {
                pt.tier = "common";
                break;
            }
            if (pt.y > tiers[t].minChance && pt.y <= tiers[t].maxChance) {
                pt.tier = t;
                break;
            }
        }
        if (pt.adj) {
            for (const t in tiers) {
                if (pt.adj > tiers[t].minChance && pt.adj <= tiers[t].maxChance) {
                    pt.adjTier = t;
                    break;
                }
            }
        }
        if (!started) {
            ctx.moveTo(px, py);
            ctx.strokeStyle = tiers[pt.tier || "common"]?.color;
            started = true;

            if (sampledPoints.length === 1) {
                // If there's only one point, draw a small circle
                ctx.beginPath();
                ctx.arc(px, py, 4, 0, 2 * Math.PI);
                ctx.fillStyle = "#fff";
                ctx.fill();
                ctx.closePath();
            }
        } else {
            if (Math.abs(pt.x - lastPoint) <= 1) ctx.lineTo(px, py);
            else ctx.moveTo(px, py);

            const t = pt.tier || "common";
            if (ctx.strokeStyle !== tiers[t].color) {
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(px, py);
            }
            ctx.strokeStyle = tiers[t].color;
            pt.tier = t;
        }
        lastPoint = pt.x;
    }
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw points as small circles for hover detection
    /* for (const pt of sampledPoints) {
        let px = ((pt.x - minY) / (maxY - minY)) * size;
        let py = size - ((pt.y - minChance) / (maxChance - minChance)) * size;
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, 2 * Math.PI);
        ctx.fill();
    } */

    // hovering over the graph will show the depth and chance of the nearest point on the line
    // Create tooltip element
    let tooltip = document.createElement("div");
    tooltip.className = "wikiGraphTooltip";
    document.body.appendChild(tooltip);

    function move(evt) {
        let rect = rarityGraph.getBoundingClientRect();
        let mx = evt.clientX - rect.left;
        let my = evt.clientY - rect.top;
        // Find nearest sampled point
        let nearest = null;
        let minDist = Infinity;
        for (const pt of sampledPoints) {
            let dx = mx - pt.px; // inverted
            let dy = pt.py - my;
            let dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDist) {
                minDist = dist;
                nearest = pt;
            }
        }
        if (nearest) {
            // Create or get the highlight overlay canvas
            let overlayId = "rarityGraphOverlay";
            let overlay = document.getElementById(overlayId);
            if (!overlay) {
                overlay = document.createElement("canvas");
                overlay.className = "wikiGraph";
                overlay.id = overlayId;
                overlay.width = rarityGraph.width;
                overlay.height = rarityGraph.height;
                overlay.style.pointerEvents = "none";
                overlay.style.border = "none";
                overlay.style.zIndex = "1001";
                rarityGraph.parentNode.appendChild(overlay);
            }
            overlay.width = rarityGraph.width;
            overlay.height = rarityGraph.height;
            let octx = overlay.getContext("2d");
            octx.clearRect(0, 0, overlay.width, overlay.height);
            let tx = ((maxY - nearest.x) / (maxY - minY)) * (size - padding) + padding / 2;
            let ty = size - ((nearest.y - minChance) / (maxChance - minChance)) * (size - padding) - padding / 2;
            if (isNaN(tx)) tx = size / 2;
            if (isNaN(ty)) ty = size / 2;
            octx.save();
            octx.beginPath();
            octx.arc(tx, ty, 6, 0, 2 * Math.PI);
            octx.strokeStyle = "#0ff";
            octx.lineWidth = 2;
            octx.stroke();
            octx.restore();

            tooltip.style.display = "block";
            tooltip.innerHTML =
                `<b>${nearest.x > 0 ? "Altitude:" : "Depth:"}</b> <span style="color: ${layers[getLayer(nearest.x, 0, 0, false)].color}">${formatNum(Math.round(nearest.x))}m</span><br>` +
                `<b>Rarity:</b><span style="color: ${tiers[nearest.tier]?.color || "#fff"}"> ${`1 / ${formatNum(1 / nearest.y)}`.replace("1 / Infinity", "0").replace("1 / 0.999", "Filler")}</span><br>` +
                (nearest.conditionLabel ? `<b>Condition:</b> <span style="color: #fff">${nearest.conditionLabel}</span><br>` : "") +
                (nearest.adj ? `<b>Adjusted Rarity:</b> <span style="color: ${tiers[nearest.adjTier]?.color || "#fff"}">1 / ${formatNum(1 / nearest.adj)}</span><br>` : "");
            tooltip.style.left = (evt.clientX + 16) + "px";
            tooltip.style.top = (evt.clientY + 16) + "px";
        }
    }
    rarityGraph.addEventListener("mousemove", move);
    rarityGraph.addEventListener("touchmove", (evt) => {
        evt.preventDefault();
        move(evt.touches[0]);
    });

    rarityGraph.addEventListener("mouseleave", () => {
        tooltip.style.display = "none";
        document.getElementById("rarityGraphOverlay")?.remove();
    });
    rarityGraph.addEventListener("touchend", () => {
        tooltip.style.display = "none";
        document.getElementById("rarityGraphOverlay")?.remove();
    });

    oreInfo.appendChild(rarityGraph);

    const maxChanceText = document.createElement("span");
    maxChanceText.className = "minChanceText";
    maxChanceText.innerHTML = `1 in ${formatNum(1 / maxChance, 2, 99999)}`.replace("1 in Infinity", "0").replace("1 in 0.999", "Filler");
    maxChanceText.style.height = rarityGraph.height + "px";

    const minChanceText = document.createElement("span");
    minChanceText.className = "maxChanceText";
    minChanceText.innerHTML = `1 in ${formatNum(1 / minChance, 2, 99999)}`.replace("1 in Infinity", "0").replace("1 in 0.999", "Filler").replace("1 in 0", "Filler");
    minChanceText.style.height = rarityGraph.height + "px";

    const maxDepthText = document.createElement("span");
    maxDepthText.className = "maxDepthText";
    maxDepthText.innerText = `${formatNum(minY)}m`;

    const minDepthText = document.createElement("span");
    minDepthText.className = "minDepthText";
    minDepthText.innerText = `${formatNum(maxY)}m`;

    oreInfo.appendChild(maxChanceText);
    oreInfo.appendChild(minChanceText);
    oreInfo.appendChild(maxDepthText);
    oreInfo.appendChild(minDepthText);

    let itemTexture = items[ore].canvasElem;
    itemTexture.className = "wikiTexture";
    if (ores[ore].customTexture?.item?.colorize) itemTexture.style.setProperty("--color", ores[ore].customTexture.item.colorize);
    // if (inventory.getCount(ore) === false) itemTexture.style.filter = "brightness(0)";
    itemTexture.draggable = false;
    oreInfo.appendChild(itemTexture);

    if (oreData.canvasElem) {
        let canvasTexture = oreData.canvasElem;
        canvasTexture.className = "wikiOreTexture";
        oreInfo.appendChild(canvasTexture);
    } else if (animations[ore]) {
        let canvasTexture = animations[ore].canvas;
        canvasTexture.className = "wikiOreTexture";
        oreInfo.appendChild(canvasTexture);
        console.log(ore, canvasTexture);
    } else if (!oreData.customModel && !oreData.noTexture) {
        let blockTexture = document.createElement("img");
        blockTexture.className = "wikiOreTexture";
        blockTexture.src = `img/block/${oreData.customTexture ? oreData.customTexture.ore : ore}.png`;
        const texture = oreData.wikiBG || getBGOre(0, maxY, 0) || "shale";
        if (ores[texture]) {
            if (!ores[texture].noTexture) blockTexture.style.backgroundImage = `url(img/block/${texture}.png)`;
            else blockTexture.style.background = ores[texture].color;
        }
        if (oreData.textureHasTransparency) blockTexture.style.background = "none";
        blockTexture.draggable = false;
        oreInfo.appendChild(blockTexture);
    }
    oreInfo.appendChild(textStuff);

    document.getElementById("ore-wiki").innerHTML = "";
    document.getElementById("ore-wiki").appendChild(oreInfo);
    document.getElementById("ore-wiki").style.display = "block";
}

function openItem(i) {
    const item = items[i];
    const wiki = document.createElement("div");

    const closeButton = document.createElement("span");
    closeButton.className = "closeButton";
    closeButton.innerText = "×";
    closeButton.addEventListener("click", () => {
        document.getElementById("ore-wiki").style.display = "none";
        document.getElementById("ore-wiki").innerHTML = "";
    });
    wiki.appendChild(closeButton);

    const name = document.createElement("span");
    name.className = "wikiName";
    name.style.color = item.color;
    name.innerText = item.name;
    wiki.appendChild(name);

    const desc = document.createElement("p");
    desc.className = "wikiText";
    desc.classList.add("wikiOtherDetails");
    desc.innerText = item.desc;
    wiki.appendChild(desc);

    document.getElementById("ore-wiki").innerHTML = "";
    document.getElementById("ore-wiki").appendChild(wiki);
    document.getElementById("ore-wiki").style.display = "block";
}

function loadOreWiki() {
    document.getElementById("ore-wiki-list").innerHTML = "";
    // sort ores by name (probably not the best way to do it but if it works it works)
    let sortedOres = Object.keys(ores).sort((a, b) => ores[a].name.toLowerCase() < ores[b].name.toLowerCase() ? -1 : 1);
    let undiscovered = 0;
    for (const ore of sortedOres) {
        if (ores[ore].excludeFromWiki === 2) continue;
        // list
        let oreData = ores[ore];
        let listItem = document.createElement("div");
        listItem.classList.add("item");
        listItem.setAttribute("id", `wiki-list-item-${ore}`);
        listItem.setAttribute("data-id", ore);
        listItem.innerHTML = `<span class="item-name${oreData.removalReason ? " strikethrough" : ""}">${oreData.name}</span><img src="img/item/${ores[ore].customTexture ? ores[ore].customTexture.item.src : ore}.png" alt="${oreData.name}" class="item-count">`;
        listItem.style.background = oreData.color;
        listItem.style.color = tiers[oreData.tier].color;
        listItem.addEventListener("click", () => openOre(ore));
        if (inventory.getCount(ore) === false) {
            listItem.style.backgroundColor = "#333";
            listItem.style.backgroundImage = "";
            listItem.querySelector(".item-count").style.filter = "brightness(0)";
            listItem.querySelector(".item-name").style.color = "#888";
            /* listItem.querySelector(".item-name").innerText = "???";
            listItem.classList.add("undiscovered"); */
            undiscovered++;
            if (ores[ore].excludeFromWiki) { // you never know if there are more undiscovered ores
                listItem.classList.add("hidden");
                undiscovered--;
            }
        }
        if (!(inventory.getCount(ore) === false && ores[ore].excludeFromWiki))
            document.getElementById("ore-wiki-list").appendChild(listItem);
    }
    if (undiscovered > 0) {
        let undiscoveredDiv = document.createElement("div");
        undiscoveredDiv.className = "item";
        undiscoveredDiv.id = "undiscovered-count";
        undiscoveredDiv.style.backgroundColor = "#000";
        undiscoveredDiv.style.color = "#fff";
        undiscoveredDiv.innerHTML = `<span class="item-name">${undiscovered} undiscovered</span>`;
        document.getElementById("ore-wiki-list").appendChild(undiscoveredDiv);
    }

    sortWikiList();
}

function loadItemWiki() {
    let sortedItems = Object.keys(items).sort((a, b) => items[a].name.toLowerCase() < items[b].name.toLowerCase() ? -1 : 1);
    for (const i of sortedItems) {
        const item = items[i];
        const div = document.createElement("div");
        div.className = "item";
        div.style.background = item.color;
        
        const name = document.createElement("span");
        name.className = "item-name";
        name.innerText = item.name;

        const img = document.createElement("img");
        img.className = "item-count";
        img.src = `img/item/${ores[i] && ores[i].customTexture ? ores[i].customTexture.item.src : i}.png`;

        div.append(name, img);
        div.addEventListener("click", () => openItem(i));
        document.getElementById("item-wiki-list").appendChild(div);
    }
}

function loadLayerWiki() {
    document.getElementById("layer-wiki-list").innerHTML = "";
    for (const l of Object.keys(layers)) {
        const layer = layers[l];
        
        const div = document.createElement("div");
        div.className = "item";
        div.style.background = layer.color || layer.fogColor;
        
        const name = document.createElement("span");
        name.className = "item-name";
        name.innerText = layer.name;

        const item = document.createElement("img");
        item.className = "item-count";
        item.src = `img/item/${layer.item || "question"}.png`;

        div.append(name, item);

        document.getElementById("layer-wiki-list").appendChild(div);

        div.addEventListener("click", () => {
            const wiki = document.createElement("div");

            const closeButton = document.createElement("span");
            closeButton.className = "closeButton";
            closeButton.innerText = "×";
            closeButton.addEventListener("click", () => {
                document.getElementById("ore-wiki").style.display = "none";
                document.getElementById("ore-wiki").innerHTML = "";
            });
            wiki.appendChild(closeButton);

            const name = document.createElement("span");
            name.className = "wikiName";
            name.style.color = layer.color || layer.fogColor;
            name.innerText = layer.name;
            wiki.appendChild(name);

            const desc = document.createElement("p");
            desc.className = "wikiText";
            desc.classList.add("wikiOtherDetails");
            desc.innerText = layer.desc;
            
            document.getElementById("ore-wiki").innerHTML = "";
            document.getElementById("ore-wiki").appendChild(wiki);
            document.getElementById("ore-wiki").style.display = "block";
        });
    }
}

function loadAchievements() {
    try {
        const achievementData = JSON.parse(localStorage.getItem("tdd-unlockedAchievements") || "[]");
        for (const id of achievementData) {
            if (achievements[id]) achievements[id].unlocked = true;
        }
    } catch {}

    document.getElementById("achievements-list").innerHTML = "";
    for (const a of Object.keys(achievements)) {
        const achievement = achievements[a];
        if (achievement.disabled || achievement.preReq?.some(p => !achievements[p].unlocked)) continue;
        const div = document.createElement("div");
        div.className = "item";
        div.id = `achievement-${a}`;

        const name = document.createElement("span");
        name.className = "item-name";
        name.innerText = achievement.name;

        const desc = document.createElement("span");
        desc.className = "achievement-desc";
        desc.innerText = achievement.desc;
        name.appendChild(desc);

        const img = document.createElement("img");
        img.className = "item-count";
        img.src = `img/item/${achievement.icon || "trophy"}.png`;
        div.append(name, img);

        document.getElementById("achievements-list").appendChild(div);
    }
}

export function unlockAchievement(id) {
    if (!achievements[id] || achievements[id].unlocked) return;
    achievements[id].unlocked = true;
    displayAlert(`Achievement Unlocked: ${achievements[id].name}<br><span style="font-size: 0.8em; color: #aaa;">${achievements[id].desc}</span>`);
}

function updateAchievements() {
    let unlockedCount = 0;
    for (let i = 0; i < achievementArray.length; i++) {
        const a = achievementArray[i];

        if (a.disabled) continue;

        const progress = a.progress() || 0;
        if (progress >= 1 && !a.unlocked) {
            unlockAchievement(a.id);
            unlockedCount++;
        }

        const elem = document.getElementById(`achievement-${a.id}`);
        if (!elem) continue;
        if (a.unlocked) {
            elem.classList.add("unlocked");
            if (a.secretDesc) elem.querySelector(".achievement-desc").innerText = a.secretDesc;
        } else {
            elem.style.setProperty("--progress", progress * 100 + "%");
        }
    }

    if (unlockedCount) {
        loadAchievements();
    }
}

setInterval(updateAchievements, 1000);

loadOreWiki();
// loadItemWiki();
// loadLayerWiki();
loadAchievements();

vars.inventory = inventory;

export { Inventory, inventory, GAME_MODE };