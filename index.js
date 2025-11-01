import { extension_settings } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";
import { executeSlashCommandsOnChatInput, registerSlashCommand } from "../../../slash-commands.js";
import {
    defaultSettings,
    ensureSettingsShape,
    findCostumeForTrigger,
    normalizeCostumeFolder,
    normalizeTriggerEntry,
} from "./src/simple-switcher.js";

const extensionName = "SillyTavern-CostumeSwitch";
const logPrefix = "[CostumeSwitch]";

let settings = ensureSettingsShape(extension_settings[extensionName] || defaultSettings);
let statusTimer = null;

extension_settings[extensionName] = settings;

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
        const message = "Please provide an outfit folder.";
        if (source === "slash") {
            return message;
        }
        showStatus(message, "error");
        return message;
    }

    try {
        await executeSlashCommandsOnChatInput(`/costume \\${normalized}`);
        const successMessage = `Switched to <b>${escapeHtml(normalized)}</b>.`;
        if (source === "slash") {
            return successMessage;
        }
        showStatus(successMessage, "success");
        return successMessage;
    } catch (err) {
        console.error(`${logPrefix} Failed to execute /costume for "${normalized}"`, err);
        const failureMessage = `Failed to switch to <b>${escapeHtml(normalized)}</b>.`;
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

function handleEnableToggle(event) {
    settings.enabled = Boolean(event.target.checked);
    persistSettings("enabled");
    showStatus(settings.enabled ? "Outfit switching enabled." : "Outfit switching disabled.", "info");
}

function handleCharacterInput(event) {
    settings.characterName = event.target.value.trim();
    persistSettings("characterName");
}

function handleDefaultCostumeInput(event) {
    settings.defaultCostume = event.target.value.trim();
    persistSettings("defaultCostume");
}

function addTriggerRow(trigger = { trigger: "", costume: "" }) {
    settings.triggers.push(normalizeTriggerEntry(trigger));
    persistSettings("triggers");
    renderTriggers();
}

function removeTriggerRow(index) {
    settings.triggers.splice(index, 1);
    persistSettings("triggers");
    renderTriggers();
}

function bindTriggerInputs(row, index) {
    const triggerInput = row.querySelector(".cs-trigger-input");
    const costumeInput = row.querySelector(".cs-costume-input");
    const runButton = row.querySelector(".cs-trigger-run");
    const deleteButton = row.querySelector(".cs-trigger-delete");

    triggerInput.value = settings.triggers[index].trigger;
    costumeInput.value = settings.triggers[index].costume;

    triggerInput.addEventListener("input", (event) => {
        settings.triggers[index].trigger = event.target.value;
        persistSettings("triggers");
    });

    costumeInput.addEventListener("input", (event) => {
        settings.triggers[index].costume = event.target.value;
        persistSettings("triggers");
    });

    runButton.addEventListener("click", async () => {
        if (!settings.enabled) {
            showStatus("Enable Outfit Switcher to use triggers.", "error");
            return;
        }
        const result = await issueCostume(settings.triggers[index].costume, { source: "ui" });
        if (result.toLowerCase().startsWith("please provide")) {
            showStatus("Enter an outfit folder before running the trigger.", "error");
        }
    });

    deleteButton.addEventListener("click", () => {
        removeTriggerRow(index);
    });
}

function renderTriggers() {
    const tbody = getElement("#cs-trigger-table-body");
    if (!tbody) {
        return;
    }

    tbody.innerHTML = "";
    settings.triggers.forEach((trigger, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td><input type="text" class="text_pole cs-trigger-input" placeholder="Trigger" /></td>
            <td><input type="text" class="text_pole cs-costume-input" placeholder="Outfit folder" /></td>
            <td class="cs-trigger-actions">
                <button type="button" class="menu_button interactable cs-trigger-run">Run</button>
                <button type="button" class="menu_button interactable cs-trigger-delete">Remove</button>
            </td>
        `;
        tbody.appendChild(row);
        bindTriggerInputs(row, index);
    });

    if (!settings.triggers.length) {
        const emptyRow = document.createElement("tr");
        emptyRow.innerHTML = `<td colspan="3" class="cs-empty">No triggers yet. Add one below.</td>`;
        tbody.appendChild(emptyRow);
    }
}

async function runTriggerByName(triggerName, source = "slash") {
    if (!settings.enabled) {
        const disabledMessage = "Outfit Switcher is disabled.";
        if (source === "slash") {
            return disabledMessage;
        }
        showStatus(disabledMessage, "error");
        return disabledMessage;
    }

    const costume = findCostumeForTrigger(settings, triggerName);
    if (!costume) {
        const unknownMessage = `No outfit mapped for "${escapeHtml(triggerName || "")}".`;
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
    const characterInput = getElement("#cs-character");
    const defaultCostumeInput = getElement("#cs-default-costume");
    const addTriggerButton = getElement("#cs-add-trigger");
    const runDefaultButton = getElement("#cs-run-default");

    if (enableCheckbox) {
        enableCheckbox.checked = settings.enabled;
        enableCheckbox.addEventListener("change", handleEnableToggle);
    }

    if (characterInput) {
        characterInput.value = settings.characterName;
        characterInput.addEventListener("input", handleCharacterInput);
    }

    if (defaultCostumeInput) {
        defaultCostumeInput.value = settings.defaultCostume;
        defaultCostumeInput.addEventListener("input", handleDefaultCostumeInput);
    }

    if (addTriggerButton) {
        addTriggerButton.addEventListener("click", () => addTriggerRow());
    }

    if (runDefaultButton) {
        runDefaultButton.addEventListener("click", async () => {
            if (!settings.enabled) {
                showStatus("Enable Outfit Switcher to run the default outfit.", "error");
                return;
            }
            if (!settings.defaultCostume) {
                showStatus("Set a default outfit before running it.", "error");
                return;
            }
            await issueCostume(settings.defaultCostume, { source: "ui" });
        });
    }

    renderTriggers();
}

function initSlashCommand() {
    registerSlashCommand(
        "outfitswitch",
        async (args) => {
            const triggerText = Array.isArray(args) ? args.join(" ") : String(args ?? "");
            return runTriggerByName(triggerText, "slash");
        },
        ["trigger"],
        "Switch the configured character's outfit using a named trigger.",
        false,
    );
}

function init() {
    settings = ensureSettingsShape(extension_settings[extensionName] || defaultSettings);
    extension_settings[extensionName] = settings;

    bindUI();
    showStatus("Ready", "info");
}

initSlashCommand();

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
