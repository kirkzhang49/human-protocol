import type { EnvironmentModelKey } from "../assets/environmentModelAssets";
import type { BuilderPickup, BuilderPickupKind } from "./BuilderTypes";

export type BuilderPickupThumbnailKind = "key" | "medkit" | "cell" | "missile";

export interface BuilderPickupEntry {
  kind: BuilderPickupKind;
  label: string;
  glyph: string;
  color: string;
  modelKey: EnvironmentModelKey;
  thumbnailKind: BuilderPickupThumbnailKind;
  hint: string;
}

export const builderPickupCatalog: readonly BuilderPickupEntry[] = [
  {
    kind: "key_item",
    label: "解除钥",
    glyph: "钥",
    color: "#ffd24f",
    modelKey: "pickup_large_yellow_key",
    thumbnailKind: "key",
    hint: "绑定一扇钥匙门，拾取后放行",
  },
  {
    kind: "repairKit",
    label: "治疗包",
    glyph: "+",
    color: "#f2f4ec",
    modelKey: "pickup_medkit_white_red",
    thumbnailKind: "medkit",
    hint: "试玩时恢复生命",
  },
  {
    kind: "coreCell",
    label: "能量块",
    glyph: "⚡",
    color: "#ffbd5a",
    modelKey: "pickup_energy_cell_amber",
    thumbnailKind: "cell",
    hint: "试玩时补充核心能量",
  },
  {
    kind: "breachMissile",
    label: "突破导弹",
    glyph: "导",
    color: "#72f5ff",
    modelKey: "ability_protocol_breach_missile_v1",
    thumbnailKind: "missile",
    hint: "拾取后切换为导弹技能并补充一次发射能量",
  },
] as const;

export function pickupEntry(kind: BuilderPickupKind | undefined): BuilderPickupEntry {
  return builderPickupCatalog.find((entry) => entry.kind === kind) ?? builderPickupCatalog[0];
}

export function pickupModelKey(kind: BuilderPickupKind): EnvironmentModelKey {
  return pickupEntry(kind).modelKey;
}

export function pickupLabel(pickup: Pick<BuilderPickup, "kind">) {
  return pickupEntry(pickup.kind).label;
}
