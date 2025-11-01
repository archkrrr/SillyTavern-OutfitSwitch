export const SCHEMA_VERSION = 4;

export const DEFAULT_PROFILE_NAME = "Default";

function gatherTriggerStrings(value) {
    const results = [];
    const visit = (entry) => {
        if (entry == null) {
            return;
        }
        if (Array.isArray(entry)) {
            entry.forEach(visit);
            return;
        }
        if (typeof entry === "string") {
            entry
                .split(/\r?\n|,/)
                .map((part) => part.trim())
                .filter(Boolean)
                .forEach((part) => {
                    if (!results.includes(part)) {
                        results.push(part);
                    }
                });
        }
    };
    visit(value);
    return results;
}

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
    const normalizedEntry = typeof entry === "string" ? { trigger: entry } : { ...entry };

    const folder = typeof normalizedEntry.folder === "string"
        ? normalizedEntry.folder.trim()
        : (typeof normalizedEntry.costume === "string" ? normalizedEntry.costume.trim() : "");

    const triggers = gatherTriggerStrings([
        normalizedEntry.triggers,
        normalizedEntry.trigger,
        normalizedEntry.matchers,
        normalizedEntry.matcher,
        normalizedEntry.aliases,
        normalizedEntry.patterns,
    ]);

    const trimmedPrimary = typeof normalizedEntry.trigger === "string"
        ? normalizedEntry.trigger.trim()
        : "";

    if (trimmedPrimary) {
        const existingIndex = triggers.indexOf(trimmedPrimary);
        if (existingIndex === -1) {
            triggers.unshift(trimmedPrimary);
        } else if (existingIndex > 0) {
            triggers.splice(existingIndex, 1);
            triggers.unshift(trimmedPrimary);
        }
    }

    const primaryTrigger = trimmedPrimary || (triggers.length ? triggers[0] : "");

    return { trigger: primaryTrigger, triggers, folder };
}

export function ensureProfileShape(rawProfile = {}) {
    const baseFolder = typeof rawProfile.baseFolder === "string" ? rawProfile.baseFolder.trim() : "";
    const variants = cloneVariants(rawProfile.variants);
    const triggers = cloneTriggers(rawProfile.triggers);

    return { baseFolder, variants, triggers };
}

export const defaultProfile = ensureProfileShape();

function normalizeProfilesMap(rawProfiles = {}) {
    const normalized = {};
    if (!rawProfiles || typeof rawProfiles !== "object") {
        return normalized;
    }

    for (const [name, profile] of Object.entries(rawProfiles)) {
        if (typeof name !== "string" || !name.trim()) {
            continue;
        }
        normalized[name.trim()] = ensureProfileShape(profile);
    }

    return normalized;
}

function coerceLegacyProfile(raw = {}) {
    if (!raw || typeof raw !== "object") {
        return ensureProfileShape();
    }

    const detectedProfile = raw?.profile && typeof raw.profile === "object"
        ? raw.profile
        : {
              baseFolder: raw?.baseFolder,
              variants: raw?.variants,
              triggers: raw?.triggers,
          };

    return ensureProfileShape(detectedProfile);
}

export function ensureSettingsShape(raw = {}) {
    const enabled = Boolean(raw?.enabled);
    const version = Number.isInteger(raw?.version) && raw.version > 0 ? raw.version : SCHEMA_VERSION;

    let profiles = normalizeProfilesMap(raw?.profiles);

    if (!Object.keys(profiles).length) {
        const legacyProfile = coerceLegacyProfile(raw);
        profiles = { [DEFAULT_PROFILE_NAME]: legacyProfile };
    }

    let activeProfile = typeof raw?.activeProfile === "string" ? raw.activeProfile.trim() : "";
    if (!activeProfile || !profiles[activeProfile]) {
        activeProfile = Object.keys(profiles)[0] || DEFAULT_PROFILE_NAME;
    }

    return {
        version: Math.max(version, SCHEMA_VERSION),
        enabled,
        profiles,
        activeProfile,
    };
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

export function resolveProfile(settingsOrProfile) {
    if (!settingsOrProfile || typeof settingsOrProfile !== "object") {
        return null;
    }

    if (settingsOrProfile?.profile && typeof settingsOrProfile.profile === "object") {
        return settingsOrProfile.profile;
    }

    if (settingsOrProfile?.profiles && typeof settingsOrProfile.profiles === "object") {
        const activeName = typeof settingsOrProfile.activeProfile === "string"
            ? settingsOrProfile.activeProfile.trim()
            : "";

        if (activeName && settingsOrProfile.profiles[activeName]) {
            return settingsOrProfile.profiles[activeName];
        }

        const fallbackName = Object.keys(settingsOrProfile.profiles)[0];
        if (fallbackName) {
            return settingsOrProfile.profiles[fallbackName];
        }

        return null;
    }

    return settingsOrProfile;
}

export function findCostumeForTrigger(settingsOrProfile, key) {
    const profile = resolveProfile(settingsOrProfile);
    if (!profile || !Array.isArray(profile.triggers)) {
        return "";
    }

    const lookup = String(key ?? "").trim().toLowerCase();
    if (!lookup) {
        return "";
    }

    for (const entry of profile.triggers) {
        const triggers = gatherTriggerStrings([entry?.triggers, entry?.trigger]);
        for (const trigger of triggers) {
            const normalized = trigger.trim().toLowerCase();
            if (normalized && normalized === lookup) {
                return composeCostumePath(profile.baseFolder, entry.folder);
            }
        }
    }

    return "";
}
