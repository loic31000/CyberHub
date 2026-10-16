/* Layout-change signal: anything that moves a panel asks the board to measure again. */

export const CIRCUIT_LAYOUT_EVENT = "cyberhub:layout-change";

export function requestCircuitRecompute() {
  window.dispatchEvent(new Event(CIRCUIT_LAYOUT_EVENT));
}
