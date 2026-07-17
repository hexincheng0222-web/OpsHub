/**
 * XSS 净化（白名单模式）
 * 不依赖第三方库，使用 DOMParser + 显式白名单，避免黑名单遗漏问题。
 * 白名单优先于黑名单：只允许已知安全的标签/属性，其余全部移除。
 */

// 允许的 HTML 标签白名单（不含 script/iframe/form/svg 等危险标签）
const ALLOWED_TAGS = new Set([
  'a', 'abbr', 'address', 'article', 'aside', 'b', 'bdi', 'bdo', 'blockquote',
  'br', 'caption', 'cite', 'code', 'col', 'colgroup', 'data', 'dd', 'del',
  'details', 'dfn', 'div', 'dl', 'dt', 'em', 'figcaption', 'figure', 'footer',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup', 'hr', 'i', 'img',
  'ins', 'kbd', 'li', 'main', 'mark', 'nav', 'ol', 'p', 'pre', 'q', 'rp',
  'rt', 'ruby', 's', 'samp', 'section', 'small', 'span', 'strong', 'sub',
  'summary', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'time',
  'tr', 'u', 'ul', 'var', 'wbr',
])

// 允许的属性白名单（不含 on* 事件、style 等）
const ALLOWED_ATTRS = new Set([
  'href', 'src', 'alt', 'title', 'width', 'height', 'colspan', 'rowspan',
  'target', 'rel', 'datetime', 'controls', 'download', 'id', 'class',
])

// URI 属性白名单（这些属性的值只允许 http/https/mailto/tel/相对路径）
const URI_ATTRS = new Set(['href', 'src'])

// 允许的 URI 协议白名单
const ALLOWED_PROTOCOLS = /^(https?|mailto|tel|ftp|\/|\.\/|\.\.\/|#)/i

function sanitizeNode(node: Element): void {
  // 子节点先递归处理（避免迭代时删除导致索引错乱）
  const children = [...node.children]
  for (const child of children) sanitizeNode(child)

  // 不在白名单的标签直接移除（保留子内容用 unwrap）
  const tag = node.tagName.toLowerCase()
  if (!ALLOWED_TAGS.has(tag)) {
    node.remove()
    return
  }

  // 属性过滤
  const attrs = [...node.attributes]
  for (const attr of attrs) {
    const name = attr.name.toLowerCase()
    const value = attr.value

    // 1) 不在白名单 → 移除（含 on*、style、srcset、background 等）
    if (!ALLOWED_ATTRS.has(name)) {
      node.removeAttribute(attr.name)
      continue
    }
    // 2) URI 属性校验协议白名单
    if (URI_ATTRS.has(name)) {
      const trimmed = value.trim()
      // 任何含 javascript:/vbscript:/data: 的 URI 一律移除
      if (/^\s*(javascript|vbscript|data)\s*:/i.test(trimmed)) {
        node.removeAttribute(attr.name)
        continue
      }
      // 必须匹配允许的协议或相对路径
      if (!ALLOWED_PROTOCOLS.test(trimmed)) {
        node.removeAttribute(attr.name)
        continue
      }
    }
    // 3) target=_blank 强制加 rel=noopener（防 window.opener 劫持）
    if (name === 'target' && value === '_blank') {
      node.setAttribute('rel', 'noopener noreferrer')
    }
  }
}

/** Strip XSS vectors from HTML using a whitelist approach */
export function sanitizeHtml(html: string): string {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')

  // 处理 body 下所有顶层元素
  const top = [...doc.body.children]
  for (const el of top) sanitizeNode(el)

  // 安全兜底：再次移除残留的 script/style/svg/math 等已知危险标签
  doc.querySelectorAll('script, style, iframe, object, embed, applet, form, svg, math, meta, base, link, frame, frameset').forEach(el => el.remove())
  // 再次扫描所有元素的 on* 属性（防止白名单遗漏）
  doc.querySelectorAll('*').forEach(el => {
    for (const attr of [...el.attributes]) {
      if (attr.name.toLowerCase().startsWith('on')) el.removeAttribute(attr.name)
    }
  })

  return doc.body.innerHTML
}

/**
 * HTML 实体转义 — 用于 v-html / dangerouslyUseHTMLString 拼接前的用户数据 (#27)
 * 将 & < > " ' 转义为 HTML 实体，防止二次 XSS
 */
export function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
