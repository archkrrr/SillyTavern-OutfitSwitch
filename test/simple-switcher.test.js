import test from "node:test";
import assert from "node:assert/strict";
import {
    SCHEMA_VERSION,
    buildStreamBuffer,
    composeCostumePath,
    defaultSettings,
    ensureSettingsShape,
    findCostumeForTrigger,
    findCostumeForText,
    normalizeCostumeFolder,
    normalizeTriggerEntry,
    normalizeVariantEntry,
    parseTriggerPattern,
} from "../src/simple-switcher.js";

test("default settings shape", () => {
    const result = ensureSettingsShape();
    assert.deepEqual(result, defaultSettings);
});

test("ensure settings shape preserves provided profiles and active profile", () => {
    const result = ensureSettingsShape({
        enabled: false,
        activeProfile: "Alt",
        profiles: {
            Default: { baseFolder: "hero" },
            Alt: { baseFolder: "villain" },
        },
    });

    assert.equal(result.enabled, false);
    assert.equal(result.activeProfile, "Alt");
    assert.equal(result.profiles.Alt.baseFolder, "villain");
    assert.equal(result.profiles.Default.baseFolder, "hero");
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
    assert.equal(result.activeProfile, "Default");
    assert.deepEqual(Object.keys(result.profiles), ["Default"]);
    const activeProfile = result.profiles[result.activeProfile];
    assert.equal(activeProfile.baseFolder, "Hero");
    assert.deepEqual(activeProfile.variants, [{ name: "Casual", folder: "casual" }]);
    assert.deepEqual(activeProfile.triggers, [
        { trigger: "Battle", triggers: ["Battle"], folder: "armor" },
    ]);
    assert.equal("character" in activeProfile, false);
});

test("normalize trigger entry trims values and supports legacy costume", () => {
    const entry = normalizeTriggerEntry({ trigger: "  Battle  ", costume: "  armor  " });
    assert.equal(entry.trigger, "Battle");
    assert.deepEqual(entry.triggers, ["Battle"]);
    assert.equal(entry.folder, "armor");
});

test("normalize trigger entry collects multiple trigger formats", () => {
    const entry = normalizeTriggerEntry({
        trigger: " Battle ",
        triggers: [" Fight ", "Battle", "guard"],
        matcher: "slash",
        patterns: "strike,\n parry ",
    });

    assert.equal(entry.trigger, "Battle");
    assert.deepEqual(entry.triggers, ["Battle", "Fight", "guard", "slash", "strike", "parry"]);
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

test("parse trigger pattern handles literals and regex", () => {
    const literal = parseTriggerPattern("Battle");
    assert.deepEqual(literal, { type: "literal", raw: "Battle", value: "battle" });

    const regex = parseTriggerPattern("/fight\\s+mode/i");
    assert.equal(regex?.type, "regex");
    assert.equal(regex?.raw, "/fight\\s+mode/i");
    assert.equal(regex?.regex instanceof RegExp, true);
    assert.equal(regex?.regex.flags.includes("i"), true);
});

test("parse trigger pattern returns null for invalid regex", () => {
    const result = parseTriggerPattern("/unterminated");
    assert.equal(result, null);
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

test("find costume for trigger matches any alias", () => {
    const settings = ensureSettingsShape({
        baseFolder: "hero",
        triggers: [
            { trigger: "Battle", folder: "armor" },
            { trigger: "Chill", triggers: ["relax", "breeze"], folder: "casual" },
            { trigger: "Stealth", triggers: "sneak, shadow\n night", folder: "stealth" },
        ],
    });

    assert.equal(findCostumeForTrigger(settings, "Relax"), "hero/casual");
    assert.equal(findCostumeForTrigger(settings, "shadow"), "hero/stealth");
    assert.equal(findCostumeForTrigger(settings, "night"), "hero/stealth");
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

    const profile = settings.profiles[settings.activeProfile];
    assert.equal(findCostumeForTrigger(profile, "Battle"), "hero/armor");
});

test("find costume for text matches literals case-insensitively", () => {
    const settings = ensureSettingsShape({
        baseFolder: "hero",
        triggers: [
            { trigger: "Battle", folder: "armor" },
            { trigger: "Relax", triggers: ["wind down"], folder: "casual" },
        ],
    });

    const battleMatch = findCostumeForText(settings, "Time to battle the villain!");
    assert.deepEqual(battleMatch, { costume: "hero/armor", trigger: "Battle", type: "literal" });

    const profile = settings.profiles[settings.activeProfile];
    const relaxMatch = findCostumeForText(profile, "Let's WIND DOWN after the fight.");
    assert.deepEqual(relaxMatch, { costume: "hero/casual", trigger: "wind down", type: "literal" });
});

test("find costume for text matches regex patterns", () => {
    const settings = ensureSettingsShape({
        baseFolder: "hero",
        triggers: [
            { trigger: "Battle", triggers: ["/fight\\s+mode/i"], folder: "armor" },
        ],
    });

    const match = findCostumeForText(settings, "Switching to FIGHT    MODE now!");
    assert.equal(match?.costume, "hero/armor");
    assert.equal(match?.type, "regex");
});

test("find costume for text ignores entries without folders", () => {
    const settings = ensureSettingsShape({
        baseFolder: "",
        triggers: [
            { trigger: "Battle", folder: "" },
            { trigger: "Relax", folder: "casual" },
        ],
    });

    assert.equal(findCostumeForText(settings, "battle mode"), null);
    assert.deepEqual(findCostumeForText(settings, "Time to relax"), { costume: "casual", trigger: "Relax", type: "literal" });
});

test("build stream buffer concatenates tokens and trims to limit", () => {
    const first = buildStreamBuffer("Hello", " ");
    assert.equal(first, "Hello ");

    const limited = buildStreamBuffer("abc", "def", { limit: 4 });
    assert.equal(limited, "cdef");

    const unlimited = buildStreamBuffer("abc", "def", { limit: 0 });
    assert.equal(unlimited, "abcdef");
});

