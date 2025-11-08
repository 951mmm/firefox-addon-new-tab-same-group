export class TabStateTracker {
  #lastActiveTab: Tab | null = null
  #activeHist = new Map()

  constructor() {
    this.startSnapshotRefresh()
    this.setupListeners()
  }

  // 启动快照刷新定时器
  startSnapshotRefresh() {
    this.refreshSnapshot()
    setInterval(() => this.refreshSnapshot(), 1000)
  }

  // 刷新当前活跃标签快照
  async refreshSnapshot() {
    try {
      const tabs = await browser.tabs.query({ active: true, lastFocusedWindow: true })
      if (tabs[0]) this.#lastActiveTab = tabs[0]
    } catch (e: any) {
      console.warn("failed to refresh", e)
    }
  }

  // 设置事件监听
  setupListeners() {
    browser.tabs.onActivated.addListener(({ tabId, windowId }) =>
      this.handleTabActivated(tabId, windowId)
    )
    browser.windows.onFocusChanged.addListener(() => this.refreshSnapshot())
  }

  // 处理标签激活事件
  async handleTabActivated(tabId: number, windowId: number) {
    try {
      const tab = await browser.tabs.get(tabId)
      const history = this.#activeHist.get(windowId) || []

      // 保留最近2条历史
      if (history[0]?.id !== tab.id) history.unshift(tab)
      else history[0] = tab

      this.#activeHist.set(windowId, history.slice(0, 2))
      this.#lastActiveTab = tab
    } catch (e: any) {
      console.warn("failed to handle active tab", e)
    }
  }

  getLastActiveTab(newTab: Tab) {
    let source = this.#lastActiveTab

    // 处理快照异常（源标签为新标签自身）
    if (newTab.active && source?.id === newTab.id) source = null

    // 从历史记录 fallback
    if (!source) {
      const history = this.#activeHist.get(newTab.windowId) || []
      source = newTab.active ? history[1] : history[0]
    }

    return source
  }
}
