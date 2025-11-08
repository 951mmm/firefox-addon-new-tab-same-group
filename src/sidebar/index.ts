// ANCHOR 初始化消息
browser.runtime.sendMessage({ header: "sidebar-open" } as Message)

// 因为sidebarAction不能捕捉深层定义的userInput
// 统一冒泡到window再捕捉
window.addEventListener("keyup", async e => {
  if (e.key === "Enter")
    if (e.target instanceof HTMLInputElement && e.target.classList.contains("group-input")) {
      await browser.sidebarAction.close()
    }
})

window.addEventListener("keydown", e => {
  if (e.altKey && e.shiftKey && e.code === "KeyS") {
    browser.sidebarAction.close()
  }
})

let lastActiveGroupId = 0
browser.runtime.onMessage.addListener((msg: Message) => {
  if (msg.header === "sidebar-open-ack") {
    lastActiveGroupId = msg.payload.groupId
    // 收到活跃分组ID后，触发滚动（延迟确保DOM已渲染）
    setTimeout(scrollToActiveGroup, 150)
  }
})

// ANCHOR 全局状态管理（修正默认颜色）
let currentGroupConfig: GroupConfig = {
  title: "",
  color: "blue", // 初始为空，由随机颜色初始化
  position: "top",
  relativeGroupId: 0
}
let activeInput: HTMLInputElement | null = null // 跟踪当前激活的输入框

// ANCHOR 颜色选择逻辑
const colorOptions = document.querySelectorAll<HTMLDivElement>(".color-option")
const optionsArray = Array.from(colorOptions)
const randomIndex = Math.floor(Math.random() * optionsArray.length)
const initialColorOption = optionsArray[randomIndex]

// 初始化默认颜色
if (initialColorOption) {
  initialColorOption.classList.add("selected")
  currentGroupConfig.color = initialColorOption.dataset.color as Color || ""
}

// 颜色选择事件
colorOptions.forEach(option => {
  option.addEventListener("click", () => {
    colorOptions.forEach(opt => opt.classList.remove("selected"))
    option.classList.add("selected")
    currentGroupConfig.color = option.dataset.color as Color || ""
    console.debug("group color updated to:", currentGroupConfig.color)
  })
})

// ANCHOR 颜色-字体映射（无变化）
// const BackgroundToFontColorMap: Record<Color, {
//   fontColor: string
//   fontShadow?: string
// }> = {
//   blue: { fontColor: "#ffffff" },
//   cyan: { fontColor: "#000000" },
//   grey: { fontColor: "#ffffff" },
//   green: { fontColor: "#ffffff" },
//   orange: { fontColor: "#000000" },
//   pink: { fontColor: "#000000", fontShadow: "0 0 1px rgba(0, 0, 0, 0.2)" },
//   purple: { fontColor: "#ffffff" },
//   red: { fontColor: "#ffffff" },
//   yellow: { fontColor: "#333333", fontShadow: "0 0 1px rgba(0, 0, 0, 0.3)" }
// }

// // ANCHOR 辅助函数：根据背景色获取字体样式
// const getFontColorByBgColor = (bgColor: Color): string => {
//   const config = BackgroundToFontColorMap[bgColor]
//   document.documentElement.style.setProperty("--font-shadow", config.fontShadow || "none")
//   return config.fontColor
// }

// ANCHOR 辅助函数：获取 DOM 容器
const getGroupListDOM = (): { groupListContainer: HTMLDivElement | null } => ({
  groupListContainer: document.getElementById("group-list") as HTMLDivElement | null
})

// ANCHOR 辅助函数：滚动到活跃分组
const scrollToActiveGroup = () => {
  const { groupListContainer } = getGroupListDOM()
  if (!groupListContainer || lastActiveGroupId === 0) return

  // 查找对应分组卡片（通过 data-group-id 属性匹配）
  const activeCard = groupListContainer.querySelector(`.group-card[data-group-id="${lastActiveGroupId}"]`)
  if (activeCard) {
    // 平滑滚动到卡片位置，确保卡片在可视区域中间
    activeCard.scrollIntoView({
      behavior: "smooth",
      block: "center"
    })

    // 可选：添加短暂高亮，提示当前活跃分组
    activeCard.classList.add("active-highlight")
    setTimeout(() => activeCard.classList.remove("active-highlight"), 1000)
  }
}

