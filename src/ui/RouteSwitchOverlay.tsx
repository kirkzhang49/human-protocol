import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import backgroundUrl from "../assets/gui/route-switch/route_switch_background_image2_v6.png";
import iconLanguageUrl from "../assets/gui/route-switch/route_switch_icon_language_image2_v1.png";
import iconLanguageRegionsData from "../assets/gui/route-switch/route_switch_icon_language_image2_v1.regions.json";
import outputButtonUrl from "../assets/gui/route-switch/route_switch_output_rotary_buttons_image2_v1.png";
import outputButtonRegionsData from "../assets/gui/route-switch/route_switch_output_rotary_buttons_image2_v1.regions.json";
import outputRackUrl from "../assets/gui/route-switch/route_switch_output_rack_image2_v1.png";
import outputRackRegionsData from "../assets/gui/route-switch/route_switch_output_rack_image2_v1.regions.json";
import partsUrl from "../assets/gui/route-switch/route_switch_parts_image2.png";
import regionsData from "../assets/gui/route-switch/route_switch_parts_image2.regions.json";
import type { GameLanguage } from "../game/core/GameSettings";
import type { GameWorld, RouteSwitchOption, RouteSwitchView } from "../game/core/GameWorld";
import { releaseDesktopPointerLock, requestDesktopPointerLock } from "./desktopPointerLock";
import { usePolledSnapshot } from "./usePolledSnapshot";

interface RouteSwitchOverlayProps {
  world: GameWorld;
}

interface RouteSwitchSnapshot {
  visible: boolean;
  view: RouteSwitchView | null;
  language: GameLanguage;
}

type Phase = "select" | "rotating";

const ROTATE_MS = 700;

type GuiAtlas = { atlasSize: [number, number]; regions: Record<string, [number, number, number, number]> };

const ATLAS = regionsData as unknown as GuiAtlas;
const ICON_ATLAS = iconLanguageRegionsData as unknown as GuiAtlas;
const OUTPUT_BUTTON_ATLAS = outputButtonRegionsData as unknown as GuiAtlas;
const OUTPUT_RACK_ATLAS = outputRackRegionsData as unknown as GuiAtlas;
const ROTATING_BUTTON_REGIONS = ["button_rotating_0", "button_rotating_1", "button_rotating_2", "button_rotating_3"] as const;

