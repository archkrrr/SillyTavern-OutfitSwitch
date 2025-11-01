export const SCHEMA_VERSION = 2;

function cloneVariants(variants) {
    if (!Array.isArray(variants)) {
        return [];
    }
    return variants.map((entry) => normalizeVariantEntry(entry));
}

function cloneTriggers(triggers) {
    if (!Array.isArray(triggers)) {
        return [];
    }
    return triggers.map((entry) => normalizeTriggerEntry(entry));
}

export function normalizeVariantEntry(entry = {}) {
    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    const folder = typeof entry.folder === "string" ? entry.folder.trim() : "";
    return { name, folder };
}

export function normalizeTriggerEntry(entry = {}) {
    const trigger = typeof entry.trigger === "string" ? entry.trigger.trim() : "";
    let folder = "";
    if (typeof entry.folder === "string") {
        folder = entry.folder.trim();
    } else if (typeof entry.costume === "string") {
        folder = entry.costume.trim();
    }
    return { trigger, folder };
}

export function ensureProfileShape(rawProfile = {}) {
    const character = typeof rawProfile.character === "string" ? rawProfile.character.trim() : "";
    const baseFolder = typeof rawProfile.baseFolder === "string" ? rawProfile.baseFolder.trim() : "";
    const variants = cloneVariants(rawProfile.variants);
    const triggers = cloneTriggers(rawProfile.triggers);

    return { character, baseFolder, variants, triggers };
}

export const defaultProfile = ensureProfileShape();

export function ensureSettingsShape(raw = {}) {
    const enabled = Boolean(raw?.enabled);
    const detectedProfile = raw?.profile && typeof raw.profile === "object"
        ? raw.profile
        : {
              character: typeof raw?.character === "string" ? raw.character : "",
              baseFolder: raw?.baseFolder,
              variants: raw?.variants,
              triggers: raw?.triggers,
          };

    const profile = ensureProfileShape(detectedProfile);
    const version = Number.isInteger(raw?.version) && raw.version > 0 ? raw.version : SCHEMA_VERSION;

    return { version: Math.max(version, SCHEMA_VERSION), enabled, profile };
}

export const defaultSettings = ensureSettingsShape();

export function normalizeCostumeFolder(rawFolder) {
    if (!rawFolder) {
        return "";
    }
    let folder = String(rawFolder).trim();
    folder = folder.replace(/^\\+/, "");
    folder = folder.replace(/^\/+/, "");
    folder = folder.replace(/\\+/g, "/");
    folder = folder.replace(/\/+$/, "");
    return folder;
}

export function composeCostumePath(baseFolder = "", variantFolder = "") {
    const base = normalizeCostumeFolder(baseFolder);
    const variant = normalizeCostumeFolder(variantFolder);
    if (base && variant) {
        return `${base}/${variant}`.replace(/\/{2,}/g, "/");
    }
    return variant || base;
}

export function findCostumeForTrigger(settingsOrProfile, key) {
    const profile = settingsOrProfile?.profile ? settingsOrProfile.profile : settingsOrProfile;
    if (!profile || !Array.isArray(profile.triggers)) {
        return "";
    }

    const lookup = String(key ?? "").trim().toLowerCase();
    if (!lookup) {
        return "";
    }

    for (const entry of profile.triggers) {
        const normalized = String(entry?.trigger ?? "").trim().toLowerCase();
        if (normalized && normalized === lookup) {
            return composeCostumePath(profile.baseFolder, entry.folder);
        }
    }

    return "";
}
