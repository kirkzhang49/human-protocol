// Single source of truth for device/pointer detection. Every predicate here
// reproduces, verbatim, a media query that previously lived inline in App.tsx,
// GameCanvas.tsx, RawWebGpuCanvas.tsx, or GameplayPointerLock.ts — so swapping a
// call site to one of these helpers is behaviorally identical on every device.
// Keep these as point-in-time reads (no change listeners) to match the original
// `.matches` semantics they replace.

/** Touch-primary pointer. Used to gate the desktop-only /build editor. */
export function isCoarsePointer(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(pointer: coarse)").matches ?? false;
}

/**
 * Canonical "mobile performance / mobile shell" query used by GameCanvas and
 * RawWebGpuCanvas to pick DPR/effect budgets. Coarse pointer OR narrow viewport.
 */
export function isMobileViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse), (max-width: 900px)").matches;
}

/**
 * useLandscapeLock's heuristic — the mobile-viewport query plus a short-side
 * clause so small foldables/tablets in either orientation still get the rotate
 * guard + best-effort orientation-lock flow.
 */
export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(max-width: 900px)").matches ||
    window.matchMedia("(pointer: coarse)").matches ||
    Math.min(window.innerWidth, window.innerHeight) <= 540
  );
}

/**
 * Pointer-lock gate (moved verbatim from GameplayPointerLock.usesDesktopPointer).
 * Requires a fine pointer AND not a coarse one — intentionally NOT the negation
 * of isMobileViewport, so a narrow desktop window keeps mouse-look pointer lock.
 */
export function usesDesktopPointer(): boolean {
  if (typeof window === "undefined") return false;
  const finePointer = window.matchMedia?.("(pointer: fine)").matches ?? true;
  const coarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  return finePointer && !coarsePointer;
}
