export type PublicProfileRef = {
  id: string
  publicSlug?: string | null
}

export function publicProfileRef(user: PublicProfileRef) {
  return user.publicSlug || user.id
}

export function publicProfileHref(user: PublicProfileRef, suffix = "") {
  const cleanSuffix = suffix ? `/${suffix.replace(/^\/+/, "")}` : ""
  return `/u/${publicProfileRef(user)}${cleanSuffix}`
}
