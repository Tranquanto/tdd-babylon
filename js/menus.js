import vars from "./outside_stuff.js";
document.getElementById("settings-maxLights").innerText = `Max Lights: ${localStorage.getItem("maxLights") || 10} (Requires Refresh)`;

document.getElementById("play-btn").addEventListener("click", () => {
    document.getElementById("main-menu").style.display = "none";
    document.getElementById("play-menu").style.display = "block";
});

document.getElementById("play-back").addEventListener("click", () => {
    document.getElementById("main-menu").style.display = "block";
    document.getElementById("play-menu").style.display = "none";
});
document.getElementById("play-normal").addEventListener("click", () => {
    vars.PAUSED = false;
    vars.hasPlayed = true;
    document.getElementById("bgm").play();
    document.getElementById("play-menu").style.display = "none";
    document.getElementById("logo-container").style.visibility = "hidden";
});

document.getElementById("settings-btn").addEventListener("click", () => {
    document.getElementById("main-menu").style.display = "none";
    document.getElementById("settings-menu").style.display = "block";
});
document.getElementById("settings-sensitivity").addEventListener("input", e => {
    vars.settings.sensitivity = Number(e.target.value);
    // updateSetting("sensitivity");
});
document.getElementById("settings-music").addEventListener("input", e => {
    vars.settings.music = Number(e.target.value);
    // updateSetting("music");
});
document.getElementById("settings-oreSound").addEventListener("input", e => {
    vars.settings.oreSound = Number(e.target.value);
    // listener.setMasterVolume(vars.settings.oreSound);
    // updateSetting("oreSound");
});
document.getElementById("settings-username").addEventListener("click", () => {
    localStorage.removeItem("username");
    document.getElementById("settings-username").disabled = true;
    document.getElementById("settings-username").innerText = "Username reset. Please refresh the page.";
});
document.getElementById("settings-maxLights").addEventListener("change", () => {
    const maxLights = Number(document.getElementById("settings-maxLights").value);
    localStorage.setItem("maxLights", maxLights);
});
document.getElementById("settings-maxLights").addEventListener("input", e => {
    vars.settings.maxLights = Number(e.target.value);
    localStorage.setItem("maxLights", vars.settings.maxLights);
    // updateSetting("maxLights", false);
});
document.getElementById("settings-resolutionScale").addEventListener("input", e => {
    vars.settings.resolutionScale = Number(e.target.value);
    localStorage.setItem("resolutionScale", vars.settings.resolutionScale);
    // updateSetting("resolutionScale", false);
});
document.getElementById("settings-shadows").addEventListener("click", () => {
    if (vars.settings.shadows === undefined) vars.settings.shadows = true;
    vars.settings.shadows = !vars.settings.shadows;
    localStorage.setItem("shadows", vars.settings.shadows);
    alert(`Shadows have been ${vars.settings.shadows ? "enabled" : "disabled"}. You don't need to refresh the page :3`);
    vars.renderer.shadowMap.enabled = vars.settings.shadows;
    vars.renderer.compile(vars.scene, vars.perspectiveCamera);
});
document.getElementById("settings-shadowMapSize").addEventListener("input", e => {
    vars.settings.shadowMapSize = 2 ** Number(e.target.value);
    localStorage.setItem("shadowMapSize", vars.settings.shadowMapSize);
    // updateSetting("shadowMapSize", false);
});
document.getElementById("resetBtn").addEventListener("click", () => {
    if (
        confirm('Are you sure you want to reset?')
        && confirm('Are you REALLY sure?')
        && confirm('This will reset your progress, including your username, inventory, and all discoveries. This action cannot be undone.')
        && confirm('Are you absolutely sure you want to reset everything?')
    ) {
        let operations = ["+", "-", "*"];
        let randomOperation = operations[Math.floor(Math.random() * operations.length)];
        let num1 = Math.floor(Math.random() * 100);
        let num2 = Math.floor(Math.random() * 100);
        let answer;
        switch (randomOperation) {
            case "+":
                answer = num1 + num2;
                break;
            case "-":
                answer = num1 - num2;
                break;
            case "*":
                answer = num1 * num2;
                break;
            default:
                answer = NaN;
        }
        let userAnswer = prompt(`To confirm the reset, please solve this math problem: ${num1} ${randomOperation} ${num2} = ?`);

        if (userAnswer == answer) {
            const id = localStorage.getItem('userID');
            localStorage.clear();
            localStorage.setItem('userID', id);
            location.reload();
        } else {
            alert('Incorrect answer. Reset canceled.');
        }
    }
});
document.getElementById("settings-back").addEventListener("click", () => {
    document.getElementById("main-menu").style.display = "block";
    document.getElementById("settings-menu").style.display = "none";
});

