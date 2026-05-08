export function isSqlLabPath(pathname: string) {
  return pathname === "/sql" || pathname.startsWith("/sql/")
}

export function getGuardianIdleDelayMs(isSqlLab: boolean) {
  return isSqlLab ? 75_000 : 45_000
}
