import test from "node:test";
import assert from "node:assert/strict";
import {
    defaultSettings,
    ensureSettingsShape,
    findCostumeForTrigger,
    normalizeCostumeFolder,
    normalizeTriggerEntry,
} from "../src/simple-switcher.js";

test("default settings shape", () => {
    const result = ensureSettingsShape();
    assert.deepEqual(result, defaultSettings);
});

test("normalize trigger entry trims values", () => {
    const entry = normalizeTriggerEntry({ trigger: "  Battle  ", costume: "  armor  " });
    assert.equal(entry.trigger, "Battle");
    assert.equal(entry.costume, "armor");
});

test("normalize costume folder removes leading slashes", () => {
    assert.equal(normalizeCostumeFolder("/hero"), "hero");
    assert.equal(normalizeCostumeFolder("\\villain"), "villain");
    assert.equal(normalizeCostumeFolder(" stage "), "stage");
});

test("find costume for trigger is case-insensitive", () => {
    const settings = ensureSettingsShape({
        triggers: [
            { trigger: "Battle", costume: "armor" },
            { trigger: "Relax", costume: "casual" },
        ],
    });

    assert.equal(findCostumeForTrigger(settings, "battle"), "armor");
    assert.equal(findCostumeForTrigger(settings, "RELAX"), "casual");
    assert.equal(findCostumeForTrigger(settings, "unknown"), "");
});
