export const motion = Object.freeze({
  type: 1450,
  result: 420,
  switch: 260,
  ease: "cubic-bezier(.22,1,.36,1)",
});

export const clamp = (value, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));
export const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export const motionAllowed = () =>
  !prefersReducedMotion() &&
  !document.body.classList.contains("motion-stopped");

export function sectionProgress(element, start = 0.9, end = 0.1) {
  const rect = element.getBoundingClientRect();
  const height = window.innerHeight;
  return clamp(
    (height * start - rect.top) / (rect.height + height * (start - end)),
  );
}
