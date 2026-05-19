// shared.jsx — atoms shared across the landing page.
// 中文 · 多用户个人空间平台 · 数据与实际 webappwork 项目对齐.

// 实际项目里的模块，对照 app/page.tsx + lib/permissions.ts
const MODULES = [
  { id: "home",        cn: "个人主页",     en: "HOME",         desc: "一处统御所有模块的入口仪表盘",            count: "—",    access: "open", color: "#6aa6ff", lang: "Dashboard" },
  { id: "blog",        cn: "博客",         en: "BLOG",         desc: "长文 · 技术 · 读书 · 随笔",              count: 47,     access: "open", color: "#6aa6ff", lang: "长文" },
  { id: "daily",       cn: "日常",         en: "DAILY",        desc: "时间线式的轻量日记",                       count: 213,    access: "open", color: "#7ee787", lang: "日记" },
  { id: "reflections", cn: "心得",         en: "REFLECTIONS",  desc: "复盘 · 年度总结 · 专题思考",              count: 24,     access: "open", color: "#f6c177", lang: "随笔" },
  { id: "notes",       cn: "笔记",         en: "NOTES",        desc: "碎片素材、剪贴板、私人备忘",               count: 312,    access: "auth", color: "#fb923c", lang: "便签" },
  { id: "resume",      cn: "简历",         en: "RESUME",       desc: "多模板 · Markdown / JSON · 一键打印",      count: 1,      access: "open", color: "#e94560", lang: "简历" },
  { id: "jobs",        cn: "求职追踪",     en: "JOBS",         desc: "投递 · 回复 · 面试 · Offer 全流程看板",    count: 87,     access: "auth", color: "#4a85e0", lang: "求职" },
  { id: "interviews",  cn: "面试记录",     en: "INTERVIEWS",   desc: "每轮提问 · 自评 · 复盘",                   count: 19,     access: "auth", color: "#58c25c", lang: "面试" },
  { id: "friends",     cn: "好友 · 聊天",  en: "FRIENDS",      desc: "私聊、群聊、好友圈动态",                   count: 184,    access: "auth", color: "#a78bfa", lang: "社交" },
  { id: "community",   cn: "社区资源",     en: "COMMUNITY",    desc: "网站收藏 · GIF 表情包社区",               count: 421,    access: "open", color: "#22d3ee", lang: "社区" },
  { id: "soulwing",    cn: "蝶灵圆桌",     en: "ROUNDTABLE",   desc: "每天两场议题，多人异步讨论",                count: 32,     access: "auth", color: "#ec4899", lang: "讨论" },
  { id: "ai",          cn: "AI 助手",      en: "AI",           desc: "私人对话 · 写作 / 简历润色",               count: "—",    access: "auth", color: "#a78bfa", lang: "AI" },
  { id: "sql",         cn: "SQL 实验室",   en: "SQL LAB",      desc: "在线 SQL 练习 + 小型数据探索",            count: "—",    access: "auth", color: "#22d3ee", lang: "SQL" },
  { id: "guestbook",   cn: "留言板",       en: "GUESTBOOK",    desc: "访客留言、表情包、回复线程",               count: 312,    access: "open", color: "#f6c177", lang: "留言" },
];

// 公开文章 — 来自不同用户的 demo 内容
const POSTS = [
  { date: "2026-05-19 09:02", by: "ada",     title: "从 SQLite 迁到 Postgres 的踩坑记录",      tag: "工程", read: 8,  views: 247, comments: 12 },
  { date: "2026-05-17 22:41", by: "mori",    title: "写作的复利：从早睡开始",                  tag: "心得", read: 4,  views: 89,  comments: 7  },
  { date: "2026-05-15 11:28", by: "lin01",   title: "2026 春招样本：60 投递 22 回复 9 面试",   tag: "求职", read: 12, views: 412, comments: 34 },
  { date: "2026-05-13 16:55", by: "shen",    title: "把求职追踪做成自己用的工具",              tag: "工程", read: 6,  views: 156, comments: 9  },
  { date: "2026-05-11 08:14", by: "qiu",     title: "面试官那个奇怪的算法题，我事后想了三天",   tag: "面试", read: 9,  views: 203, comments: 21 },
];

