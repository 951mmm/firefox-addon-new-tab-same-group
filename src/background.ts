import { ConfigManager } from "./core/config-manager.js"
import { ShortcutManager } from "./core/shortcut-manager.js"
import { GroupHandler } from "./core/group-handler.js"
import { TabStateTracker } from "./core/tab-state-tracker.js"
class Background {
  #configManager
  #tabStateTracker
  #groupHandler
  #shortcutManager
  #lastCommand = new String()
  #groupConfig: GroupConfig | undefined
  #isPending: boolean
  #sidebarOpen: boolean

  constructor() {
    this.#configManager = new ConfigManager()
    this.#tabStateTracker = new TabStateTracker()
    this.#groupHandler = new GroupHandler(this.#configManager)
    this.#shortcutManager = new ShortcutManager()
    this.#isPending = false
    this.#sidebarOpen = false
    this.#bindBrowserEvents()
    this.#setupInstallListener()
    this.#bindExtensionEvents()
  }

  #bindBrowserEvents() {
    browser.tabs.onCreated.addListener(this.#handleTabCreated)
    this.#shortcutManager.onCommand = (cmd) => {
      this.#lastCommand = cmd
      switch (cmd) {
        case ShortcutManager.commands.OPEN_STANDARD_NEW_TAB:
          browser.tabs.create({})
          break
        case ShortcutManager.commands.OPEN_STANDARD_TAB_IN_NEW_GROUP:
          browser.tabs.create({})
          this.#groupConfig = undefined
          break
        case ShortcutManager.commands.TOGGLE_SIDEBAR:
          this.#toggleSidebar()
          break
        default:
          break
      }
    }
  }

  #toggleSidebar = () => {
    if (this.#sidebarOpen) {
      browser.sidebarAction.close()
      this.#sidebarOpen = false
    } else {
      browser.sidebarAction.open()
      this.#sidebarOpen = true
    }
  }

  #handleTabCreated = async (newTab: Tab) => {
    const { enableGroupTab } = this.#configManager.getConfig()
    if (this.#isPending) return
    if (!enableGroupTab) return
    switch (this.#lastCommand) {
      case ShortcutManager.commands.OPEN_STANDARD_NEW_TAB: {
        console.debug(`open new tab [${newTab.id}] on standard way`)
        break
      }
      case ShortcutManager.commands.OPEN_STANDARD_TAB_IN_NEW_GROUP:
      case ShortcutManager.commands.TOGGLE_SIDEBAR: {
        console.debug(`open new tab [${newTab.id}] on standard way, and in a new group`)
        this.#groupHandler.addToNewGroup(newTab, this.#groupConfig)
        break
      }
      default: {
        const lastActiveTab = this.#tabStateTracker.getLastActiveTab(newTab)
        if (lastActiveTab) {
          await this.#groupHandler.addToTabGroup(newTab, lastActiveTab)
          await this.#simulateFocusOnNewTab(newTab)
        }
        break
      }
    }
    this.#lastCommand = ""
  }

  /**
   * becasue `create new tab` will append the new tab on the last
   * and firefox don't supply any api to resolve the focus
   * we simulate it roughly. the lackness:
   * 1. don't create new tab too often
   * 2. there is tears when jumping between the last and the current active tab
   * @param newTab new tab
   */
  #simulateFocusOnNewTab(newTab: Tab) {
    this.#isPending = true
    setTimeout(async () => {
      const newTabInGroup = (await browser.tabs.query({})).find(tab => tab.id == newTab.id)
      const tmpTab = await browser.tabs.create({ index: newTabInGroup!.index })
      this.#isPending = false
      browser.tabs.remove(tmpTab.id!)
    }, 100)
  }

  // 安装/更新日志
  #setupInstallListener() {
    browser.runtime.onInstalled.addListener(({ reason }) => {
      console.log("extension update:", reason)
    })
  }

  #bindExtensionEvents() {
    browser.runtime.onMessage.addListener((msg: Message) => {
      switch (msg.header) {
        case "build-group": {
          this.#groupConfig = msg.payload
          browser.tabs.create({})
          break
        }
        // open the sidebar by btn will fire the msg
        case "sidebar-open": {
          this.#lastCommand = ShortcutManager.commands.TOGGLE_SIDEBAR
          const lastActiveTab = this.#tabStateTracker.getLastActiveTab()
          browser.runtime.sendMessage({
            header: "sidebar-open-ack",
            payload: {
              groupId: lastActiveTab?.groupId
            } as SidebarOpenAckPayload
          } as Message)
          break
        }
      }
    })
  }
}

// 启动插件
new Background()