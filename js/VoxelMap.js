export function k(x, y, z) { // key
    return `${x}_${y}_${z}`;
}

export class VoxelMap {
    constructor(object, options = {}) {
        this._obj = object ?? {};
        this.regions = {};

        this.regionsEnabled = options.regionsEnabled || options.regionSize;
        this.regionSize = options.regionSize || 8;
    }

    getClosestRegions(x, y, z, d = 1) {
        x -= this.regionSize * (d - 1) / 2;
        y -= this.regionSize * (d - 1) / 2;
        z -= this.regionSize * (d - 1) / 2;
        const region = [Math.floor(x / this.regionSize), Math.floor(y / this.regionSize), Math.floor(z / this.regionSize)];
        if (d === 1) return {x: region[0], y: region[1], z: region[2]};

        let output = [];
        for (let dx = 0; dx < d; dx++) {
            for (let dy = 0; dy < d; dy++) {
                for (let dz = 0; dz < d; dz++) {
                    output.push({x: region[0] + dx, y: region[1] + dy, z: region[2] + dz});
                }
            }
        }

        return output;
    }

    getAllInRegion(rx, ry, rz, all) {
        if (!all) {
            return Object.keys(this.regions[k(rx, ry, rz)] ?? {});
        } else {
            const offset = [rx, ry, rz].map(c => c * this.regionSize);

            let output = [];

            for (let dx = 0; dx < this.regionSize; dx++) {
                for (let dy = 0; dy < this.regionSize; dy++) {
                    for (let dz = 0; dz < this.regionSize; dz++) {
                        const x = offset[0] + dx;
                        const y = offset[1] + dy;
                        const z = offset[2] + dz;
                        output.push({
                            x, y, z,
                            value: this.at(x, y, z)
                        });
                    }
                }
            }
            return output;
        }
    }

    at(x, y, z, v) {
        if (v === undefined) {
            return this._obj[`${x},${y},${z}`] || false;
        } else if (v !== true && v !== "delete") {
            this._obj[`${x},${y},${z}`] = v;
        } else if (v === true) {
            this._obj[`${x},${y},${z}`] = {ore: "air"};
        } else {
            delete this._obj[`${x},${y},${z}`];
        }

        if (this.regionsEnabled) {
            const r = this.getClosestRegions(x, y, z);
            if (this.regions[k(r.x, r.y, r.z)] === undefined) this.regions[k(r.x, r.y, r.z)] = {};

            if (v === "delete") delete this.regions[k(r.x, r.y, r.z)][`${x},${y},${z}`];
            else this.regions[k(r.x, r.y, r.z)][`${x},${y},${z}`] = v;
        }
    }
}