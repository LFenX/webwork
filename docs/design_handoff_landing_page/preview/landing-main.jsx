// landing-main.jsx — 主栏，全部贴合实际 webappwork 项目.

const {
  Icon: MI, ActivityHeatmap: MAH,
  MODULES: MM, POSTS: MPOSTS, ACTIVITY: MACT, ACTION_LABELS: MAL,
  PLATFORM: MP, RELEASES: MR, SPACES: MSP,
} = window;

function MainColumn() {
  return (
    <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 22 }}>
      <IntroCard/>
      <FeaturesShowcase/>
      <PersonalHomePreview/>
      <ContributionCard/>
      <RecentRow/>
      <ChangelogAndSpacesRow/>
      <FAQCard/>
    </main>
  );
}

// ─── 01 介绍卡 ──────────────────────────────────────────────────────────────
function IntroCard() {
  return (
    <section className="card-gh" id="features">
      <CardChrome icon="file" title="平台介绍" right={
        <span className="mono" style={{ color: "var(--text-3)", fontSize: 11.5 }}>
          README.md · 中文 / EN · 阅读约 2 分钟
        </span>
      }/>
      <div style={{ padding: "26px 30px 28px" }}>
        <h2 className="serif" style={{
          fontSize: 36, fontStyle: "italic", color: "var(--text)",
          marginBottom: 8, fontWeight: 400, letterSpacing: "-0.015em", lineHeight: 1.15,
        }}>
          一处<span style={{ color: "var(--accent)" }}>属于你</span>的个人空间。
        </h2>
        <p style={{
          fontSize: 14.5, color: "var(--text-2)", lineHeight: 1.7, marginBottom: 16,
          fontFamily: "var(--f-cn-serif)",
        }}>
          <strong style={{ color: "var(--text)", fontWeight: 600 }}>my-space</strong>
          是一个多用户写作 + 求职 + 社交平台。每个用户登录后会得到一整套模块——
          <a href="#" className="link">博客</a>、
          <a href="#" className="link">日常</a>、
          <a href="#" className="link">心得</a>、
          <a href="#" className="link">笔记</a>、
          <a href="#" className="link">简历</a>、
          <a href="#" className="link">求职追踪</a>、
          <a href="#" className="link">面试记录</a>、
          <a href="#" className="link">好友 / 聊天频道</a>、
          <a href="#" className="link">蝶灵圆桌</a>、
          <a href="#" className="link">AI 助手</a>、
          <a href="#" className="link">SQL 实验室</a>、
          <a href="#" className="link">留言板</a>。
          <br/>
          <span style={{ color: "var(--text-3)" }}>哪些公开、哪些只给好友看、哪些彻底私人——逐模块由你决定。</span>
        </p>

        {/* 引用块 */}
        <blockquote style={{
          borderLeft: "3px solid var(--accent)",
          padding: "8px 18px",
          color: "var(--text-2)", fontSize: 14.5, lineHeight: 1.6,
          margin: "16px 0",
          fontStyle: "italic", fontFamily: "var(--f-display)",
        }}>
          “把事情写下来。回头看。注意到自己这一年的形状。”
          <span style={{ display: "block", fontSize: 12, color: "var(--text-3)", marginTop: 4, fontStyle: "normal", fontFamily: "var(--f-cn-serif)" }}>
            —— 这个平台唯一的规矩
          </span>
        </blockquote>

        {/* 命令行 */}
        <div style={{
          display: "flex", alignItems: "center", gap: 16,
          marginTop: 14, padding: "12px 14px",
          background: "var(--bg-deep)", border: "1px solid var(--line-2)", borderRadius: 6,
          fontFamily: "var(--f-mono)", fontSize: 12.5,
        }}>
          <span style={{ color: "var(--text-3)" }}>→</span>
          <span style={{ color: "var(--text)" }}>访问 <span style={{ color: "var(--green)" }}>{"/u/<你的 handle>"}</span></span>
          <span style={{ color: "var(--text-3)" }}># 注册即生成你的公开空间 URL，可一键分享</span>
          <span style={{ flex: 1 }}/>
          <button style={{
            padding: "3px 9px", border: "1px solid var(--line-strong)",
            background: "var(--surface)", color: "var(--text-2)",
            borderRadius: 4, fontSize: 11, fontFamily: "inherit", cursor: "pointer",
          }}>复制</button>
        </div>

        <h3 style={{ marginTop: 22, fontSize: 16, color: "var(--text)", fontWeight: 600 }}>
          为什么用 my-space
        </h3>
        <ul style={{ margin: "10px 0 8px", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            "公开主页可分享：/u/handle 自定义短链，访客可留言、统计访问数",
            "求职闭环：投递 → 已回复 → 进入面试 → Offer，看漏斗看自己的转化率",
            "面试记录：每轮提问、自评 1–5 星、复盘，下次复习不靠记忆",
            "蝶灵圆桌：每天早晚两场议题，多人异步讨论，凉了再来",
            "AI 助手只对你说话：写作辅助、简历润色、不训练你的数据",
            "数据全部可导出：Markdown + JSON，跟我无关也带走",
          ].map((t, i) => (
            <li key={i} style={{ display: "flex", gap: 10, fontSize: 14, color: "var(--text-2)", lineHeight: 1.55 }}>
              <span style={{
                marginTop: 4, width: 14, height: 14, flexShrink: 0,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                border: "1px solid var(--line-strong)", borderRadius: 3, background: "var(--accent)",
              }}>
                <MI name="check" size={10} stroke={3}/>
              </span>
              <span>{t}</span>
            </li>
          ))}
        </ul>

        <hr style={{ margin: "20px 0", border: 0, borderTop: "1px solid var(--line-2)" }}/>
        <p style={{ fontSize: 13, color: "var(--text-3)", lineHeight: 1.5 }}>
          继续阅读：<a href="#preview" className="link">登录后你会看到什么</a> ·{" "}
          <a href="#community" className="link">浏览公开空间</a> ·{" "}
          <a href="#changelog" className="link">v2.4 更新内容</a> ·{" "}
          <a href="#faq" className="link">常见问题</a>
        </p>
      </div>
    </section>
  );
}

