// landing-sidebar.jsx — 左侧概览 (中文).

const { Icon: SI, PLATFORM: SP, MODULES: SM, SPACES: SS } = window;

function Sidebar() {
  return (
    <aside style={{ width: 296, flexShrink: 0 }}>
      {/* Avatar mark */}
      <div style={{ position: "relative" }}>
        <div style={{
          width: 296, height: 296,
          border: "1px solid var(--line-2)",
          borderRadius: "50%",
          background: "var(--surface)",
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative", overflow: "hidden",
        }}>
          <BigSpaceMark/>
        </div>
        <a href="#" style={{
          position: "absolute", left: 14, bottom: -10,
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 12px",
          background: "var(--surface)",
          border: "1px solid var(--line-2)",
          borderRadius: 999,
          fontSize: 12, color: "var(--text-2)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        }}>
          <span className="live-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)" }}/>
          <span style={{ color: "var(--text)" }}>当前 {SP.online} 人在线 · {SP.joined7d} 个新空间 / 7d</span>
        </a>
      </div>

      {/* 名称 + handle */}
      <h1 style={{ fontSize: 26, fontWeight: 600, marginTop: 22, color: "var(--text)", letterSpacing: "-0.01em" }}>
        my-space
      </h1>
      <div style={{ fontSize: 20, color: "var(--text-3)", fontWeight: 300, marginBottom: 14, marginTop: 2 }}>
        <span className="mono">/@你</span>
      </div>

      <p style={{
        fontSize: 14, color: "var(--text-2)", lineHeight: 1.6, marginBottom: 16,
      }}>
        一处统御写作、求职、社交的个人空间。
        <strong style={{ color: "var(--text)", fontWeight: 600 }}>每个用户自带一整套模块</strong>，公开还是私人由你决定。
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
        <a href="#" className="btn btn-sm" style={{
          width: "100%", justifyContent: "center", padding: "8px 14px",
          background: "var(--green-2)", borderColor: "color-mix(in oklab, var(--green-2) 60%, #000)",
          color: "var(--bg-deep)", fontWeight: 600, fontSize: 13,
          boxShadow: "0 1px 0 rgba(255,255,255,0.1) inset",
        }}>
          <SI name="plus" size={13}/> 创建你的空间
        </a>
        <a href="#" className="btn btn-sm" style={{
          width: "100%", justifyContent: "center", padding: "8px 14px", fontSize: 13,
        }}>
          <SI name="enter" size={13}/> 登录已有账号
        </a>
        <a href="#" className="btn btn-sm" style={{
          width: "100%", justifyContent: "center", padding: "8px 14px", fontSize: 13,
          background: "var(--surface-2)", color: "var(--text-2)",
        }}>
          <SI name="eye" size={12}/> 浏览公开空间
        </a>
      </div>

      {/* 关于 */}
      <ul style={{
        listStyle: "none", padding: 0, margin: "0 0 18px",
        fontSize: 13, color: "var(--text-2)",
        display: "flex", flexDirection: "column", gap: 7,
        paddingBottom: 18, borderBottom: "1px solid var(--line-2)",
      }}>
        <li style={liStyle}>
          <SI name="person" size={13}/>
          <span><span style={{ color: "var(--text)" }}>{SP.users.toLocaleString()}</span> 个活跃空间</span>
        </li>
        <li style={liStyle}>
          <SI name="pen" size={13}/>
          <span><span style={{ color: "var(--text)" }}>{SP.posts.toLocaleString()}</span> 篇公开文章</span>
        </li>
        <li style={liStyle}>
          <SI name="briefcase" size={13}/>
          <span><span style={{ color: "var(--text)" }}>{SP.jobs.toLocaleString()}</span> 条求职记录</span>
        </li>
        <li style={liStyle}>
          <SI name="eye" size={13}/>
          <span><span style={{ color: "var(--text)" }}>{SP.visits.toLocaleString()}</span> 次访客访问</span>
        </li>
        <li style={liStyle}>
          <SI name="clock" size={13}/>
          <span>上线 757 天 · <span style={{ color: "var(--green)" }}>{SP.uptime}</span></span>
        </li>
        <li style={liStyle}>
          <SI name="code" size={13}/> <span>开源 · MIT · 中文 / EN</span>
        </li>
      </ul>

      {/* 模块覆盖 */}
      <Section title="平台模块" right={<span style={{ fontSize: 11, color: "var(--text-3)" }}>共 {SM.length} 个</span>}>
        <ModulesBar/>
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-2)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px 12px" }}>
          {SM.slice(0, 8).map(m => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: m.color }}/>
              <span>{m.cn}</span>
              <span style={{ color: "var(--text-4)", marginLeft: "auto", fontFamily: "var(--f-mono)", fontSize: 10.5 }}>
                {m.access === "open" ? "公开" : "私"}
              </span>
            </div>
          ))}
        </div>
        <a href="#" style={{ display: "inline-block", marginTop: 8, fontSize: 12, color: "var(--accent)" }}>
          查看全部 14 个模块 →
        </a>
      </Section>

      {/* 推荐空间 */}
      <Section title="推荐空间" right={<a href="#" style={{ fontSize: 12, color: "var(--accent)" }}>全部 →</a>}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {SS.slice(0, 4).map(s => (
            <a key={s.handle} href="#" style={{
              display: "grid", gridTemplateColumns: "26px 1fr auto", gap: 10,
              alignItems: "center",
            }}>
              <span style={{
                width: 26, height: 26, borderRadius: "50%",
                background: s.color, opacity: 0.85,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--bg-deep)", fontSize: 11, fontFamily: "var(--f-mono)", fontWeight: 700,
              }}>
                {s.handle.slice(0, 2)}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: "var(--text)", fontSize: 13, fontWeight: 500, lineHeight: 1.2 }}>
                  @{s.handle}
                </div>
                <div style={{ color: "var(--text-3)", fontSize: 11, lineHeight: 1.3 }}>
                  {s.role}
                </div>
              </div>
              <span className="mono" style={{ fontSize: 10.5, color: "var(--text-3)", whiteSpace: "nowrap" }}>
                <SI name="flame" size={10}/> {s.streak}d
              </span>
            </a>
          ))}
        </div>
      </Section>

      <div style={{ marginTop: 12, fontSize: 11.5, color: "var(--text-4)" }}>
        <a href="#" style={{ color: "var(--text-3)" }}>反馈问题</a> · <a href="#" style={{ color: "var(--text-3)" }}>自部署文档</a>
      </div>
    </aside>
  );
}

