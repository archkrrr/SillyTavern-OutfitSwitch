import { extension_settings } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";
import { executeSlashCommandsOnChatInput, registerSlashCommand } from "../../../slash-commands.js";
import {
    defaultSettings,
    ensureSettingsShape,
    findCostumeForTrigger,
    composeCostumePath,
    normalizeCostumeFolder,
    normalizeTriggerEntry,
    normalizeVariantEntry,
} from "./src/simple-switcher.js";
import { getOutfitSlashCommandConfig } from "./src/verbs.js";

const extensionName = "SillyTavern-CostumeSwitch";
const logPrefix = "[CostumeSwitch]";

let settings = ensureSettingsShape(extension_settings[extensionName] || defaultSettings);
let statusTimer = null;
let settingsPanelPromise = null;

extension_settings[extensionName] = settings;

function getActiveProfile() {
    if (!settings.profile || typeof settings.profile !== "object") {
        settings.profile = ensureSettingsShape().profile;
    }
    return settings.profile;
}

function cloneSettings(value) {
    if (typeof structuredClone === "function") {
        return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
}

function persistSettings(reason = "update") {
    settings = ensureSettingsShape(settings);
    extension_settings[extensionName] = cloneSettings(settings);
    try {
        saveSettingsDebounced?.(reason);
    } catch (err) {
        console.error(`${logPrefix} Failed to save settings`, err);
    }
}

function getElement(selector) {
    return document.querySelector(selector);
}

function getSettingsContainer() {
    return document.querySelector("#extensions_settings");
}

async function ensureSettingsPanel() {
    if (document.getElementById("costume-switcher-settings")) {
        return;
    }

    if (!settingsPanelPromise) {
        settingsPanelPromise = (async () => {
            const container = getSettingsContainer();
            if (!container) {
                throw new Error("Unable to locate the SillyTavern extensions container.");
            }

            const settingsUrl = new URL("./settings.html", import.meta.url);
            const response = await fetch(settingsUrl);
            if (!response.ok) {
                throw new Error(`Failed to load settings markup (${response.status})`);
            }

            const markup = await response.text();
            const template = document.createElement("template");
            template.innerHTML = markup.trim();
            const panel = template.content.firstElementChild;

            if (!panel) {
                throw new Error("Settings markup did not contain a root element.");
            }

            container.appendChild(panel);
        })().catch((error) => {
            console.error(`${logPrefix} Failed to inject settings panel`, error);
            settingsPanelPromise = null;
        });
    }

    return settingsPanelPromise;
}

function showStatus(message, type = "info", duration = 2500) {
    const statusEl = getElement("#cs-status");
    const textEl = getElement("#cs-status-text");
    if (!statusEl || !textEl) {
        console.log(`${logPrefix} ${message}`);
        return;
    }

    statusEl.dataset.type = type;
    textEl.innerHTML = message;

    statusEl.classList.add("is-visible");
    if (statusTimer) {
        clearTimeout(statusTimer);
    }
    statusTimer = setTimeout(() => {
        statusEl.classList.remove("is-visible");
        textEl.textContent = "Ready";
        statusTimer = null;
    }, Math.max(duration, 1000));
}

async function issueCostume(folder, { source = "ui" } = {}) {
    const normalized = normalizeCostumeFolder(folder);
    if (!normalized) {
        const message = "Provide an outfit folder for the focus character.";
        if (source === "slash") {
            return message;
        }
        showStatus(message, "error");
        return message;
    }

    try {
        await executeSlashCommandsOnChatInput(`/costume \\${normalized}`);
        const successMessage = `Updated the focus character's outfit to <b>${escapeHtml(normalized)}</b>.`;
        if (source === "slash") {
            return successMessage;
        }
        showStatus(successMessage, "success");
        return successMessage;
    } catch (err) {
        console.error(`${logPrefix} Failed to execute /costume for "${normalized}"`, err);
        const failureMessage = `Failed to update the focus character's outfit to <b>${escapeHtml(normalized)}</b>.`;
        if (source === "slash") {
            return failureMessage;
        }
        showStatus(failureMessage, "error", 4000);
        return failureMessage;
    }
}

function escapeHtml(str) {
    const p = document.createElement("p");
    p.textContent = str;
    return p.innerHTML;
}

function extractDirectoryFromFileList(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) {
        return "";
    }

    const file = files[0];
    if (file && typeof file.webkitRelativePath === "string" && file.webkitRelativePath) {
        const segments = file.webkitRelativePath.split("/");
        if (segments.length > 1) {
            segments.pop();
            return segments.join("/");
        }
        return file.webkitRelativePath;
    }

    if (file && typeof file.name === "string") {
        return file.name;
    }

    return "";
}

