import { useMemo, useState } from "react";
import { Image2StatePanel } from "../ui/Image2StatePanel";
import { IMAGE2_STATES, image2HasState, type Image2RegionsData } from "../ui/image2Region";
import { useBuilderLanguage } from "./i18n/builderLanguage";
import type { BuilderRouteSwitch } from "./BuilderTypes";

import routeBg from "../assets/gui/level07/transit_route_switch_background_image2.png";
import routeParts from "../assets/gui/level07/transit_route_switch_parts_image2.png";
import routeRegions from "../assets/gui/level07/transit_route_switch_parts_image2.regions.json";
import lockdownBg from "../assets/gui/level09/lockdown_override_background_image2.png";
import lockdownParts from "../assets/gui/level09/lockdown_override_parts_image2.png";
import lockdownRegions from "../assets/gui/level09/lockdown_override_parts_image2.regions.json";
import protocolBg from "../assets/gui/level10/final_protocol_background_image2.png";
import protocolParts from "../assets/gui/level10/final_protocol_parts_image2.png";
import protocolRegions from "../assets/gui/level10/final_protocol_parts_image2.regions.json";

/**
 * In-builder preview of the Image2 console GUIs so a designer can see what the
 * player will see at each state (locked before authorization, active, solved,
 * danger, choice…) instead of only the static GLB panel. The route-switch kit
 * maps to the selected route console; lockdown / final-protocol are reference
 * kits (not yet bound to a builder object). Read-only — never mutates the
 * project.
 */
interface KitDef {
  id: string;
  label: string;
  labelEn: string;
  /** True = not bound to a builder object yet; shown as reference only. */
  reference: boolean;
  backgroundUrl: string;
  partsUrl: string;
  regions: Image2RegionsData;
  /** React-owned live copy per state (never baked into the PNG). */
  text: Record<string, string>;
  textEn: Record<string, string>;
}

const KITS: readonly KitDef[] = [
  {
    id: "route",
    label: "路由控制台",
    labelEn: "Route Console",
    reference: false,
    backgroundUrl: routeBg,
    partsUrl: routeParts,
    regions: routeRegions as unknown as Image2RegionsData,
    text: { locked: "需要授权码", active: "选择目标路线", solved: "路线切换完成", disabled: "电源不足", danger: "线路过热", choice: "确认目标路线", error: "信号丢失" },
    textEn: { locked: "Authorization required", active: "Select target route", solved: "Route switched", disabled: "Insufficient power", danger: "Circuit overheating", choice: "Confirm target route", error: "Signal lost" },
  },
  {
    id: "lockdown",
    label: "封锁解除",
    labelEn: "Lockdown Override",
    reference: true,
    backgroundUrl: lockdownBg,
    partsUrl: lockdownParts,
    regions: lockdownRegions as unknown as Image2RegionsData,
    text: { locked: "访问受限", active: "正在解除封锁", solved: "封锁解除", disabled: "电源不足", danger: "压力过载", choice: "选择断路通道", error: "传感器故障" },
    textEn: { locked: "Access restricted", active: "Overriding lockdown", solved: "Lockdown lifted", disabled: "Insufficient power", danger: "Pressure overload", choice: "Select breaker channel", error: "Sensor fault" },
  },
  {
    id: "protocol",
    label: "最终协议",
    labelEn: "Final Protocol",
    reference: true,
    backgroundUrl: protocolBg,
    partsUrl: protocolParts,
    regions: protocolRegions as unknown as Image2RegionsData,
    text: { locked: "协议封存", active: "协议运行中", solved: "协议确认", disabled: "权限不足", danger: "核心过载", choice: "做出最终选择", error: "校验失败" },
    textEn: { locked: "Protocol sealed", active: "Protocol running", solved: "Protocol confirmed", disabled: "Insufficient clearance", danger: "Core overload", choice: "Make the final choice", error: "Verification failed" },
  },
];

const STATE_LABEL: Record<string, string> = {
  locked: "锁定",
  active: "激活",
  solved: "完成",
  disabled: "禁用",
  danger: "危险",
  choice: "选择",
  error: "错误",
};

const STATE_LABEL_EN: Record<string, string> = {
  locked: "Locked",
  active: "Active",
  solved: "Solved",
  disabled: "Disabled",
  danger: "Danger",
  choice: "Choice",
  error: "Error",
};

/** A quiet read of the route's outputs → the state the player meets it in. */
function suggestedState(routeSwitch: BuilderRouteSwitch): string {
  return (routeSwitch.outputs?.length ?? 0) > 0 ? "active" : "locked";
}

export function BuilderImage2StatePreview({ routeSwitch }: { routeSwitch: BuilderRouteSwitch }) {
  const { language } = useBuilderLanguage();
  const en = language === "en";
  const [kitId, setKitId] = useState("route");
  const [state, setState] = useState<string>(() => suggestedState(routeSwitch));

  const kit = KITS.find((candidate) => candidate.id === kitId) ?? KITS[0];
  const kitText = en ? kit.textEn : kit.text;
  const stateLabels = en ? STATE_LABEL_EN : STATE_LABEL;
  const availableStates = useMemo<string[]>(
    () => IMAGE2_STATES.filter((value) => image2HasState(kit.regions, value)),
    [kit],
  );
  const suggested = suggestedState(routeSwitch);
  const activeState = availableStates.includes(state)
    ? state
    : availableStates.includes(suggested)
      ? suggested
      : availableStates[0] ?? "active";

  return (
    <div className="builder-image2-preview">
      <div className="builder-image2-kit-tabs" role="tablist" aria-label={en ? "Image2 consoles" : "Image2 控制台"}>
        {KITS.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            role="tab"
            aria-selected={candidate.id === kitId}
            className={candidate.id === kitId ? "active" : ""}
            onClick={() => setKitId(candidate.id)}
          >
            {en ? candidate.labelEn : candidate.label}
            {candidate.reference ? <em>{en ? "ref" : "参考"}</em> : null}
          </button>
        ))}
      </div>

      <Image2StatePanel
        backgroundUrl={kit.backgroundUrl}
        partsUrl={kit.partsUrl}
        regions={kit.regions}
        state={activeState}
        label={kitText[activeState] ?? activeState}
        title={`${en ? kit.labelEn : kit.label} · ${stateLabels[activeState] ?? activeState}`}
        className="builder-image2-preview-panel"
      />

      <div className="builder-image2-state-chips" role="group" aria-label={en ? "States" : "状态"}>
        {availableStates.map((value) => (
          <button
            key={value}
            type="button"
            className={value === activeState ? "active" : ""}
            onClick={() => setState(value)}
          >
            {stateLabels[value] ?? value}
          </button>
        ))}
      </div>

      <p className="builder-hint">
        {kit.reference
          ? en
            ? "Reference: this console isn't bound to a build object yet — it only previews Image2 states."
            : "参考：此控制台暂未绑定建造对象，仅用于查看 Image2 状态。"
          : en
            ? "What the player sees on the Image2 route console. Locked = before authorization; Active = after outputs are wired."
            : "玩家看到的 Image2 路由台外观。锁定 = 授权前所见；激活 = 接好输出后。"}
      </p>
    </div>
  );
}
