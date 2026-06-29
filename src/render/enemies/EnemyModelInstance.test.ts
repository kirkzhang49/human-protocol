import { describe, expect, it } from "vitest";
import { MeshStandardMaterial } from "three";
import { polishEnemyMaterial } from "./EnemyModelInstance";

describe("polishEnemyMaterial", () => {
  it("keeps reclamation mother core glass readable instead of forcing it opaque", () => {
    const material = new MeshStandardMaterial({ name: "mat_core_blue_glass" });

    polishEnemyMaterial(material, "hp_enemy_reclamation_mother_final_horror", true);

    expect(material.transparent).toBe(true);
    expect(material.opacity).toBeGreaterThan(0.62);
    expect(material.opacity).toBeLessThan(0.9);
    expect(material.depthWrite).toBe(false);
    expect(material.emissiveIntensity).toBeGreaterThanOrEqual(1.8);
    expect(material.toneMapped).toBe(false);
  });

  it("does not mistake dark core shadow plates for the glowing core lens", () => {
    const material = new MeshStandardMaterial({ name: "hp_oxidized_dark_core_shadow_production" });

    polishEnemyMaterial(material, "hp_enemy_reclamation_mother_final_horror", true);

    expect(material.transparent).toBe(false);
    expect(material.emissiveIntensity).toBeLessThan(0.3);
    expect(material.depthWrite).toBe(true);
  });
});