function deriveRelativeFolder(folderPath) {
    const normalized = normalizeCostumeFolder(folderPath);
    if (!normalized) {
        return "";
    }

    const base = normalizeCostumeFolder(getActiveProfile().baseFolder);
    if (!base) {
        return normalized;
    }

    const normalizedLower = normalized.toLowerCase();
    const baseLower = base.toLowerCase();

    if (normalizedLower === baseLower) {
        return "";
    }

    if (normalizedLower.startsWith(`${baseLower}/`)) {
        return normalized.slice(base.length + 1);
    }

    if (normalizedLower.startsWith(baseLower)) {
        return normalized.slice(base.length).replace(/^\/+/, "");
    }

    return normalized;
}

function attachFolderPicker(button, targetInput, { mode = "absolute" } = {}) {
    if (!button || !targetInput) {
        return;
    }

    if (button.dataset.hasFolderPicker === "true") {
        return;
    }

    const picker = document.createElement("input");
    picker.type = "file";
    picker.hidden = true;
    picker.multiple = true;
    picker.setAttribute("webkitdirectory", "true");
    picker.setAttribute("directory", "true");

    button.insertAdjacentElement("afterend", picker);
    button.dataset.hasFolderPicker = "true";

    button.addEventListener("click", () => {
        picker.click();
    });

    picker.addEventListener("change", () => {
        const folderPath = extractDirectoryFromFileList(picker.files);
        if (!folderPath) {
            picker.value = "";
            return;
        }

        const value = mode === "relative" ? deriveRelativeFolder(folderPath) : normalizeCostumeFolder(folderPath);
        targetInput.value = value;
        targetInput.dispatchEvent(new Event("input", { bubbles: true }));
        picker.value = "";
    });
}

function handleEnableToggle(event) {
    settings.enabled = Boolean(event.target.checked);
    persistSettings("enabled");
    showStatus(settings.enabled ? "Outfit switching enabled." : "Outfit switching disabled.", "info");
}

function addTriggerRow(trigger = { trigger: "", folder: "" }) {
    const profile = getActiveProfile();
    profile.triggers.push(normalizeTriggerEntry(trigger));
    persistSettings("triggers");
    renderTriggers();
}

function removeTriggerRow(index) {
    const profile = getActiveProfile();
    profile.triggers.splice(index, 1);
    persistSettings("triggers");
    renderTriggers();
}

function parseTriggerTextareaValue(value) {
    if (typeof value !== "string" || !value.trim()) {
        return [];
    }

    const results = [];
    value
        .split(/\r?\n|,/)
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((part) => {
            if (!results.includes(part)) {
                results.push(part);
            }
        });

    return results;
}

function bindTriggerInputs(row, index) {
    const triggerInput = row.querySelector(".cs-trigger-input");
    const folderInput = row.querySelector(".cs-folder-input");
    const runButton = row.querySelector(".cs-trigger-run");
    const deleteButton = row.querySelector(".cs-trigger-delete");
    const folderButton = row.querySelector(".cs-trigger-folder-select");

    const profile = getActiveProfile();
    const triggerList = Array.isArray(profile.triggers[index].triggers) && profile.triggers[index].triggers.length
        ? profile.triggers[index].triggers
        : (profile.triggers[index].trigger ? [profile.triggers[index].trigger] : []);
    triggerInput.value = triggerList.join("\n");
    folderInput.value = profile.triggers[index].folder;

    triggerInput.addEventListener("input", (event) => {
        const activeProfile = getActiveProfile();
        const triggers = parseTriggerTextareaValue(event.target.value);
        activeProfile.triggers[index].triggers = triggers;
        activeProfile.triggers[index].trigger = triggers[0] || "";
        persistSettings("triggers");
    });

    folderInput.addEventListener("input", (event) => {
        const activeProfile = getActiveProfile();
        activeProfile.triggers[index].folder = event.target.value;
        persistSettings("triggers");
    });

    runButton.addEventListener("click", async () => {
        if (!settings.enabled) {
            showStatus("Enable Outfit Switcher to use triggers.", "error");
            return;
        }
        const activeProfile = getActiveProfile();
        const targetFolder = composeCostumePath(activeProfile.baseFolder, activeProfile.triggers[index].folder);
        const result = await issueCostume(targetFolder, { source: "ui" });
        if (result.toLowerCase().startsWith("please provide")) {
            showStatus("Enter an outfit folder before running the trigger.", "error");
        }
    });

    deleteButton.addEventListener("click", () => {
        removeTriggerRow(index);
    });

    attachFolderPicker(folderButton, folderInput, { mode: "relative" });
}

