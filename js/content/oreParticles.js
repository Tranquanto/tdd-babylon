import { getColor } from "../getColor.js";
import vars from "../vars.js";

export const oreParticles = {
    thundrite: {
        getParticleSystem(name, scene) {
            const ps = new BABYLON.ParticleSystem(name, 100, scene);
            ps.createBoxEmitter(new BABYLON.Vector3(1, 1, 1), new BABYLON.Vector3(-1, -1, -1), new BABYLON.Vector3(-1, -1, -1), new BABYLON.Vector3(1, 1, 1));
            ps.particleTexture = vars.getTexture("particle", "particle");
            ps.color1 = ps.color2 = getColor("#ff0");
            ps.colorDead = ps.color1.clone();
            ps.colorDead.a = 0;
            ps.maxSize = ps.minSize = 0.1;
            ps.emitRate = 10;

            return ps;
        }
    },
    fumarole: {
        getParticleSystem(name, scene) {
            const ps = new BABYLON.ParticleSystem(name, 100, scene);
            const emitter = ps.createConeEmitter(2, 10);
            ps.particleTexture = vars.getTexture("particle", "particle");
            ps.emitRate = 10;
            ps.maxSize = ps.minSize = 0.06;
            ps.color1 = ps.color2 = getColor("#f80");
            ps.colorDead = getColor("#4440");
            ps.gravity = new BABYLON.Vector3(0, -7, 0);
            ps.maxEmitPower = ps.minEmitPower = 4;
            emitter.angle = Math.PI / 2;
            emitter.emitFromSpawnPointOnly = true;

            return ps;
        }
    },
    asbestos: {
        getParticleSystem(name, scene) {
            const ps = new BABYLON.ParticleSystem(name, 200, scene);
            const emitter = ps.createBoxEmitter(new BABYLON.Vector3(-0.1, -1, -0.1), new BABYLON.Vector3(0.1, -1, 0.1), new BABYLON.Vector3(-0.5, -0.4, -0.5), new BABYLON.Vector3(0.5, -0.4, 0.5));
            ps.particleTexture = vars.getTexture("particle", "particle");
            ps.emitRate = 20;
            ps.gravity = new BABYLON.Vector3(0, -20, 0);
            ps.maxSize = ps.minSize = 0.14;
            ps.colorDead = getColor("#fff0");

            return ps;
        }
    },
    dragonite: {
        getParticleSystem(name, scene) {
            const ps = new BABYLON.ParticleSystem(name, 100, scene);
            const emitter = ps.createSphereEmitter(0.5, 0);
            ps.particleTexture = vars.getTexture("particle", "particle");
            ps.emitRate = 20;
            ps.maxEmitPower = ps.minEmitPower = 1;
            ps.maxSize = ps.minSize = 0.4;

            ps.color1 = ps.color2 = getColor("#90f");

            ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;

            return ps;
        }
    },
    ulexite: {
        getParticleSystem(name, scene) {
            const ps = new BABYLON.ParticleSystem(name, 100, scene);
            const emitter = ps.createSphereEmitter(2, 0);
            ps.particleTexture = vars.getTexture("particle", "particle");
            ps.emitRate = 20;
            ps.maxEmitPower = ps.minEmitPower = -1.5;
            ps.maxSize = ps.minSize = 0.4;

            ps.color1 = ps.color2 = getColor("#000");
            ps.colorDead = getColor("#eae3c800");

            ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;

            return ps;
        }
    },
    creation: {
        getParticleSystem(name, scene) {
            const ps = new BABYLON.ParticleSystem(name, 150, scene);
            const emitter = ps.createSphereEmitter(0.25, 0);
            ps.particleTexture = vars.getTexture("particle", "particle");
            ps.emitRate = 50;
            ps.maxEmitPower = ps.minEmitPower = 10;
            ps.maxSize = ps.minSize = 0.25;

            ps.color1 = ps.color2 = getColor("#fff");
            ps.colorDead = getColor("#000");

            ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;

            return ps;
        }
    },
    destruction: {
        getParticleSystem(name, scene) {
            const ps = new BABYLON.ParticleSystem(name, 150, scene);
            const emitter = ps.createSphereEmitter(10, 0);
            ps.particleTexture = vars.getTexture("particle", "particle");
            ps.emitRate = 50;
            ps.maxEmitPower = ps.minEmitPower = -10;
            ps.maxSize = ps.minSize = 0.25;

            ps.color1 = ps.color2 = getColor("#0000");
            ps.colorDead = getColor("#f00");

            return ps;
        }
    }
};

oreParticles.dwagonite = oreParticles.dragonite;