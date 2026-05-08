# 06 - UI、2D 动画与交互规格

## 1. 设计目标

SQL Guardian 的 UI 目标是：

- 像一个真正住在网站里的小生命。
- 不干扰用户完成主要任务。
- 在 SQL Lab 中与 SQL Assistant 融合。
- 在全站页面中低频陪伴。
- 可关闭、可降级、移动端友好。
- 未来可替换为高质量 Sprite / Rive / Lottie 资产。

## 2. 视觉层级

### 2.1 默认尺寸

| 场景 | 建议尺寸 |
|---|---|
| 全站浮层角色 | 72px - 96px |
| SQL Lab 角色 | 80px - 120px |
| 角色之家图标 | 44px - 64px |
| 移动端收起状态 | 40px - 48px |
| 对话气泡 | 最大 280px 宽 |

### 2.2 z-index

Guardian 应位于普通内容之上，但低于全屏 Dialog、Command Palette、Modal、Toast 关键层级。

建议：

```css
--z-guardian: 40;
--z-guardian-bubble: 45;
--z-modal: 50;
```

如果项目已有 z-index 变量，必须遵守现有体系。

## 3. 组件结构

```txt
GuardianProvider
  └── GuardianHost
        ├── GuardianHome
        ├── GuardianSprite
        ├── GuardianBubble
        ├── GuardianChatPanel
        └── GuardianLevelUpToast
```

### 3.1 GuardianProvider

职责：

- 拉取 profile。
- 管理状态机。
- 记录页面路径。
- 监听用户事件。
- 提供 `useGuardian()`。

### 3.2 GuardianHost

职责：

- 全站挂载。
- 控制位置。
- 控制显示隐藏。
- 管理 reduced motion。
- 管理移动端降级。

### 3.3 GuardianHome

职责：

- 显示角色之家。
- 在 SQL Assistant 区域作为入口。
- 在全站作为 dock 或 home button。

### 3.4 GuardianSprite

职责：

- 根据 state 渲染角色。
- 支持 SVG / PNG / sprite sheet / CSS animation。
- 第一版可用简单 SVG 或占位插画。

### 3.5 GuardianBubble

职责：

- 显示短句、自言自语、状态提示。
- 支持自动消失。
- 支持点击展开聊天。

### 3.6 GuardianChatPanel

职责：

- 用户与 Guardian 对话。
- 显示最近对话。
- 支持输入、发送、加载中。
- 可嵌入 SQL Lab Assistant，也可作为全站浮层。

## 4. 动作列表

第一版动作：

| 动作 | 用途 | 资产要求 |
|---|---|---|
| idle | 待机 | 必须 |
| talk | 说话 | 必须 |
| think | 思考 | 必须 |
| walk | 巡逻 | 推荐 |
| jump | 越过障碍 | 推荐 |
| happy | 成功反馈 | 推荐 |
| confused | 错误反馈 | 推荐 |
| sleep | 长时间无操作 | 推荐 |
| teleport | 虫洞移动 | 推荐 |
| level-up | 升级 | 推荐 |

如果第一版缺少真实美术资产，可以用 CSS/SVG 占位：

- idle：轻微上下浮动。
- talk：身体轻微摇摆 + 气泡。
- think：罗盘旋转。
- walk：左右平移 + 脚步摆动。
- jump：translateY 弧线。
- teleport：scale + opacity + ring。

## 5. 状态机

### 5.1 状态定义

```ts
export type GuardianState =
  | 'home'
  | 'idle'
  | 'walking'
  | 'jumping'
  | 'teleporting'
  | 'thinking'
  | 'talking'
  | 'happy'
  | 'confused'
  | 'sleeping'
  | 'levelingUp'
  | 'hidden'
```

### 5.2 事件定义

```ts
export type GuardianUiEvent =
  | 'PAGE_CHANGED'
  | 'USER_IDLE'
  | 'USER_ACTIVE'
  | 'USER_CLICK_GUARDIAN'
  | 'USER_OPEN_SQL_LAB'
  | 'USER_RUN_QUERY'
  | 'USER_QUERY_SUCCESS'
  | 'USER_QUERY_ERROR'
  | 'USER_CHAT_SENT'
  | 'GUARDIAN_REPLY_START'
  | 'GUARDIAN_REPLY_END'
  | 'GUARDIAN_LEVEL_UP'
  | 'USER_HIDE_GUARDIAN'
```

### 5.3 转换示例

| 当前状态 | 事件 | 下一状态 |
|---|---|---|
| idle | USER_IDLE | sleeping |
| sleeping | USER_ACTIVE | idle |
| idle | USER_RUN_QUERY | thinking |
| thinking | USER_QUERY_SUCCESS | happy |
| thinking | USER_QUERY_ERROR | confused |
| idle | USER_CLICK_GUARDIAN | talking |
| talking | GUARDIAN_REPLY_START | thinking |
| thinking | GUARDIAN_REPLY_END | talking |
| any | GUARDIAN_LEVEL_UP | levelingUp |
| any | USER_HIDE_GUARDIAN | hidden |

## 6. 边界行走与障碍避让

用户希望角色“沿着界面边框走动，碰到走不了的地方跳过去，符合物理特性，也可以通过虫洞跳过去”。

第一版推荐使用轻量规则，不引入复杂物理引擎。

### 6.1 可行走路径

默认路径：

