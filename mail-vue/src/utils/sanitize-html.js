import DOMPurify from 'dompurify'

// 收到的邮件HTML来自任意发件人, 渲染前必须清洗, 防止XSS窃取token
const purifier = DOMPurify()

purifier.addHook('afterSanitizeAttributes', node => {
  if (node.tagName === 'A' && node.hasAttribute('href')) {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

const config = {
  FORCE_BODY: true,
  FORBID_TAGS: ['form', 'input', 'button', 'textarea', 'select', 'option', 'base', 'meta', 'link'],
  FORBID_ATTR: ['formaction', 'action']
}

export function sanitizeHtml(html) {
  if (!html) return ''
  return purifier.sanitize(html, config)
}

export function escapeHtml(text) {
  if (!text) return ''
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