function atlasRegionStyle(atlas: GuiAtlas, imageUrl: string, name: string): CSSProperties {
  const [aw, ah] = atlas.atlasSize;
  const region = atlas.regions[name];
  if (!region) return {};
  const [rx, ry, rw, rh] = region;
  const posX = aw === rw ? 0 : (rx / (aw - rw)) * 100;
  const posY = ah === rh ? 0 : (ry / (ah - rh)) * 100;
  return {
    backgroundImage: `url("${imageUrl}")`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${(aw / rw) * 100}% ${(ah / rh) * 100}%`,
    backgroundPosition: `${posX}% ${posY}%`,
    aspectRatio: `${rw} / ${rh}`,
  };
}

function regionStyle(name: string): CSSProperties {
  return atlasRegionStyle(ATLAS, partsUrl, name);
}

function iconStyle(name: string): CSSProperties {
  return atlasRegionStyle(ICON_ATLAS, iconLanguageUrl, name);
}

type OutputButtonRegion = "button_enabled" | "button_disabled" | "button_selected" | (typeof ROTATING_BUTTON_REGIONS)[number];

function outputButtonStyle(name: OutputButtonRegion): CSSProperties {
  return atlasRegionStyle(OUTPUT_BUTTON_ATLAS, outputButtonUrl, name);
}

function outputRackStyle(name: "output_rack"): CSSProperties {
  return atlasRegionStyle(OUTPUT_RACK_ATLAS, outputRackUrl, name);
}

function iconForOption(option: RouteSwitchOption): string {
  switch (option.kind) {
    case "door":
      return "icon_door";
    case "puzzle":
      return "icon_terminal";
    case "robot":
      return "icon_robot";
    default:
      return "icon_gate";
  }
}

// Pointer fans across the top arc; each output is a gauge tick, standby = 0deg.
function angleForOption(option: RouteSwitchOption, outputs: RouteSwitchOption[]): number {
  if (option.isIdle) return 0;
  const count = outputs.length;
  const j = outputs.findIndex((candidate) => candidate.stateId === option.stateId);
  if (count <= 1 || j < 0) return 0;
  const step = Math.min(50, 120 / (count - 1));
  return (j - (count - 1) / 2) * step;
}

export function RouteSwitchOverlay({ world }: RouteSwitchOverlayProps) {
  const snapshot = usePolledSnapshot(() => readRouteSwitch(world), 80, sameSnapshot);
  const view = snapshot.view;
  const en = snapshot.language === "en";

  const outputs = useMemo(() => (view ? view.options.filter((option) => !option.isIdle).slice(0, 4) : []), [view]);

  const [phase, setPhase] = useState<Phase>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pointerAngle, setPointerAngle] = useState(0);
  const timers = useRef<number[]>([]);

  // Denied-click feedback: tracks which plate was last denied + a nonce so
  // re-clicking the same plate re-triggers. Both cleared after the animation.
  const [deniedStateId, setDeniedStateId] = useState<string | null>(null);
  const [deniedNonce, setDeniedNonce] = useState(0);

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);

  // Reset to the current routing whenever the panel (re)opens.
  useEffect(() => {
    if (!snapshot.visible || !view) return;
    releaseDesktopPointerLock();
    setPhase("select");
    setSelectedId(null);
    setDeniedStateId(null);
    setDeniedNonce(0);
    const current = view.options.find((option) => option.stateId === view.currentStateId) ?? null;
    setPointerAngle(current ? angleForOption(current, view.options.filter((o) => !o.isIdle).slice(0, 4)) : 0);
    return clearTimers;
  }, [snapshot.visible, view?.switchId]);

  const close = useCallback(() => {
    clearTimers();
    world.closeRouteSwitch();
    requestDesktopPointerLock();
  }, [world, clearTimers]);

  useEffect(() => {
    if (!snapshot.visible) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && phase === "select") {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [snapshot.visible, phase, close]);

  const choose = useCallback(
    (option: RouteSwitchOption) => {
      if (!view || phase !== "select") return;
      if (!option.hasKey) {
        // Unauthorized: brief warning via world, no switch.
        world.chooseRouteSwitchState(view.switchId, option.stateId);
        // Trigger overlay-local denied animation on the clicked plate + key lens.
        setDeniedStateId(option.stateId);
        setDeniedNonce((n) => n + 1);
        const tDenied = window.setTimeout(() => {
          setDeniedStateId(null);
        }, 520);
        timers.current.push(tDenied);
        return;
      }
      // Authorized: re-acquire pointer lock now (inside the click gesture) so the
      // 3D reveal and resumed gameplay keep it once the 2D panel drops.
      requestDesktopPointerLock();
      setSelectedId(option.stateId);
      setPhase("rotating");
      setPointerAngle(angleForOption(option, outputs));
      const switchId = view.switchId;
      const t1 = window.setTimeout(() => {
        const committed = world.chooseRouteSwitchState(switchId, option.stateId);
        clearTimers();
        if (committed) {
          // The chosen output already started the 3D target reveal; drop the 2D
          // panel immediately instead of holding it for seconds over the reveal.
          if (world.session.mode === "routeSwitch") world.closeRouteSwitch();
        } else {
          setPhase("select");
        }
      }, ROTATE_MS);
      timers.current.push(t1);
    },
    [view, phase, outputs, world, clearTimers],
  );

  if (!snapshot.visible || !view) return null;

  const authorizedCount = outputs.filter((option) => option.hasKey).length;
  const locked = authorizedCount === 0;
  const partial = authorizedCount > 0 && authorizedCount < outputs.length;
  const keyDenied = Boolean(deniedStateId);
  const authText = locked ? (en ? "AUTHORIZATION REQUIRED" : "缺少授权") : partial ? (en ? "PARTIAL AUTH" : "部分授权") : en ? "AUTHORIZED" : "已授权";

  return (
    <section
      className="route-switch-overlay"
      style={{ "--route-switch-bg": `url("${backgroundUrl}")`, "--rs-rotate-ms": `${ROTATE_MS}ms` } as CSSProperties}
      aria-label={view.label}
      onClick={(event) => {
        if (event.target === event.currentTarget && phase === "select") close();
      }}
    >
      <div className={`route-switch-panel${locked ? " is-locked" : " is-live"}`} data-no-pointer-lock="true">
        <i className="route-switch-corner tl" style={regionStyle("frame_corner_tl")} aria-hidden="true" />
        <i className="route-switch-corner tr" style={regionStyle("frame_corner_tr")} aria-hidden="true" />
        <i className="route-switch-corner bl" style={regionStyle("frame_corner_bl")} aria-hidden="true" />
        <i className="route-switch-corner br" style={regionStyle("frame_corner_br")} aria-hidden="true" />

        {phase === "select" ? (
          <button type="button" className="route-switch-close" onClick={close} aria-label={en ? "Close" : "关闭"}>
            ×
          </button>
        ) : null}

        <header className="route-switch-head">
          <span className="route-switch-sr-only">{view.label}</span>
          <div
            className={`route-switch-key${locked || keyDenied ? " locked" : " authorized"}${keyDenied ? " is-denied" : ""}`}
            data-denied-nonce={keyDenied ? deniedNonce : undefined}
            aria-label={authText}
          >
            <i
              className="route-switch-auth-mark"
              style={iconStyle(keyDenied ? "auth_denied" : locked ? "auth_locked" : "auth_authorized")}
              aria-hidden="true"
            />
            <span className="route-switch-sr-only">{authText}</span>
          </div>
        </header>

        <div className="route-switch-stage">
          <div className="route-switch-dial" aria-hidden="true">
            <i className="route-switch-ring" style={regionStyle("dial_ring")} />
            <i className="route-switch-hub" style={regionStyle("dial_hub")} />
            <i
              className={`route-switch-pointer${phase === "rotating" ? " spinning" : ""}`}
              style={{ ...regionStyle("dial_pointer_cyan"), transform: `translate(-50%, -100%) rotate(${pointerAngle}deg)` }}
            />
            <i className="route-switch-scan" style={regionStyle("scanline_strip")} />
          </div>
        </div>

        {/* Console front face: image2 mechanical output buttons mounted into
            the route panel; labels stay runtime text for i18n/accessibility. */}
        <div className="route-switch-deck" data-output-count={outputs.length} role="group" aria-label={en ? "Route outputs" : "路由输出"}>
          <i className="route-switch-deck-rail" style={regionStyle("brass_bracket")} aria-hidden="true" />
          <div className="route-switch-outputs">
            <i className="route-switch-output-rack" style={outputRackStyle("output_rack")} aria-hidden="true" />
            {outputs.map((option, index) => {
              const isSelected = selectedId === option.stateId || view.currentStateId === option.stateId;
              const isRotating = phase === "rotating" && selectedId === option.stateId;
              const optionLocked = !option.hasKey;
              const isDimmed = optionLocked || (phase !== "select" && !isSelected);
              const buttonRegion: OutputButtonRegion = optionLocked ? "button_disabled" : isSelected ? "button_selected" : "button_enabled";
              return (
                <button
                  key={option.stateId}
                  type="button"
                  className={`route-switch-plate kind-${option.kind}${isSelected ? " selected" : ""}${isRotating ? " is-rotating" : ""}${optionLocked ? " locked" : ""}${isDimmed ? " is-dimmed" : ""}${optionLocked && deniedStateId === option.stateId ? " plate-denied" : ""}`}
                  data-output-index={index + 1}
                  data-denied-nonce={optionLocked && deniedStateId === option.stateId ? deniedNonce : undefined}
                  disabled={phase !== "select"}
                  onClick={() => choose(option)}
                  aria-label={option.label}
                  aria-pressed={isSelected}
                >
                  {isRotating ? (
                    ROTATING_BUTTON_REGIONS.map((region, frameIndex) => (
                      <i
                        key={region}
                        className={`plate-rotating-frame frame-${frameIndex}`}
                        style={outputButtonStyle(region)}
                        aria-hidden="true"
                      />
                    ))
                  ) : (
                    <i className="plate-button-shell" style={outputButtonStyle(buttonRegion)} aria-hidden="true" />
                  )}
                  <i className="plate-status-dot" aria-hidden="true" />
                  <i className="plate-kind-icon" style={iconStyle(iconForOption(option))} aria-hidden="true" />
                  <span className="plate-label route-switch-sr-only">{option.label}</span>
                  {option.detail ? <span className="plate-detail">{option.detail}</span> : null}
                </button>
              );
            })}
          </div>
          <i className="route-switch-skirt" style={regionStyle("hazard_skirt")} aria-hidden="true" />
        </div>

        <footer className="route-switch-foot">
          <i className="route-switch-foot-icon" style={iconStyle(locked ? "auth_locked" : "footer_branch")} aria-hidden="true" />
          <span className="route-switch-sr-only">{locked ? (en ? "KEY REQUIRED" : "需要钥匙") : en ? "SELECT OUTPUT BAY" : "选择输出"}</span>
        </footer>
      </div>
    </section>
  );
}

function readRouteSwitch(world: GameWorld): RouteSwitchSnapshot {
  const visible = world.session.mode === "routeSwitch";
  return {
    visible,
    view: visible ? world.activeRouteSwitchView() : null,
    language: world.settings.language,
  };
}

function sameSnapshot(current: RouteSwitchSnapshot, next: RouteSwitchSnapshot) {
  return (
    current.visible === next.visible &&
    current.view?.switchId === next.view?.switchId &&
    current.view?.hasKey === next.view?.hasKey &&
    current.view?.currentStateId === next.view?.currentStateId &&
    current.view?.options.length === next.view?.options.length &&
    optionAuthSignature(current.view) === optionAuthSignature(next.view) &&
    current.language === next.language
  );
}

function optionAuthSignature(view: RouteSwitchView | null) {
  return view?.options.map((option) => `${option.stateId}:${option.hasKey ? "1" : "0"}`).join("|") ?? "";
}
