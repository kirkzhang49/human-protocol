import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { PwaPrompt } from "./ui/PwaPrompt";
import { registerHumanProtocolPwa } from "./pwa/registerHumanProtocolPwa";
import "./styles/builder.css";
import "./styles/cockpit.css";
import "./styles/desktop.css";
import "./styles/dialogue.css";
import "./styles/global.css";
import "./styles/hud.css";
// Order matters: mobile.css must stay imported BEFORE overlays.css so that
// mobile overrides keyed off `.X-overlay` ancestors out-specify the single-class
// overlays.css rules (equal specificity would otherwise lose on source order).
import "./styles/mobile.css";
import "./styles/overlays.css";
import "./styles/render-surge.css";
import "./styles/retention.css";
import "./styles/root-menu.css";
import "./styles/steam-gui.css";
import "./styles/gui-math.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
    <PwaPrompt />
  </React.StrictMode>,
);

registerHumanProtocolPwa();
