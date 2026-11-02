import { toBlocks } from '@/lib/content/blocks'
import { cn } from '@/lib/utils'

export function RichText({ text, className, tone = 'dark' }: { text: string; className?: string; tone?: 'dark' | 'light' }) {
  const blocks = toBlocks(text)
  const body = tone === 'dark' ? 'text-fg-muted' : 'text-zinc-700'
  const head = tone === 'dark' ? 'text-fg' : 'text-zinc-900'
  return (
    <div className={cn('space-y-3 text-[14px] leading-relaxed', body, className)}>
      {blocks.map((b, i) =>
        b.type === 'heading' ? (
          <h4 key={i} className={cn('pt-1 text-[14px] font-semibold', head)}>
            {b.text}
          </h4>
        ) : b.type === 'list' ? (
          b.ordered ? (
            <ol key={i} className="list-decimal space-y-1 pl-5">
              {b.items.map((it, j) => (
                <li key={j}>{it}</li>
              ))}
            </ol>
          ) : (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {b.items.map((it, j) => (
                <li key={j}>{it}</li>
              ))}
            </ul>
          )
        ) : (
          <p key={i}>{b.text}</p>
        ),
      )}
    </div>
  )
}
