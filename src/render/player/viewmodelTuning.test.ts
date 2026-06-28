import { describe, expect, it } from "vitest";
import {
  shouldUseOpaqueSelfDepthForViewmodelMaterial,
  scriptedDerivedSidearmLayerMaterialTuning,
  scriptedDerivedSidearmMotionTuning,
} from "./viewmodelTuning";

describe("scripted-derived sidearm first-person tuning", () => {
  it("keeps idle and firing motion restrained for playable aiming", () => {
    expect(scriptedDerivedSidearmMotionTuning.rootIdleX).toBeLessThanOrEqual(0.0016);
    expect(scriptedDerivedSidearmMotionTuning.rootIdleY).toBeLessThanOrEqual(0.0012);
    expect(scriptedDerivedSidearmMotionTuning.visualKickScale).toBeLessThanOrEqual(0.46);
    expect(scriptedDerivedSidearmMotionTuning.weaponKickZ).toBeLessThanOrEqual(0.095);
    expect(scriptedDerivedSidearmMotionTuning.weaponPitchKick).toBeLessThanOrEqual(0.24);
    expect(scriptedDerivedSidearmMotionTuning.handWristKick).toBeLessThanOrEqual(0.065);
    expect(scriptedDerivedSidearmMotionTuning.rightHandGripKick).toBeLessThanOrEqual(0.42);
  });

  it("pulls the support hand out of the sidearm silhouette", () => {
    expect(scriptedDerivedSidearmMotionTuning.leftHandScale).toBeLessThanOrEqual(0.82);
    expect(scriptedDerivedSidearmMotionTuning.leftHandOffsetZ).toBeLessThanOrEqual(-0.045);
    expect(scriptedDerivedSidearmMotionTuning.leftHandOffsetY).toBeLessThanOrEqual(-0.02);
  });

  it("uses crisp metallic response instead of flat grey glow", () => {
    expect(scriptedDerivedSidearmLayerMaterialTuning.slide.metalness).toBeGreaterThanOrEqual(0.98);
    expect(scriptedDerivedSidearmLayerMaterialTuning.barrel.metalness).toBeGreaterThanOrEqual(0.99);
    expect(scriptedDerivedSidearmLayerMaterialTuning.slide.roughness).toBeLessThanOrEqual(0.28);
    expect(scriptedDerivedSidearmLayerMaterialTuning.barrel.roughness).toBeLessThanOrEqual(0.24);
    expect(scriptedDerivedSidearmLayerMaterialTuning.slide.emissiveIntensity).toBeLessThanOrEqual(0.025);
    expect(scriptedDerivedSidearmLayerMaterialTuning.frame.emissiveIntensity).toBeLessThanOrEqual(0.018);
    expect(scriptedDerivedSidearmLayerMaterialTuning.grip.envMapIntensity).toBeLessThanOrEqual(0.32);
  });

  it("keeps opaque layered sidearm meshes from rendering like transparent overlays", () => {
    expect(shouldUseOpaqueSelfDepthForViewmodelMaterial("sidearm_layer_slide_opaque")).toBe(true);
    expect(shouldUseOpaqueSelfDepthForViewmodelMaterial("sidearm_layer_frame_opaque")).toBe(true);
    expect(shouldUseOpaqueSelfDepthForViewmodelMaterial("muzzle_glow")).toBe(false);
  });
});