// ─── 02 功能展示 ────────────────────────────────────────────────────────────
function FeaturesShowcase() {
  return (
    <section>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", display: "flex", gap: 6, alignItems: "center" }}>
          <MI name="pin" size={13}/>
          十四个模块 · 一个空间
          <span className="chip" style={{ fontSize: 10, padding: "0 6px" }}>实际功能</span>
        </h3>
        <a href="#" style={{ fontSize: 12, color: "var(--accent)" }}>逐项可见性控制 →</a>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {MM.slice(0, 9).map(m => <FeatureCard key={m.id} m={m}/>)}
      </div>
    </section>
  );
}

function FeatureCard({ m }) {
  const iconMap = {
    home: "folder", blog: "pen", daily: "calendar", reflections: "bulb",
    notes: "sticky", resume: "file", jobs: "briefcase", interviews: "video",
    friends: "persons", community: "share", soulwing: "chat", ai: "sparkles",
    sql: "database", guestbook: "chat",
  };
  return (
    <a href="#" className="card-gh" style={{
      display: "block", padding: 14, transition: "border-color .15s",
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = "color-mix(in oklab, var(--accent) 50%, var(--line-2))"}
      onMouseLeave={e => e.currentTarget.style.borderColor = ""}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 24, height: 24, borderRadius: 5, color: m.color,
          background: "color-mix(in oklab, " + m.color + " 14%, transparent)",
        }}>
          <MI name={iconMap[m.id]} size={13}/>
        </span>
        <span style={{ color: "var(--accent)", fontWeight: 600, fontSize: 13.5 }}>{m.cn}</span>
        <span className="chip" style={{ marginLeft: "auto", fontSize: 9.5, padding: "1px 6px" }}>
          {m.access === "open" ? "公开可见" : "仅登录"}
        </span>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5, minHeight: 36 }}>
        {m.desc}
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 11, color: "var(--text-3)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 8, height: 8, background: m.color, borderRadius: "50%" }}/>
          {m.lang}
        </span>
        {m.count && m.count !== "—" && (
          <span className="mono">数据 {m.count} 条</span>
        )}
      </div>
    </a>
  );
}

