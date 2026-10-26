import { useSyncExternalStore } from 'react'
import { LEARNING_MODES, type LearningMode } from './types'

/*
 * The Learning mode is a local, per-browser preference (V1: no backend).
 * Any missing or invalid value falls back to 'essential'. Every <Learn>
 * subscribes to the same store, so changing the mode updates them all, and
 * other tabs follow through the storage event.
 */

const KEY = 'cyberhub.learning.v1'
export const DEFAULT_LEARNING_MODE: LearningMode = 'essential'
const isMode = (value: unknown): value is LearningMode => (LEARNING_MODES as readonly unknown[]).includes(value)

export function readLearningMode(): LearningMode {
  try {
    const value = localStorage.getItem(KEY)
    return isMode(value) ? value : DEFAULT_LEARNING_MODE
  } catch {
    return DEFAULT_LEARNING_MODE
  }
}

const listeners = new Set<() => void>()

export function setLearningMode(mode: LearningMode) {
  if (!isMode(mode)) return
  try { localStorage.setItem(KEY, mode) } catch { /* storage can be unavailable */ }
  listeners.forEach(listener => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => { if (event.key === KEY) listener() }
  window.addEventListener('storage', onStorage)
  return () => { listeners.delete(listener); window.removeEventListener('storage', onStorage) }
}

export const useLearningMode = () => useSyncExternalStore(subscribe, readLearningMode, () => DEFAULT_LEARNING_MODE)
