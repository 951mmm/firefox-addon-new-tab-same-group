import { ConfigManager } from "./core/config-manager.js"
import { ShortcutManager } from "./core/shortcut-manager.js"
import { GroupHandler } from "./core/group-handler.js"
import { GroupTaskManager } from "./core/group-task-manager.js"
import { TabStateTracker } from "./core/tab-state-tracker.js"
class Background {
  #configManager;
  #tabStateTracker;
  #groupHandler;
  #groupTaskManager;
  #shortcutManager;
  #captureOpenStandardNewTab = false;
  #lastCommand = new String()

  constructor() {
    this.#configManager = new ConfigManager();
    this.#tabStateTracker = new TabStateTracker();
    this.#groupHandler = new GroupHandler(this.#configManager);
    this.#shortcutManager = new ShortcutManager()
    this.#groupTaskManager = new GroupTaskManager(
      this.#shortcutManager,
      this.#configManager,
      this.#groupHandler
    );

    this.bindEvents();
    this.setupInstallListener();
  }

  bindEvents() {
    browser.tabs.onCreated.addListener(this.handleTabCreated);

    this.#shortcutManager.onCommand = (cmd) => {
      this.#lastCommand = cmd
      switch (cmd) {
        case ShortcutManager.commands.OPEN_STANDARD_NEW_TAB:
        case ShortcutManager.commands.OPEN_STANDARD_TAB_IN_NEW_GROUP:
          browser.tabs.create({});
          break;
        case ShortcutManager.commands.CANCEL_PENDING_GROUPING:
          this.#groupTaskManager.cancelAll();
          break;
        default:
          break;
      }
    };
  }

  handleTabCreated = (newTab: Tab) => {
    const { enableGroupTab } = this.#configManager.getConfig();
    if (!enableGroupTab) return;

    switch (this.#lastCommand) {
      case ShortcutManager.commands.OPEN_STANDARD_NEW_TAB: {
        console.debug(`open new tab [${newTab.id}] on standard way`);
        break;
      }
      case ShortcutManager.commands.OPEN_STANDARD_TAB_IN_NEW_GROUP: {
        console.debug(`open new tab [${newTab.id}] on standard way, and in a new group`);
        // 不走调度，走nm
        this.#groupHandler.addToNewGroup(newTab);
        break;
      }
      default: {
        const lastActiveTab = this.#tabStateTracker.getLastActiveTab(newTab);
        if (lastActiveTab) this.#groupTaskManager.scheduleAddToTabGroup(newTab, lastActiveTab);
        break;
      }
    }
    this.#lastCommand = "";
  }

  // 安装/更新日志
  setupInstallListener() {
    browser.runtime.onInstalled.addListener(({ reason }) => {
      console.log("extension update:", reason);
    });
  }
}

// 启动插件
new Background();