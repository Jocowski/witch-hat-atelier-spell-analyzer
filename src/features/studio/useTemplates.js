// useTemplates.js — React hook that supplies recognizer templates to the Studio.
//
// Default state = static bundled seed (immediate, synchronous floor).
// When `useDbTraining` is true AND the user is authed, fetches verified DB rows
// and merges them over the seed (seed is always the floor — merge means recognition
// can only improve, and still works if the DB is paused or unreachable).
//
// Pure export for unit testing:
//   mergeTemplates(seed, dbRows) → [...seed, ...dbRows]
//
// Hook signature:
//   useTemplates({ useDbTraining } = {}) → templates[]

import { useEffect, useState } from 'react'
import { seedTemplates } from '../../draw/seedTemplates.js'
import { activeTemplates } from '../../data-services/samples.js'
import { useCapabilities } from '../../app/capabilities.js'
import rules from '../../../data/rules.json'

/**
 * Merge DB-verified rows over the static seed.
 * The seed is always the floor: DB rows are ADDED, never replace existing seed entries.
 * Recognition can only improve compared to the shipped baseline, and degrades gracefully
 * to the seed when the DB is paused or unreachable.
 *
 * Pure function — no React, importable in unit tests.
 *
 * @param {Array<{ name: string, role: string, points: Array, source: string, weight: number }>} seed
 * @param {Array<{ name: string, role: string, points: Array, source: string, weight: number }>} dbRows
 * @returns {Array<{ name: string, role: string, points: Array, source: string, weight: number }>}
 */
export function mergeTemplates(seed, dbRows) {
  return [...seed, ...dbRows]
}

/**
 * Return recognizer templates as React state.
 *
 * Default: static seed (immediate, synchronous — zero network calls).
 * With `useDbTraining: true` + authed session: seed ⊕ verified DB overlay.
 *
 * @param {{ useDbTraining?: boolean }} [opts]
 * @returns {Array<{ name: string, role: string, points: Array, source: string, weight: number }>}
 */
export function useTemplates({ useDbTraining } = {}) {
  const seed = seedTemplates()
  const { isAuthed } = useCapabilities()
  const [templates, setTemplates] = useState(() => seed)

  useEffect(() => {
    let cancelled = false

    if (isAuthed && useDbTraining) {
      activeTemplates(rules.recognition, { verifiedOnly: true })
        .then((dbRows) => {
          if (cancelled) return
          if (dbRows && dbRows.length > 0) {
            setTemplates(mergeTemplates(seed, dbRows))
          } else {
            setTemplates(seed)
          }
        })
        .catch(() => {
          if (!cancelled) setTemplates(seed)
        })
    } else {
      setTemplates(seed)
    }

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, useDbTraining])

  return templates
}