// ─── 03 个人主页预览 ──────────────────────────────────────────────────────
function PersonalHomePreview() {
  return (
    <section id="preview">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", gap: 6 }}>
          <MI name="eye" size={13}/>
          登录后你会看到
          <span className="chip" style={{ fontSize: 10, padding: "0 6px", color: "var(--green)", borderColor: "color-mix(in oklab, var(--green) 30%, var(--line-2))" }}>实景</span>
        </h3>
        <span style={{ fontSize: 12, color: "var(--text-3)" }} className="mono">/u/&lt;你&gt; · 主页布局</span>
      </div>
      <div className="card-gh" style={{ padding: 18, background: "var(--bg-deep)" }}>
        <PersonalHomeMockup/>
      </div>
    </section>
  );
}

function PersonalHomeMockup() {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 240px", gap: 14,
      fontFamily: "var(--f-sans)",
    }}>
      {/* Main column */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Hero card */}
        <div style={{
          padding: 14,
          background: "var(--surface)", border: "1px solid var(--line-2)",
          borderRadius: 8,
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <span style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "#6aa6ff", display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--bg-deep)", fontWeight: 700, fontFamily: "var(--f-mono)", fontSize: 18,
          }}>AD</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, color: "var(--text)", fontWeight: 600 }}>@ada</div>
            <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>后端工程师 · 杭州 · 加入 757 天</div>
            <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
              <span style={{ fontSize: 10.5, padding: "2px 7px", background: "var(--brand)", color: "#fff", borderRadius: 4 }}>编辑资料</span>
              <span style={{ fontSize: 10.5, padding: "2px 7px", border: "1px solid var(--line-2)", color: "var(--text-2)", borderRadius: 4 }}>写文章</span>
              <span style={{ fontSize: 10.5, padding: "2px 7px", border: "1px solid var(--line-2)", color: "var(--text-2)", borderRadius: 4 }}>分享主页</span>
            </div>
          </div>
          <span style={{ fontSize: 10, color: "var(--text-3)" }} className="mono">/u/ada</span>
        </div>

        {/* Metric strip */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(6, 1fr)",
          background: "var(--surface)", border: "1px solid var(--line-2)", borderRadius: 8,
          overflow: "hidden",
        }}>
          {[
            { k: "文章", v: 47,  u: "篇", c: "#6aa6ff" },
            { k: "日常", v: 213, u: "条", c: "#7ee787" },
            { k: "求职", v: 87,  u: "项", c: "#f6c177" },
            { k: "访客", v: "289k", u: "次", c: "#22d3ee" },
            { k: "互动", v: 1842, u: "次", c: "#a78bfa" },
            { k: "留言", v: 312, u: "条", c: "#ec4899" },
          ].map((s, i) => (
            <div key={s.k} style={{
              padding: "10px 12px",
              borderRight: i < 5 ? "1px solid var(--line)" : "none",
            }}>
              <div style={{ fontSize: 9.5, color: "var(--text-3)", marginBottom: 2 }}>{s.k}</div>
              <div className="mono" style={{ fontSize: 16, fontWeight: 600, color: "var(--text)" }}>
                {s.v}<span style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 400, marginLeft: 2 }}>{s.u}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Latest article + recent jobs */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {/* Article list */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--line-2)", borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 11.5, color: "var(--text)", fontWeight: 600, marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
              <span><MI name="book" size={11}/> 最新文章</span>
              <a href="#" style={{ fontSize: 10.5, color: "var(--accent)" }}>更多 →</a>
            </div>
            {MPOSTS.slice(0, 3).map((p, i) => (
              <div key={i} style={{ padding: "5px 0", borderTop: i > 0 ? "1px solid var(--line)" : "none" }}>
                <div style={{ fontSize: 11.5, color: "var(--text)", lineHeight: 1.3 }}>{p.title}</div>
                <div className="mono" style={{ fontSize: 9, color: "var(--text-3)", marginTop: 1 }}>{p.date.slice(0,10)} · {p.tag}</div>
              </div>
            ))}
          </div>

          {/* Job funnel */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--line-2)", borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 11.5, color: "var(--text)", fontWeight: 600, marginBottom: 8 }}>
              <MI name="funnel" size={11}/> 求职漏斗
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {[
                { l: "投递", v: 87, w: 100, c: "#6aa6ff" },
                { l: "已回复", v: 41, w: 47,  c: "#7ee787" },
                { l: "进入面试", v: 19, w: 22, c: "#f6c177" },
                { l: "Offer", v: 3, w: 3.5, c: "#e94560" },
              ].map(f => (
                <div key={f.l} style={{ fontSize: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-2)" }}>
                    <span>{f.l}</span><span className="mono">{f.v}</span>
                  </div>
                  <div style={{ height: 5, background: "var(--surface-2)", borderRadius: 2, marginTop: 2, overflow: "hidden" }}>
                    <div style={{ width: `${f.w}%`, height: "100%", background: f.c, opacity: 0.8 }}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Aside cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Writing stats */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--line-2)", borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 10.5, color: "var(--text-3)", letterSpacing: "0.05em" }}>写作统计</div>
          <div className="mono" style={{ fontSize: 20, fontWeight: 600, color: "var(--text)", marginTop: 4 }}>
            128 <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 400 }}>千字</span>
          </div>
          <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 4 }}>
            连续 <span style={{ color: "var(--green)" }}>23</span> 天 · 本月 <span style={{ color: "var(--text-2)" }}>14</span> 篇
          </div>
          <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(14, 1fr)", gap: 2 }}>
            {Array.from({ length: 28 }).map((_, i) => (
              <span key={i} style={{
                aspectRatio: "1/1",
                background: i % 5 === 0 ? "var(--surface-2)" : "var(--accent)",
                opacity: i % 5 === 0 ? 1 : 0.3 + (i % 4) * 0.2,
                borderRadius: 1,
              }}/>
            ))}
          </div>
        </div>

        {/* Visit overview */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--line-2)", borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 10.5, color: "var(--text-3)", letterSpacing: "0.05em" }}>访客概览 · 30d</div>
          <div className="mono" style={{ fontSize: 20, fontWeight: 600, color: "var(--text)", marginTop: 4 }}>
            1,247
          </div>
          <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 2 }}>
            独立访客 412 · 累计 289k
          </div>
          <svg width="100%" height="32" viewBox="0 0 200 32" style={{ marginTop: 6 }}>
            <polyline points="0,28 14,26 28,22 42,20 56,15 70,18 84,14 98,12 112,10 126,14 140,8 154,11 168,6 182,9 200,4"
              fill="none" stroke="var(--accent)" strokeWidth="1.2"/>
          </svg>
        </div>

        {/* Recent visitors */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--line-2)", borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 10.5, color: "var(--text-3)", letterSpacing: "0.05em", marginBottom: 6 }}>最近访客</div>
          {[
            { name: "@mori", path: "/u/ada/blog", t: "刚刚",  c: "#a78bfa" },
            { name: "@shen", path: "/u/ada/resume", t: "2m", c: "#f6c177" },
            { name: "匿名",  path: "/u/ada",         t: "5m", c: "#5f6671" },
          ].map((v, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "3px 0", borderTop: i > 0 ? "1px solid var(--line)" : "none" }}>
              <span style={{ width: 16, height: 16, borderRadius: "50%", background: v.c, opacity: 0.7, flexShrink: 0 }}/>
              <span style={{ fontSize: 10.5, color: "var(--text-2)" }}>{v.name}</span>
              <span style={{ fontSize: 9.5, color: "var(--text-3)" }} className="mono">{v.path}</span>
              <span style={{ marginLeft: "auto", fontSize: 9.5, color: "var(--text-4)" }} className="mono">{v.t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── 04 全站书写热度 ────────────────────────────────────────────────────────
function ContributionCard() {
  return (
    <section className="card-gh">
      <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid var(--line-2)",
        display: "flex", alignItems: "baseline", justifyContent: "space-between",
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>
          <span style={{ color: "var(--text)" }}>{MP.commits365.toLocaleString()}</span>
          <span style={{ color: "var(--text-2)", fontWeight: 400 }}>{" "}次写入，来自 {MP.users.toLocaleString()} 个空间的过去一年</span>
        </h3>
        <div style={{ display: "flex", gap: 6 }}>
          <button style={ghButton}>过去一年 <MI name="chevD" size={10}/></button>
          <button style={ghButton}>全部模块 <MI name="chevD" size={10}/></button>
        </div>
      </div>
      <div style={{ padding: "16px 20px 18px" }}>
        <MAH weeks={53} cell={13} gap={3}/>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginTop: 12, fontSize: 12, color: "var(--text-3)",
        }}>
          <span>包含：博客 · 日常 · 心得 · 求职 · 面试 · 留言 · 圆桌</span>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span>少</span>
            {[0,1,2,3,4].map(i => (
              <span key={i} style={{
                width: 11, height: 11, borderRadius: 2,
                background: i === 0 ? "var(--surface-2)" : "var(--accent)",
                opacity: i === 0 ? 1 : [0, 0.22, 0.42, 0.68, 1][i],
              }}/>
            ))}
            <span>多</span>
          </div>
        </div>

        <div style={{
          marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line)",
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0,
        }}>
          {[
            { l: "公开文章",   n: MP.posts.toLocaleString(),      sub: `+847 本月` },
            { l: "求职记录",   n: MP.jobs.toLocaleString(),       sub: "+1,238 本月" },
            { l: "面试记录",   n: MP.interviews.toLocaleString(), sub: "+312 本月" },
            { l: "留言互动",   n: MP.comments.toLocaleString(),   sub: "+524 本月" },
          ].map((s, i) => (
            <div key={s.l} style={{
              padding: "0 18px",
              borderLeft: i === 0 ? 0 : "1px solid var(--line)",
            }}>
              <div className="kicker" style={{ fontSize: 10, marginBottom: 4 }}>{s.l}</div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.01em" }}>{s.n}</div>
              <div style={{ fontSize: 11, color: "var(--green)", marginTop: 2 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 05 最近动态 + 最新文章 ────────────────────────────────────────────────
function RecentRow() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }} id="community">
      <ActivityFeedCard/>
      <LatestWritingCard/>
    </div>
  );
}

function ActivityFeedCard() {
  return (
    <section className="card-gh">
      <CardChrome
        icon="activity" title="站内动态"
        right={<>
          <span className="chip" style={{ fontSize: 9.5, padding: "0 6px", marginRight: 8 }}>
            <span className="live-dot" style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--green)", display: "inline-block", marginRight: 4 }}/>
            实时
          </span>
          <button style={ghButton}>全部模块 <MI name="chevD" size={10}/></button>
        </>}
      />
      <div style={{ padding: "4px 0" }}>
        {MACT.slice(0, 8).map((a, i) => (
          <div key={i} style={{
            display: "grid", gridTemplateColumns: "26px 1fr auto", gap: 10,
            padding: "10px 18px", alignItems: "center",
            borderTop: i === 0 ? "none" : "1px solid var(--line)",
            fontSize: 13,
          }}>
            <span style={{
              width: 22, height: 22, borderRadius: "50%",
              background: a.avatar, opacity: 0.85,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--bg-deep)", fontSize: 10, fontFamily: "var(--f-mono)", fontWeight: 700,
            }}>{a.who.slice(0, 2)}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: "var(--text-2)", lineHeight: 1.35 }}>
                <a href="#" style={{ color: "var(--accent)", fontWeight: 500 }}>@{a.who}</a>
                <span style={{ color: "var(--text-3)" }}> {MAL[a.action]} </span>
                <span style={{ color: "var(--text)", fontSize: 12.5 }}>{a.target}</span>
              </div>
              <div style={{ marginTop: 2, fontSize: 10.5, color: "var(--text-3)", display: "flex", gap: 8 }}>
                <span className="mono">{a.t}</span>
                <span className="chip" style={{ padding: "0 5px", fontSize: 9 }}>{a.tag}</span>
              </div>
            </div>
            <MI name={
              a.action === "publish" ? "pen" :
              a.action === "job" ? "briefcase" :
              a.action === "interview" ? "video" :
              a.action === "daily" ? "calendar" :
              a.action === "guestbook" ? "chat" :
              a.action === "join" ? "plus" :
              a.action === "comment" ? "chat" :
              a.action === "resume" ? "file" :
              a.action === "roundtable" ? "persons" :
              a.action === "ai" ? "sparkles" : "dot"
            } size={14} stroke={1.6}/>
          </div>
        ))}
      </div>
    </section>
  );
}

