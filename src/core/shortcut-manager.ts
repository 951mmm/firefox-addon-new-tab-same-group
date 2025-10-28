export class ShortcutManager {
  static commands = {
    OPEN_STANDARD_NEW_TAB: "open-standard-new-tab",
    OPEN_STANDARD_TAB_IN_NEW_GROUP: "open-standard-tab-in-new-group",
    OPEN_SIDEBAR: "open-sidebar",
    CANCEL_PENDING_GROUPING: "cancel-pending-grouping"
  };
  #keyMap = new Map<string, string>();
  #isSet = false;
  #isEnabled = false;

  constructor() {
    this.init();
  }

  // 初始化快捷键映射
  async init() {
    await this.readUserShortcuts();
    this.setupCommandListener();
  }

  // 读取用户自定义快捷键
  async readUserShortcuts() {
    const allCommands = await browser.commands.getAll();
    Object
      .values(ShortcutManager.commands)
      .forEach(val => {
        const cmdFound = allCommands.find(c => c.name === val);
        if (cmdFound?.shortcut) this.#keyMap.set(val, cmdFound.shortcut)
      })
  }

  // 启用快捷键
  async enable() {
    if (this.#isEnabled) return;
    if (!this.#isSet) await this.readUserShortcuts();

    for (const [name, shortcut] of this.#keyMap) {
      await browser.commands.update({ name, shortcut });
    }
    this.#isEnabled = true;
  }

  // 禁用快捷键
  async disable() {
    if (!this.#isEnabled) return;

    for (const name of this.#keyMap.keys()) {
      await browser.commands.update({ name, shortcut: "" });
    }
    this.#isEnabled = false;
  }

  // 注册快捷键命令监听
  setupCommandListener() {
    browser.commands.onCommand.addListener((cmd) => {
      this.onCommand(cmd);
    });
  }

  // 命令处理回调（由外部注册）
  onCommand = (cmd: String) => {
    console.error("empty command callback", cmd)
  };
}
