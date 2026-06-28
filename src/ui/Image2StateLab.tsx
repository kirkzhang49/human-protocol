// Image2 state lab (dev-only, ?image2Lab=1 on /build).
//
// Proves the Image2 GUI kits can switch locked/active/solved/disabled/danger/
// choice/error layers at runtime — not just exist as files. Renders every
// supported state for the three Batch 01 hero GUI kits (level07 route switch,
// level09 lockdown override, level10 final protocol) using the reusable
// Image2StatePanel, with React-owned Chinese live text per state. A small
// window API lets the screenshot QA harness drive single-state captures.
import { useEffect, useState } from "react";
import { Image2StatePanel } from "./Image2StatePanel";
import { IMAGE2_STATES, image2HasState, type Image2RegionsData } from "./image2Region";

import routeBg from "../assets/gui/level07/transit_route_switch_background_image2.png";
import routeParts from "../assets/gui/level07/transit_route_switch_parts_image2.png";
import routeRegions from "../assets/gui/level07/transit_route_switch_parts_image2.regions.json";
import lockdownBg from "../assets/gui/level09/lockdown_override_background_image2.png";
import lockdownParts from "../assets/gui/level09/lockdown_override_parts_image2.png";
import lockdownRegions from "../assets/gui/level09/lockdown_override_parts_image2.regions.json";
import protocolBg from "../assets/gui/level10/final_protocol_background_image2.png";
import protocolParts from "../assets/gui/level10/final_protocol_parts_image2.png";
import protocolRegions from "../assets/gui/level10/final_protocol_parts_image2.regions.json";

interface KitDef {
  id: string;
  label: string;
  level: string;
  backgroundUrl: string;
  partsUrl: string;
  regions: Image2RegionsData;
  /** React-owned live copy per state (no puzzle answers, no baked text). */
  text: Record<string, string>;
}

// Live copy drawn from the Level 06-10 GUI/asset draft pack. React owns this —
// it is never baked into the PNGs.
const KITS: KitDef[] = [
  {
    id: "level07_transit_route_switch",
    label: "轨道路由控制台",
    level: "L07",
    backgroundUrl: routeBg,
    partsUrl: routeParts,
    regions: routeRegions as unknown as Image2RegionsData,
    text: {
      locked: "需要授权码",
      active: "选择目标路线",
      solved: "路线切换完成",
      disabled: "电源不足",
      danger: "线路过热",
      choice: "确认目标路线",
      error: "信号丢失",
    },
  },
  {
    id: "level09_lockdown_override",
    label: "封锁解除控制台",
    level: "L09",
    backgroundUrl: lockdownBg,
    partsUrl: lockdownParts,
    regions: lockdownRegions as unknown as Image2RegionsData,
    text: {
      locked: "访问受限",
      active: "正在解除封锁",
      solved: "封锁解除",
      disabled: "电源不足",
      danger: "压力过载",
      choice: "选择断路通道",
      error: "传感器故障",
    },
  },
  {
    id: "level10_final_protocol",
    label: "终极协议控制台",
    level: "L10",
    backgroundUrl: protocolBg,
    partsUrl: protocolParts,
    regions: protocolRegions as unknown as Image2RegionsData,
    text: {
      locked: "协议密钥缺失",
      active: "协议同步中",
      solved: "协议已完成",
      disabled: "电源不足",
      danger: "核心过载",
      choice: "保留 / 删除 / 传输",
      error: "同步中断",
    },
  },
];

const PROGRESS_BY_STATE: Record<string, number | undefined> = {
  active: 0.62,
  danger: 0.88,
  solved: 1,
};

export function Image2StateLab() {
  const [focus, setFocus] = useState<{ kitId: string; state: string } | null>(null);

  useEffect(() => {
    const api = {
      kits: KITS.map((k) => ({ id: k.id, states: IMAGE2_STATES.filter((s) => image2HasState(k.regions, s)) })),
      setState(kitId: string, state: string) {
        setFocus({ kitId, state });
      },
      clear() {
        setFocus(null);
      },
    };
    (window as unknown as { __image2Lab?: typeof api }).__image2Lab = api;
    (window as unknown as { __image2LabReady?: boolean }).__image2LabReady = true;
    return () => {
      delete (window as unknown as { __image2Lab?: unknown }).__image2Lab;
      delete (window as unknown as { __image2LabReady?: boolean }).__image2LabReady;
    };
  }, []);

  if (focus) {
    const kit = KITS.find((k) => k.id === focus.kitId);
    if (kit) {
      return (
        <div className="image2-lab image2-lab-focus" data-kit={kit.id} data-state={focus.state}>
          <Image2StatePanel
            backgroundUrl={kit.backgroundUrl}
            partsUrl={kit.partsUrl}
            regions={kit.regions}
            state={focus.state}
            progress={PROGRESS_BY_STATE[focus.state]}
            label={kit.text[focus.state]}
            title={`${kit.label} — ${focus.state}`}
            className="image2-lab-panel"
          />
        </div>
      );
    }
  }

  return (
    <div className="image2-lab">
      <header className="image2-lab-head">
        <strong>Image2 GUI 状态实验台</strong>
        <span>parts atlas + regions.json → 状态切换（locked / active / solved / disabled / danger / choice / error）</span>
      </header>
      {KITS.map((kit) => {
        const states = IMAGE2_STATES.filter((s) => image2HasState(kit.regions, s));
        return (
          <section className="image2-lab-row" key={kit.id} data-kit={kit.id}>
            <h2>
              {kit.level} · {kit.label}
            </h2>
            <div className="image2-lab-grid">
              {states.map((state) => (
                <figure className="image2-lab-cell" key={state} data-state={state}>
                  <Image2StatePanel
                    backgroundUrl={kit.backgroundUrl}
                    partsUrl={kit.partsUrl}
                    regions={kit.regions}
                    state={state}
                    progress={PROGRESS_BY_STATE[state]}
                    label={kit.text[state]}
                    title={`${kit.label} — ${state}`}
                    className="image2-lab-panel"
                  />
                  <figcaption>{state}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
