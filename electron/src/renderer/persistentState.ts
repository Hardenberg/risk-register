import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

export function usePersistentState<T extends object> (
  key: string,
  initialState: T
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key)
      if (!stored) return initialState
      const parsed = JSON.parse(stored)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return initialState
      return { ...initialState, ...parsed }
    } catch {
      return initialState
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(state))
    } catch {
      // Persistenz ist nur Komfort; die Tabellen bleiben ohne Storage normal nutzbar.
    }
  }, [key, state])

  return [state, setState]
}