- viewport 底部边缘。
- viewport 右侧边缘。
- SQL Assistant 面板边缘。
- 角色之家附近的小范围路径。

### 6.2 避让区域

必须避让：

- SQL 编辑器输入区。
- Run / Format / Save 按钮。
- Modal / Dialog。
- Chat 输入框。
- 移动端底部导航。

可通过 DOM selector 或固定区域配置：

```ts
type GuardianAvoidZone = {
  id: string
  rect: DOMRect
  priority: 'low' | 'high'
}
```

### 6.3 跳跃规则

当下一个目标点与避让区域重叠：

1. 如果障碍宽度小于角色宽度的 2 倍，执行 jump。
2. 如果障碍较大，尝试绕行。
3. 如果绕行失败，执行 teleport。

### 6.4 虫洞规则

虫洞用于：

- 页面切换后重新定位。
- 从 SQL Assistant 面板到全站边缘。
- 避让大型遮挡。
- 升级动画后回家。

视觉：

- 小型圆环。
- 数据星点。
- 角色缩小消失，再放大出现。

## 7. 对话气泡

### 7.1 气泡位置

优先级：

1. 角色上方。
2. 角色左侧或右侧。
3. 如果空间不足，显示为底部 toast 式短句。

### 7.2 气泡内容长度

自言自语不超过 32 个中文字符。

SQL 提示不超过 60 个中文字符，详细内容放入聊天面板或 SQL Assistant。

### 7.3 气泡频率

默认频率：

- 普通页面：每 5 - 15 分钟最多一次。
- SQL Lab：根据用户行为触发，但错误 / 成功反馈可即时。
- 用户专注输入时：不主动弹出。

## 8. 聊天面板

### 8.1 全站聊天

- 点击角色打开。
- 右下角或侧边小面板。
- 支持最近 10 条对话。
- 支持加载更多。
- 支持关闭。

### 8.2 SQL Lab 聊天

- 可以复用 SQL Assistant 面板。
- 或在 SQL Assistant 内加入 Guardian persona 标识。
- 不与原 SQL Assistant 输入冲突。

## 9. Reduced Motion

必须支持：

```ts
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
```

如果用户开启 reduced motion：

- 禁用行走、跳跃、虫洞动画。
- 保留静态角色与气泡。
- 升级效果改为静态提示。
- 不做连续浮动。

## 10. 移动端策略

移动端不应默认显示大型角色。

建议：

- 默认收起为 40px floating home。
- 点击后展开面板。
- 不沿边框行走。
- 不遮挡底部导航、输入框。
- SQL Lab 移动端优先保证编辑器可用。

## 11. 性能预算

- 初始 JS 增量尽量小。
- 不要在首屏加载大型 sprite sheet。
- 图片资源懒加载。
- 动画使用 transform / opacity，避免频繁 layout。
- 状态机 tick 不要高频运行。
- 页面不可见时暂停动画。
- 对话历史分页加载。

## 12. 美术资产规格

### 12.1 SVG / PNG 第一版

建议文件：

```txt
public/sql-guardian/guardian-idle.svg
public/sql-guardian/guardian-talk.svg
public/sql-guardian/guardian-think.svg
public/sql-guardian/guardian-happy.svg
public/sql-guardian/guardian-confused.svg
public/sql-guardian/guardian-sleep.svg
public/sql-guardian/guardian-home.svg
```

### 12.2 Sprite Sheet 进阶版

规格：

- 每帧 256x256 或 512x512。
- 透明背景。
- 每个动作 6 - 12 帧。
- 文件名带动作和等级。

```txt
guardian-lv1-idle.png
guardian-lv1-walk.png
guardian-lv2-jump.png
guardian-lv4-teleport.png
guardian-lv5-levelup.png
```

### 12.3 Rive / Lottie 进阶版

后续可引入，但 MVP 不强制。

引入前需要评估：

- 包体积。
- SSR 兼容。
- 编辑成本。
- 是否支持状态机。
- 是否容易替换资产。

## 13. UI 文案

### 13.1 按钮

- 和澜守说话
- 让它回家
- 暂停自言自语
- 关闭动画
- 查看它记住了什么
- 重置守门人

### 13.2 空状态

```txt
澜守还没有记住任何事。
等你愿意告诉它一些偏好，它会慢慢学会如何陪你。
```

### 13.3 升级提示

```txt
澜守升到了 Lv.3：Schema 航线绘图师。
它的罗盘现在能看见更多表之间的航线了。
```

## 14. 与现有 UI 风格融合

当前项目是仪表盘式、工具式、工作台式体验。Guardian 不能破坏这种专业感。

建议：

- 色彩使用现有主题变量。
- 角色光效控制在小范围。
- SQL Lab 中偏冷色、数据感。
- 首页中偏温暖、陪伴感。
- 后台页面中默认降低活跃度。

## 15. CSS 变量建议

```css
:root {
  --guardian-home-bg: hsl(var(--card));
  --guardian-accent: #3dd7ff;
  --guardian-accent-soft: rgba(61, 215, 255, 0.18);
  --guardian-bubble-bg: hsl(var(--popover));
  --guardian-bubble-text: hsl(var(--popover-foreground));
  --guardian-shadow: 0 18px 45px rgba(15, 23, 42, 0.16);
}
```

如果项目已有设计 token，应转为项目现有变量。
