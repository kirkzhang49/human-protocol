// Dev-only preview harness for the route-switch overlay so its diegetic-machine
// composition can be screenshotted in isolation (locked vs authorized) without
// driving a full level. Mounts the REAL <RouteSwitchOverlay/> against a minimal
// mock world that exposes only what the overlay reads. Never imported by the app
// build (reached solely via /route-overlay-preview.html in the dev server).
import { createRoot } from "react-dom/client";
import "../styles/mobile.css";
import "../styles/overlays.css";
import { RouteSwitchOverlay } from "../ui/RouteSwitchOverlay";
import type { GameWorld, RouteSwitchView } from "../game/core/GameWorld";

const params = new URLSearchParams(window.location.search);
const previewState = params.get("state") ?? "authorized";
const authorized = previewState === "authorized" || previewState === "rotating";
const autoRotate = previewState === "rotating";
const outputCount = Math.min(4, Math.max(1, Number(params.get("outputs") ?? 4) || 4));

const outputOptions = [
  { stateId: "o_door", index: 1, isIdle: false, kind: "door" as const, label: "开启档案门", detail: "" },
  { stateId: "o_puzzle", index: 2, isIdle: false, kind: "puzzle" as const, label: "接入终端", detail: "" },
  { stateId: "o_robot", index: 3, isIdle: false, kind: "robot" as const, label: "唤醒守卫", detail: "" },
  { stateId: "o_gate", index: 4, isIdle: false, kind: "door" as const, label: "回收闸", detail: "" },
].slice(0, outputCount).map((option) => ({
  ...option,
  requiredKeyItemId: `route_demo_output_${option.index}_orb`,
  hasKey: authorized,
}));

const view: RouteSwitchView = {
  switchId: "route_demo",
  label: authorized ? "档案路由台 · ARCHIVE ROUTING" : "档案路由台 · ARCHIVE ROUTING",
  hasKey: authorized,
  currentStateId: "standby",
  options: [
    { stateId: "standby", index: 0, isIdle: true, kind: "standby", label: "待机", detail: "", hasKey: true },
    ...outputOptions,
  ],
};

const world = {
  session: { mode: "routeSwitch" as const },
  settings: { language: "zh" as const },
  activeRouteSwitchView: () => view,
  closeRouteSwitch: () => {},
  chooseRouteSwitchState: () => false,
} as unknown as GameWorld;

createRoot(document.getElementById("root")!).render(<RouteSwitchOverlay world={world} />);

if (autoRotate) {
  window.setTimeout(() => {
    document.querySelector<HTMLButtonElement>(".route-switch-plate:not(:disabled)")?.click();
  }, 180);
}
