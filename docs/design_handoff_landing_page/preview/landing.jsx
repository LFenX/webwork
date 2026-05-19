// landing.jsx — 整页组合 + 底部 footer.

const {
  GlobalHeader, ProjectHeaderStrip,
  Sidebar, MainColumn,
  Icon: LI, PLATFORM: LP,
} = window;

function Landing() {
  return (
    <div className="gh-page" style={{ color: "var(--text)", fontFamily: "var(--f-sans)" }}>
      <GlobalHeader/>
      <ProjectHeaderStrip/>

      <div style={{
        maxWidth: 1440, margin: "0 auto",
        padding: "26px 22px 36px",
        display: "flex", gap: 32, alignItems: "flex-start",
      }}>
        <Sidebar/>
        <MainColumn/>
      </div>

      <BottomCTA/>
      <Footer/>
    </div>
  );
}

function BottomCTA() {
  return (
    <section style={{
      borderTop: "1px solid var(--line-2)", borderBottom: "1px solid var(--line-2)",
      background: "var(--bg-deep)",
      padding: "44px 22px",
    }}>
      <div style={{
        maxWidth: 880, margin: "0 auto", textAlign: "center",
      }}>
        <div className="kicker" style={{ color: "var(--accent)", marginBottom: 14 }}>
          → 准备好开始了？
        </div>
        <h2 className="serif" style={{
          fontSize: 48, lineHeight: 1.05, fontStyle: "italic", color: "var(--text)",
          letterSpacing: "-0.025em", marginBottom: 14, fontWeight: 400,
        }}>
          创建一个空间，<br/>
          把<span style={{ color: "var(--accent)" }}>这一年</span>写下来。
        </h2>
        <p style={{
          fontSize: 14.5, color: "var(--text-2)", maxWidth: 540, margin: "0 auto 22px",
          fontFamily: "var(--f-cn-serif)", lineHeight: 1.7,
        }}>
          免费 · 邀请制 · MIT 开源 · 数据可随时导出。
          注册后立刻拿到 <span className="mono" style={{ color: "var(--text)" }}>/u/yourname</span> 的公开主页。
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <a href="#" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "11px 22px", background: "var(--green-2)", color: "var(--bg-deep)",
            borderRadius: 6, fontSize: 14, fontWeight: 600,
            border: "1px solid color-mix(in oklab, var(--green-2) 60%, #000)",
          }}>
            <LI name="plus" size={14}/> 创建你的空间 <LI name="arrowR" size={14}/>
          </a>
          <a href="#" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "11px 22px", border: "1px solid var(--line-strong)", color: "var(--text)",
            borderRadius: 6, fontSize: 14,
          }}>
            登录已有账号
          </a>
          <a href="#" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "11px 16px", color: "var(--text-2)",
            borderRadius: 6, fontSize: 14,
          }}>
            浏览公开空间 →
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ padding: "32px 0 22px", background: "var(--bg-deep)" }}>
      <div style={{
        maxWidth: 1440, margin: "0 auto",
        padding: "0 22px",
        display: "grid", gridTemplateColumns: "260px repeat(4, 1fr)", gap: 36,
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <SpaceMarkFooter/>
            <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>my-space</span>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.5, marginBottom: 14 }}>
            一处属于你的个人空间。<br/>
            自部署 · 开源 · MIT 许可。<br/>
            中文为主。
          </p>
          <div style={{ display: "flex", gap: 6 }}>
            <a href="#" style={footerSocial}><LI name="rss" size={13}/></a>
            <a href="#" style={footerSocial}><LI name="code" size={13}/></a>
            <a href="#" style={footerSocial}><LI name="book" size={13}/></a>
            <a href="#" style={footerSocial}><LI name="chat" size={13}/></a>
          </div>
        </div>

        {[
          { h: "产品",     items: ["公开空间", "更新日志", "未来路线", "试用邀请", "定价"] },
          { h: "资源",     items: ["使用文档", "API", "自部署指南", "数据导出", "服务状态"] },
          { h: "社区",     items: ["推荐空间", "蝶灵圆桌", "讨论频道", "表情包社区", "RSS"] },
          { h: "支持",     items: ["联系我们", "反馈问题", "隐私政策", "服务条款", "致谢"] },
        ].map(col => (
          <div key={col.h}>
            <div className="kicker" style={{ marginBottom: 10 }}>{col.h}</div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 7 }}>
              {col.items.map(it => (
                <li key={it}>
                  <a href="#" style={{ fontSize: 12.5, color: "var(--text-2)" }}>{it}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div style={{
        maxWidth: 1440, margin: "24px auto 0", padding: "16px 22px 0",
        borderTop: "1px solid var(--line-2)",
        display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12,
      }}>
        <span className="kicker" style={{ color: "var(--text-4)" }}>
          © 2026 MY-SPACE · 构建 {LP.hash} · {LP.version} · 运行 757 天 · 在线 {LP.online} 人
        </span>
        <span className="kicker" style={{ color: "var(--text-4)", display: "flex", gap: 12 }}>
          <a href="#" style={{ color: "var(--green)" }}>● 全部系统正常</a>
          <span>·</span>
          <a href="#" style={{ color: "var(--text-3)" }}>隐私</a>
          <span>·</span>
          <a href="#" style={{ color: "var(--text-3)" }}>条款</a>
          <span>·</span>
          <a href="#" style={{ color: "var(--text-3)" }}>许可</a>
        </span>
      </div>
    </footer>
  );
}

function SpaceMarkFooter() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32">
      <rect x="3" y="3" width="26" height="26" rx="4" fill="none" stroke="var(--text-2)" strokeWidth="1.4"/>
      <rect x="9" y="9" width="14" height="14" rx="2" fill="none" stroke="var(--accent)" strokeWidth="1.4"/>
      <rect x="13.5" y="13.5" width="5" height="5" rx="0.5" fill="var(--accent)"/>
    </svg>
  );
}

const footerSocial = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 28, height: 28, borderRadius: 6,
  border: "1px solid var(--line-2)", color: "var(--text-2)",
};

Object.assign(window, { Landing });
