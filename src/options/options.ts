/* === Helpers ================================================== */
const $ = (s: string) => document.querySelector(s);
const $$ = (s: string) => document.querySelectorAll(s);

/* === Elements ================================================= */
const enableGroupTab = $("#enableGroupTab") as HTMLInputElement;
const placementCard = $("#placementCard") as HTMLElement;
const placementRadios = $$("input[name=\"placement\"]") as NodeListOf<HTMLInputElement>;

const enableStdShort = $("#enableStandardShortcut") as HTMLInputElement;
const enableDelay = $("#enableDelay") as HTMLInputElement;

/* === Load prefs ============================================== */
chrome.storage.sync.get(
  {
    enableGroupTab: true, placementMode: "after",
    enableStandardTabShortcut: true, enableDelayGrouping: false
  },
  p => {
    enableGroupTab.checked = p.enableGroupTab;
    togglePlacement(p.enableGroupTab);
    placementRadios.forEach(r => r.checked = (r.value === p.placementMode));
    enableStdShort.checked = p.enableStandardTabShortcut;
    enableDelay.checked = p.enableDelayGrouping;
  }
);

/* === Save handlers =========================================== */
enableGroupTab.addEventListener("change", () => {
  chrome.storage.sync.set({ enableGroupTab: enableGroupTab.checked });
  togglePlacement(enableGroupTab.checked);
});
placementRadios.forEach(r =>
  r.addEventListener("change", () => {
    if (r.checked) chrome.storage.sync.set({ placementMode: r.value });
  })
);
enableStdShort.addEventListener("change", () =>
  chrome.storage.sync.set({ enableStandardTabShortcut: enableStdShort.checked })
);
enableDelay.addEventListener("change", () =>
  chrome.storage.sync.set({ enableDelayGrouping: enableDelay.checked })
);

/* === Shortcut settings links ================================= */
$$(".editShortcut").forEach(link =>
  link.addEventListener("click", e => {
    e.preventDefault();
    if (browser.commands?.openShortcutSettings) browser.commands.openShortcutSettings();
    else browser.tabs.create({ url: "about:addons" });
  })
);

/* === UI helper =============================================== */
function togglePlacement(state: boolean) {
  placementCard.classList.toggle("disabled", !state);
  placementRadios.forEach(r => r.disabled = !state);
}
