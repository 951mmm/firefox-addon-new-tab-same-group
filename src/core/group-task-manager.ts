import { ConfigManager } from "./config-manager";
import { GroupHandler } from "./group-handler";
import { ShortcutManager } from "./shortcut-manager";

// 非常小众的需求，谁没事取消创建标签页
export class GroupTaskManager {
  #pending: Map<number, number> = new Map(); // tabId → timer
  #shortcutManager;
  #configManager;
  #groupHandler;

  constructor(
    shortcutManager: ShortcutManager,
    configManager: ConfigManager, 
    groupHandler: GroupHandler) {
    this.#shortcutManager = shortcutManager;
    this.#configManager = configManager;
    this.#groupHandler = groupHandler;
    this.setupListeners();
  }

  // 设置标签移除监听
  setupListeners() {
    browser.tabs.onRemoved.addListener(this.handleTabRemoved);
  }

  /**
   * 处理新标签创建（发起分组任务）
   * 我说白了，我白说了，就是一个时间窗口的复杂写法
   */
  async scheduleAddToTabGroup(newTab: Tab, lastActiveTab: Tab) {
    const { enableDelayGrouping, delayMS } = this.#configManager.getConfig();

    if (enableDelayGrouping) {
      await this.#shortcutManager.enable();
      if (newTab.id != undefined && newTab.id != browser.tabs.TAB_ID_NONE) {
        const timer = setTimeout(() => {
          this.#pending.delete(newTab.id!)
          if (!this.#pending.size) this.#shortcutManager.disable();
          this.#groupHandler.addToTabGroup(newTab, lastActiveTab);
        }, delayMS);
        this.#pending.set(newTab.id, timer);
      }
    } else {
      this.#groupHandler.addToTabGroup(newTab, lastActiveTab);
    }
  }

  // 处理标签移除（清理任务）
  handleTabRemoved = (tabId: number) => {
    if (this.#pending.has(tabId)) {
      clearTimeout(this.#pending.get(tabId));
      this.#pending.delete(tabId);
      if (!this.#pending.size) this.#shortcutManager.disable();
    }
  }

  // 取消所有 pending 任务
  cancelAll() {
    this.#pending.forEach(timer => clearTimeout(timer));
    this.#pending.clear();
    this.#shortcutManager.disable();
  }
}
