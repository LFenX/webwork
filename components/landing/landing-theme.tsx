"use client"

import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"

const STORAGE_KEY = "landing-theme"

type Theme = "dark" | "light"

export function LandingThemeProvider({ children, pageClassName }: { children: React.ReactNode; pageClassName: string }) {
  const [theme, setTheme] = useState<Theme>("light")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    document.body.classList.add("landing-active")
    const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null
    if (stored === "light" || stored === "dark") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme(stored)
    }
    setMounted(true)
    return () => {
      document.body.classList.remove("landing-active")
    }
  }, [])

  useEffect(() => {
    if (!mounted) return
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme, mounted])

  return (
    <>
      <style>{`
        .site-header,
        footer.site-footer,
        #waifu,
        #waifu-toggle,
        nextjs-portal {
          display: none !important;
        }

        main {
          padding-top: 0 !important;
        }

        @media (max-width: 640px) {
          .landing-project-actions,
          .landing-project-invite-chip {
            display: none !important;
          }
        }
      `}</style>
      <div className={pageClassName} data-landing-theme={theme}>
        <LandingThemeContext.Provider value={{ theme, toggle: () => setTheme(t => (t === "dark" ? "light" : "dark")) }}>
          {children}
        </LandingThemeContext.Provider>
      </div>
    </>
  )
}

import { createContext, useContext } from "react"

const LandingThemeContext = createContext<{ theme: Theme; toggle: () => void } | null>(null)

export function LandingThemeToggle({ className }: { className?: string }) {
  const ctx = useContext(LandingThemeContext)
  if (!ctx) return null
  const Icon = ctx.theme === "dark" ? Sun : Moon
  return (
    <button
      type="button"
      className={className}
      onClick={ctx.toggle}
      aria-label={ctx.theme === "dark" ? "切换到亮色模式" : "切换到暗色模式"}
      title={ctx.theme === "dark" ? "切换到亮色模式" : "切换到暗色模式"}
    >
      <Icon size={15} strokeWidth={1.6} />
    </button>
  )
}
