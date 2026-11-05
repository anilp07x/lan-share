import { useEffect, useRef, useState } from 'react'
import Icon from './Icon.tsx'
import { cn } from '../lib/utils.ts'

export type Filter = 'all' | 'text' | 'files' | 'images'

export const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Tudo' },
  { id: 'text', label: 'Texto' },
  { id: 'files', label: 'Ficheiros' },
  { id: 'images', label: 'Imagens' },
]

interface FilterBarProps {
  filter: Filter
  onFilter: (filter: Filter) => void
  counts: Record<Filter, number>
  query: string
  onQuery: (query: string) => void
}

export default function FilterBar({ filter, onFilter, counts, query, onQuery }: FilterBarProps) {
  // no telemóvel a pesquisa abre por cima dos separadores; no desktop está sempre visível
  const [searchOpen, setSearchOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus()
  }, [searchOpen])

  function closeSearch() {
    onQuery('')
    setSearchOpen(false)
  }

  return (
    <div className="border-border bg-background/90 supports-[backdrop-filter]:bg-background/75 sticky top-0 z-30 border-b backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-1 px-2 sm:gap-2 sm:px-6">
        <div
          role="group"
          aria-label="Filtrar envios"
          className={cn('no-scrollbar -mx-1 flex min-w-0 flex-1 gap-0.5 overflow-x-auto px-1 sm:gap-1', searchOpen && 'max-sm:hidden')}
        >
          {FILTERS.map(({ id, label }) => {
            const active = filter === id
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                onClick={() => onFilter(id)}
                className={cn(
                  'tag flex h-10 shrink-0 items-center gap-1 rounded-full px-2.5 text-[13px] transition-colors sm:gap-1.5 sm:px-3.5',
                  active ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                {label}
                <span className={cn('tabular-nums', active ? 'opacity-60' : 'opacity-70')}>{counts[id]}</span>
              </button>
            )
          })}
        </div>

        <label
          className={cn(
            'border-input bg-card focus-within:border-ring h-10 items-center gap-2 rounded-full border px-3 sm:flex sm:w-56',
            searchOpen ? 'flex flex-1' : 'hidden',
          )}
        >
          <Icon name="search" className="text-muted-foreground size-4 shrink-0" />
          <span className="sr-only">Pesquisar</span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') closeSearch()
            }}
            placeholder="Pesquisar texto, ficheiro, remetente"
            className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-[15px] outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {query || searchOpen ? (
            <button
              type="button"
              onClick={closeSearch}
              className="text-muted-foreground hover:text-foreground -mr-1 flex size-7 items-center justify-center rounded-full"
              aria-label="Limpar pesquisa"
            >
              <Icon name="x" className="size-3.5" />
            </button>
          ) : null}
        </label>

        {!searchOpen ? (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-10 shrink-0 items-center justify-center rounded-full sm:hidden"
            aria-label="Pesquisar"
          >
            <Icon name="search" className="size-[18px]" />
          </button>
        ) : null}
      </div>
    </div>
  )
}
