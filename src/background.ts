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
  #lastCommand = new String()
  #groupConfig: GroupConfig | undefined

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
    this.#bindBrowserEvents();
    this.#setupInstallListener();
    this.#bindExtensionEvents();
  }

  #bindBrowserEvents() {
    browser.tabs.onCreated.addListener(this.#handleTabCreated);
    this.#shortcutManager.onCommand = (cmd) => {
      this.#lastCommand = cmd
      switch (cmd) {
        case ShortcutManager.commands.OPEN_STANDARD_NEW_TAB:
          browser.tabs.create({});
          break;
        case ShortcutManager.commands.OPEN_STANDARD_TAB_IN_NEW_GROUP:
          browser.tabs.create({});
          this.#groupConfig = undefined;
          break;
        case ShortcutManager.commands.OPEN_SIDEBAR:
          browser.sidebarAction.open()
          break;
        case ShortcutManager.commands.CANCEL_PENDING_GROUPING:
          this.#groupTaskManager.cancelAll();
          break;
        default:
          break;
      }
    };
  }

  #handleTabCreated = (newTab: Tab) => {
    const { enableGroupTab } = this.#configManager.getConfig();
    if (!enableGroupTab) return;
    switch (this.#lastCommand) {
      case ShortcutManager.commands.OPEN_STANDARD_NEW_TAB: {
        console.debug(`open new tab [${newTab.id}] on standard way`);
        break;
      }
      case ShortcutManager.commands.OPEN_STANDARD_TAB_IN_NEW_GROUP:
      case ShortcutManager.commands.OPEN_SIDEBAR: {
        console.debug(`open new tab [${newTab.id}] on standard way, and in a new group`);
        this.#groupHandler.addToNewGroup(newTab, this.#groupConfig)
        // 不走调度，走nm
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
  #setupInstallListener() {
    browser.runtime.onInstalled.addListener(({ reason }) => {
      console.log("extension update:", reason);
    });
  }

  #bindExtensionEvents() {
    browser.runtime.onMessage.addListener((msg: Message) => {
      switch (msg.header) {
        case "build-group": {
          this.#groupConfig = msg.payload;
          browser.tabs.create({})
          break;
        }
        // open the sidebar by btn will fire the msg
        case "sidebar-open": {
          this.#lastCommand = ShortcutManager.commands.OPEN_SIDEBAR;
          break;
        }
      }
    })
  }
}

// 启动插件
new Background();