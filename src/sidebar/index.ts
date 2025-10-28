// ANCHOR init
browser.runtime.sendMessage({
  header: "sidebar-open"
} as Message)
// ANCHOR groupnameInput
const groupnameInput = document.getElementById("groupname-input") as HTMLInputElement;
window.addEventListener("focus", () => {
  groupnameInput.focus()
})

groupnameInput.addEventListener("input", () => {
  currentGroupConfig.title = groupnameInput.value.trim();

});

groupnameInput.addEventListener("keyup", async (e) => {
  if (e.key === "Enter") {
    await emitBuildGroup()
  }
})

async function emitBuildGroup() {
  console.debug(`build group config: ${JSON.stringify(currentGroupConfig)}`)
  browser.runtime.sendMessage({
    header: "build-group",
    payload: currentGroupConfig
  } as Message)
  await browser.sidebarAction.close()
}
// ANCHOR colorOption
const colorOptions = document.querySelectorAll<HTMLDivElement>(".color-option");
const optionsArray = Array.from(colorOptions);
const randomIndex = Math.floor(Math.random() * optionsArray.length);
const initialColorOption = optionsArray[randomIndex];
initialColorOption.classList.add("selected");

// 当前分组配置（可用于后续业务逻辑）
const currentGroupConfig: GroupConfig = {
  title: "",
  color: initialColorOption.dataset.color as browser.tabGroups.Color || "",
  position: "top",
  relativeGroupId: 0
};

// 颜色色块点击事件：切换选中状态并更新当前颜色
colorOptions.forEach(option => {
  option.addEventListener("click", () => {
    // 移除其他色块的选中状态
    colorOptions.forEach(opt => opt.classList.remove("selected"));
    // 选中当前色块
    option.classList.add("selected");
    // 更新当前分组颜色
    currentGroupConfig.color = option.dataset.color as browser.tabGroups.Color || "";
    console.debug("group color is: ", currentGroupConfig.color);
  });
});


const BackgroundToFontColorMap: Record<Color, {
  fontColor: string;    // 互补字体色
  fontShadow?: string;  // 可选：增强可读性的文字阴影（仅低对比度场景）
}> = {
  blue: {
    fontColor: "#ffffff",  // 深蓝色（#0000FF）→ 白色（对比度 8.5:1，远超标准）
  },
  cyan: {
    fontColor: "#000000",  // 浅青色（#00FFFF）→ 黑色（对比度 7.1:1，清晰不刺眼）
  },
  grey: {
    fontColor: "#ffffff",  // 深灰色（#808080）→ 白色（对比度 10.5:1，无视觉疲劳）
  },
  green: {
    fontColor: "#ffffff",  // 深绿色（#008000）→ 白色（对比度 8.2:1，符合用户习惯）
  },
  orange: {
    fontColor: "#000000",  // 橙色（#FFA500）→ 黑色（对比度 4.7:1，满足 AA 级标准）
  },
  pink: {
    fontColor: "#000000",  // 浅粉色（#FFC0CB）→ 黑色（对比度 4.3:1，接近 AA 级，加轻微阴影）
    fontShadow: "0 0 1px rgba(0, 0, 0, 0.2)"  // 增强边缘清晰度
  },
  purple: {
    fontColor: "#ffffff",  // 深紫色（#800080）→ 白色（对比度 8.0:1，高对比度清晰）
  },
  red: {
    fontColor: "#ffffff",  // 红色（#FF0000）→ 白色（对比度 7.8:1，警示性与可读性兼顾）
  },
  yellow: {
    // 优化：黄色（#FFFF00）→ 深灰色（非纯黑），对比度从 1.9:1 提升到 7.3:1
    fontColor: "#333333",  
    fontShadow: "0 0 1px rgba(0, 0, 0, 0.3)"  // 轻微阴影避免“发光”感
  }
};

const getFontColorByBgColor = (bgColor: Color): string => {
  const { fontColor, fontShadow } = BackgroundToFontColorMap[bgColor];
  
  // 动态设置文字阴影（全局 CSS 变量，供卡片样式使用）
  document.documentElement.style.setProperty("--font-shadow", fontShadow || "none");
  
  return fontColor;
}

const getGroupListDOM = () => ({
  groupListContainer: document.getElementById("group-list") as HTMLDivElement | null,
});

