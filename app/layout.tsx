import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Toaster } from "@/components/ui/sonner"
import { getOptionalSession } from "@/lib/auth"
import { getSiteSettings } from "@/lib/mdx"
import { ServiceWorkerCleanup } from "@/components/service-worker-cleanup"
import { VisualViewportVars } from "@/components/visual-viewport-vars"
import { getUserAdminInfo, normalizeUserRole } from "@/lib/admin"
import { getCreatorProfile } from "@/lib/profile"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const DEFAULT_SETTINGS = { ownerName: "My Space", heroTagline: "" }

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
  themeColor: "#FAF9F5",
}

export async function generateMetadata(): Promise<Metadata> {
  const session = await getOptionalSession()
  const settings = session ? await getSiteSettings(session.userId) : DEFAULT_SETTINGS
  return {
    title: `${settings.ownerName} 的空间`,
    description: settings.heroTagline,
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await getOptionalSession()
  const settings = session ? await getSiteSettings(session.userId) : DEFAULT_SETTINGS
  const user = session ? await getUserAdminInfo(session.userId) : null
  const [normalizedUser, profile] = await Promise.all([
    user ? normalizeUserRole(user) : null,
    session ? getCreatorProfile(session.userId) : null,
  ])

  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col antialiased">
        <SiteHeader
          ownerName={settings.ownerName}
          heroTagline={settings.heroTagline}
          session={session}
          role={normalizedUser?.role}
          avatarText={profile?.avatarText}
          avatarUrl={profile?.avatarUrl}
          displayName={profile?.displayName}
        />
        <main key={session?.userId ?? "guest"} className="flex-1">{children}</main>
        <SiteFooter />
        <Toaster position="bottom-right" />
        <ServiceWorkerCleanup />
        <VisualViewportVars />
      </body>
    </html>
  )
}
