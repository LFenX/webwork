# v2 变更记录（2026-04-21）

> 本文件记录本次改动的完整内容，供纠错和后续开发参考。

---

## 一、依赖变更

```bash
npm install @uiw/react-md-editor @uiw/react-markdown-preview
```

---

## 二、数据库 Schema 变更（Prisma）

**文件：** `prisma/schema.prisma`

新增三个 Model：

```prisma
model Post {
  id        String   @id @default(cuid())
  type      String              # "blog" | "daily" | "reflections" | "notes"
  slug      String
  title     String
  summary   String   @default("")
  tags      String   @default("[]")   # JSON 字符串，如 '["React","TS"]'
  content   String   @default("")
  date      DateTime @default(now())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([type, slug])
  @@index([type, date])
}

model Resume {
  id        String   @id @default("singleton")
  mode      String   @default("markdown")   # "markdown" 或 "pdf"
  content   String   @default("")
  pdfPath   String?                          # 如 "/uploads/resume.pdf"
  updatedAt DateTime @updatedAt
}

model SiteSettings {
  id          String   @id @default("singleton")
  ownerName   String   @default("LFen")
  heroTagline String   @default("这里是我的个人空间...")
  updatedAt   DateTime @updatedAt
}
```

`JobApplication` 新增三字段：

```prisma
baseLocation String?   # BASE 地
hrContact    String?   # HR 联系方式
link         String?   # 投递链接
```

执行迁移：

```bash
npx prisma migrate dev --name add_post_resume_settings_job_fields
npx prisma generate
```

**注意：** `prisma generate` 后必须重启 Next.js dev server，否则 `globalThis.prisma` 缓存旧 client，新 model 会报 `Cannot read properties of undefined`。

---

## 三、内容迁移

**文件：** `scripts/migrate-content-to-db.ts`

将 `content/blog/`、`content/daily/`、`content/reflections/`、`content/resume.mdx` 迁移进 SQLite 的 `Post` / `Resume` 表，并初始化 `SiteSettings`。

运行一次：

```bash
npx tsx scripts/migrate-content-to-db.ts
```

旧 MDX 文件保留在 `content/` 作备份，不再被代码读取。

---

## 四、lib 层变更

### `lib/mdx.ts`（完全重写）

- 原来：同步读取本地 MDX 文件
- 现在：异步读取 Prisma `Post` / `Resume` 表
- `getPosts(type)` → `async`，返回 `PostMeta[]`
- `getPost(type, slug)` → `async`，返回 `Post | null`
- `getResumeContent()` → `async`，返回 `{ mode, content, pdfPath }`

**影响：** 所有调用方（页面组件）必须是 `async` server component，且要 `await`。

### `lib/validators.ts`（扩展）

新增：
- `createPostSchema` / `updatePostSchema`
- `resumeSchema`
- `siteSettingsSchema`
- `JobApplication` schema 加了 `baseLocation / hrContact / link`（均 optional nullable）

### `lib/enums.ts`（扩展）

新增：
```ts
export const POST_TYPES = ["blog", "daily", "reflections", "notes"] as const
export const POST_TYPE_LABELS: Record<string, string> = { blog: "博客", ... }
```

### `lib/api-client.ts`（新建）

统一 fetch 封装，所有请求默认 `cache: 'no-store'`：

```ts
apiFetch<T>(url, init?)      // GET
apiPost<T>(url, body)        // POST
apiPatch<T>(url, body)       // PATCH
apiDelete(url)               // DELETE
```

---

## 五、API 路由变更

### 全局规则（所有已有 / 新增 route.ts）

```ts
export const dynamic = "force-dynamic"
// 所有 GET 响应：
return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } })
```

### 已修改

| 文件 | 变更 |
|------|------|
| `app/api/jobs/route.ts` | 加 `dynamic` + `no-store` |
| `app/api/jobs/[id]/route.ts` | 加 `dynamic` + `no-store`；补加 `GET` handler |
| `app/api/jobs/stats/route.ts` | 加 `dynamic` + `no-store` |
| `app/api/interviews/route.ts` | 加 `dynamic` + `no-store` |
| `app/api/interviews/[id]/route.ts` | 加 `dynamic` + `no-store` |
| `app/api/interviews/stats/route.ts` | 加 `dynamic` + `no-store` |

### 新增

| 文件 | 说明 |
|------|------|
| `app/api/posts/route.ts` | GET（列表，支持 `?type=` `?q=`）+ POST（创建，自动 `revalidatePath`） |
| `app/api/posts/[id]/route.ts` | GET / PATCH / DELETE，写入后 `revalidatePath` |
| `app/api/resume/route.ts` | GET + PUT（更新 mode/content/pdfPath） |
| `app/api/resume/upload/route.ts` | POST multipart，保存到 `public/uploads/resume.pdf` |
| `app/api/settings/route.ts` | GET + PUT，写入后 `revalidatePath('/')` + `revalidatePath('/','layout')` |

