let sensitivity = localStorage.getItem("sensitivity") || 1;

Math.lerp = function (a, b, t) {
    // t = (1 - Math.cos(t * Math.PI)) / 2; // Convert to sine easing
    return a + (b - a) * Math.min(Math.max(t, 0), 1);
}

/**
 * Converts a number into a formatted string with number names for large values and increasing number of decimal places for small values.
 * @param {number} n Input value
 * @param {number} d Number of decimal places
 * @param {number} min Minimum value before the number is converted to its name
 * @param {string} format Locale
 * @returns {string} Formatted number string (e.g. "1,234,567,890" or "15.8Qi")
 */
function formatNum(n, d = 2, min = 1e15, format) {
    n = Number(n);
    if (Math.abs(n) >= min) {
        const s = numberName(n, true, true, Math.max(d - (Math.floor(Math.log10(n)) % 3), 0));
        if (s.split(" ")[1]?.length === 1) return s.replace(" ", "");
        return s;
    } else if (Math.abs(n) > 1e-6) {
        return n.toLocaleString(format, {maximumFractionDigits: Math.max(0, d - Math.floor(Math.log10(Math.abs(n))))});
    } else if (n > 0) {
        return n.toExponential(d);
    } else return "0";
}

/**
 * Format a chance value as a percentage and/or "1 in X".
 * @param {number} chance Chance value (between 0 and 1)
 * @param {string} format Locale
 * @returns {string} Formatted chance string (e.g. "1 in 40,000", "1 in 250 (0.4%)", or "25%")
 */
function formatChance(chance, format) {
    if (chance <= 0.0001) {
        return `1 in ${formatNum(1 / chance, 2, undefined, format)}`;
    } else if (chance <= 0.1) {
        return `1 in ${formatNum(1 / chance, 2, undefined, format)} (${formatNum(chance * 100, 2, undefined, format)}%)`;
    } else if (chance < Infinity) {
        return `${formatNum(chance * 100, 2, undefined, format)}%`;
    } else {
        return "Infinity";
    }
}

/**
 * Format time given in seconds into a human-readable string.
 * @param {number} t Time in seconds
 * @param {boolean} onlyFirst Whether to only print the largest unit
 * @returns {string} Formatted time string (e.g. "1 hr 23 min 45 sec")
 */
function formatTime(t, onlyFirst = false) {
    if (isNaN(t) || typeof t !== "number") return "NaN";
    // if (t < 1) return formatNum(t * 1e3, 2) + " ms";
    if (t < 60) return formatNum(t, 2) + " sec";
    else if (t < 3600) return (formatNum(Math.floor(t / 60), 0) + " min " + (((t % 60) !== 0 && !onlyFirst) ? formatTime(t % 60) : "")).trim();
    else if (t < 86400) return (formatNum(Math.floor(t / 3600), 0) + " hr " + (((t % 3600) !== 0 && !onlyFirst) ? formatTime(t % 3600) : "")).trim();
    else if (t < 31556926.08) return (formatNum(Math.floor(t / 86400), 0) + " day " + (((t % 86400) !== 0 && !onlyFirst) ? formatTime(t % 86400) : "")).trim();
    else if (t < 31556926080) return (formatNum(Math.floor(t / 31556926.08), 0) + " yr " + (((t % 31556926.08) !== 0 && !onlyFirst) ? formatTime(t % 31556926.08) : "")).trim();
    else if (t < 1e300) return formatNum(t / 31556926.08, 2) + " yr";
    else return "Infinity";
}

/**
 * Checks if a value is not defined or is NaN.
 * @param {*} input Input value
 * @return {boolean} Whether the value is not defined or NaN
 */
function nd(input) {
    return !input && input !== 0;
}