import { createContext, useContext } from "react";
import type { BuilderSelection } from "./BuilderTypes";

/**
 * Shared semantic-selection state for the /build editor. The central 2D/3D
 * canvas, right inspector, and blueprint read the SAME hovered / selected /
 * focus state through this context so the editor behaves like one tool instead
 * of disconnected panels.
 *
 * Additive only: BuildPage keeps owning `selection`/`hovered` as the source of
 * truth and still threads them as props. This context mirrors that state plus a
 * one-way camera `focusRequest` and the 3D semantic-overlay toggle, so new
 * cross-links can be wired without touching the existing prop flow.
 */
export interface BuilderFocusRequest {
  /** Plan-space X (metres). */
  x: number;
  /** Plan-space Z (metres). */
  z: number;
  /** Optional target span (largest room dimension) → camera pull-back distance. */
  span?: number;
  /** Monotonic token so the same target re-fires the camera move. */
  token: number;
}

export interface BuilderSelectionContextValue {
  selection: BuilderSelection;
  hovered: BuilderSelection;
  setSelection: (selection: BuilderSelection) => void;
  setHovered: (selection: BuilderSelection) => void;
  focusRequest: BuilderFocusRequest | null;
  requestFocus: (request: Omit<BuilderFocusRequest, "token">) => void;
  /** 3D semantic-overlay layer toggle (exits / puzzles / locks / story / enemies). */
  overlayEnabled: boolean;
  setOverlayEnabled: (enabled: boolean) => void;
}

const BuilderSelectionContext = createContext<BuilderSelectionContextValue | null>(null);

export const BuilderSelectionProvider = BuilderSelectionContext.Provider;

/**
 * Read the shared selection context. Returns null when used outside a provider
 * (e.g. the thumbnail-capture page mounting a builder component in isolation),
 * so every consumer must null-guard — keeping the integration safe and additive.
 */
export function useBuilderSelection(): BuilderSelectionContextValue | null {
  return useContext(BuilderSelectionContext);
}
