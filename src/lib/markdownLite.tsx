import { Fragment, type ReactNode } from 'react'

/** Assistant chat replies come back as plain Gemini text that often uses light
 * markdown (bold, inline code, bullet/numbered lists) - rendered here as real
 * React nodes (never dangerouslySetInnerHTML, so there's no injection surface
 * even though the text is LLM-generated) instead of pulling in a markdown
 * dependency for what's a small, fixed subset. */

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = []
  const pattern = /\*\*([^*]+)\*\*|`([^`]+)`/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let i = 0
  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    if (match[1] !== undefined) {
      parts.push(<strong key={`${keyPrefix}-${i++}`}>{match[1]}</strong>)
    } else {
      parts.push(
        <code
          key={`${keyPrefix}-${i++}`}
          className="rounded bg-surface px-1 py-0.5 font-mono text-[0.85em]"
        >
          {match[2]}
        </code>,
      )
    }
    lastIndex = pattern.lastIndex
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}

interface Block {
  type: 'ul' | 'ol' | 'p'
  lines: string[]
}

function toBlocks(text: string): Block[] {
  const blocks: Block[] = []
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trimEnd()
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line)
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    const last = blocks[blocks.length - 1]
    if (bullet) {
      if (last?.type === 'ul') last.lines.push(bullet[1])
      else blocks.push({ type: 'ul', lines: [bullet[1]] })
    } else if (numbered) {
      if (last?.type === 'ol') last.lines.push(numbered[1])
      else blocks.push({ type: 'ol', lines: [numbered[1]] })
    } else {
      // Blank lines just separate paragraphs within a 'p' block - tracked as
      // an empty line entry so toParagraphs (below) can split on them.
      if (last?.type === 'p') last.lines.push(line)
      else blocks.push({ type: 'p', lines: [line] })
    }
  }
  return blocks
}

function toParagraphs(lines: string[]): string[][] {
  const paragraphs: string[][] = [[]]
  for (const line of lines) {
    if (line === '') paragraphs.push([])
    else paragraphs[paragraphs.length - 1].push(line)
  }
  return paragraphs.filter((p) => p.length > 0)
}

export function MarkdownLite({ text }: { text: string }) {
  const blocks = toBlocks(text)
  return (
    <>
      {blocks.map((block, bi) => {
        if (block.type === 'ul') {
          return (
            <ul key={bi} className="list-disc space-y-0.5 pl-5">
              {block.lines.map((line, li) => (
                <li key={li}>{renderInline(line, `${bi}-${li}`)}</li>
              ))}
            </ul>
          )
        }
        if (block.type === 'ol') {
          return (
            <ol key={bi} className="list-decimal space-y-0.5 pl-5">
              {block.lines.map((line, li) => (
                <li key={li}>{renderInline(line, `${bi}-${li}`)}</li>
              ))}
            </ol>
          )
        }
        return (
          <Fragment key={bi}>
            {toParagraphs(block.lines).map((paragraph, pi) => (
              <p key={pi}>
                {paragraph.map((line, li) => (
                  <Fragment key={li}>
                    {li > 0 && <br />}
                    {renderInline(line, `${bi}-${pi}-${li}`)}
                  </Fragment>
                ))}
              </p>
            ))}
          </Fragment>
        )
      })}
    </>
  )
}
