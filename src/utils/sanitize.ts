/** Strip XSS vectors from HTML (executed in browser) */
export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script').forEach(el => el.remove())
  doc.querySelectorAll('*').forEach(el => {
    const attrs = [...el.attributes]
    for (const attr of attrs) {
      if (attr.name.startsWith('on') || (attr.name === 'href' && /^\s*javascript\s*:/i.test(attr.value))) {
        el.removeAttribute(attr.name)
      }
    }
  })
  return doc.body.innerHTML
}
