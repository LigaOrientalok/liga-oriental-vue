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
