import test from "node:test";
import assert from "node:assert/strict";
import {
    SCHEMA_VERSION,
    composeCostumePath,
    defaultSettings,
    ensureSettingsShape,
    findCostumeForTrigger,
    normalizeCostumeFolder,
    normalizeTriggerEntry,
    normalizeVariantEntry,
} from "../src/simple-switcher.js";

test("default settings shape", () => {
    const result = ensureSettingsShape();
    assert.deepEqual(result, defaultSettings);
});

test("ensure settings shape nests legacy fields into profile", () => {
    const result = ensureSettingsShape({
        enabled: true,
        baseFolder: "Hero ",
        character: "  Alice  ",
        variants: [{ name: "  Casual  ", folder: "  casual  " }],
        triggers: [{ trigger: "  Battle  ", folder: "  armor  " }],
    });

    assert.equal(result.enabled, true);
    assert.equal(result.version, SCHEMA_VERSION);
    assert.equal(result.profile.character, "Alice");
    assert.equal(result.profile.baseFolder, "Hero");
    assert.deepEqual(result.profile.variants, [{ name: "Casual", folder: "casual" }]);
    assert.deepEqual(result.profile.triggers, [{ trigger: "Battle", folder: "armor" }]);
});

test("normalize trigger entry trims values and supports legacy costume", () => {
    const entry = normalizeTriggerEntry({ trigger: "  Battle  ", costume: "  armor  " });
    assert.equal(entry.trigger, "Battle");
    assert.equal(entry.folder, "armor");
});

test("normalize variant entry trims values", () => {
    const entry = normalizeVariantEntry({ name: "  Casual  ", folder: "  outfits/casual  " });
    assert.equal(entry.name, "Casual");
    assert.equal(entry.folder, "outfits/casual");
});

test("normalize costume folder removes leading and trailing slashes", () => {
    assert.equal(normalizeCostumeFolder("/hero"), "hero");
    assert.equal(normalizeCostumeFolder("\\villain"), "villain");
    assert.equal(normalizeCostumeFolder(" stage/"), "stage");
});

test("compose costume path merges base and variant", () => {
    assert.equal(composeCostumePath("hero", "armor"), "hero/armor");
    assert.equal(composeCostumePath("hero", ""), "hero");
    assert.equal(composeCostumePath("", "armor"), "armor");
});

test("find costume for trigger is case-insensitive and respects base folder", () => {
    const settings = ensureSettingsShape({
        baseFolder: "hero",
        triggers: [
            { trigger: "Battle", folder: "armor" },
            { trigger: "Relax", folder: "casual" },
        ],
    });

    assert.equal(findCostumeForTrigger(settings, "battle"), "hero/armor");
    assert.equal(findCostumeForTrigger(settings, "RELAX"), "hero/casual");
    assert.equal(findCostumeForTrigger(settings, "unknown"), "");
});

test("find costume for trigger works when provided a profile object", () => {
    const settings = ensureSettingsShape({
        profile: {
            baseFolder: "hero",
            triggers: [
                { trigger: "Battle", folder: "armor" },
            ],
        },
    });

    assert.equal(findCostumeForTrigger(settings.profile, "Battle"), "hero/armor");
});
