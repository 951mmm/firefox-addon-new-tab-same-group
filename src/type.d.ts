declare global {
    type Tab = browser.tabs.Tab
    type TabGroup = browser.tabGroups.TabGroup
    type Color = browser.tabGroups.Color
    type relativePosition = "before" | "after" | "top"
    interface GroupConfig {
        title: string;
        color: Color;
        position: relativePosition,
        relativeGroupId: number,
    }
    interface Message {
        header: "build-group" | "sidebar-open" | "sidebar-open-ack"
        payload: any
    }
    interface BuildGroupPayload {
        config: GroupConfig
    }

    interface SidebarOpenAckPayload {
        groupId: number
    }
}
export { }