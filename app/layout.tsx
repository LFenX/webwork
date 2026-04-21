import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Toaster } from "@/components/ui/sonner"
import { getOptionalSession } from "@/lib/auth"
import { getSiteSettings } from "@/lib/mdx"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const DEFAULT_SETTINGS = { ownerName: "My Space", heroTagline: "" }

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
        />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <Toaster position="bottom-right" />
      </body>
    </html>
  )
}
