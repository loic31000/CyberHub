import { useId } from 'react'
import { setLearningMode, useLearningMode } from './preferences'
import type { LearningMode } from './types'
import './learning.css'

/*
 * The Learning mode control: a compact radio group (real inputs, so it works
 * with the keyboard and screen readers). It stays visible in "off" so the
 * help can always be turned back on.
 */

const OPTIONS: { value: LearningMode; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'essential', label: 'Essentiel' },
  { value: 'guided', label: 'Guidé' },
]

export default function LearningModeSwitch() {
  const mode = useLearningMode()
  const name = useId()
  return <fieldset className="lr-switch">
    <legend>Aide à la lecture</legend>
    {OPTIONS.map(option => <label key={option.value}>
      <input type="radio" name={name} value={option.value} checked={mode === option.value} onChange={() => setLearningMode(option.value)} />
      <span>{option.label}</span>
    </label>)}
  </fieldset>
}
