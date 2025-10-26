export interface Config {
  enableGroupTab: boolean
  placementMode: "after" | "last" | "first"
  enableDelayGrouping: boolean,
  // todo configurable on options.html
  delayMS: number
}
export class ConfigManager {
  #defaults: Config = {
    enableGroupTab: true,
    placementMode: "after",
    enableDelayGrouping: false,
    delayMS: 1000
  };
  #config: Config = this.#defaults

  constructor() {
    this.setupListener();
  }

  // 监听配置变更
  setupListener() {
    browser.storage.onChanged.addListener((changes) => {
      if (changes.enableGroupTab) this.#config.enableGroupTab = changes.enableGroupTab.newValue;
      if (changes.placementMode) this.#config.placementMode = changes.placementMode.newValue;
      if (changes.enableDelayGrouping) this.#config.enableDelayGrouping = changes.enableDelayGrouping.newValue;
    });
  }

  // 获取配置
  getConfig() {
    return { ...this.#config }; // 返回副本避免外部修改
  }
}
