// landing-header.jsx — 顶部 chrome (中文).
// 取消了 GitHub Watch/Fork/Star, 换成对项目有意义的"登录 / 创建空间 / 公开浏览"等操作.

const { Icon: HI, PLATFORM: HP } = window;

function GlobalHeader() {
  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 50,
      borderBottom: "1px solid var(--line-2)", background: "var(--bg-deep)",
    }}>
      <div style={{
        height: 54, padding: "0 22px",
        display: "flex", alignItems: "center", gap: 14,
        maxWidth: 1440, margin: "0 auto",
      }}>
        <button style={iconBtn} aria-label="菜单"><HI name="menu" size={18}/></button>

        {/* 品牌 mark */}
        <a href="#" style={{
          display: "inline-flex", alignItems: "center", gap: 8, padding: "0 4px",
          color: "var(--text)", fontSize: 14, fontWeight: 600,
        }}>
          <SpaceMark size={26}/>
          <span style={{ fontFamily: "var(--f-display)", fontStyle: "italic", fontSize: 17 }}>my space</span>
        </a>

        <span style={{
          marginLeft: 4, padding: "2px 7px", fontSize: 10.5,
          color: "var(--text-3)", fontFamily: "var(--f-mono)",
          border: "1px solid var(--line-2)", borderRadius: 4, letterSpacing: "0.04em",
        }}>{HP.version} · 邀请测试中</span>

        {/* 搜索 */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          marginLeft: 16, padding: "5px 10px",
          border: "1px solid var(--line-2)", borderRadius: 6,
          width: 320, fontSize: 12.5, color: "var(--text-3)",
          background: "var(--surface)",
        }}>
          <HI name="search" size={13}/>
          <span style={{ flex: 1 }}>搜索空间、文章、模块</span>
          <span className="mono" style={{
            padding: "1px 6px", border: "1px solid var(--line-2)", borderRadius: 3, fontSize: 10,
            color: "var(--text-2)",
          }}>⌘&nbsp;K</span>
        </div>

        <div style={{ flex: 1 }}/>

        <nav style={{ display: "flex", gap: 16, fontSize: 13, color: "var(--text-2)" }}>
          <a href="#features">功能</a>
          <a href="#preview">预览</a>
          <a href="#community">社区</a>
          <a href="#changelog">更新</a>
          <a href="#faq">FAQ</a>
        </nav>

        <span style={{ width: 1, height: 18, background: "var(--line-2)" }}/>

        <a href="#" style={{
          fontSize: 13, color: "var(--text)", padding: "5px 12px", fontWeight: 500,
        }}>登录</a>
        <a href="#" style={{
          fontSize: 13, color: "var(--bg-deep)",
          padding: "5px 14px", borderRadius: 6,
          background: "var(--green-2)", fontWeight: 600,
          border: "1px solid color-mix(in oklab, var(--green-2) 60%, #000)",
          boxShadow: "0 1px 0 rgba(255,255,255,0.1) inset",
        }}>创建你的空间</a>
      </div>
    </header>
  );
}

function ProjectHeaderStrip() {
  return (
    <div style={{
      borderBottom: "1px solid var(--line-2)",
      background: "linear-gradient(180deg, var(--bg) 0%, var(--bg-deep) 100%)",
    }}>
      <div style={{
        maxWidth: 1440, margin: "0 auto",
        padding: "20px 22px 0",
        display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16,
      }}>
        <div>
          <div style={{
            display: "flex", alignItems: "center", gap: 10, fontSize: 18, fontWeight: 600, marginBottom: 4,
          }}>
            <HI name="folder" size={16}/>
            <a href="#" style={{ color: "var(--accent)" }}>my-space</a>
            <span style={{ color: "var(--text-3)" }}>/</span>
            <span style={{ color: "var(--text)" }}>你的个人空间</span>
            <span className="chip">公开</span>
            <span className="chip" style={{ color: "var(--warm)", borderColor: "color-mix(in oklab, var(--warm) 30%, var(--line-2))" }}>
              <HI name="pin" size={10}/>邀请制
            </span>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-3)", marginLeft: 26, maxWidth: 720 }}>
            一处写作、求职、复盘、社交的个人空间。博客 · 日常 · 简历 · 求职追踪 · 面试记录 · 蝶灵圆桌 · AI 助手 · SQL 实验室。
            <span style={{ color: "var(--text-2)" }}>所有模块逐项可见性控制，数据可导出。</span>
          </p>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <GroupButton icon="eye"    label="浏览公开空间" n={HP.spaces.toLocaleString()} />
          <GroupButton icon="bell"   label="订阅更新"     n="RSS" />
          <GroupButton icon="star"   label="收藏"        n={HP.users.toLocaleString()} highlight />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "0 22px" }}>
        <nav style={{ display: "flex", gap: 2, marginTop: 16, alignItems: "stretch", fontSize: 13.5 }}>
          {[
            { l: "总览",         n: "",                          icon: "book",      active: true },
            { l: "空间",         n: HP.users.toLocaleString(),    icon: "person" },
            { l: "动态",         n: HP.commits365.toLocaleString(), icon: "activity" },
            { l: "公开文章",     n: HP.posts.toLocaleString(),     icon: "pen" },
            { l: "更新日志",     n: "12",                          icon: "tag" },
            { l: "讨论",         n: "1.8k",                        icon: "chat" },
            { l: "FAQ",          n: "",                            icon: "" },
          ].map(t => (
            <a key={t.l} href="#" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "10px 12px",
              borderBottom: t.active ? "2px solid var(--warm)" : "2px solid transparent",
              color: t.active ? "var(--text)" : "var(--text-2)",
              fontWeight: t.active ? 500 : 400,
            }}>
              {t.icon && <HI name={t.icon} size={14}/>}
              {t.l}
              {t.n && <span className="chip" style={{ padding: "0 6px", fontSize: 10, color: "var(--text-3)" }}>{t.n}</span>}
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}

function GroupButton({ icon, label, n, highlight }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "stretch",
      border: "1px solid var(--line-2)", borderRadius: 6,
      background: "var(--surface)",
      overflow: "hidden",
    }}>
      <button style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "5px 10px",
        background: "transparent", color: "var(--text)",
        border: 0, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit",
      }}>
        <HI name={icon} size={13}/> {label}
      </button>
      <span style={{
        padding: "5px 9px", fontSize: 12.5, color: "var(--text-2)",
        borderLeft: "1px solid var(--line-2)",
        background: "var(--bg-deep)",
        fontFamily: "var(--f-mono)", fontWeight: 500,
      }}>{n}</span>
    </div>
  );
}

const iconBtn = {
  position: "relative",
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 30, height: 30,
  background: "transparent", color: "var(--text-2)",
  border: 0, cursor: "pointer", borderRadius: 6, padding: 0,
  fontFamily: "inherit",
};

function SpaceMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={{ flexShrink: 0 }}>
      <rect x="3" y="3" width="26" height="26" rx="4" fill="none" stroke="currentColor" strokeWidth="1.4"/>
      <rect x="9" y="9" width="14" height="14" rx="2" fill="none" stroke="var(--accent)" strokeWidth="1.4"/>
      <rect x="13.5" y="13.5" width="5" height="5" rx="0.5" fill="var(--accent)"/>
    </svg>
  );
}

Object.assign(window, { GlobalHeader, ProjectHeaderStrip, SpaceMark });
