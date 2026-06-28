import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("first-person ultimate viewmodels", () => {
  it("switches the held and deployed Three fallback model by deployed ultimate ability", () => {
    const viewmodelSource = readFileSync(new URL("./FirstPersonProtagonistView.tsx", import.meta.url), "utf8");
    expect(viewmodelSource).toContain("hp_ability_protocol_breach_missile_v1.glb?url");
    expect(viewmodelSource).toContain("const missileRef = useRef<Group>(null)");
    expect(viewmodelSource).toContain("world.session.deployedUltimate?.abilityId");
    expect(viewmodelSource).toContain('ultimateAbilityId === "breachMissile"');
    expect(viewmodelSource).toContain("<ProtocolBreachMissileViewmodel />");

    const deployedSource = readFileSync(new URL("../effects/UltimateAbilityRenderer.tsx", import.meta.url), "utf8");
    expect(deployedSource).toContain("deployed.abilityId");
    expect(deployedSource).not.toContain("world.session.activeUltimateAbilityId");
  });
});
