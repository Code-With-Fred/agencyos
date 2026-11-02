import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function Pagination({ page, pageSize, total, hrefFor }: { page: number; pageSize: number; total: number; hrefFor: (p: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-3 text-[13px] text-fg-muted">
      <span>
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </span>
      <div className="flex gap-1">
        {page > 1 ? (
          <Button asChild variant="ghost" size="icon-sm" aria-label="Previous page">
            <Link href={hrefFor(page - 1)}>
              <ChevronLeft />
            </Link>
          </Button>
        ) : null}
        {page < pages ? (
          <Button asChild variant="ghost" size="icon-sm" aria-label="Next page">
            <Link href={hrefFor(page + 1)}>
              <ChevronRight />
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  )
}