---

## 六、组件变更

### 已修改

| 文件 | 变更 |
|------|------|
| `components/site-header.tsx` | 加「笔记」导航项；Logo 改读 `ownerName` prop；右侧加 `<SettingsDialog>` |
| `app/layout.tsx` | 改为 `async`，从 DB 读 `SiteSettings`，传 `ownerName / heroTagline` 给 Header |

### 新增

| 文件 | 说明 |
|------|------|
| `components/markdown-editor.tsx` | `"use client"` + `dynamic(() => import('@uiw/react-md-editor'), {ssr:false})`，接受 `value/onChange/height` |
| `components/post-editor-client.tsx` | `"use client"` 通用文章编辑器，接 `mode("create"\|"edit") / type / typeLabel / initialData`，含标题/摘要/日期/标签/内容字段 |
| `components/settings-dialog.tsx` | `"use client"` 齿轮图标 Dialog，编辑 `ownerName / heroTagline`，PUT `/api/settings` |
| `components/activity-heatmap.tsx` | `"use client"` SVG 热力图，接受 `data: Record<string,number>`（日期→活跃数） |
| `components/funnel-chart.tsx` | `"use client"` 横向漏斗图，接受 `steps: {label, value, color}[]` |

---

## 七、页面路由变更

### 已修改（改为 async + DB 数据源）

| 文件 | 变更 |
|------|------|
| `app/blog/page.tsx` | `async`，`await getPosts("blog")`；右上角加「新建」按钮 |
| `app/blog/[slug]/page.tsx` | `async`，`await getPost`；右上角加「编辑」链接 |
| `app/daily/page.tsx` | 同上 |
| `app/daily/[slug]/page.tsx` | 同上 |
| `app/reflections/page.tsx` | 同上 |
| `app/reflections/[slug]/page.tsx` | 同上 |
| `app/resume/page.tsx` | `async`，读 `getResumeContent()`；支持 markdown/pdf 双模式展示；「编辑」链接 |
| `app/page.tsx` | 全面重写：读 SiteSettings；新增写作统计、热力图、标签云、求职漏斗 |
| `app/jobs/jobs-client.tsx` | 点击行 → 只读 Sheet；Sheet 里有编辑/删除按钮；新增 BASE地/HR/链接字段；全部换用 `apiFetch`；`await` 刷新 |
| `app/interviews/interviews-client.tsx` | 全部换用 `apiFetch`；`await fetchData()` 保证刷新 |

### 新增页面

```
app/blog/new/page.tsx
app/blog/[slug]/edit/page.tsx

app/daily/new/page.tsx
app/daily/[slug]/edit/page.tsx

app/reflections/new/page.tsx
app/reflections/[slug]/edit/page.tsx

app/notes/page.tsx
app/notes/new/page.tsx
app/notes/[slug]/page.tsx
app/notes/[slug]/edit/page.tsx

app/resume/edit/page.tsx
app/resume/edit/resume-editor-client.tsx
```

---

## 八、缓存刷新问题根因与修复

**根因：** 浏览器对无 `Cache-Control` 响应头的 GET 请求可能做启发式缓存。加之 Next.js Router Cache 对 RSC payload 的缓存。

**修复三层：**

1. **服务端：** 所有 API route.ts 加 `export const dynamic = "force-dynamic"` + 响应头 `Cache-Control: no-store`
2. **客户端 fetch：** 统一走 `lib/api-client.ts`，默认 `cache: 'no-store'`
3. **变更后刷新：** 所有保存/删除操作后改为 `await Promise.all([fetchJobs(), fetchStats()])` 确保数据先回来再关闭弹窗

---

## 九、已知遗留 / 未做事项

1. **鉴权（Edit Password）**：设计方案中建议加简单密码保护（env `EDIT_PASSWORD` + cookie），**本次未实现**。站点若部署到公网任何人都能编辑。
2. **面试表查看 Sheet**：面试表已有独立 Detail Dialog（原有），本次未改造为 Sheet，若觉得体验不一致可后续统一。
3. **PDF 简历打印按钮**：PDF 模式下隐藏了打印按钮（只在 Markdown 模式显示），PDF 本身可在浏览器内直接打印。
4. **content/ 旧文件**：已迁移到 DB，旧 MDX 文件留作备份，可以手动删除或归档到 `content/_archive/`。
5. **移动端编辑器**：`@uiw/react-md-editor` 在手机上体验一般，如有需要可换轻量方案。

---

## 十、重启 Dev Server 的必要性

每次 `npx prisma generate` 后，**必须手动重启 Next.js dev server**（Ctrl+C → `npm run dev`）。

原因：`lib/db.ts` 将 PrismaClient 实例缓存在 `globalThis.prisma` 中，Turbopack 的热更新不会清除 `globalThis`，导致旧实例（没有新 model）持续被使用。
