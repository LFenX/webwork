import { cookies } from "next/headers"
import { Code2 } from "lucide-react"
import { LandingLoadingScreen } from "@/components/landing/landing-loading"
import styles from "@/components/updates/update-log.module.css"

export default async function UpdatesLoading() {
  const hasSessionCookie = (await cookies()).has("session")
  if (!hasSessionCookie) return <LandingLoadingScreen variant="updates" />

  return (
    <div className={`${styles.appShell} updates-viewport`}>
      <section className={`${styles.module} ${styles.loadingModule}`} data-shell="app" aria-busy="true" aria-label="更新日志加载中">
        <header className={styles.topbar}>
          <div className={styles.titleMark} aria-hidden="true">
            <Code2 size={28} />
          </div>
          <div className={styles.titleBlock}>
            <h1>网站建设日志</h1>
            <p>把每一次代码变化，整理成用户看得懂的建站记录</p>
            <div className={styles.chips}>
              <span>Git 记录生成</span>
              <span>公开只读</span>
              <span>可评论</span>
            </div>
          </div>
          <div className={styles.loadingActions}>
            <span />
            <span />
          </div>
        </header>

        <div className={styles.loadingFilters}>
          <span />
          <span />
          <span />
        </div>

        <div className={styles.workspace}>
          <aside className={styles.timeline}>
            <div className={styles.timelineHeader}>
              <span>变更时间坐标</span>
              <strong>...</strong>
            </div>
            <div className={styles.loadingTimelineList}>
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className={styles.loadingTimelineItem}>
                  <span />
                  <div>
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <article className={styles.detailPanel}>
            <div className={styles.loadingDetailHeader}>
              <span />
              <span />
            </div>
            <div className={styles.tabs}>
              {["说明", "影响范围", "涉及文件", "代码 Diff", "用户反馈"].map((item, index) => (
                <button key={item} type="button" className={index === 3 ? styles.tabActive : ""} disabled>
                  {item}
                </button>
              ))}
            </div>
            <div className={styles.loadingDetailBody}>
              <div className={styles.loadingNarrative}>
                <span />
                <span />
                <span />
                <span />
              </div>
              <div className={styles.loadingDiffPanel}>
                {Array.from({ length: 10 }).map((_, index) => <span key={index} />)}
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
  )
}
