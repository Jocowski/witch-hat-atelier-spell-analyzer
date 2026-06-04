// useSymbolData — subscribe a React component to the symbol store so it re-renders when the DB
// overlay loads or an Admin edit changes the merged snapshot. Kept separate from symbolStore.js so
// the store itself stays React-free (it's imported by the non-React engine modules).
import { useSyncExternalStore } from 'react'
import { subscribe, getSnapshot } from './symbolStore.js'

export function useSymbolData() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