document.getElementById("credits-btn").addEventListener("click", () => {
    document.getElementById("main-menu").style.display = "none";
    document.getElementById("credits-menu").style.display = "block";
});
document.getElementById("credits-back").addEventListener("click", () => {
    document.getElementById("main-menu").style.display = "block";
    document.getElementById("credits-menu").style.display = "none";
});

document.getElementById("changelog-btn").addEventListener("click", () => {
    window.open("changelog.html", "_blank");
});

document.getElementById("controls-btn").addEventListener("click", () => {
    document.getElementById("main-menu").style.display = "none";
    document.getElementById("controls").style.display = "block";
});
document.getElementById("controls-back").addEventListener("click", () => {
    document.getElementById("main-menu").style.display = "block";
    document.getElementById("controls").style.display = "none";
});

document.getElementById("exit-btn").addEventListener("click", () => {
    window.location = "../..";
});

document.getElementById("index-btn").addEventListener("click", () => {
    if (document.getElementById("indexes").style.display === "block")
        document.getElementById("indexes").style.display = "none";
    else document.getElementById("indexes").style.display = "block";
});
for (const cat of ["ore-wiki"/*, "item-wiki", "layer-wiki", "biome-wiki"*/, "achievements"]) {
    document.getElementById(`${cat}-btn`).addEventListener("click", () => {
        if (document.getElementById(`${cat}-list`).style.display === "block")
            document.getElementById(`${cat}-list`).style.display = "none";
        else document.getElementById(`${cat}-list`).style.display = "block";
        document.getElementById("indexes").style.display = "none"
    });
}

document.getElementById("dpad-fullscreen").addEventListener("click", () => {
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(err => {
            console.error("Error exiting fullscreen:", err);
        });
    } else {
        document.documentElement.requestFullscreen().catch(err => {
            console.error("Error entering fullscreen:", err);
        });
    }
});

if (location.origin.includes("localhost")) {
    document.getElementById("dpad-console").style.display = "block";
    document.getElementById("dpad-console").addEventListener("click", () => {
        document.dispatchEvent(new KeyboardEvent('keydown', {code: 'F2'}));
    });
}

// updateSetting("sensitivity", undefined, true);
// updateSetting("music", undefined, true);
// updateSetting("oreSound", undefined, true);
// updateSetting("maxLights", false, true);
// updateSetting("resolutionScale", false, true);
// updateSetting("shadowMapSize", false, true);

if (localStorage.getItem("shadows") === null) {
    vars.settings.shadows = true;
} else {
    vars.settings.shadows = localStorage.getItem("shadows") === "true";
}

vars.canvasFilter = {
    hueRotate: 0,
    saturate: 100,
    sepia: 0,
    appendixes: {
        "hue-rotate": "deg",
        saturate: "%",
        sepia: "%"
    },
    exclude: {
        update: 1,
        appendixes: 1,
        exclude: 1,
        reset: 1
    },
    update() {
        return document.getElementById("canvas").style.filter = Object.keys(vars.canvasFilter)
        .filter(g => !vars.canvasFilter.exclude[g])
        .map(g => {
            if (/[A-Z]/.test(g)) {
                const parts = g.split(/(?=[A-Z])/);
                return parts.map((part, index) => {
                    if (index === 0) return part.toLowerCase();
                    return part.charAt(0).toLowerCase() + part.slice(1);
                }).join("-");
            }
            return g;
        })
        .map((g, index) => {
            return {key: g, val: vars.canvasFilter[Object.keys(vars.canvasFilter).filter(g => !vars.canvasFilter.exclude[g])[index]] + (vars.canvasFilter.appendixes[g] || "")};
        })
        .map(g => `${g.key}(${g.val})`).join(" ");
    },
    reset() {
        vars.canvasFilter.hueRotate = 0;
        vars.canvasFilter.saturate = 100;
        vars.canvasFilter.sepia = 0;
        vars.canvasFilter.update();
    }
};