function LatestWritingCard() {
  return (
    <section className="card-gh">
      <CardChrome
        icon="book" title="本周公开文章"
        right={<>
          <a href="#" className="link" style={{ fontSize: 12, marginRight: 12 }}>归档 →</a>
          <button style={ghButton}>本周 <MI name="chevD" size={10}/></button>
        </>}
      />
      <div>
        {MPOSTS.slice(0, 5).map((p, i) => (
          <a key={i} href="#" style={{
            display: "block", padding: "12px 18px",
            borderTop: i === 0 ? "none" : "1px solid var(--line)",
          }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
              <span style={{
                width: 14, height: 14, borderRadius: "50%",
                background: ["#6aa6ff","#a78bfa","#ec4899","#f6c177","#7ee787"][i % 5],
                display: "inline-block", flexShrink: 0,
                transform: "translateY(2px)",
              }}/>
              <span style={{ color: "var(--accent)", fontSize: 12.5, fontWeight: 500 }}>@{p.by}</span>
              <span style={{ color: "var(--text-3)", fontSize: 12 }}>·</span>
              <span style={{ color: "var(--text-3)", fontSize: 11.5 }} className="mono">{p.date.slice(5, 10)}</span>
              <span style={{ marginLeft: "auto", color: "var(--text-3)", fontSize: 11 }} className="mono">
                <MI name="eye" size={10}/> {p.views} · <MI name="chat" size={10}/> {p.comments}
              </span>
            </div>
            <div style={{ fontSize: 13.5, color: "var(--text)", fontWeight: 500, lineHeight: 1.4, paddingLeft: 22 }}>{p.title}</div>
            <div className="kicker" style={{ marginTop: 4, fontSize: 9.5, color: "var(--text-3)", paddingLeft: 22 }}>
              {p.tag} · 约 {p.read} 分钟
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

// ─── 06 更新日志 + 推荐空间 ────────────────────────────────────────────────
function ChangelogAndSpacesRow() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }} id="changelog">
      <section className="card-gh">
        <CardChrome
          icon="tag" title={<>更新日志 <span className="chip" style={{ fontSize: 10, padding: "0 6px", marginLeft: 4 }}>12 个版本</span></>}
        />
        <div>
          {MR.map((r, i) => (
            <div key={r.tag} style={{
              padding: "12px 18px",
              borderTop: i === 0 ? "none" : "1px solid var(--line)",
              display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 14, alignItems: "baseline",
            }}>
              <span className="mono" style={{
                fontSize: 12, color: "var(--text)", fontWeight: 500,
                display: "inline-flex", alignItems: "center", gap: 6,
              }}>
                <MI name="tag" size={12}/>
                {r.tag}
                {r.latest && (
                  <span className="chip" style={{
                    color: "var(--green)", borderColor: "color-mix(in oklab, var(--green) 30%, var(--line-2))",
                    fontSize: 9, padding: "0 5px",
                  }}>最新</span>
                )}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: "var(--text)" }}>{r.title}</div>
                <div className="kicker" style={{ fontSize: 9.5, marginTop: 2 }}>{r.date}</div>
              </div>
              <a href="#" className="link link-mono" style={{ fontSize: 11 }}>详情 →</a>
            </div>
          ))}
        </div>
      </section>

      <section className="card-gh">
        <CardChrome
          icon="flame" title="本周活跃空间" right={<button style={ghButton}>近 7 天 <MI name="chevD" size={10}/></button>}
        />
        <div>
          {MSP.slice(0, 4).map((s, i) => (
            <div key={s.handle} style={{
              padding: "12px 18px",
              borderTop: i === 0 ? "none" : "1px solid var(--line)",
              display: "grid", gridTemplateColumns: "30px 1fr auto auto", gap: 12, alignItems: "center",
            }}>
              <span style={{
                width: 28, height: 28, borderRadius: "50%",
                background: s.color, opacity: 0.85,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--bg-deep)", fontSize: 11, fontFamily: "var(--f-mono)", fontWeight: 700,
              }}>{s.handle.slice(0, 2)}</span>
              <div>
                <div style={{ fontSize: 13, color: "var(--text)" }}>
                  <a href="#" style={{ color: "var(--accent)", fontWeight: 500 }}>@{s.handle}</a>
                  <span style={{ color: "var(--text-3)", marginLeft: 8, fontSize: 12 }}>{s.role}</span>
                </div>
                <div className="kicker" style={{ fontSize: 9.5, marginTop: 2 }}>
                  {s.posts} 篇文章 · <MI name="flame" size={9}/> 连续 {s.streak} 天
                </div>
              </div>
              <span style={{
                fontSize: 11, color: "var(--green)", fontFamily: "var(--f-mono)",
                padding: "2px 7px", border: "1px solid color-mix(in oklab, var(--green) 30%, var(--line-2))",
                borderRadius: 999,
              }}>↑ {Math.floor(20 + (i * 13 + 4) % 70)}%</span>
              <a href="#" className="btn btn-sm" style={{ padding: "3px 10px", fontSize: 11.5 }}>
                <MI name="eye" size={10}/> 看看
              </a>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── 07 FAQ ────────────────────────────────────────────────────────────────
function FAQCard() {
  const faqs = [
    { q: "数据真的可以导出吗？",
      a: "可以。Markdown + JSON 全量打包下载，没有锁定。" },
    { q: "我能让某个模块只给好友看吗？",
      a: "可以。逐模块独立设置 public / friends / private，访客和好友看到不同视图。" },
    { q: "公开主页的 URL 能自定义吗？",
      a: "在设置 → 个人资料中设置 publicSlug，访问 /@yourname。未设置则用用户 ID。" },
    { q: "AI 助手会拿我的数据训练吗？",
      a: "不会。AI 调用仅在你的会话内，不入训练集。" },
    { q: "想自部署？",
      a: "支持。Next.js + Prisma + PostgreSQL，开源 MIT。" },
    { q: "蝶灵圆桌是什么？",
      a: "每天 8:00 / 22:00 自动开启一场议题，多用户异步发言，议题完结后仍可回看与追问。" },
  ];
  return (
    <section className="card-gh" id="faq">
      <CardChrome icon="bulb" title="常见问题"/>
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0,
      }}>
        {faqs.map((f, i) => (
          <div key={i} style={{
            padding: "16px 22px",
            borderRight: i % 2 === 0 ? "1px solid var(--line)" : "none",
            borderTop: i < 2 ? "none" : "1px solid var(--line)",
          }}>
            <div style={{ fontSize: 13.5, color: "var(--text)", fontWeight: 600, marginBottom: 6 }}>
              {f.q}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.55 }}>
              {f.a}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── 小工具 ────────────────────────────────────────────────────────────────
function CardChrome({ icon, title, right }) {
  return (
    <div style={{
      padding: "10px 16px", borderBottom: "1px solid var(--line-2)",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      fontSize: 13, color: "var(--text-2)",
      background: "var(--bg-deep)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {icon && <MI name={icon} size={14}/>}
        <span style={{ color: "var(--text)", fontWeight: 600 }}>{title}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {right}
      </div>
    </div>
  );
}

const ghButton = {
  display: "inline-flex", alignItems: "center", gap: 4,
  padding: "3px 9px", borderRadius: 4, border: "1px solid var(--line-2)",
  background: "var(--surface-2)", color: "var(--text-2)",
  cursor: "pointer", fontSize: 11.5, fontFamily: "inherit",
};

Object.assign(window, { MainColumn });
