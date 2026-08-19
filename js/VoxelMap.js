export class VoxelMap {
    constructor(object) {
        this._obj = object ?? {};
    }

    at(x, y, z, v) {
        if (v === undefined) return this._obj[`${x},${y},${z}`] || false;
        else if (v !== true && v !== "delete") this._obj[`${x},${y},${z}`] = v;
        else if (v === true) this._obj[`${x},${y},${z}`] = {ore: "air"};
        else delete this._obj[`${x},${y},${z}`];
    }
}