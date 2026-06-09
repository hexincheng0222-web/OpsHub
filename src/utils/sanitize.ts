/** Strip XSS vectors from HTML (executed in browser) */
export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  // 移除危险标签
  doc.querySelectorAll('script, iframe, object, embed, applet, form, svg, style, link, meta, base').forEach(el => el.remove())
  doc.querySelectorAll('*').forEach(el => {
    const attrs = [...el.attributes]
    for (const attr of attrs) {
      const val = attr.value.trim()
      // 移除事件处理器
      if (attr.name.startsWith('on')) { el.removeAttribute(attr.name); continue }
      // 移除 javascript: 和 data: URI
      if (['href', 'src', 'action', 'formaction', 'xlink:href'].includes(attr.name)) {
        if (/^\s*(javascript|vbscript|data)\s*:/i.test(val)) { el.removeAttribute(attr.name); continue }
      }
      // 移除 style 中的 expression/url
      if (attr.name === 'style' && /expression\s*\(|url\s*\(/i.test(val)) {
        el.removeAttribute(attr.name)
      }
    }
  })
  return doc.body.innerHTML
}
