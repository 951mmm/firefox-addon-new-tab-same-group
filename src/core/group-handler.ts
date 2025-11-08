import { Config, ConfigManager } from "./config-manager"
export class GroupHandler {
  #configManager

  constructor(configManager: ConfigManager) {
    this.#configManager = configManager
  }

  async addToTabGroup(newTab: Tab, lastActiveTab: Tab) {
    try {
      const { placementMode } = this.#configManager.getConfig()

      if (newTab.windowId == undefined || lastActiveTab.windowId == undefined) return
      // 校验分组条件
      if (!lastActiveTab ||
        lastActiveTab.groupId === -1 ||
        newTab.windowId !== lastActiveTab.windowId) return
      if (newTab.id == undefined) return

      // 添加到源标签的分组
      await browser.tabs.group({ groupId: lastActiveTab.groupId, tabIds: [newTab.id] })

      await this.#handlePlacement(newTab, lastActiveTab, placementMode)
    } catch (e: any) {
      console.warn("bad group: ", e.message)
    }
  }

  async addToNewGroup(newTab: Tab, groupConfig: GroupConfig | undefined) {
    if (newTab.id === undefined) {
      return
    }
    const groupId = await browser.tabs.group({
      tabIds: [newTab.id]
    })
    if (groupConfig) {
      const { color, title, position, relativeGroupId } = groupConfig
      await browser.tabGroups.update(groupId, {
        color,
        title
      })
      switch (position) {
        case "top": {
          break
        }
        case "after": {
          const tabs = await browser.tabs.query({ groupId: relativeGroupId })
          const maxIndex = tabs.map(tab => tab.index).sort((l, r) => r - l)[0]
          await browser.tabGroups.move(groupId, {
            index: maxIndex + 1
          })
          break
        }
        case "before": {
          const tabs = await browser.tabs.query({ groupId: relativeGroupId })
          const minIndex = tabs.map(tab => tab.index).sort((l, r) => l - r)[0]
          await browser.tabGroups.move(groupId, {
            index: minIndex
          })
          break
        }
      }
    }
  }

  async #handlePlacement(newTab: Tab, lastActiveTab: Tab, placementMode: Config["placementMode"]) {
    console.trace(`
new tab: [${newTab.id}] join last active tab [${lastActiveTab.id}]' group: [${lastActiveTab.groupId}]
placementMode: ${placementMode}
`)
    switch (placementMode) {
      case "first": {
        const groupTabs = await browser.tabs.query({
          groupId: lastActiveTab.groupId,
          windowId: lastActiveTab.windowId
        })
        const otherIndices = groupTabs
          .filter(t => t.id !== newTab.id)
          .map(t => t.index)
        const targetIndex = otherIndices.length ? Math.min(...otherIndices) : 0
        await browser.tabs.move(newTab.id!, { index: targetIndex })
        break
      }
      case "after": {
        const targetIndex = lastActiveTab.index + 1
        await browser.tabs.move(newTab.id!, { index: targetIndex })
        break
      }
      case "last":
        // nop
        break
    }
  }
}
