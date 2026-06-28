import { describe, expect, it } from "vitest";
import { localizeBuilderPackDiagnostic } from "../BuilderPlaytestPackControls";
import { bl } from "./catalogLabels";

describe("builder English labels", () => {
  it("localizes official-builder draft labels and WebGPU diagnostics in English mode", () => {
    expect(bl("回收核心 · 可编辑草稿", "en")).toBe("Reclamation Core · Editable Draft");
    expect(bl("回收中庭", "en")).toBe("Reclamation Atrium");
    expect(bl("监控档案区·夜审 #71203", "en")).toBe("Surveillance Archive Night Review #71203");
    expect(bl("线性密室", "en")).toBe("Linear Room");
    expect(bl("北制动门", "en")).toBe("North Brake Door");
    expect(bl("归档电梯门", "en")).toBe("Archive Elevator Door");
    expect(
      localizeBuilderPackDiagnostic(
        "WGPU 资源包缺少 furniture：door_clinic_memory, door_reclamation_archive。深度试玩会只为这些缺口临时烘焙。",
        "en",
      ),
    ).toBe("WGPU resource pack is missing furniture: door_clinic_memory, door_reclamation_archive. Deep playtest will temporarily bake only these gaps.");
  });
});
