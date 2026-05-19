import type { Metadata, Viewport } from "next"
import { Instrument_Serif } from "next/font/google"
import "./globals.css"

const instrumentSerif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  display: "swap",
})
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Toaster } from "@/components/ui/sonner"
import { getOptionalSession } from "@/lib/auth"
import { ServiceWorkerCleanup } from "@/components/service-worker-cleanup"
import { Live2DWidget } from "@/components/live2d-widget"
import { VisualViewportVars } from "@/components/visual-viewport-vars"
import { SessionHeartbeat } from "@/components/session-heartbeat"
import { RealtimeNotifications } from "@/components/realtime-notifications"
import { RecentActivityReadTracker } from "@/components/recent-activity-read-tracker"
import { getUserAdminInfo, normalizeUserRole } from "@/lib/admin"
import { getCreatorProfile } from "@/lib/profile"
import { getDictionary } from "@/lib/i18n"
import { getUserSiteSettings } from "@/lib/settings"
import { getUserLive2DSettings } from "@/lib/live2d-settings"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

const DEFAULT_SETTINGS = { ownerName: "My Space", heroTagline: "", language: "zh-CN" as const }

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
  themeColor: "#FAF9F5",
  viewportFit: "cover",
}

export async function generateMetadata(): Promise<Metadata> {
  const session = await getOptionalSession()
  const settings = session ? await getUserSiteSettings(session.userId) : DEFAULT_SETTINGS
  return {
    title: `${settings.ownerName} Space`,
    description: settings.heroTagline,
    manifest: '/manifest.json',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: 'lgplayblog',
    },
    icons: {
      icon: [
        { url: '/favicon.ico' },
        { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
      apple: [
        { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      ],
    },
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await getOptionalSession()
  const settings = session ? await getUserSiteSettings(session.userId) : DEFAULT_SETTINGS
  const live2d = await getUserLive2DSettings(session?.userId)
  const user = session ? await getUserAdminInfo(session.userId) : null
  const [normalizedUser, profile] = await Promise.all([
    user ? normalizeUserRole(user) : null,
    session ? getCreatorProfile(session.userId) : null,
  ])
  const dict = getDictionary(settings.language)

  let canAccessSqlPractice = false
  if (normalizedUser) {
    if (normalizedUser.role === "owner") {
      canAccessSqlPractice = true
    } else {
      const grant = await prisma.sqlPracticeAccessGrant.findUnique({
        where: { userId: normalizedUser.id },
        select: { enabled: true },
      })
      canAccessSqlPractice = Boolean(grant?.enabled)
    }
  }

  return (
    <html lang={settings.language} className={`h-full ${instrumentSerif.variable}`}>
      <body className="min-h-full flex flex-col antialiased">
        <SiteHeader
          ownerName={settings.ownerName}
          heroTagline={settings.heroTagline}
          locale={settings.language}
          navDict={dict.nav}
          session={session}
          role={normalizedUser?.role}
          avatarText={profile?.avatarText}
          avatarUrl={profile?.avatarUrl}
          displayName={profile?.displayName}
          canAccessSqlPractice={canAccessSqlPractice}
        />
        <main key={session?.userId ?? "guest"} className="flex-1 pt-14">
          {children}
        </main>
        <SiteFooter />
        <Toaster position="bottom-right" />
        {session && <SessionHeartbeat />}
        {session && <RealtimeNotifications userId={session.userId} />}
        {session && <RecentActivityReadTracker userId={session.userId} />}
        <ServiceWorkerCleanup />
        <VisualViewportVars />
        <Live2DWidget
          displayMode={live2d.displayMode}
          position={live2d.position}
          size={live2d.size}
          drag={live2d.drag}
          modelId={live2d.modelId}
          bubbleTheme={live2d.bubbleTheme}
          bubbleName={live2d.bubbleName}
        />
      </body>
    </html>
  )
}
