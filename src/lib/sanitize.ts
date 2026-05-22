import DOMPurify from 'isomorphic-dompurify'

/**
 * Inline-only sanitizer for AI-generated copy that contains <em>, <strong>,
 * and a couple of class-tagged spans we render in slide previews/captions.
 *
 * Strips every other tag, attribute, and event handler. Use this for any string
 * fed into dangerouslySetInnerHTML.
 */
export function sanitizeInline(dirty: string | null | undefined): string {
  if (!dirty) return ''
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['em', 'strong', 'span', 'b', 'i', 'br'],
    ALLOWED_ATTR: ['class'],
    ALLOW_DATA_ATTR: false,
    RETURN_TRUSTED_TYPE: false,
  }) as unknown as string
}

/**
 * Sanitizer for the full HTML preview of templates (DialogPreview).
 * Allows block-level tags but blocks scripts, iframes, event handlers, and
 * remote resources via on* attrs.
 */
export function sanitizeTemplate(dirty: string | null | undefined): string {
  if (!dirty) return ''
  return DOMPurify.sanitize(dirty, {
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'link', 'meta'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
    RETURN_TRUSTED_TYPE: false,
  }) as unknown as string
}