// ANCHOR 辅助函数：获取真实标签组数据
const fetchRealTabGroups = async (): Promise<TabGroup[]> => {
  try {
    const currentWindow = await browser.windows.getCurrent({})
    if (!currentWindow.id) throw new Error("Current window ID not found")

    const groups = await browser.tabGroups.query({ windowId: currentWindow.id })
    return groups.map(group => ({
      ...group,
      title: group.title || "Untitled Group"
    }))
  } catch (error) {
    console.error("Failed to fetch tab groups:", error)
    return []
  }
}

// ANCHOR 辅助函数：创建输入框（安全方式）
const createGroupInput = (): HTMLInputElement => {
  const input = document.createElement("input")
  input.type = "text"
  input.placeholder = "enter group title..."
  input.className = "group-input" // 使用 CSS 类管理样式

  // 主题适配（通过 CSS 变量，避免硬编码）
  const isDarkMode = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
  input.dataset.theme = isDarkMode ? "dark" : "light"

  return input
}

// ANCHOR 辅助函数：创建插入遮罩（全 DOM 操作）
const createInsertOverlay = (
  position: "top" | "bottom",
  label: string,
  onClick: () => void
): HTMLDivElement => {
  const overlay = document.createElement("div")
  overlay.className = `insert-overlay insert-overlay--${position}`

  // 创建加号元素
  const plusSpan = document.createElement("span")
  plusSpan.className = "insert-overlay__plus"
  plusSpan.textContent = "+"

  // 创建标签元素
  const labelSpan = document.createElement("span")
  labelSpan.className = "insert-overlay__label"
  labelSpan.textContent = label

  // 组装遮罩
  overlay.appendChild(plusSpan)
  overlay.appendChild(labelSpan)

  overlay.addEventListener("click", () => {
    onClick() // 执行原位置设置逻辑

    // 移除已有输入框，避免重复
    if (activeInput) {
      activeInput.remove()
      activeInput = null
    }

    // 创建并插入输入框
    const input = createGroupInput()
    overlay.after(input) // 插入到遮罩后面
    activeInput = input
    input.focus() // 自动聚焦

    // 回车创建分组
    input.addEventListener("keyup", async (e) => {
      if (e.key === "Enter") {
        await handleInputSubmit(input)
      }
    })

    // 失焦处理（空值则移除）
    input.addEventListener("blur", () => {
      if (input.value.trim() === "") input.remove()
      activeInput = null
    })
  })

  return overlay
}

// ANCHOR 辅助函数：处理输入框提交
const handleInputSubmit = async (input: HTMLInputElement) => {
  const title = input.value.trim() || ""

  // 确保颜色已选择（兜底默认色）
  if (!currentGroupConfig.color) {
    currentGroupConfig.color = "blue" as Color
  }

  currentGroupConfig.title = title
  console.debug(`build group config: ${JSON.stringify(currentGroupConfig)}`)

  // 发送创建请求
  await browser.runtime.sendMessage({
    header: "build-group",
    payload: currentGroupConfig
  } as Message)

  // 清理输入框
  input.remove()
  activeInput = null
}