function Section({ title, right, children }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{
        display: "flex", alignItems: "baseline", justifyContent: "space-between",
        marginBottom: 8, fontSize: 13,
      }}>
        <h3 style={{ fontWeight: 600, color: "var(--text)" }}>{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

const liStyle = { display: "flex", alignItems: "center", gap: 8 };

// 模块占比条
function ModulesBar() {
  // 简单按 demo 数据给一个占比
  const slices = [
    { color: "#6aa6ff", w: 28 },  // 写作类
    { color: "#a78bfa", w: 18 },  // 社交
    { color: "#f6c177", w: 14 },  // 求职
    { color: "#7ee787", w: 12 },  // 简历
    { color: "#ec4899", w: 10 },  // 圆桌
    { color: "#22d3ee", w:  9 },  // SQL/AI
    { color: "#fb923c", w:  9 },  // 笔记/其他
  ];
  return (
    <div style={{
      display: "flex", width: "100%", height: 8,
      borderRadius: 999, overflow: "hidden", background: "var(--surface-2)",
    }}>
      {slices.map((s, i) => <span key={i} style={{ width: `${s.w}%`, background: s.color }}/>)}
    </div>
  );
}

// 大 mark for the sidebar
function BigSpaceMark() {
  return (
    <svg width="220" height="220" viewBox="0 0 220 220">
      <defs>
        <radialGradient id="bg-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18"/>
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="110" cy="110" r="110" fill="url(#bg-glow)"/>
      <rect x="20" y="20" width="180" height="180" rx="10" fill="none"
            stroke="var(--line-strong)" strokeWidth="1"/>
      <rect x="20" y="20" width="180" height="180" rx="10" fill="none"
            stroke="var(--accent)" strokeWidth="1" strokeOpacity="0.25" strokeDasharray="3 5"/>
      <rect x="48" y="48" width="124" height="124" rx="6" fill="none"
            stroke="var(--accent)" strokeWidth="1"/>
      <path d="M48 110 H172 M110 48 V172" stroke="var(--accent)" strokeWidth="0.8" strokeOpacity="0.35"/>
      <rect x="86" y="86" width="48" height="48" rx="3" fill="var(--accent)" fillOpacity="0.9"/>
      <rect x="100" y="100" width="20" height="20" rx="1" fill="var(--bg-deep)"/>
      {[[20,20],[200,20],[20,200],[200,200]].map(([x, y], i) => (
        <g key={i} fill="var(--text-3)">
          <rect x={x-2} y={y-2} width="4" height="4"/>
        </g>
      ))}
      <text x="110" y="218" textAnchor="middle"
            fontFamily="var(--f-mono)" fontSize="9" fill="var(--text-3)" letterSpacing="3">MY · SPACE · 2026</text>
    </svg>
  );
}

Object.assign(window, { Sidebar, BigSpaceMark, Section });
