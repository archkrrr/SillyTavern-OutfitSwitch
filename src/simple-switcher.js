export const defaultSettings = {
    enabled: false,
    characterName: "",
    defaultCostume: "",
    triggers: [],
};

function cloneTriggers(triggers) {
    if (!Array.isArray(triggers)) {
        return [];
    }
    return triggers.map((entry) => normalizeTriggerEntry(entry));
}

export function normalizeTriggerEntry(entry = {}) {
    const trigger = typeof entry.trigger === "string" ? entry.trigger.trim() : "";
    const costume = typeof entry.costume === "string" ? entry.costume.trim() : "";
    return { trigger, costume };
}

export function ensureSettingsShape(raw = {}) {
    const enabled = Boolean(raw.enabled);
    const characterName = typeof raw.characterName === "string" ? raw.characterName.trim() : "";
    const defaultCostume = typeof raw.defaultCostume === "string" ? raw.defaultCostume.trim() : "";
    const triggers = cloneTriggers(raw.triggers);

    return { enabled, characterName, defaultCostume, triggers };
}

export function normalizeCostumeFolder(rawFolder) {
    if (!rawFolder) {
        return "";
    }
    let folder = String(rawFolder).trim();
    folder = folder.replace(/^\\+/, "");
    folder = folder.replace(/^\/+/, "");
    return folder;
}

export function findCostumeForTrigger(settings, key) {
    if (!settings || !Array.isArray(settings.triggers)) {
        return "";
    }

    const lookup = String(key ?? "").trim().toLowerCase();
    if (!lookup) {
        return "";
    }

    for (const entry of settings.triggers) {
        const normalized = String(entry?.trigger ?? "").trim().toLowerCase();
        if (normalized && normalized === lookup) {
            return String(entry.costume ?? "").trim();
        }
    }

    return "";
}
