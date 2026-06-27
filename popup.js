const statusLabel  = document.getElementById("statusLabel");
const toggleBtn    = document.getElementById("toggleBtn");
const allowedInput = document.getElementById("allowedChars");
const saveBtn      = document.getElementById("saveBtn");
const resetBtn     = document.getElementById("resetBtn");
const saveStatus   = document.getElementById("saveStatus");

const DEFAULT_ALLOWED_CHARS = "àçèéêëôïîùûüÀÇÈÉÊËÎÏÔÙÛÜ€$©";

// Render UI based on current enabled state
function render(enabled) {
    statusLabel.textContent = enabled ? "On" : "Off";
    toggleBtn.textContent   = enabled ? "Turn off" : "Turn on";
    toggleBtn.className     = enabled ? "is-on" : "is-off";
}

function flashSaveStatus(text) {
    saveStatus.textContent = text;
    setTimeout(() => { saveStatus.textContent = ""; }, 1500);
}

// Load stored state (default: enabled)
chrome.storage.sync.get({ enabled: true }, ({ enabled }) => render(enabled));

chrome.storage.sync.get({ allowedChars: DEFAULT_ALLOWED_CHARS }, ({ allowedChars }) => {
    allowedInput.value = allowedChars;
});

toggleBtn.addEventListener("click", () => {
    chrome.storage.sync.get({ enabled: true }, ({ enabled }) => {
        const next = !enabled;
        chrome.storage.sync.set({ enabled: next }, () => render(next));
    });
});

saveBtn.addEventListener("click", () => {
    chrome.storage.sync.set({ allowedChars: allowedInput.value }, () => {
        flashSaveStatus("Saved");
    });
});

resetBtn.addEventListener("click", () => {
    allowedInput.value = DEFAULT_ALLOWED_CHARS;
    chrome.storage.sync.set({ allowedChars: DEFAULT_ALLOWED_CHARS }, () => {
        flashSaveStatus("Reset to default");
    });
});
