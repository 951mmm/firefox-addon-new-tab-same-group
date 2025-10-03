// ──────────────────────────────────────────────────────────────
// New Tab Same Group  •  v1.6.4   (13 Jun 2025)
//   – Snapshot + history-fallback algorithm (bullet-proof)
//   – Cancel shortcut Ctrl+` / Alt+` (active only 1 s)
// ──────────────────────────────────────────────────────────────

/* === Preferences ============================================ */
let enabled = true;
let placement = 'after';     // after | first | last
let enableDelay = false;     // 1-second window
const DELAY_MS = 1000;

browser.storage.sync.get(
  { enableGroupTab: true, placementMode: 'after', enableDelayGrouping: false },
  p => { enabled = p.enableGroupTab; placement = p.placementMode; enableDelay = p.enableDelayGrouping; }
);
browser.storage.onChanged.addListener(ch => {
  if (ch.enableGroupTab) enabled = ch.enableGroupTab.newValue;
  if (ch.placementMode) placement = ch.placementMode.newValue;
  if (ch.enableDelayGrouping) enableDelay = ch.enableDelayGrouping.newValue;
});

// shortcut key
const OPEN_STANDARD_NEW_TAB = 'open-standard-new-tab'
const CANCEL_PENDING_GROUPING = 'cancel-pending-grouping';
const shortcutKeyMap = new Map([
  [OPEN_STANDARD_NEW_TAB, "ALt+`"],
  [CANCEL_PENDING_GROUPING, "Ctrl+`"]
])
let isSetShortcutKeyMap = false
let isShortcutEnable = false
let captureOpenStandardNewTab = false
/* === Dynamic cancel shortcut ================================ */

async function readUserShortcut() {
  const all = await browser.commands.getAll();
  shortcutKeyMap.forEach((_, shortcutKey) => {
    const command = all.find(cmd => cmd.name == shortcutKey);
    if (command && command.shortcut) {
      shortcutKeyMap.set(shortcutKey, command.shortcut)
    }
  })
  isSetShortcutKeyMap = true
}
async function defaultShortcut() {
  const { os } = await browser.runtime.getPlatformInfo();
  return os === 'mac' ? 'Alt+`' : 'Ctrl+`';
}
async function enableShortcut() {
  if (!isShortcutEnable) {
    if (!isSetShortcutKeyMap) await readUserShortcut();
    const updates = Array.from(shortcutKeyMap.entries()).map(([commandName, shortcut]) => ({
      name: commandName,
      shortcut: shortcut
    }));
    // Execute all updates sequentially
    for (const update of updates) {
      await browser.commands.update(update);
    }
    isShortcutEnable = true;
  }
}
async function disableShortcut() {
  if (isShortcutEnable) {
    for (const commandName of shortcutKeyMap.keys()) {
      await browser.commands.update({
        name: commandName,
        shortcut: ''
      })
    }
    isShortcutEnable = false
  }
}

/* === Track active & previous (history) ====================== */
let lastActiveTab = null;                     // snapshot via refresh
const activeHist = new Map();                // windowId → [current, previous]

refreshSnapshot();
setInterval(refreshSnapshot, 5000);

function refreshSnapshot() {
  browser.tabs.query({ active: true, lastFocusedWindow: true })
    .then(t => { if (t[0]) lastActiveTab = t[0]; })
    .catch(() => { });
}
browser.tabs.onActivated.addListener(({ tabId, windowId }) => {
  browser.tabs.get(tabId).then(tab => {
    const arr = activeHist.get(windowId) || [];
    if (arr[0] && arr[0].id !== tab.id) arr.unshift(tab); else arr[0] = tab;
    activeHist.set(windowId, arr.slice(0, 2));
    lastActiveTab = tab;
  }).catch(() => { });
});
browser.windows.onFocusChanged.addListener(refreshSnapshot);

/* === Shortcut  =============================== */
const pending = new Map();                    // tabId → timer
browser.commands.onCommand.addListener(cmd => {
  if (cmd === CANCEL_PENDING_GROUPING) cancelAll()
  else if (cmd === OPEN_STANDARD_NEW_TAB) {
    console.debug("open standard new tab")
    captureOpenStandardNewTab = true
    browser.tabs.create({})
  }
});

function cancelAll() {
  for (const t of pending.values()) clearTimeout(t);
  pending.clear(); disableShortcut();
}

/* === Main onCreated handler ================================ */
browser.tabs.onCreated.addListener(async newTab => {
  if (!enabled) return;

  // 0) check if open on a standard way
  if (captureOpenStandardNewTab) {
    console.debug("subscribe create a new standard tab")
    captureOpenStandardNewTab = false
    return
  }

  // 1) snapshot source
  let source = lastActiveTab;

  // 2) fallback if snapshot is self or missing
  if (newTab.active && source && source.id === newTab.id) source = null;
  if (!source) {
    const hist = (activeHist.get(newTab.windowId) || []);
    source = newTab.active ? hist[1] : hist[0];
  }
  if (!source) return;   // still nothing → abort

  // 3) delay or immediate
  if (enableDelay) {
    await enableShortcut();
    const timer = setTimeout(() => {
      pending.delete(newTab.id);
      if (!pending.size) disableShortcut();
      groupTab(newTab, source);
    }, DELAY_MS);
    pending.set(newTab.id, timer);
  } else {
    groupTab(newTab, source);
  }
});

browser.tabs.onRemoved.addListener(id => {
  if (pending.has(id)) {
    clearTimeout(pending.get(id));
    pending.delete(id);
    if (!pending.size) disableShortcut();
  }
});

/* === Group helper =========================================== */
async function groupTab(newTab, src) {
  try {
    if (!src || src.groupId === -1 || newTab.windowId !== src.windowId) return;

    await browser.tabs.group({ groupId: src.groupId, tabIds: [newTab.id] });

    let idx = src.index + 1, move = placement !== 'last';

    if (placement === 'first') {
      const g = await browser.tabs.query({ groupId: src.groupId, windowId: src.windowId });
      const others = g.filter(t => t.id !== newTab.id).map(t => t.index);
      idx = others.length ? Math.min(...others) : 0;
    } else if (placement === 'last') { move = false; }

    if (move) {
      const all = await browser.tabs.query({ windowId: newTab.windowId });
      idx = Math.max(0, Math.min(idx, all.length));
      await browser.tabs.move(newTab.id, { index: idx });
    }
  } catch (e) { console.warn('Grouping error', e.message); }
}

/* === Install/update log ===================================== */
browser.runtime.onInstalled.addListener(({ reason }) =>
  console.log('New Tab Same Group updated:', reason)
);