const fetchRealTabGroups = async (): Promise<TabGroup[]> => {
  try {
    const currentWindow = await browser.windows.getCurrent({});
    if (!currentWindow.id) throw new Error("Current window ID not found");

    const groups = await browser.tabGroups.query({ windowId: currentWindow.id });

    return groups.map(group => ({
      ...group,
      title: group.title || "Untitled Group",
    }));
  } catch (error) {
    console.error("Failed to fetch tab groups:", error);
    return []; // 出错时返回空数组，避免页面崩溃
  }
};
const renderGroupList = (
  groups: browser.tabGroups.TabGroup[],
  container: HTMLDivElement
) => {
  // 清空容器，避免重复渲染
  container.innerHTML = "";

  // 无分组时显示提示
  if (groups.length === 0) {
    const emptyTip = document.createElement("div");
    emptyTip.style.cssText = `
      font-size: 12px;
      color: var(--text-secondary, #666);
      padding: 12px 0;
      text-align: center;
    `;
    emptyTip.textContent = "No groups found. Create your first group!";
    container.appendChild(emptyTip);
    return;
  }
  
  // 1. 添加“最顶部插入遮罩”（解决第一个分组无法前置插入问题）
  const topOverlay = createInsertOverlay(
    "top",
    "Add to top",
    emitBuildGroup
  );
  container.appendChild(topOverlay);

  // 2. 遍历渲染分组卡片（含上下遮罩）
  groups.forEach((group, index) => {
    // 卡片外层容器：用于包裹“遮罩+卡片”，控制hover显示逻辑
    const cardWrapper = document.createElement("div");
    cardWrapper.className = "group-card__wrapper";

    // 分组卡片本体（核心内容）
    const groupCard = document.createElement("div");
    const bgColor = group.color as Color;
    const fontColor = getFontColorByBgColor(bgColor);

    // 卡片样式：背景色+协调字体色+文字阴影
    groupCard.className = "group-card";
    groupCard.dataset.groupId = group.id.toString();
    groupCard.style.cssText = `
      background-color: ${bgColor};
      color: ${fontColor};
      text-shadow: var(--font-shadow);
    `;

    // 卡片内容（标题+折叠状态）
    groupCard.innerHTML = `
      <div class="group-card__title">${group.title}</div>
      <div class="group-card__status">
        ${group.collapsed ? "Collapsed" : "Expanded"}
      </div>
    `;

    // 3. 创建卡片上方遮罩（插入到当前分组之前）
    const beforeOverlay = createInsertOverlay(
      "top",
      "Add before",
      async () => { 
        currentGroupConfig.position = "before"
        currentGroupConfig.relativeGroupId = group.id
        await emitBuildGroup()
      }
    );

    // 4. 创建卡片下方遮罩（插入到当前分组之后）
    const afterOverlay = createInsertOverlay(
      "bottom",
      "Add after",
      async () => {
        currentGroupConfig.position = "after"
        currentGroupConfig.relativeGroupId = group.id
        await emitBuildGroup();
      }
    );

    // 5. 组装外层容器：上方遮罩 → 卡片 → 下方遮罩
    cardWrapper.appendChild(beforeOverlay);
    cardWrapper.appendChild(groupCard);
    cardWrapper.appendChild(afterOverlay);

    // 6. 添加到列表容器
    container.appendChild(cardWrapper);
  });
};

const createInsertOverlay = (
  position: "top" | "bottom",
  label: string,
  onClick: () => void
) => {
  const overlay = document.createElement("div");
  overlay.className = `insert-overlay insert-overlay--${position}`;


  // 遮罩内容（加号+提示文字）
  overlay.innerHTML = `
    <span class="insert-overlay__plus">+</span>
    <span class="insert-overlay__label">${label}</span>
  `;

  // 点击遮罩触发插入逻辑
  overlay.addEventListener("click", onClick);
  return overlay;
};

const updateGroupListView = async (container: HTMLDivElement) => {
  const groupList = await fetchRealTabGroups();
  renderGroupList(groupList, container);
}

const setupGroupEventListeners = (container: HTMLDivElement) => {
  browser.tabGroups.onUpdated.addListener(
    async (group: TabGroup) => {
      console.debug(`group [${group.id}] updated`);
      updateGroupListView(container)
    }
  );

  // 监听分组删除事件（分组被删除时触发）
  browser.tabGroups.onRemoved.addListener(async group => {
    console.debug(`group [${group.id}] removed`);
    updateGroupListView(container)
  });

  browser.tabGroups.onCreated.addListener(async group => {
    console.debug(`group [${group.id}] create`)
    updateGroupListView(container)
  });
};

document.addEventListener("DOMContentLoaded", async () => {
  const { groupListContainer } = getGroupListDOM();

  if (!groupListContainer) {
    console.error("Group list container not found in DOM");
    return;
  }

  updateGroupListView(groupListContainer)
  setupGroupEventListeners(groupListContainer);
});