// 站内动态 — 用真实平台行为代替 GitHub 的 commit/fork/star
const ACTIVITY = [
  { t: "刚刚",       who: "ada",   avatar: "#6aa6ff", action: "publish",   tag: "博客", target: "从 SQLite 迁到 Postgres" },
  { t: "12 秒前",    who: "shen",  avatar: "#f6c177", action: "job",       tag: "求职", target: "字节跳动 · 已回复" },
  { t: "1 分钟前",   who: "qiu",   avatar: "#7ee787", action: "interview", tag: "面试", target: "蚂蚁 · 技术二面" },
  { t: "3 分钟前",   who: "mori",  avatar: "#a78bfa", action: "daily",     tag: "日常", target: "咖啡馆早晨" },
  { t: "5 分钟前",   who: "lin01", avatar: "#ec4899", action: "guestbook", tag: "留言", target: "在 @shen 的留言板" },
  { t: "11 分钟前",  who: "yan",   avatar: "#22d3ee", action: "join",      tag: "新人", target: "刚刚创建了空间" },
  { t: "18 分钟前",  who: "ada",   avatar: "#6aa6ff", action: "comment",   tag: "评论", target: "@mori 的博客" },
  { t: "26 分钟前",  who: "shen",  avatar: "#f6c177", action: "resume",    tag: "简历", target: "更新到 v2 · 2026" },
  { t: "42 分钟前",  who: "rin",   avatar: "#fb923c", action: "roundtable",tag: "圆桌", target: "晚间议题：写作的目的" },
  { t: "1 小时前",   who: "mori",  avatar: "#a78bfa", action: "ai",        tag: "AI",   target: "完成了一次简历润色" },
];

const ACTION_LABELS = {
  publish:    "发布了",
  job:        "记录了投递",
  interview:  "新增了一轮面试",
  daily:     "写了日常",
  guestbook: "留下了一条留言",
  join:      "加入了平台",
  comment:   "在评论",
  resume:    "更新了简历",
  roundtable:"参加了圆桌",
  ai:        "调用了 AI",
};

// 推荐空间 — 平台上活跃的用户
const SPACES = [
  { handle: "ada",   color: "#6aa6ff", role: "后端工程师 · 杭州",   posts: 47, streak: 213 },
  { handle: "mori",  color: "#a78bfa", role: "写作者 · 北京",       posts: 89, streak: 412 },
  { handle: "shen",  color: "#f6c177", role: "全栈工程师 · 上海",   posts: 32, streak: 156 },
  { handle: "lin01", color: "#ec4899", role: "设计师 · 深圳",       posts: 24, streak: 87  },
  { handle: "qiu",   color: "#7ee787", role: "学生 · 武汉",         posts: 18, streak: 64  },
  { handle: "yan",   color: "#22d3ee", role: "产品 · 广州",         posts: 12, streak: 41  },
];

// 更新日志 — 来自项目 CHANGES-V2.md 风格
const RELEASES = [
  { tag: "v2.4.1", date: "2026-05-19", title: "搜索 ⌘K · 暗色 dim 模式 · 留言板优化", latest: true },
  { tag: "v2.4.0", date: "2026-05-12", title: "AI 助手 + 面试记录模板",                          },
  { tag: "v2.3.0", date: "2026-04-28", title: "SQL 实验室上线 · 全站活跃热力图",                  },
  { tag: "v2.2.0", date: "2026-04-12", title: "好友圈、聊天频道、蝶灵圆桌",                       },
];

// 平台聚合数据
const PLATFORM = {
  users:      1247,
  spaces:     1247,
  posts:      8946,
  jobs:       12483,
  interviews: 3201,
  comments:   1842,
  visits:     289430,
  commits365: 18642,
  uptime:     "99.98%",
  built:      "2026-05-19",
  version:    "v2.4.1",
  hash:       "a3f9c27",
  online:     43,            // 当前在线人数
  joined7d:   28,
};

// 53 周 × 7 天热度矩阵 — 用于全站书写热度图
function activityMatrix(weeks = 53, seedShift = 0) {
  const out = [];
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const k = (w * 31 + d * 17 + seedShift * 13 + 7) * 9301 + 49297;
      const r = ((k % 233280) / 233280);
      const ramp = 0.25 + (Math.sin((w / weeks) * Math.PI) * 0.55);
      const v = r < (1 - ramp) ? 0 :
                r < (1 - ramp * 0.55) ? 1 :
                r < (1 - ramp * 0.3) ? 2 :
                r < (1 - ramp * 0.1) ? 3 : 4;
      col.push(v);
    }
    out.push(col);
  }
  return out;
}

