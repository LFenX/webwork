import { requireAuth } from "@/lib/auth"
import { getDictionary } from "@/lib/i18n"
import { getUserSiteSettings } from "@/lib/settings"
import { getUserLive2DSettings } from "@/lib/live2d-settings"
import { SettingsShell } from "@/components/settings/settings-shell"
import {
  Live2DSettingsForm,
  type Live2DSettingsLabels,
} from "@/components/settings/live2d-settings-form"

export const dynamic = "force-dynamic"

const LABELS: Record<"zh-CN" | "en-US", { title: string; description: string } & Live2DSettingsLabels> = {
  "zh-CN": {
    title: "Live2D 看板娘",
    description: "调整看板娘的显示方式。除「显示模式」和「模型」外，其它项保存后即时生效，无需刷新。",
    displayMode: "显示模式",
    displayModeHint: "选择在哪些设备上显示。「仅桌面」会自动隐藏窄屏（< 768px），「所有设备」会在移动端缩小尺寸避免遮挡内容。",
    modeOff: "关闭",
    modeDesktop: "仅桌面",
    modeAll: "所有设备",
    model: "模型",
    modelHint: "从内置模型中选择。切换需要刷新页面以重新加载资源。",
    position: "位置",
    positionLeftBottom: "左下",
    positionRightBottom: "右下",
    size: "大小",
    sizeSmall: "小",
    sizeMedium: "中",
    sizeLarge: "大",
    drag: "允许拖动",
    dragHint: "开启后可以把角色拖到任意位置，位置会本地记住。",
    on: "开",
    off: "关",
    resetPosition: "重置位置",
    resetPositionDone: "已重置到默认位置",
    bubbleTheme: "对话气泡主题",
    bubbleThemeHint: "切换看板娘说话时弹出的气泡风格。所有主题均为 CSS 渲染，不依赖图片资源。",
    bubbleThemeDreamyGlass: "梦幻玻璃",
    bubbleThemeCuteSticker: "可爱贴纸",
    bubbleThemeMinimalSoft: "极简柔和",
    bubbleThemeMagicFantasy: "魔法幻想",
    bubbleName: "气泡左上角昵称",
    bubbleNameHint: "显示在气泡左上角的小标签。留空则使用所选模型的名称。",
    bubbleNamePlaceholder: "例如：小蝶酱",
    preview: "预览",
    previewHint: "预览仅示意位置和大小，实际渲染请看页面边角。",
    save: "保存",
    saving: "保存中…",
    saved: "已保存",
    saveFailed: "保存失败",
    reloadNote: "你修改了「显示模式」或「模型」，保存后页面会刷新一次以重新初始化。",
  },
  "en-US": {
    title: "Live2D companion",
    description: "Configure your Live2D widget. All settings except 'Display mode' and 'Model' apply live without a reload.",
    displayMode: "Display mode",
    displayModeHint: "Where to show the companion. 'Desktop only' hides it under 768px; 'All devices' shrinks the model on mobile so it doesn't block content.",
    modeOff: "Off",
    modeDesktop: "Desktop only",
    modeAll: "All devices",
    model: "Model",
    modelHint: "Pick one of the built-in models. Switching reloads the page to re-load assets.",
    position: "Position",
    positionLeftBottom: "Bottom left",
    positionRightBottom: "Bottom right",
    size: "Size",
    sizeSmall: "Small",
    sizeMedium: "Medium",
    sizeLarge: "Large",
    drag: "Allow dragging",
    dragHint: "When on, the character can be dragged; the position is remembered on this device.",
    on: "On",
    off: "Off",
    resetPosition: "Reset position",
    resetPositionDone: "Position reset",
    bubbleTheme: "Speech bubble theme",
    bubbleThemeHint: "Pick the look of the speech bubble. All themes are pure CSS — no image assets are loaded.",
    bubbleThemeDreamyGlass: "Dreamy glass",
    bubbleThemeCuteSticker: "Cute sticker",
    bubbleThemeMinimalSoft: "Minimal soft",
    bubbleThemeMagicFantasy: "Magic fantasy",
    bubbleName: "Top-left badge name",
    bubbleNameHint: "Small label shown in the top-left of the bubble. Leave empty to use the selected model's name.",
    bubbleNamePlaceholder: "e.g. Little Butterfly",
    preview: "Preview",
    previewHint: "Illustrative only — shows where and how big the companion will appear.",
    save: "Save",
    saving: "Saving…",
    saved: "Saved",
    saveFailed: "Save failed",
    reloadNote: "Display mode or model changed; the page will reload after save to re-initialize the widget.",
  },
}

export default async function SettingsLive2DPage() {
  const session = await requireAuth()
  const [settings, live2d] = await Promise.all([
    getUserSiteSettings(session.userId),
    getUserLive2DSettings(session.userId),
  ])
  const dict = getDictionary(settings.language)
  const labels = LABELS[settings.language]

  return (
    <SettingsShell title={labels.title} description={labels.description} backLabel={dict.common.back}>
      <Live2DSettingsForm initial={live2d} labels={labels} />
    </SettingsShell>
  )
}
