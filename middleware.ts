import { NextRequest, NextResponse } from "next/server"

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"])

export function middleware(req: NextRequest) {
  if (process.env.NODE_ENV !== "production") {
    return NextResponse.next()
  }

  const url = new URL(req.url)
  const host = (req.headers.get("host") ?? url.hostname).split(":")[0]
  if (LOCAL_HOSTS.has(host)) {
    return NextResponse.next()
  }

  const proto = req.headers.get("x-forwarded-proto")
  if (proto === "https") {
    return NextResponse.next()
  }

  if (proto && proto !== "https") {
    url.protocol = "https:"
    return NextResponse.redirect(url, 307)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|.*\\..*).*)"],
}
