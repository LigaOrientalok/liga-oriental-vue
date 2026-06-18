export function escapeHtml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function sanitizarImgSrc(src) {
  if (!src) return ''
  if (src.startsWith('data:image/')) return src
  if (src.startsWith('http://') || src.startsWith('https://')) return src
  return ''
}

export function sanitizarIframeSrc(src) {
  if (!src) return ''
  const url = src.startsWith('//') ? 'https:' + src : src
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return ''
    const host = parsed.hostname
    const allowed = ['youtube.com', 'www.youtube.com', 'youtube-nocookie.com', 'player.vimeo.com', 'drive.google.com']
    if (allowed.some(a => host === a || host.endsWith('.' + a))) return parsed.href
    if (host === 'localhost' || host === '127.0.0.1') return parsed.href
    return ''
  } catch {
    return ''
  }
}
