export type PreviewPlaneRotation = [number, number, number];

export const horizontalPreviewPlaneRotation: PreviewPlaneRotation = [-Math.PI / 2, 0, 0];

export function ceilingPreviewPlaneRotation(hasFootprintGeometry: boolean): PreviewPlaneRotation | undefined {
  return hasFootprintGeometry ? undefined : horizontalPreviewPlaneRotation;
}
