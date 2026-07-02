export const API_BASE_URL =
  import.meta.env.PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? 'https://api.o-andy.com'

export function apiUrl(path: string) {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

export function recordIdPart(id: string | number | null | undefined) {
  const value = id?.toString() ?? ''
  const separator = value.indexOf(':')
  return separator >= 0 ? value.slice(separator + 1) : value
}

export function sameRecordId(a: string | number | null | undefined, b: string | number | null | undefined) {
  return recordIdPart(a) === recordIdPart(b)
}
