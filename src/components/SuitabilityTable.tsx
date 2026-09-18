'use client'

import { useState } from 'react'
import { CLASS_LABEL, type CropAssessment, type SuitabilityClass } from '../lib/agronomy/suitability'

const CLASS_COLOR: Record<SuitabilityClass, string> = {
  S1: '#4E6636',
  S2: '#7C8A3E',
  S3: '#B07A2E',
  N: '#8A3C22',
}

export default function SuitabilityTable({ assessments }: { assessments: CropAssessment[] }) {
  const [open, setOpen] = useState<string | null>(assessments[0]?.crop.id ?? null)
  const [showAll, setShowAll] = useState(false)

  const visible = showAll ? assessments : assessments.slice(0, 8)

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h3 className="font-sheet text-lg text-ink">Crop suitability</h3>
        <p className="label-note">S1 highly · S2 moderately · S3 marginally · N unsuitable</p>
      </div>

      <ul className="mt-3">
        {visible.map((a, index) => {
          const expanded = open === a.crop.id
          return (
            <li key={a.crop.id} className="border-b border-rule/50">
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : a.crop.id)}
                aria-expanded={expanded}
                className="flex w-full items-center gap-3 py-2 text-left"
              >
                <span className="w-4 text-micro text-ink-faint">{index + 1}</span>
                <span className="flex-1">
                  <span className="text-sm text-ink">{a.crop.name}</span>
                  <span className="label-note block italic">{a.crop.botanical}</span>
                </span>
                <span className="h-1.5 w-20 overflow-hidden bg-rule/50" aria-hidden>
                  <span
                    className="score-bar block h-full"
                    style={{ width: `${a.score}%`, backgroundColor: CLASS_COLOR[a.class], animationDelay: `${index * 55}ms` }}
                  />
                </span>
                <span className="w-7 text-right text-sm text-ink">{a.score}</span>
                <span
                  className="w-6 text-right text-sm font-semibold"
                  style={{ color: CLASS_COLOR[a.class] }}
                  title={CLASS_LABEL[a.class]}
                >
                  {a.class}
                </span>
              </button>

              {expanded && (
                <div className="pb-4 pl-7 pr-1">
                  <p className="text-sm leading-relaxed text-ink-soft">{a.crop.note}</p>

                  <dl className="mt-3">
                    {a.factors.map((f) => (
                      <div key={f.factor} className="flex items-baseline justify-between gap-3 py-1">
                        <dt className="text-micro text-ink-soft">{f.factor}</dt>
                        <dd className="flex items-baseline gap-2 text-micro">
                          <span className="text-ink">{f.observed}</span>
                          <span
                            className="w-8 text-right"
                            style={{ color: f.score >= 70 ? '#4E6636' : f.score >= 40 ? '#B07A2E' : '#8A3C22' }}
                          >
                            {Math.round(f.score)}
                          </span>
                        </dd>
                      </div>
                    ))}
                  </dl>

                  {a.limiting.length > 0 && (
                    <p className="mt-2 text-micro text-ink-soft">
                      Held back by {a.limiting.map((f) => f.factor.toLowerCase()).join(', ')}. Target:{' '}
                      {a.limiting[0].required}.
                    </p>
                  )}

                  {a.interventions.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {a.interventions.map((tip) => (
                        <li key={tip} className="flex gap-2 text-micro leading-relaxed text-ink-soft">
                          <span className="mt-[5px] h-1 w-1 shrink-0 bg-nitisol" aria-hidden />
                          {tip}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {assessments.length > 8 && (
        <button type="button" onClick={() => setShowAll(!showAll)} className="mt-3 text-micro text-nitisol underline underline-offset-2">
          {showAll ? 'Show leading crops only' : `Show all ${assessments.length} crops assessed`}
        </button>
      )}
    </section>
  )
}
