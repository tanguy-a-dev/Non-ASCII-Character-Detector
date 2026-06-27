const statusLabel = document.getElementById("statusLabel");
const toggleBtn   = document.getElementById("toggleBtn");

// Render UI based on current enabled state
function render(enabled) {
    statusLabel.textContent = enabled ? "On" : "Off";
    toggleBtn.textContent   = enabled ? "Turn off" : "Turn on";
    toggleBtn.className     = enabled ? "is-on" : "is-off";
}

// Load stored state (default: enabled)
chrome.storage.sync.get({ enabled: true }, ({ enabled }) => render(enabled));

toggleBtn.addEventListener("click", () => {
    chrome.storage.sync.get({ enabled: true }, ({ enabled }) => {
        const next = !enabled;
        chrome.storage.sync.set({ enabled: next }, () => render(next));
    });
}); 