function renderTriggers() {
    const tbody = getElement("#cs-trigger-table-body");
    if (!tbody) {
        return;
    }

    tbody.innerHTML = "";
    const profile = getActiveProfile();

    profile.triggers.forEach((trigger, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td class="cs-trigger-column cs-trigger-column-triggers">
                <textarea class="text_pole cs-trigger-input" rows="2" placeholder="One trigger per line"></textarea>
                <small class="cs-trigger-helper">Matches case-insensitive triggers just like the full Costume Switcher.</small>
            </td>
            <td class="cs-trigger-column cs-trigger-column-folder">
                <div class="cs-folder-picker">
                    <input type="text" class="text_pole cs-folder-input" placeholder="Variant folder" />
                    <button type="button" class="menu_button interactable cs-button-ghost cs-folder-button cs-trigger-folder-select">
                        <i class="fa-solid fa-folder-open"></i>
                        <span>Pick Folder</span>
                    </button>
                </div>
            </td>
            <td class="cs-trigger-actions">
                <button type="button" class="menu_button interactable cs-trigger-run">Run</button>
                <button type="button" class="menu_button interactable cs-trigger-delete">Remove</button>
            </td>
        `;
        tbody.appendChild(row);
        bindTriggerInputs(row, index);
    });

    if (!profile.triggers.length) {
        const emptyRow = document.createElement("tr");
        emptyRow.innerHTML = `<td colspan="3" class="cs-empty">No triggers yet. Add one below.</td>`;
        tbody.appendChild(emptyRow);
    }
}

function addVariant(variant = { name: "", folder: "" }) {
    const profile = getActiveProfile();
    profile.variants.push(normalizeVariantEntry(variant));
    persistSettings("variants");
    renderVariants();
    renderTriggers();
}

function removeVariant(index) {
    const profile = getActiveProfile();
    profile.variants.splice(index, 1);
    persistSettings("variants");
    renderVariants();
    renderTriggers();
}

function bindVariantInputs(row, index) {
    const nameInput = row.querySelector(".cs-variant-name");
    const folderInput = row.querySelector(".cs-variant-folder");
    const runButton = row.querySelector(".cs-variant-run");
    const deleteButton = row.querySelector(".cs-variant-delete");
    const folderButton = row.querySelector(".cs-variant-folder-select");

    const profile = getActiveProfile();
    nameInput.value = profile.variants[index].name;
    folderInput.value = profile.variants[index].folder;

    nameInput.addEventListener("input", (event) => {
        const activeProfile = getActiveProfile();
        activeProfile.variants[index].name = event.target.value;
        persistSettings("variants");
    });

    folderInput.addEventListener("input", (event) => {
        const activeProfile = getActiveProfile();
        activeProfile.variants[index].folder = event.target.value;
        persistSettings("variants");
    });

    runButton.addEventListener("click", async () => {
        if (!settings.enabled) {
            showStatus("Enable Outfit Switcher to use variants.", "error");
            return;
        }
        const activeProfile = getActiveProfile();
        const targetFolder = composeCostumePath(activeProfile.baseFolder, activeProfile.variants[index].folder);
        const result = await issueCostume(targetFolder, { source: "ui" });
        if (result.toLowerCase().startsWith("please provide")) {
            showStatus("Set the base folder or variant folder before running.", "error");
        }
    });

    deleteButton.addEventListener("click", () => {
        removeVariant(index);
    });

    attachFolderPicker(folderButton, folderInput, { mode: "relative" });
}

function renderVariants() {
    const tbody = getElement("#cs-variant-table-body");
    if (!tbody) {
        return;
    }

    tbody.innerHTML = "";
    const profile = getActiveProfile();

    profile.variants.forEach((variant, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td><input type="text" class="text_pole cs-variant-name" placeholder="Variant name" /></td>
            <td>
                <div class="cs-folder-picker">
                    <input type="text" class="text_pole cs-variant-folder" placeholder="Subfolder" />
                    <button type="button" class="menu_button interactable cs-button-ghost cs-folder-button cs-variant-folder-select">
                        <i class="fa-solid fa-folder-open"></i>
                        <span>Pick Folder</span>
                    </button>
                </div>
            </td>
            <td class="cs-variant-actions">
                <button type="button" class="menu_button interactable cs-variant-run">Run</button>
                <button type="button" class="menu_button interactable cs-variant-delete">Remove</button>
            </td>
        `;
        tbody.appendChild(row);
        bindVariantInputs(row, index);
    });

    if (!profile.variants.length) {
        const emptyRow = document.createElement("tr");
        emptyRow.innerHTML = `<td colspan="3" class="cs-empty">No variants configured. Add one below.</td>`;
        tbody.appendChild(emptyRow);
    }
}

