export type Block = { type: 'heading'; text: string } | { type: 'paragraph'; text: string } | { type: 'list'; items: string[]; ordered: boolean }

/**
 * Minimal, safe text format used for editable documents:
 *   "## Heading", "- bullet" / "* bullet", "1. numbered", blank line = paragraph.
 * Rendered as React elements / PDF nodes — never as raw HTML.
 */
export function toBlocks(text: string): Block[] {
  const blocks: Block[] = []
  let para: string[] = []
  let list: { items: string[]; ordered: boolean } | null = null
  const flushPara = () => {
    if (para.length) blocks.push({ type: 'paragraph', text: para.join(' ').trim() })
    para = []
  }
  const flushList = () => {
    if (list) blocks.push({ type: 'list', ...list })
    list = null
  }
  for (const raw of (text ?? '').replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim()
    if (!line) {
      flushPara()
      flushList()
      continue
    }
    const heading = line.match(/^#{1,4}\s+(.*)$/)
    const bullet = line.match(/^[-*•]\s+(.*)$/)
    const numbered = line.match(/^\d+[.)]\s+(.*)$/)
    if (heading) {
      flushPara()
      flushList()
      blocks.push({ type: 'heading', text: heading[1].replace(/\*\*/g, '') })
    } else if (bullet || numbered) {
      flushPara()
      const ordered = Boolean(numbered)
      if (list && list.ordered !== ordered) flushList()
      list ??= { items: [], ordered }
      list.items.push((bullet ?? numbered)![1].replace(/\*\*/g, ''))
    } else {
      flushList()
      para.push(line.replace(/\*\*/g, ''))
    }
  }
  flushPara()
  flushList()
  return blocks
}
