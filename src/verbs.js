export const OUTFIT_ACTION_VERBS = Object.freeze(["switch", "change", "swap"]);

export function isOutfitActionVerb(value) {
    if (!value) {
        return false;
    }
    const lookup = String(value).trim().toLowerCase();
    return OUTFIT_ACTION_VERBS.includes(lookup);
}
