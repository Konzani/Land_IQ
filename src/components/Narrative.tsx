'use client'

import { Fragment } from 'react'

function inline(text: string, keyPrefix: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={`${keyPrefix}-${i}`} className="font-semibold text-ink">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={`${keyPrefix}-${i}`}>{part}</Fragment>
    ),
  )
}

export default function Narrative({ text, streaming }: { text: string; streaming: boolean }) {
  const blocks: JSX.Element[] = []
  const lines = text.split('\n')
  let bullets: string[] = []

  const flush = (key: string) => {
    if (!bullets.length) return
    blocks.push(
      <ul key={key} className="my-2 space-y-1.5">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed text-ink-soft">
            <span className="mt-[7px] h-1 w-1 shrink-0 bg-nitisol" aria-hidden />
            <span>{inline(b, `${key}-${i}`)}</span>
          </li>
        ))}
      </ul>,
    )
    bullets = []
  }

  lines.forEach((raw, i) => {
    const line = raw.trimEnd()
    if (/^\s*[-*]\s+/.test(line)) {
      bullets.push(line.replace(/^\s*[-*]\s+/, ''))
      return
    }
    flush(`ul-${i}`)
    if (!line.trim()) return
    if (line.startsWith('### ')) {
      blocks.push(
        <h4 key={i} className="mt-4 font-sheet text-base text-ink">
          {line.slice(4)}
        </h4>,
      )
    } else if (line.startsWith('## ')) {
      blocks.push(
        <h3 key={i} className="mt-5 font-sheet text-lg text-ink first:mt-0">
          {line.slice(3)}
        </h3>,
      )
    } else if (line.startsWith('# ')) {
      blocks.push(
        <h3 key={i} className="mt-5 font-sheet text-lg text-ink first:mt-0">
          {line.slice(2)}
        </h3>,
      )
    } else {
      blocks.push(
        <p key={i} className="mt-2 text-sm leading-relaxed text-ink-soft">
          {inline(line, `p-${i}`)}
        </p>,
      )
    }
  })
  flush('ul-final')

  return (
    <section>
      <h3 className="font-sheet text-lg text-ink">Interpretation</h3>
      <div className="mt-1 max-w-[62ch]">
        {blocks}
        {streaming && <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-nitisol align-text-bottom" />}
      </div>
      <p className="label-note mt-4">
        Written by a language model from the measured values above. Treat it as interpretation, not as a substitute for a
        field visit.
      </p>
    </section>
  )
}
