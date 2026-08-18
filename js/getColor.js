import Color from "./color.js";

export function getColor(input) {
    if (input instanceof BABYLON.Color4) return input;
    let output = input;
    if (typeof output === "number") {
        const str = output.toString(16);
        output = "#" + "0".repeat(6 - str.length) + str;
    }
    try {
        const color = new Color(output).toString({ format: "hex", collapse: false });
        return BABYLON.Color4.FromHexString(color);
    } catch (e) {
        console.error(`Invalid color: ${output} | ${e}`);
        return new BABYLON.Color4(1, 1, 1);
    }
}

/**
 * Returns a color lerped between two colors
 * @param {BABYLON.Color3} color1 Color1
 * @param {BABYLON.Color3} color2 Color2
 * @param {Number} t Distance
 */
export function lerpColor(color1, color2, t) {
    const c1 = getColor(color1), c2 = getColor(color2);
    return new BABYLON.Color4(Math.lerp(c1.r, c2.r, t), Math.lerp(c1.g, c2.g, t), Math.lerp(c1.b, c2.b, t), Math.lerp(c1.a, c2.a, t));
}