// ─── Icons ──────────────────────────────────────────────────────────────────
function Icon({ name, size = 14, stroke = 1.5 }) {
  const P = {
    arrowR:   <><path d="M5 12h14"/><path d="m13 5 7 7-7 7"/></>,
    arrowUR:  <><path d="M7 17 17 7"/><path d="M7 7h10v10"/></>,
    plus:     <><path d="M12 5v14 M5 12h14"/></>,
    lock:     <><rect x="4" y="11" width="16" height="10" rx="1.5"/><path d="M8 11V7a4 4 0 1 1 8 0v4"/></>,
    open:     <><circle cx="12" cy="12" r="3"/></>,
    enter:    <><path d="M3 12h14"/><path d="m12 5 7 7-7 7"/><path d="M21 4v6"/></>,
    chevR:    <><path d="m9 6 6 6-6 6"/></>,
    chevD:    <><path d="m6 9 6 6 6-6"/></>,
    dot:      <><circle cx="12" cy="12" r="4"/></>,
    activity: <><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></>,
    file:     <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></>,
    folder:   <><path d="M3 8a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></>,
    star:     <><path d="m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/></>,
    eye:      <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
    clock:    <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    bell:     <><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M9 21a3 3 0 0 0 6 0"/></>,
    search:   <><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>,
    menu:     <><path d="M3 6h18 M3 12h18 M3 18h18"/></>,
    commit:   <><circle cx="12" cy="12" r="3"/><path d="M3 12h6m6 0h6"/></>,
    chat:     <><path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z"/></>,
    person:   <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    persons:  <><circle cx="9" cy="8" r="3.5"/><path d="M2 21a7 7 0 0 1 14 0"/><circle cx="17" cy="6" r="3"/><path d="M22 18a5 5 0 0 0-5-5"/></>,
    pin:      <><path d="M16 4v6l4 5h-7v6l-2-3-2 3v-6H2l4-5V4"/><path d="M9 4h6"/></>,
    flame:    <><path d="M12 22s7-4 7-11c0-3-2-5-3-5s-1 2-1 2-2-4-5-4-4 3-4 6c0 7 6 12 6 12z"/></>,
    book:     <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></>,
    briefcase:<><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></>,
    video:    <><path d="m22 8-6 4 6 4Z"/><rect x="2" y="6" width="14" height="12" rx="2"/></>,
    sticky:   <><path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5z"/><path d="M15 3v6h6"/></>,
    sparkles: <><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/></>,
    database: <><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4 M8 2v4 M3 10h18"/></>,
    bulb:     <><path d="M9 18h6 M10 22h4"/><path d="M15.1 14.5c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5a6 6 0 0 0-12 0c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5"/></>,
    map:      <><path d="M1 6v15l7-3 8 3 7-3V3l-7 3-8-3z"/><path d="M8 3v15 M16 6v15"/></>,
    code:     <><path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/></>,
    rss:      <><path d="M3 11a9 9 0 0 1 9 9"/><path d="M3 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></>,
    tag:      <><path d="M20 12v7a1 1 0 0 1-1 1h-7l-9-9 8-8h8a1 1 0 0 1 1 1z"/><circle cx="14" cy="10" r="1.5"/></>,
    funnel:   <><path d="M3 4h18l-7 9v6l-4 2v-8z"/></>,
    pen:      <><path d="m12 19 7-7 3 3-7 7-3-3z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18 M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></>,
    share:    <><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></>,
    check:    <><path d="M20 6 9 17l-5-5"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
         style={{ display: "inline-block", verticalAlign: "-2px", flexShrink: 0 }}>
      {P[name]}
    </svg>
  );
}

// ─── ActivityHeatmap (full year, configurable) ──────────────────────────────
function ActivityHeatmap({ weeks = 53, cell = 11, gap = 3, color, seedShift = 0 }) {
  const matrix = React.useMemo(() => activityMatrix(weeks, seedShift), [weeks, seedShift]);
  const totalW = weeks * (cell + gap) - gap;
  const totalH = 7 * (cell + gap) - gap;
  const c = color || "var(--accent)";
  return (
    <svg width={totalW} height={totalH} style={{ display: "block" }}>
      {matrix.map((col, w) => col.map((v, d) => (
        <rect
          key={`${w}-${d}`}
          x={w * (cell + gap)} y={d * (cell + gap)}
          width={cell} height={cell} rx="2"
          fill={v === 0 ? "var(--surface-2)" : c}
          fillOpacity={v === 0 ? 1 : [0, 0.22, 0.42, 0.68, 1][v]}
        />
      )))}
    </svg>
  );
}

// 简短趋势线
function Spark({ values, color, w = 80, h = 18 }) {
  const max = Math.max(...values), min = Math.min(...values), r = max - min || 1;
  const pts = values.map((v, i) =>
    `${(i / (values.length - 1)) * w},${h - ((v - min) / r) * (h - 2) - 1}`).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color || "var(--accent)"} strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  );
}

// 全局样式注入
(function injectGlobals() {
  if (document.getElementById("__shared-style")) return;
  const s = document.createElement("style");
  s.id = "__shared-style";
  s.textContent = `
    @keyframes blink { 0%,55%{opacity:1} 56%,100%{opacity:0} }
    @keyframes pulse-dot { 0%, 100%{opacity:.4} 50%{opacity:1} }
    .live-dot { animation: pulse-dot 1.4s ease-in-out infinite; }
  `;
  document.head.appendChild(s);
})();

Object.assign(window, {
  MODULES, POSTS, ACTIVITY, ACTION_LABELS, PLATFORM, SPACES, RELEASES,
  Icon, ActivityHeatmap, Spark, activityMatrix,
});