const NativeColorToSoftColorMap = {
  blue: "#99ccff",    // 较深天蓝，保留柔和感
  cyan: "#80e5ed",    // 较深青色，鲜明不刺眼
  grey: "#cccccc",    // 中灰，平衡存在感
  green: "#a8e6cf",   // 较深浅绿，自然清新
  orange: "#ffc299",  // 较深浅橙，温暖不燥
  pink: "#ffb3c1",    // 较深浅粉，柔和不艳
  purple: "#c8b6ff",  // 较深浅紫，雅致鲜明
  red: "#ffb3b3",     // 较深浅红，温和不刺
  yellow: "#ffe6b3",  // 较深浅黄，明亮不晃
  default: "#99ccff"
} as const
// ANCHOR 核心函数：渲染分组列表（无 innerHTML）
const renderGroupList = (groups: TabGroup[], container: HTMLDivElement) => {
  // 清空容器（安全方式）
  while (container.firstChild) {
    container.removeChild(container.firstChild)
  }

  // 无分组时显示提示
  if (groups.length === 0) {
    const emptyTip = document.createElement("div")
    emptyTip.className = "empty-tip"
    emptyTip.textContent = "No groups found. Create your first group!"
    container.appendChild(emptyTip)
    return
  }

  // 添加顶部插入遮罩
  const topOverlay = createInsertOverlay(
    "top",
    "Add to top",
    () => {
      currentGroupConfig.position = "top"
    }
  )
  container.appendChild(topOverlay)

  // 遍历渲染每个分组
  groups.forEach(group => {
    // 卡片容器
    const cardWrapper = document.createElement("div")
    cardWrapper.className = "group-card__wrapper"

    // 分组卡片
    const groupCard = document.createElement("div")
    groupCard.className = "group-card"
    groupCard.dataset.groupId = group.id.toString()

    // 设置卡片样式（核心优化：让背景更柔和）
    const bgColor = NativeColorToSoftColorMap[group.color]
    const fontColor = "#000000"
    groupCard.style.backgroundColor = bgColor
    // 叠加白色降低饱和度，视觉更柔和（opacity 0.15 可根据需求调整）
    groupCard.style.backgroundImage = "linear-gradient(rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.25))"
    // 轻微模糊增强柔和感（blur 1px 不影响文字清晰度）
    groupCard.style.backdropFilter = "blur(1px)"
    // 保留高对比度黑字
    groupCard.style.color = fontColor
    // 移除文字阴影（柔和背景+黑字已足够清晰，阴影反而显脏）
    groupCard.style.textShadow = "none"
    // 增加边框提升精致感（低透明度黑色边框，不突兀）
    groupCard.style.border = "1px solid rgba(0, 0, 0, 0.05)"
    // 卡片标题
    const titleDiv = document.createElement("div")
    titleDiv.className = "group-card__title"
    titleDiv.textContent = group.title!
    groupCard.appendChild(titleDiv)

    // 卡片状态
    const statusDiv = document.createElement("div")
    statusDiv.className = "group-card__status"
    statusDiv.textContent = group.collapsed ? "Collapsed" : "Expanded"
    groupCard.appendChild(statusDiv)

    // 上方插入遮罩（Add before）
    const beforeOverlay = createInsertOverlay(
      "top",
      "Add before",
      () => {
        currentGroupConfig.position = "before"
        currentGroupConfig.relativeGroupId = group.id
      }
    )

    // 下方插入遮罩（Add after）
    const afterOverlay = createInsertOverlay(
      "bottom",
      "Add after",
      () => {
        currentGroupConfig.position = "after"
        currentGroupConfig.relativeGroupId = group.id
      }
    )

    // 组装卡片容器
    cardWrapper.appendChild(beforeOverlay)
    cardWrapper.appendChild(groupCard)
    cardWrapper.appendChild(afterOverlay)
    container.appendChild(cardWrapper)
  })

  // 列表渲染完成后，触发滚动（应对初始加载场景）
  if (lastActiveGroupId !== 0) {
    scrollToActiveGroup()
  }
}

// ANCHOR 核心函数：更新分组列表视图
const updateGroupListView = async (container: HTMLDivElement) => {
  const groups = await fetchRealTabGroups()
  renderGroupList(groups, container)
}

// ANCHOR 核心函数：设置分组事件监听
const setupGroupEventListeners = (container: HTMLDivElement) => {
  browser.tabGroups.onUpdated.addListener(() => updateGroupListView(container))
  browser.tabGroups.onRemoved.addListener(() => updateGroupListView(container))
  browser.tabGroups.onCreated.addListener(() => updateGroupListView(container))
  browser.tabGroups.onMoved.addListener(() => updateGroupListView(container))
}

const collapseAllGroups = async () => {
  try {
    const currentWindow = await browser.windows.getCurrent({})
    if (!currentWindow.id) throw new Error("Current window ID not found")

    // 获取当前窗口所有标签组
    const groups = await browser.tabGroups.query({ windowId: currentWindow.id })

    // 批量折叠未折叠的组
    for (const group of groups) {
      if (!group.collapsed) { // 只处理未折叠的组
        await browser.tabGroups.update(group.id, { collapsed: true })
      }
    }

    console.log(`Collapsed ${groups.filter(g => !g.collapsed).length} groups`)
  } catch (error) {
    console.error("Failed to collapse all groups:", error)
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const { groupListContainer } = getGroupListDOM()
  if (!groupListContainer) {
    console.error("Group list container not found")
    return
  }

  updateGroupListView(groupListContainer)
  setupGroupEventListeners(groupListContainer)
  // 🔥 绑定"全部折叠"按钮事件
  const collapseBtn = document.getElementById("collapse-all")
  if (collapseBtn) {
    collapseBtn.addEventListener("click", collapseAllGroups)
  }
})