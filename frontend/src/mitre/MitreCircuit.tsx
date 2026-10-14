import ModuleCircuit, { type ModuleCircuitConfig } from '@/circuit/ModuleCircuit'

/*
 * The MITRE pages' motherboard: the Dashboard's board, fed by the ATT&CK
 * processor of the module hero. Feeds leave 0.05 s after the hero's pulse
 * reaches the processor (4.5 s into its 10 s cycle), one every 10 s.
 */
const CONFIG: ModuleCircuitConfig = {
  surfaces: '.chh, .mx-stat, .mx-head-actions > *, .mx-tab, .mx-search, .mx-switch, .mx-chip, .mx-rail, .mx-card, .mx-layer, .mx-entry, .mx-state, .mx-meta-form, .mx-pager > *, .mx-dirty, .mx-skeleton',
  readable: '.chh, .mx-stat, .mx-head-actions > *, .mx-tab, .mx-search, .mx-switch, .mx-chip, .mx-result-count, .mx-toolbar-label, .mx-results-title, .mx-pager, .mx-rail, .mx-state, .mx-meta-form, .mx-dirty',
  passBehind: '.mx-stat',
  band: '.mx-top',
  hero: '.chh',
  watch: '.mx-grid, .mx-layer-grid, .mx-scroll, .mx-body',
  schedule: { start: 4.55, cycle: 30, trip: 8 },
}

export default function MitreCircuit() {
  return <ModuleCircuit config={CONFIG} />
}