function handleBaseFolderInput(event) {
    const profile = getActiveProfile();
    profile.baseFolder = event.target.value.trim();
    persistSettings("baseFolder");
}

async function runTriggerByName(triggerName, source = "slash") {
    if (!settings.enabled) {
        const disabledMessage = "Outfit Switcher is disabled for the focus character.";
        if (source === "slash") {
            return disabledMessage;
        }
        showStatus(disabledMessage, "error");
        return disabledMessage;
    }

    const costume = findCostumeForTrigger(settings, triggerName);
    if (!costume) {
        const unknownMessage = `No outfit trigger named "${escapeHtml(triggerName || "")}".`;
        if (source === "slash") {
            return unknownMessage;
        }
        showStatus(unknownMessage, "error");
        return unknownMessage;
    }

    return issueCostume(costume, { source });
}

function bindUI() {
    const enableCheckbox = getElement("#cs-enable");
    const baseFolderInput = getElement("#cs-base-folder");
    const baseFolderButton = getElement("#cs-base-folder-select");
    const addVariantButton = getElement("#cs-add-variant");
    const addTriggerButton = getElement("#cs-add-trigger");
    const runBaseButton = getElement("#cs-run-base");

    if (enableCheckbox) {
        enableCheckbox.checked = settings.enabled;
        enableCheckbox.addEventListener("change", handleEnableToggle);
    }

    if (baseFolderInput) {
        const profile = getActiveProfile();
        baseFolderInput.value = profile.baseFolder;
        baseFolderInput.addEventListener("input", handleBaseFolderInput);
    }

    attachFolderPicker(baseFolderButton, baseFolderInput, { mode: "absolute" });

    if (addVariantButton) {
        addVariantButton.addEventListener("click", () => addVariant());
    }

    if (addTriggerButton) {
        addTriggerButton.addEventListener("click", () => addTriggerRow());
    }

    if (runBaseButton) {
        runBaseButton.addEventListener("click", async () => {
            if (!settings.enabled) {
                showStatus("Enable Outfit Switcher to run the base folder.", "error");
                return;
            }
            const profile = getActiveProfile();
            if (!profile.baseFolder) {
                showStatus("Set a base folder before running it.", "error");
                return;
            }
            await issueCostume(profile.baseFolder, { source: "ui" });
        });
    }

    renderVariants();
    renderTriggers();
}

function initSlashCommand() {
    const slashConfig = getOutfitSlashCommandConfig();

    registerSlashCommand(
        slashConfig.name,
        async (args) => {
            const triggerText = Array.isArray(args) ? args.join(" ") : String(args ?? "");
            return runTriggerByName(triggerText, "slash");
        },
        slashConfig.args,
        slashConfig.description,
        false,
    );
}

async function init() {
    settings = ensureSettingsShape(extension_settings[extensionName] || defaultSettings);
    extension_settings[extensionName] = settings;

    await ensureSettingsPanel();
    bindUI();
    showStatus("Ready", "info");
}

initSlashCommand();

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        init();
    });
} else {
    init();
}
