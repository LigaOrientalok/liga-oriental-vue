import { describe, it, expect } from 'vitest'
import { escapeHtml, sanitizarImgSrc } from '../helpers'

describe('escapeHtml', () => {
  it('returns empty string for null/undefined', () => {
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })

  it('escapes ampersands', () => {
    expect(escapeHtml('&')).toBe('&amp;')
    expect(escapeHtml('foo & bar')).toBe('foo &amp; bar')
  })

  it('escapes less-than signs', () => {
    expect(escapeHtml('<')).toBe('&lt;')
    expect(escapeHtml('a < b')).toBe('a &lt; b')
  })

  it('escapes greater-than signs', () => {
    expect(escapeHtml('>')).toBe('&gt;')
    expect(escapeHtml('a > b')).toBe('a &gt; b')
  })

  it('escapes double quotes', () => {
    expect(escapeHtml('"')).toBe('&quot;')
    expect(escapeHtml('say "hello"')).toBe('say &quot;hello&quot;')
  })

  it('escapes single quotes', () => {
    expect(escapeHtml("'")).toBe('&#39;')
    expect(escapeHtml("it's")).toBe('it&#39;s')
  })

  it('escapes all HTML characters together', () => {
    const input = `<script>"alert('xss')" & more</script>`
    const expected = '&lt;script&gt;&quot;alert(&#39;xss&#39;)&quot; &amp; more&lt;/script&gt;'
    expect(escapeHtml(input)).toBe(expected)
  })

  it('returns empty string for empty input', () => {
    expect(escapeHtml('')).toBe('')
  })
})

describe('sanitizarImgSrc', () => {
  it('returns empty string for null/undefined', () => {
    expect(sanitizarImgSrc(null)).toBe('')
    expect(sanitizarImgSrc(undefined)).toBe('')
  })

  it('allows data URIs', () => {
    const uri = 'data:image/png;base64,iVBORw0KGgo='
    expect(sanitizarImgSrc(uri)).toBe(uri)
  })

  it('allows http URLs', () => {
    const url = 'http://example.com/image.png'
    expect(sanitizarImgSrc(url)).toBe(url)
  })

  it('allows https URLs', () => {
    const url = 'https://example.com/image.png'
    expect(sanitizarImgSrc(url)).toBe(url)
  })

  it('rejects javascript URLs', () => {
    expect(sanitizarImgSrc("javascript:alert('xss')")).toBe('')
  })

  it('rejects relative paths', () => {
    expect(sanitizarImgSrc('/images/foo.png')).toBe('')
    expect(sanitizarImgSrc('images/foo.png')).toBe('')
  })

  it('rejects empty string', () => {
    expect(sanitizarImgSrc('')).toBe('')
  })
})
